-- =============================================================================
-- 0011_onboarding_notifications.sql — onboarding wizard fields + notifications
--
--  * teams gains size_bracket / city / country / referral_source (asked once,
--    at creation, so they live on the team — joiners are never asked).
--  * profiles gains full_name / phone (collected in the onboarding wizard).
--  * notifications: per-user in-app inbox. Clients can only SELECT and
--    mark-read their own rows; all INSERTs happen inside SECURITY DEFINER
--    triggers/RPCs so the client can never forge a notification.
--  * create_team() is re-created with the new optional params (old single-arg
--    overload dropped to keep PostgREST rpc resolution unambiguous).
--
-- Run after 0010. Idempotent: safe to re-run.
-- =============================================================================

-- =============================================================================
-- 1. COLUMNS
-- =============================================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS size_bracket    TEXT CHECK (size_bracket IN ('solo','2-5','6-20','20+')),
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS country         TEXT,
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone     TEXT;

-- =============================================================================
-- 2. NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_id    UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
               'trial_started','invite_accepted','member_joined',
               'trial_ending','trial_ended','subscription_activated')),
  title      TEXT NOT NULL,
  body       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Only mark-read style updates; guarded further by the trigger below.
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No client INSERT/DELETE policies: inserts come from SECURITY DEFINER code.

-- Clients may only flip read_at; every other column is frozen.
CREATE OR REPLACE FUNCTION public.guard_notification_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb->>'role' = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id    IS DISTINCT FROM OLD.user_id
     OR NEW.team_id IS DISTINCT FROM OLD.team_id
     OR NEW.type    IS DISTINCT FROM OLD.type
     OR NEW.title   IS DISTINCT FROM OLD.title
     OR NEW.body    IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'only read_at can be changed';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notifications_guard ON public.notifications;
CREATE TRIGGER trg_notifications_guard BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_notification_update();

-- =============================================================================
-- 3. NOTIFICATION-GENERATING TRIGGERS
-- =============================================================================

-- team_members insert: owner joining their own new team → trial_started;
-- agent joining via invite → welcome for the joiner + heads-up for the owner.
CREATE OR REPLACE FUNCTION public.notify_member_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  team_name  TEXT;
  team_owner UUID;
  joiner     TEXT;
BEGIN
  SELECT t.name, t.owner_id INTO team_name, team_owner
  FROM public.teams t WHERE t.id = NEW.team_id;

  IF NEW.role = 'owner' THEN
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (NEW.user_id, NEW.team_id, 'trial_started',
            'Your 14-day free trial has started',
            'Welcome to Kagu! Your team "' || team_name || '" is ready. Invite your agents and start adding properties.');
  ELSE
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (NEW.user_id, NEW.team_id, 'member_joined',
            'Welcome to ' || team_name,
            'You joined as an agent. Your team''s properties and leads are now available.');

    SELECT coalesce(p.full_name, p.display_name, p.email) INTO joiner
    FROM public.profiles p WHERE p.id = NEW.user_id;

    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (team_owner, NEW.team_id, 'invite_accepted',
            joiner || ' joined your team',
            joiner || ' accepted an invite and was added as an agent.');
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_team_members_notify ON public.team_members;
CREATE TRIGGER trg_team_members_notify AFTER INSERT ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.notify_member_event();

-- subscriptions: transition into 'active' → notify the owner.
CREATE OR REPLACE FUNCTION public.notify_subscription_event()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE team_owner UUID;
BEGIN
  IF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    SELECT owner_id INTO team_owner FROM public.teams WHERE id = NEW.team_id;
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (team_owner, NEW.team_id, 'subscription_activated',
            'Subscription activated',
            'Your team''s subscription is active. Thanks for choosing Kagu!');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_subscriptions_notify ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_notify AFTER UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.notify_subscription_event();

-- =============================================================================
-- 4. RPCs
-- =============================================================================

-- check_trial_notifications() — idempotent, called client-side on app load.
-- Inserts at most one trial_ending (≤3 days left) and one trial_ended
-- notification per team, addressed to the owner. No cron required.
CREATE OR REPLACE FUNCTION public.check_trial_notifications()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  my_team UUID := public.user_team_id();
  t       public.teams%ROWTYPE;
  has_sub BOOLEAN;
BEGIN
  IF my_team IS NULL THEN RETURN; END IF;
  SELECT * INTO t FROM public.teams WHERE id = my_team;

  -- Irrelevant once a subscription is active.
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.team_id = my_team AND s.status = 'active'
  ) INTO has_sub;
  IF has_sub THEN RETURN; END IF;

  IF t.trial_ends_at <= now() THEN
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    SELECT t.owner_id, my_team, 'trial_ended',
           'Your free trial has ended',
           'Your workspace is now read-only. Choose a plan in Billing to keep working.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE team_id = my_team AND type = 'trial_ended'
    );
  ELSIF t.trial_ends_at <= now() + INTERVAL '3 days' THEN
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    SELECT t.owner_id, my_team, 'trial_ending',
           'Your trial ends soon',
           'Your free trial ends on ' || to_char(t.trial_ends_at, 'DD Mon') || '. Pick a plan in Billing to avoid interruption.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE team_id = my_team AND type = 'trial_ending'
    );
  END IF;
END;
$$;

-- invite_team_name(code) — team name for a live invite code, nothing else.
-- Lets /signup show "You've been invited to join <Team>" pre-auth.
CREATE OR REPLACE FUNCTION public.invite_team_name(invite_code TEXT)
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT t.name
  FROM public.invites i
  JOIN public.teams t ON t.id = i.team_id
  WHERE i.code = invite_code
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND (i.email IS NULL OR i.accepted_at IS NULL)
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.invite_team_name(TEXT) TO anon, authenticated;

-- create_team with onboarding fields. Drop the old overload so PostgREST
-- rpc resolution stays unambiguous.
DROP FUNCTION IF EXISTS public.create_team(TEXT);
CREATE OR REPLACE FUNCTION public.create_team(
  team_name       TEXT,
  size_bracket    TEXT DEFAULT NULL,
  city            TEXT DEFAULT NULL,
  country         TEXT DEFAULT NULL,
  referral_source TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE new_team UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'you already belong to a team';
  END IF;

  INSERT INTO public.teams (name, owner_id, size_bracket, city, country, referral_source)
  VALUES (trim(team_name), auth.uid(),
          create_team.size_bracket, nullif(trim(create_team.city), ''),
          nullif(trim(create_team.country), ''), create_team.referral_source)
  RETURNING id INTO new_team;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (new_team, auth.uid(), 'owner');

  INSERT INTO public.subscriptions (team_id, status) VALUES (new_team, 'trialing');

  RETURN new_team;
END;
$$;

NOTIFY pgrst, 'reload schema';
