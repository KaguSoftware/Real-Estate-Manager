-- =============================================================================
-- 0010_multitenant.sql — teams, invites, subscriptions: single-project SaaS
--
-- Converts the per-user (owner_id = auth.uid()) model into team-based
-- row-level isolation. FRESH START: business tables are truncated.
--
-- Design notes:
--  * One team per user, enforced by UNIQUE(team_members.user_id).
--  * Business rows carry team_id; every member of that team can read them.
--    Writes additionally require team_is_writable() — the trial/paywall lock.
--  * Team creation / invite acceptance / member removal happen ONLY through
--    SECURITY DEFINER RPCs (they run as the table owner and therefore bypass
--    RLS — which is also why tables use ENABLE, not FORCE, row level security).
--  * Helpers pin search_path and are wrapped as (SELECT fn(...)) in policies
--    so Postgres evaluates them once per statement, not per row.
--
-- Run after 0009. Idempotent: safe to re-run.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- 1. TEAMS / MEMBERSHIP / INVITES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  owner_id      UUID NOT NULL REFERENCES public.profiles(id),
  trial_ends_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '14 days',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner','agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  -- one team per user, enforced by the database (no app-level race possible)
  CONSTRAINT team_members_one_team_per_user UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);

CREATE TABLE IF NOT EXISTS public.invites (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  -- email invites are single-use and bound to this address;
  -- the shareable team link is a row with email IS NULL (multi-use until rotated)
  email       TEXT,
  code        TEXT NOT NULL UNIQUE
              DEFAULT translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_'),
  role        TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent')),
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '7 days',
  accepted_by UUID REFERENCES public.profiles(id),
  accepted_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invites_team ON public.invites(team_id);

-- =============================================================================
-- 2. PLANS / SUBSCRIPTIONS / BILLING EVENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  price_monthly NUMERIC(12,2) NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'TRY',
  max_seats     INT,                      -- NULL = unlimited
  limits        JSONB NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.plans (id, name, price_monthly, currency, max_seats, limits) VALUES
  ('starter', 'Takip',         3000, 'TRY', NULL, '{}'),
  ('pro',     'Takip + Belge', 5000, 'TRY', NULL, '{"documents": true}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id                  UUID NOT NULL UNIQUE REFERENCES public.teams(id) ON DELETE CASCADE,
  plan_id                  TEXT REFERENCES public.plans(id),
  status                   TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (status IN ('trialing','active','past_due','canceled')),
  provider                 TEXT,          -- 'iyzico' | 'mock'
  provider_subscription_id TEXT,
  current_period_end       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Webhook idempotency ledger: a provider event is applied at most once.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider_event_id TEXT NOT NULL UNIQUE,
  team_id           UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  type              TEXT NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}',
  processed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_teams_updated_at ON public.teams;
CREATE TRIGGER trg_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. SECURITY DEFINER HELPERS
-- =============================================================================

-- The caller's team (NULL when they haven't joined one yet).
CREATE OR REPLACE FUNCTION public.user_team_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT team_id FROM public.team_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(t UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT t IS NOT NULL AND t = public.user_team_id();
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(t UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = t AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- Are two users in the same team? (used to let members read teammates' profiles)
CREATE OR REPLACE FUNCTION public.is_teammate(other UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = other AND team_id = public.user_team_id()
  );
$$;

-- The trial / paywall lock. Reads are never blocked; INSERT/UPDATE/DELETE
-- policies call this. Writable while: trial running, subscription active
-- (or trialing), or past_due within a 7-day grace window.
CREATE OR REPLACE FUNCTION public.team_is_writable(t UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = t AND trial_ends_at > now())
      OR EXISTS (
           SELECT 1 FROM public.subscriptions s
           WHERE s.team_id = t
             AND ( s.status = 'active'
                OR (s.status = 'past_due'
                    AND s.current_period_end + INTERVAL '7 days' > now()) )
         );
$$;

-- =============================================================================
-- 4. BUSINESS TABLES → TEAM SCOPE (fresh start: data cleared)
-- =============================================================================
TRUNCATE public.payments, public.leases, public.sales, public.property_images,
         public.properties, public.tenants, public.leads;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties','tenants','leases','payments','sales','leads','property_images']
  LOOP
    -- owner_id → created_by: informational only, must not cascade-delete team data
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = t AND column_name = 'owner_id') THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN owner_id TO created_by', t);
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN created_by DROP NOT NULL', t);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_owner_id_fkey');
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (created_by)
                      REFERENCES public.profiles(id) ON DELETE SET NULL', t, t || '_created_by_fkey');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = t AND column_name = 'team_id') THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN team_id UUID NOT NULL
                      REFERENCES public.teams(id) ON DELETE CASCADE', t);
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_team ON public.%I(team_id)', t, t);
  END LOOP;
END $$;

-- All money in the product is Turkish Lira.
ALTER TABLE public.sales ALTER COLUMN currency SET DEFAULT 'TRY';

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_properties_team_assigned ON public.properties(team_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_team_assigned      ON public.leads(team_id, assigned_to);

-- ── Same-team referential integrity ─────────────────────────────────────────
-- RLS alone can't stop a row from referencing a parent in ANOTHER team (the
-- child row itself passes WITH CHECK). This trigger closes that hole.
CREATE OR REPLACE FUNCTION public.assert_same_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_team UUID;
BEGIN
  IF TG_TABLE_NAME IN ('leases','sales','property_images') THEN
    SELECT team_id INTO parent_team FROM public.properties WHERE id = NEW.property_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'property belongs to a different team';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'leases' THEN
    SELECT team_id INTO parent_team FROM public.tenants WHERE id = NEW.tenant_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'tenant belongs to a different team';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'sales' THEN
    SELECT team_id INTO parent_team FROM public.tenants WHERE id = NEW.buyer_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'buyer belongs to a different team';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'payments' THEN
    SELECT team_id INTO parent_team FROM public.leases WHERE id = NEW.lease_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'lease belongs to a different team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leases_same_team ON public.leases;
CREATE TRIGGER trg_leases_same_team BEFORE INSERT OR UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_team();
DROP TRIGGER IF EXISTS trg_payments_same_team ON public.payments;
CREATE TRIGGER trg_payments_same_team BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_team();
DROP TRIGGER IF EXISTS trg_sales_same_team ON public.sales;
CREATE TRIGGER trg_sales_same_team BEFORE INSERT OR UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_team();
DROP TRIGGER IF EXISTS trg_property_images_same_team ON public.property_images;
CREATE TRIGGER trg_property_images_same_team BEFORE INSERT OR UPDATE ON public.property_images
  FOR EACH ROW EXECUTE FUNCTION public.assert_same_team();

-- =============================================================================
-- 5. RLS — business tables (uniform team pattern)
-- =============================================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['properties','tenants','leases','payments','sales','leads','property_images']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT
                    USING ((SELECT public.is_team_member(team_id)))', t || '_select', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT
                    WITH CHECK ((SELECT public.is_team_member(team_id))
                            AND (SELECT public.team_is_writable(team_id)))', t || '_insert', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE
                    USING ((SELECT public.is_team_member(team_id)))
                    WITH CHECK ((SELECT public.is_team_member(team_id))
                            AND (SELECT public.team_is_writable(team_id)))', t || '_update', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE
                    USING ((SELECT public.is_team_member(team_id))
                       AND (SELECT public.team_is_writable(team_id)))', t || '_delete', t);
  END LOOP;
END $$;

-- =============================================================================
-- 6. RLS — meta tables
-- =============================================================================
ALTER TABLE public.teams          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- teams: members read; owner may rename ONLY (trial/owner guarded by trigger).
-- No client INSERT/DELETE — team creation goes through create_team().
DROP POLICY IF EXISTS teams_select ON public.teams;
CREATE POLICY teams_select ON public.teams FOR SELECT
  USING ((SELECT public.is_team_member(id)));
DROP POLICY IF EXISTS teams_update ON public.teams;
CREATE POLICY teams_update ON public.teams FOR UPDATE
  USING ((SELECT public.is_team_owner(id)))
  WITH CHECK ((SELECT public.is_team_owner(id)));

-- Owners must not extend their own trial or reassign ownership via UPDATE.
CREATE OR REPLACE FUNCTION public.guard_team_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- service role (webhooks) and direct SQL (support) may change anything
  IF coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'role' = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
     OR NEW.owner_id   IS DISTINCT FROM OLD.owner_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'only the team name can be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_teams_guard ON public.teams;
CREATE TRIGGER trg_teams_guard BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.guard_team_update();

-- team_members: members see their team's roster; owner removes agents via RPC
-- (no direct client INSERT; DELETE allowed to owner except their own row).
DROP POLICY IF EXISTS team_members_select ON public.team_members;
CREATE POLICY team_members_select ON public.team_members FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));
DROP POLICY IF EXISTS team_members_delete ON public.team_members;
CREATE POLICY team_members_delete ON public.team_members FOR DELETE
  USING ((SELECT public.is_team_owner(team_id)) AND user_id <> auth.uid());

