-- =============================================================================
-- 0017_document_editor.sql — editable contract documents + per-team clauses
--
-- 1. Fixes teams_brand_palette_check: the app's default palette id 'kagu'
--    (src/lib/pdf/branding.ts) was missing from the allowed set, so teams
--    could never persist it. Also flips the column default to 'kagu'.
-- 2. contract_documents — the editable document produced at the wizard's
--    final step. Stores the editor content (Tiptap JSON) plus a frozen
--    snapshot of the wizard data (source_data) used for the cover page and
--    the "reset to template" action. One document per lease / sale.
--    Draft documents stay editable; finalize() locks them (trigger-enforced).
-- 3. clause_templates — per-team overrides of the standard T&C clause sets.
--    One row per (team, kind); `clauses` is a JSONB array of clause strings
--    containing {placeholder} tokens. Absent row = built-in defaults.
--
-- Run after 0016. Idempotent: safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. PALETTE CONSTRAINT FIX
-- =============================================================================
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_brand_palette_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_brand_palette_check
  CHECK (brand_palette IN ('kagu', 'slate', 'avera', 'emerald', 'indigo', 'burgundy'));
ALTER TABLE public.teams ALTER COLUMN brand_palette SET DEFAULT 'kagu';

-- =============================================================================
-- 2. CONTRACT DOCUMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.contract_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('rental', 'sales')),
  lease_id     UUID REFERENCES public.leases(id) ON DELETE CASCADE,
  sale_id      UUID REFERENCES public.sales(id)  ON DELETE CASCADE,
  title        TEXT NOT NULL,          -- cover title (editable)
  subtitle     TEXT,                   -- cover subtitle (editable)
  content      JSONB NOT NULL,         -- Tiptap document JSON (the body)
  source_data  JSONB NOT NULL,         -- RentalPDFData / SalesPDFData snapshot
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  finalized_at TIMESTAMPTZ,
  pdf_path     TEXT,                   -- mirrors leases/sales.document_pdf_path
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- exactly one parent record, matching the kind
  CONSTRAINT contract_documents_parent CHECK (
    (kind = 'rental' AND lease_id IS NOT NULL AND sale_id IS NULL) OR
    (kind = 'sales'  AND sale_id  IS NOT NULL AND lease_id IS NULL)
  )
);

-- one editable document per lease / sale
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contract_documents_lease
  ON public.contract_documents(lease_id) WHERE lease_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_contract_documents_sale
  ON public.contract_documents(sale_id) WHERE sale_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contract_documents_team
  ON public.contract_documents(team_id);

DROP TRIGGER IF EXISTS trg_contract_documents_updated_at ON public.contract_documents;
CREATE TRIGGER trg_contract_documents_updated_at BEFORE UPDATE ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Same-team referential integrity ─────────────────────────────────────────
-- assert_same_team() (0010) is keyed on TG_TABLE_NAME and doesn't know this
-- table, so it gets its own trigger function following the same pattern.
CREATE OR REPLACE FUNCTION public.assert_contract_document_same_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_team UUID;
BEGIN
  IF NEW.lease_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.leases WHERE id = NEW.lease_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'lease belongs to a different team';
    END IF;
  END IF;
  IF NEW.sale_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.sales WHERE id = NEW.sale_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'sale belongs to a different team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contract_documents_same_team ON public.contract_documents;
CREATE TRIGGER trg_contract_documents_same_team
  BEFORE INSERT OR UPDATE ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.assert_contract_document_same_team();

-- ── Finalize lock ────────────────────────────────────────────────────────────
-- A finalized contract is a signed legal artifact: its content must not change
-- silently. Enforced server-side (not just in the UI). Un-finalizing is also
-- blocked for non-admin roles; support can act via service role / direct SQL.
CREATE OR REPLACE FUNCTION public.guard_contract_document_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'role' = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF OLD.status = 'finalized' THEN
    IF NEW.status IS DISTINCT FROM 'finalized'
       OR NEW.content   IS DISTINCT FROM OLD.content
       OR NEW.title     IS DISTINCT FROM OLD.title
       OR NEW.subtitle  IS DISTINCT FROM OLD.subtitle
       OR NEW.source_data IS DISTINCT FROM OLD.source_data THEN
      RAISE EXCEPTION 'document is finalized and can no longer be edited';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_contract_documents_guard ON public.contract_documents;
CREATE TRIGGER trg_contract_documents_guard
  BEFORE UPDATE ON public.contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_document_update();

-- ── RLS — standard team pattern (0010 §5) ────────────────────────────────────
ALTER TABLE public.contract_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_documents_select ON public.contract_documents;
CREATE POLICY contract_documents_select ON public.contract_documents FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS contract_documents_insert ON public.contract_documents;
CREATE POLICY contract_documents_insert ON public.contract_documents FOR INSERT
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS contract_documents_update ON public.contract_documents;
CREATE POLICY contract_documents_update ON public.contract_documents FOR UPDATE
  USING ((SELECT public.is_team_member(team_id)))
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS contract_documents_delete ON public.contract_documents;
CREATE POLICY contract_documents_delete ON public.contract_documents FOR DELETE
  USING ((SELECT public.is_team_member(team_id))
     AND (SELECT public.team_is_writable(team_id)));

-- =============================================================================
-- 3. CLAUSE TEMPLATES
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.clause_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('rental', 'sales')),
  clauses    JSONB NOT NULL,   -- ["clause text with {tokens}", ...]
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clause_templates_team_kind UNIQUE (team_id, kind),
  -- must be a non-empty JSON array
  CONSTRAINT clause_templates_clauses_array CHECK (
    jsonb_typeof(clauses) = 'array' AND jsonb_array_length(clauses) > 0
  )
);

DROP TRIGGER IF EXISTS trg_clause_templates_updated_at ON public.clause_templates;
CREATE TRIGGER trg_clause_templates_updated_at BEFORE UPDATE ON public.clause_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Members read; writes are owner-only (matches branding writes) + paywall.
ALTER TABLE public.clause_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clause_templates_select ON public.clause_templates;
CREATE POLICY clause_templates_select ON public.clause_templates FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS clause_templates_insert ON public.clause_templates;
CREATE POLICY clause_templates_insert ON public.clause_templates FOR INSERT
  WITH CHECK ((SELECT public.is_team_owner(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS clause_templates_update ON public.clause_templates;
CREATE POLICY clause_templates_update ON public.clause_templates FOR UPDATE
  USING ((SELECT public.is_team_owner(team_id)))
  WITH CHECK ((SELECT public.is_team_owner(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS clause_templates_delete ON public.clause_templates;
CREATE POLICY clause_templates_delete ON public.clause_templates FOR DELETE
  USING ((SELECT public.is_team_owner(team_id))
     AND (SELECT public.team_is_writable(team_id)));
