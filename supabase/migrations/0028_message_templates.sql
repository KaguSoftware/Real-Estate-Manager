-- =============================================================================
-- 0028_message_templates.sql — per-team WhatsApp message templates
--
-- Agents share listings over WhatsApp constantly. The app now prefills that
-- message, but the wording is an office's voice, not ours — so the template is
-- team-editable, with a built-in default when no row exists.
--
-- Mirrors public.clause_templates (0017) exactly: team-scoped, one row per
-- kind, members read, owners write (and only while the team is writable).
--
-- Tokens are resolved app-side against a fixed whitelist
-- (src/lib/whatsappMessage.ts). A template can therefore never surface the
-- homeowner's name or the tapu identifiers, whatever an owner types here.
--
-- Run after 0027_contact_activity.sql. Idempotent: safe to re-run.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.message_templates (
  -- gen_random_uuid() is core Postgres 13+; uuid_generate_v4() lives in the
  -- uuid-ossp schema, which isn't on the migration runner's search_path.
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('whatsapp_property')),
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT message_templates_team_kind UNIQUE (team_id, kind),
  -- A blank template would silently send an empty WhatsApp message.
  CONSTRAINT message_templates_body_not_blank CHECK (length(btrim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_message_templates_team
  ON public.message_templates(team_id);

DROP TRIGGER IF EXISTS trg_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER trg_message_templates_updated_at BEFORE UPDATE ON public.message_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- RLS — members read; writes are owner-only + paywall (matches clause_templates)
-- =============================================================================
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS message_templates_select ON public.message_templates;
CREATE POLICY message_templates_select ON public.message_templates FOR SELECT
  USING ((SELECT public.is_team_member(team_id)));

DROP POLICY IF EXISTS message_templates_insert ON public.message_templates;
CREATE POLICY message_templates_insert ON public.message_templates FOR INSERT
  WITH CHECK ((SELECT public.is_team_owner(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS message_templates_update ON public.message_templates;
CREATE POLICY message_templates_update ON public.message_templates FOR UPDATE
  USING ((SELECT public.is_team_owner(team_id)))
  WITH CHECK ((SELECT public.is_team_owner(team_id))
          AND (SELECT public.team_is_writable(team_id)));

DROP POLICY IF EXISTS message_templates_delete ON public.message_templates;
CREATE POLICY message_templates_delete ON public.message_templates FOR DELETE
  USING ((SELECT public.is_team_owner(team_id))
     AND (SELECT public.team_is_writable(team_id)));
