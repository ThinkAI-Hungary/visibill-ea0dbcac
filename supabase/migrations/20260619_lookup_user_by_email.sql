-- ============================================================================
-- lookup_user_by_email — RPC for InviteUserDialog email lookup
-- ============================================================================
-- Returns { email, name } for a given email if user exists.
-- Used by the frontend to check if a user is already registered
-- before adding them to a company.
-- Only owner/admin callers should use this (frontend enforces).
-- ============================================================================

CREATE OR REPLACE FUNCTION lookup_user_by_email(p_email TEXT)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email::TEXT AS email,
    COALESCE(p.name, au.raw_user_meta_data->>'name', au.email)::TEXT AS name
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE lower(au.email) = lower(p_email)
  LIMIT 1;
END;
$$;

-- Only authenticated users can call this
REVOKE EXECUTE ON FUNCTION public.lookup_user_by_email FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_user_by_email TO authenticated;

COMMENT ON FUNCTION public.lookup_user_by_email IS
  'Looks up a user by email address. Returns user_id, email, and name if found. '
  'Used by InviteUserDialog to check if user exists before inviting.';
