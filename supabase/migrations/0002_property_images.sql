-- =============================================================================
-- 0002_property_images.sql — property image gallery
--
-- Adds the property_images table + the property-images storage bucket with RLS.
-- Run after 0001_init.sql. Idempotent.
-- =============================================================================

-- ── property_images ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_images (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,            -- path inside the property-images bucket
  position     INT  NOT NULL DEFAULT 0,  -- ordering; lowest = featured/hero
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_property_images_property
  ON public.property_images(property_id, position);

ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS property_images_select ON public.property_images;
CREATE POLICY property_images_select ON public.property_images FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS property_images_insert ON public.property_images;
CREATE POLICY property_images_insert ON public.property_images FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS property_images_update ON public.property_images;
CREATE POLICY property_images_update ON public.property_images FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS property_images_delete ON public.property_images;
CREATE POLICY property_images_delete ON public.property_images FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());

-- ── Storage bucket + RLS ─────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can read (bucket is public; we use getPublicUrl for CDN delivery).
-- Authenticated users can write to paths prefixed with their own user id only:
--   path convention: {user_id}/{property_id}/{uuid}.{ext}
DROP POLICY IF EXISTS property_images_storage_insert ON storage.objects;
CREATE POLICY property_images_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS property_images_storage_delete ON storage.objects;
CREATE POLICY property_images_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
