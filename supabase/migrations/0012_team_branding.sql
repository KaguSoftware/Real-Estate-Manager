-- =============================================================================
-- 0012_team_branding.sql — team logo + PDF color palette
--
-- Adds branding columns to teams and a public `team-logos` storage bucket
-- (path convention: {team_id}/logo.{ext}, matching property-images).
-- Available to every team (incl. trial) — no plan gating.
-- Run after 0011_onboarding_notifications.sql. Idempotent.
-- =============================================================================

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_path TEXT,
  ADD COLUMN IF NOT EXISTS brand_palette TEXT NOT NULL DEFAULT 'slate';

-- Palette ids are code-defined presets (src/lib/pdf/branding.ts); keep the
-- allowed set in sync when adding presets.
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_brand_palette_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_brand_palette_check
  CHECK (brand_palette IN ('slate', 'avera', 'emerald', 'indigo', 'burgundy'));

-- ── team-logos bucket ────────────────────────────────────────────────────────
-- Public: logos are non-sensitive and both the navbar <img> and react-pdf's
-- <Image> want a plain URL (same reasoning as property-images).
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-logos', 'team-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Writes are owner-only and respect the trial/paywall lock.
DROP POLICY IF EXISTS team_logos_storage_insert ON storage.objects;
CREATE POLICY team_logos_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND public.is_team_owner(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS team_logos_storage_update ON storage.objects;
CREATE POLICY team_logos_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND public.is_team_owner(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
DROP POLICY IF EXISTS team_logos_storage_delete ON storage.objects;
CREATE POLICY team_logos_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND public.is_team_owner(((storage.foldername(name))[1])::uuid)
    AND public.team_is_writable(((storage.foldername(name))[1])::uuid)
  );
