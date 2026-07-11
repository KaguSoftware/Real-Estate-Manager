-- =============================================================================
-- 0014_seats_lifecycle_hardening.sql — launch hardening
--
-- 1. Seat limits: accept_invite() now enforces plans.max_seats (was advertised
--    but never checked — any plan could add unlimited agents).
-- 2. Team lifecycle RPCs: transfer_ownership(), leave_team(), delete_team().
--    Before this there was no way for an owner to hand over or delete a team,
--    or for an agent to leave — a KVKK/GDPR erasure blocker.
-- 3. search_path pins on the 0001 SECURITY DEFINER functions (is_admin,
--    find_user_by_email, admin_set_user_role, handle_new_user) — closes the
--    classic search_path-injection footgun; 0010+ functions already do this.
-- 4. invites.created_by loosened to ON DELETE SET NULL so deleting a former
--    owner's account isn't blocked by historical invite rows.
--
-- Run after 0013_profiles_role_guard.sql. Idempotent.
-- =============================================================================

-- ── 1. Seat enforcement ──────────────────────────────────────────────────────
-- Cap = the subscribed plan's max_seats; teams still on trial (no plan yet)
-- get the most generous active plan's cap so they can evaluate the top tier
-- (NULL max_seats = unlimited).
CREATE OR REPLACE FUNCTION public.team_seat_cap(t UUID)
RETURNS INT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.team_id = t AND s.plan_id IS NOT NULL)
      THEN (SELECT p.max_seats FROM public.subscriptions s
            JOIN public.plans p ON p.id = s.plan_id
            WHERE s.team_id = t)
    WHEN EXISTS (SELECT 1 FROM public.plans p WHERE p.is_active AND p.max_seats IS NULL)
      THEN NULL
    ELSE (SELECT max(p.max_seats) FROM public.plans p WHERE p.is_active)
  END;
$$;

-- accept_invite(code) → team id. Same contract as 0010 (uniform error message
-- so invalid codes leak nothing) + the new seat check.
CREATE OR REPLACE FUNCTION public.accept_invite(invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv         public.invites%ROWTYPE;
  caller_mail TEXT := lower(coalesce(auth.jwt()->>'email', ''));
  seat_cap    INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'you already belong to a team';
  END IF;

  -- row lock prevents two sessions consuming one email invite concurrently
  -- (and racing past the seat check below)
  SELECT * INTO inv FROM public.invites
  WHERE code = invite_code
  FOR UPDATE;

  IF inv.id IS NULL
     OR inv.revoked_at IS NOT NULL
     OR inv.expires_at <= now()
     OR (inv.email IS NOT NULL AND inv.accepted_at IS NOT NULL)
     OR (inv.email IS NOT NULL AND lower(inv.email) <> caller_mail) THEN
    RAISE EXCEPTION 'invalid or expired invite';
  END IF;

  seat_cap := public.team_seat_cap(inv.team_id);
  IF seat_cap IS NOT NULL AND
     (SELECT count(*) FROM public.team_members WHERE team_id = inv.team_id) >= seat_cap THEN
    RAISE EXCEPTION 'plan seat limit reached';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (inv.team_id, auth.uid(), inv.role);

  IF inv.email IS NOT NULL THEN
    UPDATE public.invites
    SET accepted_by = auth.uid(), accepted_at = now()
    WHERE id = inv.id;
  END IF;

  RETURN inv.team_id;
END;
$$;

-- ── 2. Team lifecycle RPCs ───────────────────────────────────────────────────

-- transfer_ownership(new_owner) — current owner hands the team to a member.
-- The demote/promote order matters if a unique-owner index ever exists; the
-- guard trigger permits owner_id changes here because SECURITY DEFINER runs
-- as the function owner (postgres).
CREATE OR REPLACE FUNCTION public.transfer_ownership(new_owner UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE my_team UUID := public.user_team_id();
BEGIN
  IF my_team IS NULL OR NOT public.is_team_owner(my_team) THEN
    RAISE EXCEPTION 'only the team owner can transfer ownership';
  END IF;
  IF new_owner = auth.uid() THEN
    RAISE EXCEPTION 'you already own this team';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members
                 WHERE team_id = my_team AND user_id = new_owner) THEN
    RAISE EXCEPTION 'no such member';
  END IF;

  UPDATE public.team_members SET role = 'agent'
  WHERE team_id = my_team AND user_id = auth.uid();
  UPDATE public.team_members SET role = 'owner'
  WHERE team_id = my_team AND user_id = new_owner;
  UPDATE public.teams SET owner_id = new_owner WHERE id = my_team;
END;
$$;

-- leave_team() — an agent removes themself (owners must transfer first).
-- Mirrors remove_member(): unassign records, then drop the membership row.
CREATE OR REPLACE FUNCTION public.leave_team()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE my_team UUID := public.user_team_id();
BEGIN
  IF my_team IS NULL THEN
    RAISE EXCEPTION 'you are not in a team';
  END IF;
  IF public.is_team_owner(my_team) THEN
    RAISE EXCEPTION 'transfer ownership or delete the team first';
  END IF;

  UPDATE public.properties SET assigned_to = NULL
  WHERE team_id = my_team AND assigned_to = auth.uid();
  UPDATE public.leads SET assigned_to = NULL
  WHERE team_id = my_team AND assigned_to = auth.uid();

  DELETE FROM public.team_members
  WHERE team_id = my_team AND user_id = auth.uid();
END;
$$;

-- delete_team(confirmation) — owner-only, irreversible. Every dependent table
-- references teams with ON DELETE CASCADE (business tables, team_members,
-- invites, subscriptions, notifications; billing_events keeps its ledger rows
-- with team_id nulled). Storage objects under {team_id}/ are removed from all
-- three buckets so the files stop being served immediately.
CREATE OR REPLACE FUNCTION public.delete_team(confirmation TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE my_team UUID := public.user_team_id();
BEGIN
  IF my_team IS NULL OR NOT public.is_team_owner(my_team) THEN
    RAISE EXCEPTION 'only the team owner can delete the team';
  END IF;
  IF confirmation IS DISTINCT FROM 'DELETE' THEN
    RAISE EXCEPTION 'confirmation mismatch';
  END IF;

  DELETE FROM storage.objects
  WHERE bucket_id IN ('property-images', 'documents', 'team-logos')
    AND (storage.foldername(name))[1] = my_team::text;

  DELETE FROM public.teams WHERE id = my_team;
END;
$$;

-- ── 3. search_path pins on 0001 SECURITY DEFINER functions ──────────────────
-- Same bodies as 0001 (already schema-qualified), now immune to search_path
-- hijacking. CREATE OR REPLACE keeps the OIDs, so RLS policies using
-- is_admin() are unaffected.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND app_role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email TEXT)
RETURNS TABLE (id UUID, email TEXT)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id UUID,
  new_role       TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: caller is not an admin';
  END IF;

  IF new_role NOT IN ('admin', 'member', 'client') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, member, or client', new_role;
  END IF;

  UPDATE public.profiles
  SET app_role = new_role
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', target_user_id;
  END IF;
END;
$$;

-- ── 4. invites.created_by: allow deleting the creator's account ─────────────
ALTER TABLE public.invites ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS invites_created_by_fkey;
ALTER TABLE public.invites ADD CONSTRAINT invites_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
