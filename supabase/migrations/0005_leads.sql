-- =============================================================================
-- 0005_leads.sql — Client / lead CRM
--
-- Prospective clients (leads): name, phone, what they're interested in, a
-- pipeline status, free-text notes, and the date they were last called (so
-- multiple agents don't call the same lead twice in one day).
--
-- Run after 0001_init.sql. Idempotent: safe to re-run.
-- Mirrors the conventions used by public.tenants in 0001_init.sql.
-- =============================================================================

-- =============================================================================
-- 1. LEADS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name          TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  interested_in      TEXT,                          -- free-text ("3+1 with a garden")
  -- optional structured prefs — drive the "Find matches" link into property filters
  pref_listing_type  TEXT CHECK (pref_listing_type IN ('for_rent','for_sale')),
  pref_nitelik       TEXT,                          -- e.g. "3+1"
  pref_min_bedrooms  INT,
  pref_location      TEXT,                          -- matches city / mahalle / mevkii
  status             TEXT NOT NULL DEFAULT 'new'
                     CHECK (status IN ('new','called_rejected','follow_up','interested','closed')),
  notes              TEXT,
  last_call_at       DATE,                          -- date of last call
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leads_owner ON public.leads(owner_id);

-- =============================================================================
-- 2. updated_at TRIGGER (reuses public.set_updated_at from 0001_init.sql)
-- =============================================================================
DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. ROW LEVEL SECURITY — owner-only access + admin override
-- =============================================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leads_select ON public.leads;
CREATE POLICY leads_select ON public.leads FOR SELECT
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS leads_insert ON public.leads;
CREATE POLICY leads_insert ON public.leads FOR INSERT
  WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS leads_update ON public.leads;
CREATE POLICY leads_update ON public.leads FOR UPDATE
  USING (public.is_admin() OR owner_id = auth.uid());
DROP POLICY IF EXISTS leads_delete ON public.leads;
CREATE POLICY leads_delete ON public.leads FOR DELETE
  USING (public.is_admin() OR owner_id = auth.uid());
