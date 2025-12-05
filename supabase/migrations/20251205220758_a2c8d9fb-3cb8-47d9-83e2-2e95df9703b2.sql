-- Drop the old single-parameter version to resolve function overloading
DROP FUNCTION IF EXISTS public.get_nav_credentials(uuid);

-- The new version with optional company_id remains:
-- get_nav_credentials(p_user_id uuid, p_company_id uuid DEFAULT NULL)