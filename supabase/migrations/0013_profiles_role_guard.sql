-- =============================================================================
-- 0013_profiles_role_guard.sql — close a privilege-escalation hole on profiles
--
-- profiles_update_own (0001) had a USING clause but no WITH CHECK, and app_role
-- ('admin' | 'member' | 'client') lives on the same table with no column guard.
-- An authenticated user could therefore run, through PostgREST with the anon key:
--     update profiles set app_role = 'admin' where id = auth.uid();
-- and is_admin() would then grant them cross-team read/write via the admin
-- override policies on properties/tenants/leases/payments/leads.
--
-- Fix (mirrors guard_team_update in 0010 / guard_notification_update in 0011):
-- a BEFORE UPDATE trigger that pins app_role, id, email and created_at for
-- normal callers. Role changes go only through the SECURITY DEFINER
-- admin_set_user_role RPC, and service_role / direct SQL keep full control.
-- Run after 0012. Idempotent.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.guard_profiles_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- service role (RPCs/webhooks) and direct SQL (support) may change anything.
  IF coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'role' = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.app_role   IS DISTINCT FROM OLD.app_role
     OR NEW.id      IS DISTINCT FROM OLD.id
     OR NEW.email   IS DISTINCT FROM OLD.email
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'app_role and identity columns cannot be changed directly';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard ON public.profiles;
CREATE TRIGGER trg_profiles_guard BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profiles_update();

-- ── find_user_by_email: close the email-enumeration primitive ────────────────
-- SECURITY DEFINER, so it returns {id,email} for any exact email match bypassing
-- profiles RLS — an account-enumeration tool. It has no app callers, so revoke
-- execute from client roles entirely (service_role keeps access for server use).
REVOKE EXECUTE ON FUNCTION public.find_user_by_email(TEXT) FROM PUBLIC, anon, authenticated;

-- Defense in depth: give the UPDATE policy an explicit WITH CHECK so a user can
-- only ever write their own row (the trigger handles column-level protection).
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
