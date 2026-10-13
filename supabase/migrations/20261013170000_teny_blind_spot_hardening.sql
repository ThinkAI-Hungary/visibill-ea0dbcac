-- =============================================================================
-- TENY Hardening – Blind-Spot Védelem és Biztonsági Megerősítés
-- Terv: morfi-implementation-review Blind-Spot döntések (Option A)
--
--  1. Anon & Public hozzáférés explicit megvonása mind az 5 TENY RPC-ről
--  2. Pályázati projektek (grant_projects) törlésvédelmi őr trigger:
--     Megakadályozza a projekt törlését, ha kapcsolódó eszköz, komponens,
--     vagy lekönyvelt főkönyvi tétel hivatkozik rá.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Explicit jogosultság-megvonás (REVOKE) és autentikált GRANT mind az 5 RPC-re
-- ─────────────────────────────────────────────────────────────────────────────

-- 1.1 Főkönyvi rekonciliáció
REVOKE ALL ON FUNCTION public.reconcile_fixed_assets_with_gl(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_fixed_assets_with_gl(uuid, date) TO authenticated, service_role;

-- 1.2 Kivezetés kezdeményezése
REVOKE ALL ON FUNCTION public.request_asset_disposal(uuid, uuid, text, date, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_asset_disposal(uuid, uuid, text, date, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- 1.3 Kivezetés elutasítása
REVOKE ALL ON FUNCTION public.reject_asset_disposal(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_asset_disposal(uuid, uuid, text) TO authenticated, service_role;

-- 1.4 Kivezetés jóváhagyása és atomi könyvelése
REVOKE ALL ON FUNCTION public.approve_asset_disposal(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_asset_disposal(uuid, uuid, jsonb, text) TO authenticated, service_role;

-- 1.5 Támogatási passzív elhatárolás (PIE) feloldás könyvelése
REVOKE ALL ON FUNCTION public.post_grant_deferral_release_to_gl(uuid, uuid, uuid, date, numeric, numeric, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_grant_deferral_release_to_gl(uuid, uuid, uuid, date, numeric, numeric, uuid, uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Pályázati projekt törlésvédelmi őr trigger (Data Integrity)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_grant_project_can_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_asset_count integer := 0;
  v_comp_count integer := 0;
  v_journal_count integer := 0;
BEGIN
  -- 1. Kapcsolódó főkarton tárgyi eszközök ellenőrzése
  SELECT COUNT(*) INTO v_asset_count
    FROM public.fixed_assets
   WHERE grant_project_id = OLD.id;

  IF v_asset_count > 0 THEN
    RAISE EXCEPTION 'A(z) "%" pályázati projekt nem törölhető: % db tárgyi eszköz van hozzárendelve. Előbb szüntesd meg a kapcsolatot az eszköz főkartonján!', OLD.name, v_asset_count
      USING ERRCODE = '23503';
  END IF;

  -- 2. Kapcsolódó alkatrész-komponensek ellenőrzése
  SELECT COUNT(*) INTO v_comp_count
    FROM public.fixed_asset_components
   WHERE grant_project_id = OLD.id;

  IF v_comp_count > 0 THEN
    RAISE EXCEPTION 'A(z) "%" pályázati projekt nem törölhető: % db alkatrész-komponens hivatkozik rá!', OLD.name, v_comp_count
      USING ERRCODE = '23503';
  END IF;

  -- 3. Kapcsolódó főkönyvi vegyes tételek ellenőrzése
  SELECT COUNT(*) INTO v_journal_count
    FROM public.acc_journal_headers
   WHERE company_id = OLD.company_id
     AND status <> 'SZTORNOZOTT'
     AND (
       description ILIKE '%' || OLD.code || '%'
       OR justification ILIKE '%' || OLD.code || '%'
       OR document_id ILIKE 'PIE-FELOLD-%'
     );

  IF v_journal_count > 0 THEN
    RAISE EXCEPTION 'A(z) "%" pályázati projekt nem törölhető: már lekönyvelt főkönyvi tételek hivatkoznak a projekt kódjára (%).', OLD.name, OLD.code
      USING ERRCODE = '23503';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_grant_project_with_usage ON public.grant_projects;
CREATE TRIGGER trg_prevent_delete_grant_project_with_usage
  BEFORE DELETE ON public.grant_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.check_grant_project_can_delete();

COMMENT ON FUNCTION public.check_grant_project_can_delete() IS
  'Megvédi a pályázati projekteket a véletlen törléstől, ha aktív tárgyi eszköz, komponens vagy lekönyvelt PIE tétel kapcsolódik hozzá.';

NOTIFY pgrst, 'reload schema';
