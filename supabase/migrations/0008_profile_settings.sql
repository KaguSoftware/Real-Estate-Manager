-- Per-user app settings (e.g. attention-panel thresholds), stored as JSONB on
-- profiles. RLS from 0001 already scopes select/update to the owning user
-- (profiles_select_own_or_admin / profiles_update_own).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';
