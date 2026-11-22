-- Triggers : remplir notifications.body depuis alerte_burnout.commentaire_rh
-- et psychobot_alerteburnout.raisons (à exécuter dans Supabase SQL Editor).
-- Prérequis : table public.notifications + RLS ; tables alerte_burnout, psychobot_alerteburnout, psychobot_questionnairereponse.

-- ── 1) RH : nouvelle ligne alerte_burnout → une notif par profil RH, body = commentaire RH ──
CREATE OR REPLACE FUNCTION public.notify_rh_on_alerte_burnout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.utilisateur_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body)
    SELECT
      p.id,
      'ALERTE_BURNOUT',
      'Nouvelle alerte burnout',
      COALESCE(
        NULLIF(btrim(NEW.commentaire_rh), ''),
        format(
          'Alerte burnout n° %s — le commentaire RH sera complété ultérieurement.',
          NEW.id
        )
      )
    FROM public.profiles AS p
    WHERE p.role = 'RH';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alerte_burnout_notify ON public.alerte_burnout;
CREATE TRIGGER trg_alerte_burnout_notify
  AFTER INSERT ON public.alerte_burnout
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_rh_on_alerte_burnout();

-- ── 2) Employé : insert psychobot_alerteburnout → notif avec body = raisons (lisible) ──
CREATE OR REPLACE FUNCTION public.notify_user_on_psychobot_alerte_burnout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_body text;
BEGIN
  SELECT q.utilisateur_id
  INTO v_user_id
  FROM public.psychobot_questionnairereponse AS q
  WHERE q.id = NEW.questionnaire_id;

  IF v_user_id IS NOT NULL THEN
    IF jsonb_typeof(NEW.raisons) = 'array' THEN
      SELECT string_agg(
        CASE jsonb_typeof(elem)
          WHEN 'string' THEN elem #>> '{}'
          ELSE elem::text
        END,
        E'\n• '
      )
      INTO v_body
      FROM jsonb_array_elements(NEW.raisons) AS t(elem);
      IF v_body IS NOT NULL AND btrim(v_body) <> '' THEN
        v_body := '• ' || v_body;
      END IF;
    ELSE
      v_body := nullif(btrim(COALESCE(jsonb_pretty(NEW.raisons), NEW.raisons::text)), '');
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (
      v_user_id,
      'PSYCHOBOT_ALERTE_BURNOUT',
      'Analyse du questionnaire',
      COALESCE(
        NULLIF(btrim(v_body), ''),
        format('Niveau détecté : %s (score %s).', NEW.niveau, NEW.score)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psychobot_alerte_burnout_notify ON public.psychobot_alerteburnout;
CREATE TRIGGER trg_psychobot_alerte_burnout_notify
  AFTER INSERT ON public.psychobot_alerteburnout
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_on_psychobot_alerte_burnout();

COMMENT ON FUNCTION public.notify_rh_on_alerte_burnout() IS
  'Insère une notification par RH ; body = commentaire_rh (alerte_burnout).';

COMMENT ON FUNCTION public.notify_user_on_psychobot_alerte_burnout() IS
  'Notifie l’employé ; body dérivé de raisons (jsonb) sur psychobot_alerteburnout.';
