-- =============================================================================
-- 0006_real_estate.sql — Real Estate rehaul
--
-- Drops the obsolete document-builder schema (documents, document_access,
-- access_requests + related RPCs) and replaces it with four new relational
-- tables: properties, tenants, leases, payments. RLS is owner-only with an
-- admin override. Idempotent where it matters; one-shot rehaul migration.
-- =============================================================================

-- ── 1. DROP OBSOLETE DOCUMENT-BUILDER SCHEMA ─────────────────────────────────
DROP TABLE IF EXISTS public.access_requests   CASCADE;
DROP TABLE IF EXISTS public.document_access   CASCADE;
DROP TABLE IF EXISTS public.documents         CASCADE;

DROP FUNCTION IF EXISTS public.get_my_role(uuid);
DROP FUNCTION IF EXISTS public.list_pending_requests_for_document(uuid);
DROP FUNCTION IF EXISTS public.list_all_pending_requests();
DROP FUNCTION IF EXISTS public.request_editor_access(uuid, text);
DROP FUNCTION IF EXISTS public.get_my_request_status(uuid);
DROP FUNCTION IF EXISTS public.review_access_request(uuid, text);
DROP FUNCTION IF EXISTS public.list_shareable_users();
DROP FUNCTION IF EXISTS public.get_profiles_for_users(uuid[]);
-- Keep: is_admin(), find_user_by_email(), admin_set_user_role(), set_updated_at()

-- ── 2. PROPERTIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  homeowner_name  TEXT NOT NULL,
  address_line    TEXT NOT NULL,
  city            TEXT,
  size_sqm        NUMERIC(10,2),
  bedrooms        INT,
  bathrooms       INT,
  listing_type    TEXT NOT NULL CHECK (listing_type IN ('for_rent','for_sale')),
  status          TEXT NOT NULL DEFAULT 'vacant'
                  CHECK (status IN ('vacant','occupied','sold')),
  list_price      NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'USD',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_properties_owner  ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(owner_id, status);

-- ── 3. TENANTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  national_id     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON public.tenants(owner_id);

-- ── 4. LEASES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leases (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id       UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id         UUID NOT NULL REFERENCES public.tenants(id)    ON DELETE CASCADE,
  term              TEXT NOT NULL CHECK (term IN ('1yr','2yr','undefined')),
  start_date        DATE NOT NULL,
  end_date          DATE,
  monthly_rent      NUMERIC(12,2) NOT NULL,
  deposit           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'USD',
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','ended','terminated')),
  document_pdf_path TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leases_owner  ON public.leases(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_prop   ON public.leases(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON public.leases(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lease_per_property
  ON public.leases(property_id) WHERE status = 'active';

-- ── 5. PAYMENTS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lease_id      UUID NOT NULL REFERENCES public.leases(id)   ON DELETE CASCADE,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  amount_due    NUMERIC(12,2) NOT NULL,
  amount_paid   NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_at       TIMESTAMPTZ,
  method        TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_owner ON public.payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_lease ON public.payments(lease_id);

-- ── 6. updated_at TRIGGERS (function defined in 0001_init.sql) ───────────────
DROP TRIGGER IF EXISTS trg_properties_updated_at ON public.properties;
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_leases_updated_at ON public.leases;
CREATE TRIGGER trg_leases_updated_at BEFORE UPDATE ON public.leases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 7. ENABLE ROW LEVEL SECURITY ─────────────────────────────────────────────
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS POLICIES (owner-only + admin override) ────────────────────────────

-- properties
DROP POLICY IF EXISTS properties_select ON public.properties;
CREATE POLICY properties_select ON public.properties FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS properties_insert ON public.properties;
CREATE POLICY properties_insert ON public.properties FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS properties_update ON public.properties;
CREATE POLICY properties_update ON public.properties FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS properties_delete ON public.properties;
CREATE POLICY properties_delete ON public.properties FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());

-- tenants
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS tenants_insert ON public.tenants;
CREATE POLICY tenants_insert ON public.tenants FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS tenants_delete ON public.tenants;
CREATE POLICY tenants_delete ON public.tenants FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());

-- leases
DROP POLICY IF EXISTS leases_select ON public.leases;
CREATE POLICY leases_select ON public.leases FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS leases_insert ON public.leases;
CREATE POLICY leases_insert ON public.leases FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS leases_update ON public.leases;
CREATE POLICY leases_update ON public.leases FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS leases_delete ON public.leases;
CREATE POLICY leases_delete ON public.leases FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());

-- payments
DROP POLICY IF EXISTS payments_select ON public.payments;
CREATE POLICY payments_select ON public.payments FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS payments_insert ON public.payments;
CREATE POLICY payments_insert ON public.payments FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS payments_update ON public.payments;
CREATE POLICY payments_update ON public.payments FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS payments_delete ON public.payments;
CREATE POLICY payments_delete ON public.payments FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());
