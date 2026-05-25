-- =============================================================================
-- 0003_sales.sql — sales agreements + property title-deed fields
--
-- Run after 0001_init.sql and 0002_property_images.sql. Idempotent.
-- =============================================================================

-- ── Title-deed columns on properties (optional; rental ignores them) ─────────
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS nitelik   TEXT,
  ADD COLUMN IF NOT EXISTS ada_no    TEXT,
  ADD COLUMN IF NOT EXISTS parsel_no TEXT,
  ADD COLUMN IF NOT EXISTS mahalle   TEXT,
  ADD COLUMN IF NOT EXISTS mevkii    TEXT;

-- ── sales ────────────────────────────────────────────────────────────────────
-- Buyers reuse public.tenants (schema identical: name/email/phone/national_id).
CREATE TABLE IF NOT EXISTS public.sales (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id                 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id              UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  buyer_id                 UUID NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  sale_price               NUMERIC(14,2) NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  sale_date                DATE NOT NULL,
  target_close_date        DATE,
  deposit_amount           NUMERIC(14,2),
  penalty_amount           NUMERIC(14,2),
  validity_days            INT,
  tax_responsibility       TEXT NOT NULL DEFAULT 'legal'
                           CHECK (tax_responsibility IN ('buyer','seller','legal')),
  buyer_commission_rate    NUMERIC(5,2),     -- e.g. 2.00 = 2 %
  seller_commission_rate   NUMERIC(5,2),
  special_conditions       TEXT,
  status                   TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','closed','cancelled')),
  document_pdf_path        TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_owner    ON public.sales(owner_id);
CREATE INDEX IF NOT EXISTS idx_sales_property ON public.sales(property_id);
CREATE INDEX IF NOT EXISTS idx_sales_buyer    ON public.sales(buyer_id);

-- One active sale per property at a time (closed/cancelled don't block).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_sale_per_property
  ON public.sales(property_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_select ON public.sales;
CREATE POLICY sales_select ON public.sales FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS sales_insert ON public.sales;
CREATE POLICY sales_insert ON public.sales FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS sales_update ON public.sales;
CREATE POLICY sales_update ON public.sales FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS sales_delete ON public.sales;
CREATE POLICY sales_delete ON public.sales FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());
