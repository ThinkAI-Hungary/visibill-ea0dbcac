-- ============================================================
-- Fix: Drop invalid partners_user_tax_unique index
-- ============================================================
-- Problem: The UNIQUE INDEX (user_id, tax_number) prevents
-- multi-company users from having the same partner (e.g.
-- Magyar Telekom) in multiple companies. Error 23505:
-- "duplicate key value violates unique constraint
--  partners_user_tax_unique"
--
-- Root cause: This index was created pre-company_id era
-- (migration 20251205) when partners were user-scoped.
-- After company_id was introduced, the correct dedup key
-- became (company_id, tax_number) — which already exists
-- as partners_company_id_tax_number_key.
--
-- The user_id column is a "creator stamp", not a tenant ID.
-- A-024 ADR confirms: dedup is (company_id, tax_number).
-- ============================================================

DROP INDEX IF EXISTS partners_user_tax_unique;
