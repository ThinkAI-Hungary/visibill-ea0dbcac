-- =============================================================================
-- TENY M2.1 – Hierarchikus tárolóhelyek és felelős dolgozók sémája
-- Terv: implementation-plans/TENY_implementacios_terv.md (M2.1)
--
--  1. company_sub_locations           (hierarchikus tárolóhelyek: épület/emelet/raktár/iroda/polc)
--  2. fixed_assets FK bővítések       (custodian_id, sub_location_id, cost_center_id)
--  3. RLS házirendek & Indexek        (bérlői izoláció: company_members + accounty_assignments)
--  4. Integritás- és cégőr triggerek  (cross-tenant védelem, önhivatkozási hurok tiltása)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. company_sub_locations tábla
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_sub_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.company_locations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.company_sub_locations(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_sub_locations_company_id
  ON public.company_sub_locations (company_id);

CREATE INDEX IF NOT EXISTS idx_company_sub_locations_location_id
  ON public.company_sub_locations (location_id);

CREATE INDEX IF NOT EXISTS idx_company_sub_locations_parent_id
  ON public.company_sub_locations (parent_id)
  WHERE parent_id IS NOT NULL;

COMMENT ON TABLE public.company_sub_locations IS
  'Hierarchikus tárgyi eszköz tárolóhelyek és rész-helyszínek (pl. épület, emelet, iroda, raktár, polc)';
COMMENT ON COLUMN public.company_sub_locations.location_id IS
  'Fő telephely / székhely kapcsolat a company_locations táblához';
COMMENT ON COLUMN public.company_sub_locations.parent_id IS
  'Szülő rész-helyszín kapcsolat a fa-hierarchiához (önmagára hivatkozás)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. company_sub_locations RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.company_sub_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_sub_locations_select ON public.company_sub_locations;
CREATE POLICY company_sub_locations_select ON public.company_sub_locations
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS company_sub_locations_insert ON public.company_sub_locations;
CREATE POLICY company_sub_locations_insert ON public.company_sub_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS company_sub_locations_update ON public.company_sub_locations;
CREATE POLICY company_sub_locations_update ON public.company_sub_locations
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

DROP POLICY IF EXISTS company_sub_locations_delete ON public.company_sub_locations;
CREATE POLICY company_sub_locations_delete ON public.company_sub_locations
  FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. company_sub_locations hierarchia és cégkonzisztencia őr
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.company_sub_locations_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Telephely cég-ellenőrzés
  IF NOT EXISTS (
    SELECT 1 FROM public.company_locations cl
     WHERE cl.id = NEW.location_id
       AND cl.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'A megadott telephely (%) nem tartozik a céghez.', NEW.location_id
      USING ERRCODE = '23514';
  END IF;

  -- Szülő al-helyszín ellenőrzés (ha van parent_id)
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.id IS NOT NULL AND NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Egy tárolóhely nem lehet önmaga szülője.'
        USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.company_sub_locations p
       WHERE p.id = NEW.parent_id
         AND p.company_id = NEW.company_id
         AND p.location_id = NEW.location_id
    ) THEN
      RAISE EXCEPTION 'A szülő tárolóhely (%) nem ugyanahhoz a céghez vagy telephelyhez tartozik.', NEW.parent_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.company_sub_locations_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_company_sub_locations_guard ON public.company_sub_locations;
CREATE TRIGGER trg_company_sub_locations_guard
  BEFORE INSERT OR UPDATE OF location_id, parent_id, company_id ON public.company_sub_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.company_sub_locations_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. fixed_assets tábla bővítése (custodian_id, sub_location_id, cost_center_id)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS custodian_id uuid,
  ADD COLUMN IF NOT EXISTS sub_location_id uuid,
  ADD COLUMN IF NOT EXISTS cost_center_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fixed_assets_custodian_id_fkey'
       AND conrelid = 'public.fixed_assets'::regclass
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD CONSTRAINT fixed_assets_custodian_id_fkey
      FOREIGN KEY (custodian_id) REFERENCES public.accounty_employees(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fixed_assets_sub_location_id_fkey'
       AND conrelid = 'public.fixed_assets'::regclass
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD CONSTRAINT fixed_assets_sub_location_id_fkey
      FOREIGN KEY (sub_location_id) REFERENCES public.company_sub_locations(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'fixed_assets_cost_center_id_fkey'
       AND conrelid = 'public.fixed_assets'::regclass
  ) THEN
    ALTER TABLE public.fixed_assets
      ADD CONSTRAINT fixed_assets_cost_center_id_fkey
      FOREIGN KEY (cost_center_id) REFERENCES public.accounty_cost_centers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_custodian_id
  ON public.fixed_assets (custodian_id)
  WHERE custodian_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_sub_location_id
  ON public.fixed_assets (sub_location_id)
  WHERE sub_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_cost_center_id
  ON public.fixed_assets (cost_center_id)
  WHERE cost_center_id IS NOT NULL;

COMMENT ON COLUMN public.fixed_assets.custodian_id IS
  'Tárgyi eszközért felelős személy (dolgozó) kapcsolata az accounty_employees táblához';
COMMENT ON COLUMN public.fixed_assets.sub_location_id IS
  'Tárgyi eszköz pontos tárolóhelye a company_sub_locations hierarchikus táblában';
COMMENT ON COLUMN public.fixed_assets.cost_center_id IS
  'Tárgyi eszköz szervezeti egysége / költségviselője az accounty_cost_centers táblában';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. fixed_assets cégkonzisztencia őr (felelős dolgozó, tárolóhely, költséghely)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fixed_assets_sub_location_custodian_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Ellenőrzés: custodian_id tartozzon a céghez
  IF NEW.custodian_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounty_employees e
       WHERE e.id = NEW.custodian_id
         AND e.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'A kiválasztott felelős dolgozó (%) nem ehhez a céghez tartozik.', NEW.custodian_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 2. Ellenőrzés: sub_location_id tartozzon a céghez és (ha location_id ki van töltve) a megfelelő telephelyhez
  IF NEW.sub_location_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_sub_locations s
       WHERE s.id = NEW.sub_location_id
         AND s.company_id = NEW.company_id
         AND (NEW.location_id IS NULL OR s.location_id = NEW.location_id)
    ) THEN
      RAISE EXCEPTION 'A kiválasztott tárolóhely (%) nem ehhez a céghez vagy telephelyhez tartozik.', NEW.sub_location_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 3. Ellenőrzés: cost_center_id tartozzon a céghez
  IF NEW.cost_center_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.accounty_cost_centers c
       WHERE c.id = NEW.cost_center_id
         AND c.company_id = NEW.company_id
    ) THEN
      RAISE EXCEPTION 'A kiválasztott költséghely (%) nem ehhez a céghez tartozik.', NEW.cost_center_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.fixed_assets_sub_location_custodian_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fixed_assets_sub_location_custodian_guard ON public.fixed_assets;
CREATE TRIGGER trg_fixed_assets_sub_location_custodian_guard
  BEFORE INSERT OR UPDATE OF custodian_id, sub_location_id, cost_center_id, location_id, company_id ON public.fixed_assets
  FOR EACH ROW
  WHEN (NEW.custodian_id IS NOT NULL OR NEW.sub_location_id IS NOT NULL OR NEW.cost_center_id IS NOT NULL)
  EXECUTE FUNCTION public.fixed_assets_sub_location_custodian_guard();

NOTIFY pgrst, 'reload schema';