-- invites: owner-only. Acceptance happens through accept_invite(code) so
-- non-members can never enumerate or read invites.
DROP POLICY IF EXISTS invites_select ON public.invites;
CREATE POLICY invites_select ON public.invites FOR SELECT
  USING ((SELECT public.is_team_owner(team_id)));
DROP POLICY IF EXISTS invites_insert ON public.invites;
CREATE POLICY invites_insert ON public.invites FOR INSERT
  WITH CHECK ((SELECT public.is_team_owner(team_id)) AND created_by = auth.uid());
DROP POLICY IF EXISTS invites_update ON public.invites;
CREATE POLICY invites_update ON public.invites FOR UPDATE
  USING ((SELECT public.is_team_owner(team_id)));
DROP POLICY IF EXISTS invites_delete ON public.invites;
CREATE POLICY invites_delete ON public.invites FOR DELETE
  USING ((SELECT public.is_team_owner(team_id)));

-- plans: anyone signed in can read active plans (pricing page).
DROP POLICY IF EXISTS plans_select ON public.plans;
CREATE POLICY plans_select ON public.plans FOR SELECT
  TO authenticated USING (is_active);

-- subscriptions: members read their team's; ALL writes via service role only.
DROP POLICY IF EXISTS subscriptions_select ON public.subscriptions;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

