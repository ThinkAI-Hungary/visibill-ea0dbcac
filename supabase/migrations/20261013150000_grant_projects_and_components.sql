-- =============================================================================
-- TENY M3.1 – Pályázati projektek és alkatrész-komponensek sémája
-- Terv: implementation-plans/TENY_implementacios_terv.md (M3.1)
--
--  1. grant_projects               (Támogatási szerződések, keretek, mérföldkövek, fenntartás)
--  2. fixed_asset_components       (Eszköz-alkatrészek, többforrásos finanszírozás, ráaktiválás)
--  3. fixed_assets FK bővítés      (grant_project_id közvetlen hozzárendeléshez)
--  4. RLS házirendek & Indexek     (Bérlői izoláció: company_members + accounty_assignments)
--  5. Cross-tenant őr triggerek    (Cégazonosság garantálása komponens, eszköz és projekt között)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. grant_projects tábla
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grant_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  grantor text,
  contract_number text,
  eligible_cost numeric(14,2) NOT NULL DEFAULT 0,
  grant_amount numeric(14,2) NOT NULL DEFAULT 0,
  intensity_rate numeric(5,2) NOT NULL DEFAULT 0,
  own_contribution numeric(14,2) NOT NULL DEFAULT 0,
  advance_amount numeric(14,2) NOT NULL DEFAULT 0,
  disbursed_amount numeric(14,2) NOT NULL DEFAULT 0,
  maintenance_period_years integer NOT NULL DEFAULT 3,
  maintenance_end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'audit_in_progress', 'closed')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_grant_projects_company_code UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_grant_projects_company_id
  ON public.grant_projects (company_id);

CREATE INDEX IF NOT EXISTS idx_grant_projects_status
  ON public.grant_projects (company_id, status);

COMMENT ON TABLE public.grant_projects IS
  'Vissza nem térítendő beruházási támogatási és pályázati projektek analitikus nyilvántartása';
COMMENT ON COLUMN public.grant_projects.eligible_cost IS
  'Projekt elszámolható összköltsége (Ft)';
COMMENT ON COLUMN public.grant_projects.grant_amount IS
  'Megítélt támogatási összeg (Ft)';
COMMENT ON COLUMN public.grant_projects.intensity_rate IS
  'Támogatási intenzitás százalékban (pl. 65.00)';
COMMENT ON COLUMN public.grant_projects.maintenance_end_date IS
  'Kötelező fenntartási időszak vége (eszköz-elidegenítési és zárolási tilalom határa)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. grant_projects RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.grant_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grant_projects_select ON public.grant_projects;
