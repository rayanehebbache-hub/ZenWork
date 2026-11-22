-- ============================================
-- 1. UPDATE demande_changement table
-- Add date fields to specify when the demande applies
-- ============================================

ALTER TABLE public.demande_changement
  ADD COLUMN date_debut timestamp with time zone NULL,
  ADD COLUMN date_fin timestamp with time zone NULL;

-- Add check: date_fin must be after date_debut
ALTER TABLE public.demande_changement
  ADD CONSTRAINT demande_changement_dates_check 
  CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin > date_debut);

-- ============================================
-- 2. UPDATE planning table
-- Remove the single utilisateur_id, make it support groups
-- ============================================

-- First, drop RLS policies that depend on utilisateur_id
DROP POLICY IF EXISTS "User can see own planning" ON public.planning;
DROP POLICY IF EXISTS "L'utilisateur peut voir son planning" ON public.planning;
DROP POLICY IF EXISTS "Planning: employe voit son planning" ON public.planning;

-- Drop any other policies that might reference utilisateur_id
-- (You may need to check your Supabase dashboard for exact policy names)
-- DROP POLICY IF EXISTS "your_policy_name_here" ON public.planning;

-- Drop the old foreign key and index
DROP INDEX IF EXISTS public.idx_planning_user;
ALTER TABLE public.planning DROP CONSTRAINT IF EXISTS planning_utilisateur_id_fkey;

-- Remove the single utilisateur_id column
ALTER TABLE public.planning DROP COLUMN IF EXISTS utilisateur_id;

-- Add type_planning to distinguish work vs leave vs absence
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS type_planning text NOT NULL DEFAULT 'TRAVAIL';

-- Constraint: only allowed values
ALTER TABLE public.planning
  DROP CONSTRAINT IF EXISTS planning_type_check;
ALTER TABLE public.planning
  ADD CONSTRAINT planning_type_check CHECK (
    type_planning = ANY (ARRAY['TRAVAIL', 'CONGE', 'REPOS', 'ABSENT'])
  );

-- Link to the demande that caused this planning entry (nullable)
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS demande_id bigint NULL;

ALTER TABLE public.planning
  DROP CONSTRAINT IF EXISTS planning_demande_id_fkey;
ALTER TABLE public.planning
  ADD CONSTRAINT planning_demande_id_fkey
  FOREIGN KEY (demande_id) REFERENCES demande_changement (id) ON DELETE SET NULL;

-- Track who created/modified this planning entry (RH can create manually)
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS cree_par uuid NULL;

ALTER TABLE public.planning
  DROP CONSTRAINT IF EXISTS planning_cree_par_fkey;
ALTER TABLE public.planning
  ADD CONSTRAINT planning_cree_par_fkey
  FOREIGN KEY (cree_par) REFERENCES profiles (id) ON DELETE SET NULL;

-- Track who last modified this planning entry
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS modifie_par uuid NULL;

ALTER TABLE public.planning
  DROP CONSTRAINT IF EXISTS planning_modifie_par_fkey;
ALTER TABLE public.planning
  ADD CONSTRAINT planning_modifie_par_fkey
  FOREIGN KEY (modifie_par) REFERENCES profiles (id) ON DELETE SET NULL;

-- Track when it was last updated
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NULL DEFAULT now();

-- Source: 'DEMANDE' (auto from demande_changement) or 'MANUEL' (created by RH)
ALTER TABLE public.planning
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'MANUEL';

ALTER TABLE public.planning
  DROP CONSTRAINT IF EXISTS planning_source_check;
ALTER TABLE public.planning
  ADD CONSTRAINT planning_source_check CHECK (
    source = ANY (ARRAY['DEMANDE', 'MANUEL'])
  );

-- ============================================
-- 3. CREATE planning_employees junction table
-- This allows one planning entry to be assigned to multiple employees
-- ============================================

CREATE TABLE IF NOT EXISTS public.planning_employees (
  id bigserial NOT NULL,
  planning_id bigint NOT NULL,
  utilisateur_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT planning_employees_pkey PRIMARY KEY (id),
  CONSTRAINT planning_employees_planning_id_fkey 
    FOREIGN KEY (planning_id) REFERENCES planning (id) ON DELETE CASCADE,
  CONSTRAINT planning_employees_utilisateur_id_fkey 
    FOREIGN KEY (utilisateur_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT planning_employees_unique UNIQUE (planning_id, utilisateur_id)
) TABLESPACE pg_default;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_planning_employees_user 
  ON public.planning_employees USING btree (utilisateur_id);

CREATE INDEX IF NOT EXISTS idx_planning_employees_planning 
  ON public.planning_employees USING btree (planning_id);

-- ============================================
-- 4. CREATE groupes table (optional - for organizing employees)
-- ============================================

CREATE TABLE IF NOT EXISTS public.groupes (
  id bigserial NOT NULL,
  nom text NOT NULL,
  description text NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT groupes_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Junction table: which employees belong to which groups
CREATE TABLE IF NOT EXISTS public.groupe_employees (
  id bigserial NOT NULL,
  groupe_id bigint NOT NULL,
  utilisateur_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT groupe_employees_pkey PRIMARY KEY (id),
  CONSTRAINT groupe_employees_groupe_id_fkey 
    FOREIGN KEY (groupe_id) REFERENCES groupes (id) ON DELETE CASCADE,
  CONSTRAINT groupe_employees_utilisateur_id_fkey 
    FOREIGN KEY (utilisateur_id) REFERENCES profiles (id) ON DELETE CASCADE,
  CONSTRAINT groupe_employees_unique UNIQUE (groupe_id, utilisateur_id)
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_groupe_employees_user 
  ON public.groupe_employees USING btree (utilisateur_id);

CREATE INDEX IF NOT EXISTS idx_groupe_employees_groupe 
  ON public.groupe_employees USING btree (groupe_id);

-- ============================================
-- 5. TRIGGER: Auto-update updated_at on planning changes
-- ============================================

CREATE OR REPLACE FUNCTION public.update_planning_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planning_updated_at ON public.planning;
CREATE TRIGGER trg_planning_updated_at
  BEFORE UPDATE ON public.planning
  FOR EACH ROW
  EXECUTE FUNCTION public.update_planning_updated_at();

-- ============================================
-- 6. OPTIONAL: Recreate RLS policies for new structure
-- Employees can see planning entries assigned to them via planning_employees
-- ============================================

-- Uncomment and adjust these if you want RLS policies:

-- Policy: Employees can see planning entries assigned to them
-- CREATE POLICY "Employees see assigned planning" ON public.planning
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM public.planning_employees pe
--       WHERE pe.planning_id = planning.id
--         AND pe.utilisateur_id = auth.uid()
--     )
--   );

-- Policy: RH can see all planning
-- CREATE POLICY "RH sees all planning" ON public.planning
--   FOR SELECT USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles p
--       WHERE p.id = auth.uid() AND p.role = 'RH'
--     )
--   );
