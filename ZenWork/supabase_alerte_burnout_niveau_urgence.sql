-- Colonne attendue par le dashboard (DashboardOverview.jsx) : niveau_urgence 1, 2 ou 3
-- À exécuter dans Supabase SQL Editor.

ALTER TABLE public.alerte_burnout
  ADD COLUMN IF NOT EXISTS niveau_urgence integer NULL;

ALTER TABLE public.alerte_burnout
  DROP CONSTRAINT IF EXISTS alerte_burnout_niveau_urgence_check;

ALTER TABLE public.alerte_burnout
  ADD CONSTRAINT alerte_burnout_niveau_urgence_check
  CHECK (niveau_urgence IS NULL OR (niveau_urgence >= 1 AND niveau_urgence <= 3));

COMMENT ON COLUMN public.alerte_burnout.niveau_urgence IS
  '1 = faible, 2 = moyen, 3 = fort (aligné determine_level: low/medium/high).';
