-- =============================================================================
-- 0006_furnished.sql — furnished flag on properties
--
-- Run after 0005_leads.sql. Idempotent.
-- NULL = unknown / not specified; TRUE = furnished; FALSE = unfurnished.
-- =============================================================================

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS furnished BOOLEAN;
