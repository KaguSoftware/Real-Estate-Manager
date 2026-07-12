-- =============================================================================
-- 0022_invite_fixes.sql — accept_invite UX fixes
--
-- 1. Joining a team you're ALREADY a member of is a no-op success (idempotent:
--    double-clicking an email link or replaying the pending-invite cookie no
--    longer throws "you already belong to a team").
-- 2. Distinct, machine-readable error tokens so the client can show a helpful
--    screen instead of one uniform error:
--      invite_invalid        — unknown / revoked / expired / consumed code
--      invite_email_mismatch — email invite opened by a different account
--      already_in_team       — caller belongs to a different team
--    The email-mismatch token is only raised for otherwise-valid invites, so
--    invalid codes still leak nothing.
-- =============================================================================

-- ── Notifications: in-app invite for users who already have an account ──────
-- New type 'team_invite' + an optional href so the bell can deep-link to the
-- join URL. Inserted by the invite API with the service role (no client INSERT
-- policy exists, unchanged).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS href TEXT;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'trial_started','invite_accepted','member_joined',
  'trial_ending','trial_ended','subscription_activated','team_invite'));

CREATE OR REPLACE FUNCTION public.accept_invite(invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv           public.invites%ROWTYPE;
  caller_mail   TEXT := lower(coalesce(auth.jwt()->>'email', ''));
  existing_team UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- row lock prevents two sessions consuming one email invite concurrently
  SELECT * INTO inv FROM public.invites
  WHERE code = invite_code
  FOR UPDATE;

  IF inv.id IS NULL
     OR inv.revoked_at IS NOT NULL
     OR inv.expires_at <= now()
     OR (inv.email IS NOT NULL AND inv.accepted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'invite_invalid';
  END IF;

  SELECT team_id INTO existing_team
  FROM public.team_members WHERE user_id = auth.uid()
  LIMIT 1;

  IF existing_team IS NOT NULL THEN
    IF existing_team = inv.team_id THEN
      RETURN inv.team_id; -- already a member of this very team: no-op success
    END IF;
    RAISE EXCEPTION 'already_in_team';
  END IF;

  IF inv.email IS NOT NULL AND lower(inv.email) <> caller_mail THEN
    RAISE EXCEPTION 'invite_email_mismatch';
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
