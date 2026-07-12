-- =============================================================================
-- 0020_user_avatars.sql — user profile pictures
--
-- Adds profiles.avatar_path and a public `avatars` storage bucket
-- (path convention: {user_id}/avatar-{ts}.{ext}, matching team-logos).
-- Writes are self-only; avatars are non-sensitive so the bucket is public
-- for plain <img> URLs (same reasoning as team-logos).
-- Run after 0019_atomic_document_records.sql. Idempotent.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_path TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS avatars_storage_insert ON storage.objects;
CREATE POLICY avatars_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_storage_update ON storage.objects;
CREATE POLICY avatars_storage_update
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_storage_delete ON storage.objects;
CREATE POLICY avatars_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
