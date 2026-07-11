-- =============================================================================
-- 0015_turkish_notifications_cron.sql — Turkish notification copy + cron RPC
--
-- 1. The UI is now fully Turkish; notification titles/bodies generated in the
--    DB (0011) were English. Same triggers/logic, Turkish copy.
-- 2. run_trial_checks(): the 0011 check_trial_notifications() only fires when
--    the owner opens the app — an owner who stays away never learns the trial
--    expired. This variant sweeps ALL teams; a daily Vercel cron calls it via
--    /api/cron/trial-check with the service role. EXECUTE is revoked from
--    client roles.
--
-- Run after 0014. Idempotent.
-- =============================================================================

-- ── 1. Turkish copy for member/subscription/trial notifications ─────────────
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
            '14 günlük ücretsiz denemeniz başladı',
            'Kagu''ya hoş geldiniz! "' || team_name || '" ekibiniz hazır. Danışmanlarınızı davet edin ve portföyünüzü eklemeye başlayın.');
  ELSE
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (NEW.user_id, NEW.team_id, 'member_joined',
            team_name || ' ekibine hoş geldiniz',
            'Danışman olarak katıldınız. Ekibinizin portföyü ve müşterileri artık erişiminizde.');

    SELECT coalesce(p.full_name, p.display_name, p.email) INTO joiner
    FROM public.profiles p WHERE p.id = NEW.user_id;

    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    VALUES (team_owner, NEW.team_id, 'invite_accepted',
            joiner || ' ekibinize katıldı',
            joiner || ' daveti kabul etti ve danışman olarak eklendi.');
  END IF;

  RETURN NEW;
END;
$$;

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
            'Aboneliğiniz etkinleştirildi',
            'Ekibinizin aboneliği etkin. Kagu''yu seçtiğiniz için teşekkürler!');
  END IF;
  RETURN NEW;
END;
$$;

-- Shared per-team check, reused by the client RPC and the cron sweep.
CREATE OR REPLACE FUNCTION public.check_trial_notifications_for(target_team UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t       public.teams%ROWTYPE;
  has_sub BOOLEAN;
BEGIN
  IF target_team IS NULL THEN RETURN; END IF;
  SELECT * INTO t FROM public.teams WHERE id = target_team;
  IF t.id IS NULL THEN RETURN; END IF;

  -- Irrelevant once a subscription is active.
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.team_id = target_team AND s.status = 'active'
  ) INTO has_sub;
  IF has_sub THEN RETURN; END IF;

  IF t.trial_ends_at <= now() THEN
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    SELECT t.owner_id, target_team, 'trial_ended',
           'Ücretsiz deneme süreniz sona erdi',
           'Çalışma alanınız artık salt okunur. Çalışmaya devam etmek için Abonelik sayfasından bir plan seçin.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE team_id = target_team AND type = 'trial_ended'
    );
  ELSIF t.trial_ends_at <= now() + INTERVAL '3 days' THEN
    INSERT INTO public.notifications (user_id, team_id, type, title, body)
    SELECT t.owner_id, target_team, 'trial_ending',
           'Deneme süreniz yakında doluyor',
           'Ücretsiz deneme süreniz ' || to_char(t.trial_ends_at, 'DD.MM.YYYY') || ' tarihinde sona eriyor. Kesinti yaşamamak için Abonelik sayfasından bir plan seçin.'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE team_id = target_team AND type = 'trial_ending'
    );
  END IF;
END;
$$;

-- Same client-facing contract as 0011, now delegating to the shared check.
CREATE OR REPLACE FUNCTION public.check_trial_notifications()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.check_trial_notifications_for(public.user_team_id());
END;
$$;

-- ── 2. Cron sweep across all teams (service role only) ──────────────────────
CREATE OR REPLACE FUNCTION public.run_trial_checks()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  t   RECORD;
  n   INT := 0;
BEGIN
  FOR t IN
    SELECT id FROM public.teams
    WHERE trial_ends_at <= now() + INTERVAL '3 days'
  LOOP
    PERFORM public.check_trial_notifications_for(t.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- Clients must not run the sweep or target arbitrary teams.
REVOKE EXECUTE ON FUNCTION public.run_trial_checks() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_trial_notifications_for(UUID) FROM anon, authenticated;
