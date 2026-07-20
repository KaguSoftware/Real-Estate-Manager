-- =============================================================================
-- 0027_contact_activity.sql — structured interaction history per contact
--
-- Replaces two lossy workarounds:
--
--   1. `leads.last_call_at` is a single overwritten timestamp, so only the most
--      recent call survives — call #4 erases the record of #1–3.
--   2. Call history was being prepended as "[tarih] Arandı." text into the
--      free-text `leads.notes` column. Because the lead form loads `notes` into
--      state and writes it back wholesale on save, an agent who tidied that box
--      silently destroyed every logged call.
--
-- This table records AGENT-ENTERED interactions (a call, a viewing, a note) —
-- it is not a row-mutation audit log.
--
-- Existing "[tarih] Arandı." lines are deliberately left in `notes` as historic
-- text. Parsing them back out with a regex over user prose would corrupt real
-- notes; they simply stop growing.
--
-- Run after 0026_budget_and_projects.sql. Idempotent: safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contact_activity (
  -- gen_random_uuid() is core Postgres 13+; uuid_generate_v4() lives in the
  -- uuid-ossp schema, which isn't on the migration runner's search_path.
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id)      ON DELETE CASCADE,
  -- Constraint named explicitly: the timeline query joins the author through
  -- this FK by name (profiles!contact_activity_created_by_fkey), so it must not
  -- depend on Postgres' auto-naming.
  created_by  UUID          CONSTRAINT contact_activity_created_by_fkey
                            REFERENCES public.profiles(id)   ON DELETE SET NULL,
  -- Exactly one subject. The contacts page already unifies leads and tenants,
  -- so one timeline must serve both rather than splitting into two tables.
  lead_id     UUID          REFERENCES public.leads(id)      ON DELETE CASCADE,
  tenant_id   UUID          REFERENCES public.tenants(id)    ON DELETE CASCADE,
  kind        TEXT NOT NULL
              CHECK (kind IN ('call','whatsapp','meeting','viewing','note','status_change')),
  body        TEXT,
  -- Which property the interaction was about. SET NULL (not CASCADE): deleting
  -- a listing must not erase the record that a client was shown it.
  property_id UUID          REFERENCES public.properties(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_activity
  DROP CONSTRAINT IF EXISTS contact_activity_one_subject_check;
ALTER TABLE public.contact_activity ADD CONSTRAINT contact_activity_one_subject_check
  CHECK ((lead_id IS NULL) <> (tenant_id IS NULL));

-- Timelines are always "newest first for one contact".
CREATE INDEX IF NOT EXISTS idx_contact_activity_lead
  ON public.contact_activity(team_id, lead_id, occurred_at DESC)
  WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contact_activity_tenant
  ON public.contact_activity(team_id, tenant_id, occurred_at DESC)
  WHERE tenant_id IS NOT NULL;
-- Supports per-agent activity reporting (assigned_to already exists on both
-- leads and properties, but nothing reports on it yet).
CREATE INDEX IF NOT EXISTS idx_contact_activity_author
  ON public.contact_activity(team_id, created_by, occurred_at DESC);

-- =============================================================================
-- CROSS-TEAM GUARD
-- Every referenced row must belong to the same team as the activity itself.
-- Same shape as assert_project_same_team() in 0026.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.assert_activity_same_team()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE parent_team UUID;
BEGIN
  IF NEW.lead_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.leads WHERE id = NEW.lead_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'lead belongs to a different team';
    END IF;
  END IF;
  IF NEW.tenant_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.tenants WHERE id = NEW.tenant_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'tenant belongs to a different team';
    END IF;
  END IF;
  IF NEW.property_id IS NOT NULL THEN
    SELECT team_id INTO parent_team FROM public.properties WHERE id = NEW.property_id;
    IF parent_team IS DISTINCT FROM NEW.team_id THEN
      RAISE EXCEPTION 'property belongs to a different team';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_activity_same_team ON public.contact_activity;
CREATE TRIGGER trg_contact_activity_same_team
  BEFORE INSERT OR UPDATE ON public.contact_activity
  FOR EACH ROW EXECUTE FUNCTION public.assert_activity_same_team();

-- =============================================================================
-- RLS — mirrors the team-scoped policies from 0010_multitenant.sql:
-- read for any team member, writes additionally gated on team_is_writable().
-- =============================================================================
ALTER TABLE public.contact_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_activity_select ON public.contact_activity;
CREATE POLICY contact_activity_select ON public.contact_activity FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS contact_activity_insert ON public.contact_activity;
CREATE POLICY contact_activity_insert ON public.contact_activity FOR INSERT
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS contact_activity_update ON public.contact_activity;
CREATE POLICY contact_activity_update ON public.contact_activity FOR UPDATE
  USING ((SELECT public.is_team_member(team_id)))
  WITH CHECK ((SELECT public.is_team_member(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS contact_activity_delete ON public.contact_activity;
CREATE POLICY contact_activity_delete ON public.contact_activity FOR DELETE
  USING ((SELECT public.is_team_member(team_id))
     AND (SELECT public.team_is_writable(team_id)));
