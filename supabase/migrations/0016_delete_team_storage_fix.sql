-- =============================================================================
-- 0016_delete_team_storage_fix.sql
--
-- delete_team() failed for every owner with 42501 "permission denied for
-- table objects": on hosted Supabase storage.objects is owned by
-- supabase_storage_admin and the postgres role that owns this SECURITY
-- DEFINER function has no privileges on it, so the DELETE FROM
-- storage.objects added in 0014 aborted the whole function. (SQL-deleting
-- those rows also never removed the underlying files.)
--
-- Storage cleanup now happens in POST /api/team/delete via the storage API
-- with the service role; this function only removes the database rows
-- (everything cascades from teams).
--
-- Run after 0015_turkish_notifications_cron.sql. Idempotent.
-- =============================================================================

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

  DELETE FROM public.teams WHERE id = my_team;
END;
$$;
