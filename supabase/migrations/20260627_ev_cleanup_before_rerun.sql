-- =============================================================================
-- CLEANUP: EV modul objektumok törlése újrafuttatás előtt
-- =============================================================================
-- Futtasd ELŐSZÖR a Supabase SQL Editor-ban, MIELŐTT az alábbi scripteket
-- újrafuttatod:
--   1. 20260627_ev_single_entry_schema.sql
--   2. 20260627_ev_tax_params_seed.sql
--
-- ⚠️  EZ A SCRIPT TÖRLI AZ ÖSSZES ADATOT AZ EV TÁBLÁKBÓL!
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TRIGGEREK törlése
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_accounty_penztarkonyv_period_check ON accounty_penztarkonyv_tetel;
DROP TRIGGER IF EXISTS trg_accounty_penztarkonyv_no_update_closed ON accounty_penztarkonyv_tetel;
DROP TRIGGER IF EXISTS trg_accounty_ev_client_settings_updated_at ON accounty_ev_client_settings;
DROP TRIGGER IF EXISTS trg_accounty_penztarkonyv_tetel_updated_at ON accounty_penztarkonyv_tetel;
DROP TRIGGER IF EXISTS trg_accounty_ev_contribution_calc_updated_at ON accounty_ev_contribution_calc;
DROP TRIGGER IF EXISTS trg_accounty_ev_hipa_calc_updated_at ON accounty_ev_hipa_calc;
DROP TRIGGER IF EXISTS trg_accounty_ev_tax_returns_updated_at ON accounty_ev_tax_returns;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FUNKCIÓK törlése
-- ─────────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS fn_accounty_check_period_closed() CASCADE;
DROP FUNCTION IF EXISTS fn_accounty_prevent_closed_update() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TÁBLÁK törlése (CASCADE törli a policy-kat és indexeket is)
--    Sorrend: először a FK-val hivatkozott táblák
-- ─────────────────────────────────────────────────────────────────────────────

-- Audit log (nincs FK rá)
DROP TABLE IF EXISTS accounty_ev_audit_log CASCADE;

-- Bevallások, közteher
DROP TABLE IF EXISTS accounty_ev_tax_returns CASCADE;
DROP TABLE IF EXISTS accounty_ev_hipa_calc CASCADE;
DROP TABLE IF EXISTS accounty_ev_contribution_calc CASCADE;

-- 12 részletező nyilvántartás
DROP TABLE IF EXISTS accounty_ev_records_strict_forms CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_subcontractors CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_inventory CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_scrapping CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_other_claims CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_consignment CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_vehicle_log CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_wages CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_securities CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_investments CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_fixed_assets CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_payables CASCADE;
DROP TABLE IF EXISTS accounty_ev_records_receivables CASCADE;

-- Időszak-zárás
DROP TABLE IF EXISTS accounty_penztarkonyv_period_close CASCADE;

-- Pénztárkönyv tételek
DROP TABLE IF EXISTS accounty_penztarkonyv_tetel CASCADE;

-- Életciklus események
DROP TABLE IF EXISTS accounty_ev_lifecycle_events CASCADE;

-- Ügyfél beállítások
DROP TABLE IF EXISTS accounty_ev_client_settings CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. ENUM TÍPUSOK törlése
-- ─────────────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS accounty_ev_taxpayer_form CASCADE;
DROP TYPE IF EXISTS accounty_ev_employment_status CASCADE;
DROP TYPE IF EXISTS accounty_ev_vat_status CASCADE;
DROP TYPE IF EXISTS accounty_ev_cost_ratio_category CASCADE;
DROP TYPE IF EXISTS accounty_penztarkonyv_category CASCADE;
DROP TYPE IF EXISTS accounty_penztarkonyv_direction CASCADE;
DROP TYPE IF EXISTS accounty_ev_period_type CASCADE;
DROP TYPE IF EXISTS accounty_ev_lifecycle_event_type CASCADE;
DROP TYPE IF EXISTS accounty_ev_org_type CASCADE;
DROP TYPE IF EXISTS accounty_ev_bookkeeping_mode CASCADE;
DROP TYPE IF EXISTS accounty_ev_return_type CASCADE;
DROP TYPE IF EXISTS accounty_ev_return_status CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. GLOBÁLIS ADÓPARAMÉTER tábla policy-k törlése (a tábla marad!)
--    A seed script IF NOT EXISTS-szel dolgozik, de a régi policy-kat törölni kell
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "accounty_global_tax_params_read" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_select" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_insert" ON accounty_global_tax_params;
DROP POLICY IF EXISTS "accounty_global_tax_params_update" ON accounty_global_tax_params;

-- A seed adatokat is töröljük, hogy ON CONFLICT ne okozzon gondot
DELETE FROM accounty_global_tax_params WHERE param_key LIKE 'atalany_%'
  OR param_key LIKE 'vszja_%'
  OR param_key LIKE 'kata_%'
  OR param_key LIKE 'afa_%'
  OR param_key LIKE 'hipa_%'
  OR param_key LIKE 'szocho_%'
  OR param_key LIKE 'tb_%'
  OR param_key LIKE 'min_wage%'
  OR param_key LIKE 'szja_%';

-- =============================================================================
-- ✅ KÉSZ — Most futtasd sorrendben:
--   1. 20260627_ev_single_entry_schema.sql
--   2. 20260627_ev_tax_params_seed.sql
-- =============================================================================
