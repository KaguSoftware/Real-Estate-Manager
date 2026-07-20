-- =============================================================================
-- 0029_work_notifications.sql — notifications about the actual job
--
-- Every existing notification type is billing/team lifecycle (trial_started,
-- invite_accepted, subscription_activated…). Nothing tells an agent that rent
-- is overdue, a lease is about to expire, a client has gone quiet, or a project
-- is nearing delivery — those live only in a dashboard panel someone has to
-- remember to open.
--
-- The same conditions the app already computes in src/lib/db/attentionLogic.ts
-- become push notifications here, swept daily by the existing Vercel cron.
--
-- IDEMPOTENCY IS THE POINT. A daily sweep must not re-notify the same overdue
-- payment every morning forever, so every insert is guarded by a NOT EXISTS
-- over (user, type, href) within a recent window — the same shape
-- check_trial_notifications() uses.
--
-- Run after 0028_message_templates.sql. Idempotent: safe to re-run.
-- =============================================================================

-- ── 1. Allow the new types ───────────────────────────────────────────────────
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- existing (0011)
    'trial_started','invite_accepted','member_joined',
    'trial_ending','trial_ended','subscription_activated',
    'team_invite',
    -- work events (0029)
    'rent_overdue','lease_expiring','lead_silent','project_delivery'
  ));

-- Repeat-suppression window: a given item may re-notify only after this long.
-- Also the lookup the guard uses, so keep it indexed.
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
  ON public.notifications(user_id, type, href, created_at DESC);

-- =============================================================================
-- 2. run_work_checks() — one sweep over every team.
--
-- Notifications are insert-only by definer functions (0011's design), so this
-- is the correct place for the logic. Recipient is the assigned member where
-- one exists, else the team owner.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.run_work_checks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r          RECORD;
  inserted   INT := 0;
  wrote      INT := 0;
  -- Mirrors DEFAULT_ATTENTION_THRESHOLDS in src/lib/db/attentionLogic.ts so the
  -- dashboard feed and these notifications never disagree.
  lease_days CONSTANT INT := 30;
  lead_days  CONSTANT INT := 14;
  proj_days  CONSTANT INT := 30;
  -- Don't repeat the same item within this window.
  quiet      CONSTANT INTERVAL := INTERVAL '30 days';
BEGIN
  -- ── Overdue rent ───────────────────────────────────────────────────────────
  FOR r IN
    SELECT p.id            AS payment_id,
           l.team_id,
           pr.id           AS property_id,
           pr.address_line,
           coalesce(pr.assigned_to, t.owner_id) AS recipient,
           (p.amount_due - p.amount_paid)       AS outstanding,
           l.currency
    FROM public.payments p
    JOIN public.leases     l  ON l.id = p.lease_id AND l.status = 'active'
    JOIN public.properties pr ON pr.id = l.property_id
    JOIN public.teams      t  ON t.id = l.team_id
    WHERE p.period_end < current_date
      AND p.amount_paid < p.amount_due
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'rent_overdue',
           'Gecikmiş kira ödemesi',
           r.address_line || ' için ' ||
             to_char(r.outstanding, 'FM999G999G999D00') || ' ' || r.currency ||
             ' tutarında ödeme gecikti.',
           '/properties/' || r.property_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'rent_overdue'
        AND n.href    = '/properties/' || r.property_id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Leases ending soon ─────────────────────────────────────────────────────
  FOR r IN
    SELECT l.id AS lease_id, l.team_id, l.end_date,
           pr.id AS property_id, pr.address_line,
           coalesce(pr.assigned_to, t.owner_id) AS recipient
    FROM public.leases     l
    JOIN public.properties pr ON pr.id = l.property_id
    JOIN public.teams      t  ON t.id = l.team_id
    WHERE l.status = 'active'
      AND l.end_date IS NOT NULL
      AND l.end_date BETWEEN current_date AND current_date + lease_days
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'lease_expiring',
           'Kira sözleşmesi bitiyor',
           r.address_line || ' sözleşmesi ' || to_char(r.end_date, 'DD.MM.YYYY') ||
             ' tarihinde sona eriyor. Yenilemeyi konuşmak için iyi bir zaman.',
           '/properties/' || r.property_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'lease_expiring'
        AND n.href    = '/properties/' || r.property_id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Leads gone quiet ───────────────────────────────────────────────────────
  FOR r IN
    SELECT ld.id AS lead_id, ld.team_id, ld.full_name,
           coalesce(ld.assigned_to, t.owner_id) AS recipient
    FROM public.leads ld
    JOIN public.teams t ON t.id = ld.team_id
    WHERE ld.status IN ('new','follow_up','interested')
      AND coalesce(ld.last_call_at, ld.created_at) < now() - (lead_days || ' days')::INTERVAL
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'lead_silent',
           'Müşteriyle uzun süredir görüşülmedi',
           r.full_name || ' ile ' || lead_days || ' günden uzun süredir görüşülmedi.',
           '/leads'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'lead_silent'
        -- href is the shared /leads page, so dedupe on the lead's name in the
        -- body instead; otherwise one quiet lead would mute all the others.
        AND n.body LIKE r.full_name || ' ile %'
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  -- ── Projects nearing delivery ──────────────────────────────────────────────
  FOR r IN
    SELECT pj.id, pj.team_id, pj.name, pj.delivery_date, t.owner_id AS recipient
    FROM public.projects pj
    JOIN public.teams    t ON t.id = pj.team_id
    WHERE pj.delivery_date IS NOT NULL
      AND pj.delivery_date BETWEEN current_date AND current_date + proj_days
  LOOP
    INSERT INTO public.notifications (user_id, team_id, type, title, body, href)
    SELECT r.recipient, r.team_id, 'project_delivery',
           'Proje teslim tarihi yaklaşıyor',
           r.name || ' projesinin teslim tarihi ' ||
             to_char(r.delivery_date, 'DD.MM.YYYY') || '.',
           '/projects/' || r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = r.recipient
        AND n.type    = 'project_delivery'
        AND n.href    = '/projects/' || r.id
        AND n.created_at > now() - quiet
    );
    GET DIAGNOSTICS wrote = ROW_COUNT;
    inserted := inserted + wrote;
  END LOOP;

  RETURN inserted;
END;
$$;

-- Clients must not run the sweep.
REVOKE EXECUTE ON FUNCTION public.run_work_checks() FROM anon, authenticated;
