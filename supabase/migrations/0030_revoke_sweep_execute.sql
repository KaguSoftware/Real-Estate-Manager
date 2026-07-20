-- =============================================================================
-- 0030_revoke_sweep_execute.sql — actually lock the cron sweeps down
--
-- 0015 and 0029 each ran:
--     REVOKE EXECUTE ON FUNCTION ... FROM anon, authenticated;
--
-- which does NOT work on its own. Postgres grants EXECUTE to PUBLIC by default
-- when a function is created, and `anon` / `authenticated` inherit it through
-- that PUBLIC grant — revoking the roles individually leaves the PUBLIC grant
-- untouched, so the functions stayed callable with the public anon key.
--
-- Verified before this migration: calling run_work_checks() and
-- run_trial_checks() through the anon key both succeeded. They are
-- SECURITY DEFINER, so that let anyone spam notification inserts and force
-- repeated full-table sweeps.
--
-- The fix is to revoke from PUBLIC first, then re-grant only to service_role
-- (the key the Vercel cron route uses).
--
-- Run after 0029_work_notifications.sql. Idempotent: safe to re-run.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.run_work_checks()  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.run_trial_checks() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_trial_notifications_for(UUID)
  FROM PUBLIC, anon, authenticated;

-- Only the service role (the cron route) may sweep.
GRANT EXECUTE ON FUNCTION public.run_work_checks()  TO service_role;
GRANT EXECUTE ON FUNCTION public.run_trial_checks() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_trial_notifications_for(UUID) TO service_role;

-- check_trial_notifications() is deliberately left callable by signed-in users:
-- it is scoped to the caller's own team via user_team_id() and the app invokes
-- it on load (see checkTrialNotifications in src/lib/db/notifications.ts).
