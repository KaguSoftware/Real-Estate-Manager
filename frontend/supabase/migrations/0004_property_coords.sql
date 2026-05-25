-- =============================================================================
-- 0004_property_coords.sql — geocoded latitude/longitude on properties
--
-- Run after 0003_sales.sql. Idempotent.
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS latitude  NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

CREATE INDEX IF NOT EXISTS idx_properties_coords
  ON public.properties (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
