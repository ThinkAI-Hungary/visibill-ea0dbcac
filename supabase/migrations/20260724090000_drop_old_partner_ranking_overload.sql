-- Fix PGRST203: drop old single-parameter overload of get_partner_ranking
-- Root cause: CREATE OR REPLACE in 20260722173000_partner_ranking_date_filter.sql created a NEW
-- function signature (3 params) alongside the old one (1 param), instead of replacing it.
-- PostgREST cannot resolve overloads when DEFAULT params are involved → PGRST203 ambiguous call.
-- The 3-parameter version (p_date_from DEFAULT NULL, p_date_to DEFAULT NULL) is fully
-- backward-compatible — all existing callers work without changes.

DROP FUNCTION IF EXISTS public.get_partner_ranking(uuid);
