-- =============================================================================
-- 0024_invite_hardening.sql — invite acceptance robustness
--
-- Consolidates accept_invite into a single authoritative definition and fixes a
-- class of "Davet kodu geçersiz veya süresi dolmuş" failures on *valid* codes:
--
-- 1. Whitespace-tolerant matching. Codes arriving via the /join/[code] cookie or
--    copy-paste can carry a trailing newline/space; the previous exact
--    `WHERE code = invite_code` treated those as a miss and raised invite_invalid.
--    Both accept_invite and invite_team_name now match on trim(code).
-- 2. Migration drift. accept_invite was redefined in 0010 → 0014 (added the
--    plans.max_seats cap) → 0022 (idempotent re-join + distinct error tokens, but
--    dropped the seat cap). This restores the 0022 UX *and* the 0014 seat check in
--    one place so no environment is left on a stale mix.
--
-- Idempotent / safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.accept_invite(invite_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv           public.invites%ROWTYPE;
  caller_mail   TEXT := lower(coalesce(auth.jwt()->>'email', ''));
  existing_team UUID;
  seat_cap      INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- row lock prevents two sessions consuming one email invite concurrently
  -- (and racing past the seat check below)
  SELECT * INTO inv FROM public.invites
  WHERE code = trim(invite_code)
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

-- invite_team_name(code) — team name for a live invite code (pre-auth banner).
-- Same whitespace tolerance as accept_invite.
CREATE OR REPLACE FUNCTION public.invite_team_name(invite_code TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT t.name
  FROM public.invites i
  JOIN public.teams t ON t.id = i.team_id
  WHERE i.code = trim(invite_code)
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND (i.email IS NULL OR i.accepted_at IS NULL)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.invite_team_name(TEXT) TO anon, authenticated;