-- billing_events: service role only (no client policies at all).

-- profiles: members may read teammates (names for assignment / roster).
DROP POLICY IF EXISTS profiles_select_teammates ON public.profiles;
CREATE POLICY profiles_select_teammates ON public.profiles FOR SELECT
  USING ((SELECT public.is_teammate(id)));

-- =============================================================================
-- 7. RPCs
-- =============================================================================

-- create_team(name) → team id. Atomic: team + owner membership + trial sub.
CREATE OR REPLACE FUNCTION public.create_team(team_name TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE new_team UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'you already belong to a team';
  END IF;

  INSERT INTO public.teams (name, owner_id)
  VALUES (trim(team_name), auth.uid())
  RETURNING id INTO new_team;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team, auth.uid(), 'owner');

  INSERT INTO public.subscriptions (team_id, status) VALUES (new_team, 'trialing');

  RETURN new_team;
END;
$$;

-- accept_invite(code) → team id. Uniform error for every failure mode so
-- invalid codes leak nothing (not even whether they exist).
CREATE OR REPLACE FUNCTION public.accept_invite(invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv         public.invites%ROWTYPE;
  caller_mail TEXT := lower(coalesce(auth.jwt()->>'email', ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'you already belong to a team';
  END IF;

  -- row lock prevents two sessions consuming one email invite concurrently
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

-- rotate_invite_link() → new code. Revokes previous link invite(s).
CREATE OR REPLACE FUNCTION public.rotate_invite_link()
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  my_team  UUID := public.user_team_id();
  new_code TEXT;
BEGIN
  IF my_team IS NULL OR NOT public.is_team_owner(my_team) THEN
    RAISE EXCEPTION 'only the team owner can manage invites';
  END IF;

  UPDATE public.invites SET revoked_at = now()
  WHERE team_id = my_team AND email IS NULL AND revoked_at IS NULL;

  INSERT INTO public.invites (team_id, email, created_by, expires_at)
  VALUES (my_team, NULL, auth.uid(), now() + INTERVAL '30 days')
  RETURNING code INTO new_code;

  RETURN new_code;
END;
$$;

-- remove_member(user) — owner only; unassigns the member's records.
CREATE OR REPLACE FUNCTION public.remove_member(member_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE my_team UUID := public.user_team_id();
BEGIN
  IF my_team IS NULL OR NOT public.is_team_owner(my_team) THEN
    RAISE EXCEPTION 'only the team owner can remove members';
  END IF;
  IF member_id = auth.uid() THEN
    RAISE EXCEPTION 'the owner cannot remove themselves';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_members
                 WHERE team_id = my_team AND user_id = member_id) THEN
    RAISE EXCEPTION 'no such member';
  END IF;

  UPDATE public.properties SET assigned_to = NULL
  WHERE team_id = my_team AND assigned_to = member_id;
  UPDATE public.leads SET assigned_to = NULL
  WHERE team_id = my_team AND assigned_to = member_id;

  DELETE FROM public.team_members
  WHERE team_id = my_team AND user_id = member_id;
END;
$$;

-- =============================================================================
-- 8. STORAGE — team-scoped paths: {team_id}/...
-- =============================================================================

-- property-images (bucket stays public for CDN reads; writes are team-scoped)
DROP POLICY IF EXISTS property_images_storage_insert ON storage.objects;
CREATE POLICY property_images_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS property_images_storage_delete ON storage.objects;
CREATE POLICY property_images_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );

-- documents (private; reads via signed URLs still require SELECT policy)
DROP POLICY IF EXISTS documents_storage_select ON storage.objects;
CREATE POLICY documents_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS documents_storage_insert ON storage.objects;
CREATE POLICY documents_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS documents_storage_update ON storage.objects;
CREATE POLICY documents_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS documents_storage_delete ON storage.objects;
CREATE POLICY documents_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
