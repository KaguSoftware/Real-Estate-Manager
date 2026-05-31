-- =============================================================================
-- 0007_rental_kira.sql — Turkish residential lease (konut kira sözleşmesi) fields
--
-- Extends public.leases with the structured data the kira-sözleşmesi PDF needs:
-- a guarantor (kefil) party, payment details, per-utility responsibility,
-- subletting flag, rent-increase note, demirbaş (inventory) list, condition
-- notes and free-text special conditions.
--
-- Run after 0001_init.sql. Idempotent — safe to re-run. No new RLS needed; the
-- existing leases policies and uniq_active_lease_per_property index still apply.
-- =============================================================================

ALTER TABLE public.leases
  ADD COLUMN IF NOT EXISTS guarantor_id        UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_day         INT,            -- due day of month (1–28)
  ADD COLUMN IF NOT EXISTS payment_method      TEXT,           -- e.g. "Banka havalesi"
  ADD COLUMN IF NOT EXISTS bank_account        TEXT,           -- IBAN / account
  -- utility responsibilities: 'tenant' | 'landlord' | 'shared'
  ADD COLUMN IF NOT EXISTS util_electricity    TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS util_water          TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS util_gas            TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS util_internet       TEXT NOT NULL DEFAULT 'tenant',
  ADD COLUMN IF NOT EXISTS util_aidat          TEXT NOT NULL DEFAULT 'tenant',  -- building maintenance fee
  ADD COLUMN IF NOT EXISTS subletting_allowed  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rent_increase_note  TEXT,           -- optional override; default TBK clause used otherwise
  ADD COLUMN IF NOT EXISTS inventory           JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{item, qty, note}]
  ADD COLUMN IF NOT EXISTS condition_notes     TEXT,           -- existing defects / damage
  ADD COLUMN IF NOT EXISTS special_conditions  TEXT;

-- Constrain the utility-responsibility columns to the allowed set.
DO $$
BEGIN
  ALTER TABLE public.leases
    ADD CONSTRAINT leases_util_resp_chk CHECK (
      util_electricity IN ('tenant','landlord','shared') AND
      util_water       IN ('tenant','landlord','shared') AND
      util_gas         IN ('tenant','landlord','shared') AND
      util_internet    IN ('tenant','landlord','shared') AND
      util_aidat       IN ('tenant','landlord','shared')
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- already added on a prior run
END $$;

CREATE INDEX IF NOT EXISTS idx_leases_guarantor ON public.leases(guarantor_id);