CREATE POLICY grant_projects_select ON public.grant_projects
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS grant_projects_insert ON public.grant_projects;
CREATE POLICY grant_projects_insert ON public.grant_projects
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS grant_projects_update ON public.grant_projects;
CREATE POLICY grant_projects_update ON public.grant_projects
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS grant_projects_delete ON public.grant_projects;
CREATE POLICY grant_projects_delete ON public.grant_projects
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. fixed_assets tábla bővítése: grant_project_id
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS grant_project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE constraint_name = 'fk_fixed_assets_grant_project'
       AND table_name = 'fixed_assets'
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD CONSTRAINT fk_fixed_assets_grant_project
      FOREIGN KEY (grant_project_id)
      REFERENCES public.grant_projects(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_grant_project_id
  ON public.fixed_assets (grant_project_id)
  WHERE grant_project_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fixed_asset_components tábla (Többforrásos komponensek, ráaktiválások)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fixed_asset_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  fixed_asset_id uuid NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  name text NOT NULL,
  component_type text NOT NULL DEFAULT 'initial'
    CHECK (component_type IN ('initial', 'addition', 'upgrade', 'replacement')),
  activation_date date NOT NULL,
  gross_value numeric(14,2) NOT NULL DEFAULT 0,
  grant_project_id uuid REFERENCES public.grant_projects(id) ON DELETE SET NULL,
  grant_funding_amount numeric(14,2) NOT NULL DEFAULT 0,
  own_funding_amount numeric(14,2) NOT NULL DEFAULT 0,
  grant_ratio_percent numeric(5,2) NOT NULL DEFAULT 0,
  useful_life_months integer,
  depreciation_rate numeric(5,2),
  gl_asset_account text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fixed_asset_components_company_id
  ON public.fixed_asset_components (company_id);

CREATE INDEX IF NOT EXISTS idx_fixed_asset_components_fixed_asset_id
  ON public.fixed_asset_components (fixed_asset_id);

CREATE INDEX IF NOT EXISTS idx_fixed_asset_components_grant_project_id
  ON public.fixed_asset_components (grant_project_id)
  WHERE grant_project_id IS NOT NULL;

COMMENT ON TABLE public.fixed_asset_components IS
  'Tárgyi eszköz alkatrész-, forrás- és ráaktiválási komponensek (különböző finanszírozási forrás vagy aktiválási dátum esetén)';
COMMENT ON COLUMN public.fixed_asset_components.grant_funding_amount IS
  'Komponensre eső vissza nem térítendő támogatás összege (Ft)';
COMMENT ON COLUMN public.fixed_asset_components.own_funding_amount IS
  'Komponensre eső saját erő összege (Ft)';
COMMENT ON COLUMN public.fixed_asset_components.grant_ratio_percent IS
  'Komponens támogatási hányada (pl. 70.00%)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fixed_asset_components RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fixed_asset_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fixed_asset_components_select ON public.fixed_asset_components;
CREATE POLICY fixed_asset_components_select ON public.fixed_asset_components
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS fixed_asset_components_insert ON public.fixed_asset_components;
CREATE POLICY fixed_asset_components_insert ON public.fixed_asset_components
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS fixed_asset_components_update ON public.fixed_asset_components;
CREATE POLICY fixed_asset_components_update ON public.fixed_asset_components
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS fixed_asset_components_delete ON public.fixed_asset_components;
CREATE POLICY fixed_asset_components_delete ON public.fixed_asset_components
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Cross-tenant őr triggerek
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fixed_asset_components_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. fixed_asset_id ellenőrzése: létezzen és a megadott céghez tartozzon
  IF NOT EXISTS (
    SELECT 1 FROM public.fixed_assets a
     WHERE a.id = NEW.fixed_asset_id
       AND a.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'A főkarton tárgyi eszköz (%) nem ehhez a céghez tartozik.', NEW.fixed_asset_id
      USING ERRCODE = '23514';
  END IF;

  -- 2. grant_project_id ellenőrzése: ha ki van töltve, a céghez kell tartoznia
  IF NEW.grant_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.grant_projects p
       WHERE p.id = NEW.grant_project_id
         AND p.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'A kiválasztott pályázati projekt (%) nem ehhez a céghez tartozik.', NEW.grant_project_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 3. Összeg egyeztetés és arányszámítás: ha támogatás meg van adva, de saját erő hiányzik
  IF NEW.gross_value > 0 THEN
    IF NEW.grant_funding_amount > 0 AND NEW.own_funding_amount = 0 AND NEW.gross_value >= NEW.grant_funding_amount THEN
      NEW.own_funding_amount := NEW.gross_value - NEW.grant_funding_amount;
    END IF;
    IF NEW.grant_ratio_percent = 0 AND NEW.grant_funding_amount > 0 THEN
      NEW.grant_ratio_percent := ROUND((NEW.grant_funding_amount / NEW.gross_value) * 100, 2);
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fixed_asset_components_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fixed_asset_components_guard ON public.fixed_asset_components;
CREATE TRIGGER trg_fixed_asset_components_guard
  BEFORE INSERT OR UPDATE ON public.fixed_asset_components
  FOR EACH ROW
  EXECUTE FUNCTION public.fixed_asset_components_guard();

-- fixed_assets közvetlen grant_project_id őr trigger
CREATE OR REPLACE FUNCTION public.fixed_assets_grant_project_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.grant_project_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.grant_projects p
       WHERE p.id = NEW.grant_project_id
         AND p.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'A tárgyi eszközhöz rendelt pályázati projekt (%) nem ehhez a céghez tartozik.', NEW.grant_project_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fixed_assets_grant_project_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fixed_assets_grant_project_guard ON public.fixed_assets;
CREATE TRIGGER trg_fixed_assets_grant_project_guard
  BEFORE INSERT OR UPDATE OF grant_project_id, company_id ON public.fixed_assets
  FOR EACH ROW
  WHEN (NEW.grant_project_id IS NOT NULL)
  EXECUTE FUNCTION public.fixed_assets_grant_project_guard();

NOTIFY pgrst, 'reload schema';
