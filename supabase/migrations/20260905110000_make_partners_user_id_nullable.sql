-- ============================================================================
-- Migration: 20260905110000_make_partners_user_id_nullable.sql
-- Description: Allow partners to be created by background automated syncs (e.g. NAV sync) without user_id
-- Rationale: In multi-tenant architecture, partners belong to companies (company_id).
--            Automated system syncs (NAV Online Számla cron jobs) do not have a user_id,
--            which previously caused Postgres 23502 not-null constraint errors.
-- ============================================================================

-- 1. Drop NOT NULL constraint on user_id
ALTER TABLE public.partners 
  ALTER COLUMN user_id DROP NOT NULL;

-- 2. Documentation comment
COMMENT ON COLUMN public.partners.user_id IS 'A partnert rögzítő felhasználó ID-ja (manuális létrehozáskor); automatikus NAV sync és háttérfolyamatok esetén NULL';
