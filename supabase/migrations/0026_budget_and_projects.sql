-- =============================================================================
-- 0026_budget_and_projects.sql
--
-- Two related additions, both driven by how emlak offices actually work:
--
--   1. Lead budget. Every client conversation starts with "what's your budget?",
--      but leads could only express type/nitelik/bedrooms/location. Budget is
--      the missing join between leads.pref_* and properties.list_price, and it
--      feeds the match scorer in src/lib/matching/score.ts.
--
--   2. Projects. Brand-new construction-project units are never listed on
--      public portals; construction companies hand agencies a Google Drive
--      folder of catalogs, drone footage and price lists. A project row is the
--      home for that link, grouped by developer (construction company).
--      Units are OPTIONAL — agents add property rows only when a specific unit
--      matters, so projects carry their own price_from for budget surfacing.
--
-- Run after 0025_billing_periods.sql. Idempotent: safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. LEAD BUDGET
-- =============================================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS pref_min_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS pref_max_price NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS pref_currency  TEXT NOT NULL DEFAULT 'TRY';

-- A stated range must not be inverted. Either bound may be NULL (open-ended).
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_budget_range_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_budget_range_check
  CHECK (
    pref_min_price IS NULL
    OR pref_max_price IS NULL
    OR pref_max_price >= pref_min_price
  );

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_budget_nonnegative_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_budget_nonnegative_check
  CHECK (
    (pref_min_price IS NULL OR pref_min_price >= 0)
    AND (pref_max_price IS NULL OR pref_max_price >= 0)
  );

-- Budget filtering scans properties by price; currency is part of every
-- comparison (no FX conversion anywhere in this product).
CREATE INDEX IF NOT EXISTS idx_properties_price
  ON public.properties(team_id, currency, list_price);

-- =============================================================================
-- 2. PROJECTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id        UUID NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  created_by     UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  -- Construction company. Drives the "category by building companies" grouping.
  developer_name TEXT,
  -- The Google Drive folder the construction company shares with the agency:
  -- catalogs, videos, drone footage, price lists.
  drive_url      TEXT,
  city           TEXT,
  mahalle        TEXT,
  delivery_date  DATE,
  -- Entry price for the project as a whole, so a project with no unit rows can
  -- still be surfaced against a lead's budget as a secondary suggestion.
  price_from     NUMERIC(14,2),
  price_currency TEXT NOT NULL DEFAULT 'TRY',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_price_from_check;
ALTER TABLE public.projects ADD CONSTRAINT projects_price_from_check
  CHECK (price_from IS NULL OR price_from >= 0);

CREATE INDEX IF NOT EXISTS idx_projects_team      ON public.projects(team_id);
CREATE INDEX IF NOT EXISTS idx_projects_developer ON public.projects(team_id, developer_name);

DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. PROPERTY → PROJECT LINK
-- =============================================================================
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS project_id   UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_new_build BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_properties_project
  ON public.properties(project_id) WHERE project_id IS NOT NULL;

-- A property must not be linked to another team's project. The shared
-- assert_same_team() trigger keys off TG_TABLE_NAME for child tables; this is
-- the reverse direction (a parent row pointing at another parent), so it gets
-- its own guard rather than complicating that function.
CREATE OR REPLACE FUNCTION public.assert_project_same_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_team UUID;
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.projects WHERE id = NEW.project_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'project belongs to a different team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_properties_project_same_team ON public.properties;
CREATE TRIGGER trg_properties_project_same_team
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.assert_project_same_team();

-- =============================================================================
-- 4. PROJECTS RLS — mirrors the team-scoped policies from 0010_multitenant.sql:
--    read for any team member, writes additionally gated on team_is_writable().
-- =============================================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS projects_insert ON public.projects;
CREATE POLICY projects_insert ON public.projects FOR INSERT
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE
  USING ((SELECT public.is_team_member(team_id)))
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS projects_delete ON public.projects;
CREATE POLICY projects_delete ON public.projects FOR DELETE
  USING ((SELECT public.is_team_member(team_id))
     AND (SELECT public.team_is_writable(team_id)));
