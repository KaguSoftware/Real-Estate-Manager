-- =============================================================================
-- 0001_init.sql — Real Estate Manager schema
--
-- Single consolidated migration for a fresh Supabase project.
-- Run this once via the Supabase SQL editor (or `supabase db push`).
-- Idempotent: safe to re-run.
-- =============================================================================

-- ── EXTENSIONS ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. PROFILES (mirrors auth.users via trigger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  app_role     TEXT NOT NULL DEFAULT 'member'
               CHECK (app_role IN ('admin', 'member', 'client')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger function (reused on every table below)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 2. SECURITY DEFINER HELPERS
-- =============================================================================

-- is_admin() — single source of truth for admin checks across all RLS policies.
-- SECURITY DEFINER so it reads profiles without firing the restrictive
-- profiles RLS policy (avoids circular evaluation).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND app_role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- find_user_by_email() — exposes {id, email} for share-by-email flows
-- without leaking the full profiles table.
CREATE OR REPLACE FUNCTION public.find_user_by_email(lookup_email TEXT)
RETURNS TABLE (id UUID, email TEXT) AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.email = lookup_email
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- admin_set_user_role() — only admins may call. Re-checks is_admin() inside
-- the function so the anon key is sufficient for the client RPC.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  target_user_id UUID,
  new_role       TEXT
)
RETURNS VOID AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied: caller is not an admin';
  END IF;

  IF new_role NOT IN ('admin', 'member', 'client') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be admin, member, or client', new_role;
  END IF;

  UPDATE public.profiles
  SET app_role = new_role
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. PROFILES RLS
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- =============================================================================
-- 4. PROPERTIES
-- =============================================================================
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

-- =============================================================================
-- 5. TENANTS
-- =============================================================================
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

-- =============================================================================
-- 6. LEASES
-- =============================================================================
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
-- DB-enforced: at most one active lease per property
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lease_per_property
  ON public.leases(property_id) WHERE status = 'active';

-- =============================================================================
-- 7. PAYMENTS
-- =============================================================================
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

-- =============================================================================
-- 8. updated_at TRIGGERS
-- =============================================================================
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

-- =============================================================================
-- 9. ROW LEVEL SECURITY
-- =============================================================================
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments   ENABLE ROW LEVEL SECURITY;

-- Owner-only access + admin override, applied uniformly to all four tables.

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
