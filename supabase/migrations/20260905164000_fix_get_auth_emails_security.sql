-- ============================================================================
-- Migration: Fix get_auth_emails SECURITY DEFINER permissions (CRIT-3)
-- Date: 2026-09-05
-- Reference: visibill-db-audit CRIT-3 / ADR A-016, A-017
-- ============================================================================

-- 1. Funkció definíció megerősítése (search_path védelem és explicit sémaillesztés)
CREATE OR REPLACE FUNCTION public.get_auth_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT id, email::text FROM auth.users;
$function$;

-- 2. Jogosultságok szigorítása:
-- Teljes visszavonás PUBLIC, anon és authenticated szerepköröktől
REVOKE EXECUTE ON FUNCTION public.get_auth_emails() FROM PUBLIC, anon, authenticated;

-- Kizárólag service_role (és szuperuser postgres) kap futtatási engedélyt
GRANT EXECUTE ON FUNCTION public.get_auth_emails() TO service_role;
