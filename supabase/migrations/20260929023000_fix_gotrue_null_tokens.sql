-- Migration: Fix NULL token values in auth.users causing GoTrue /admin/users 500 scan errors
-- Issue: GoTrue scans confirmation_token, recovery_token, email_change_token_new into non-null strings.
-- When records have NULL instead of '', calls to supabase.auth.admin.listUsers() throw 500 error.

UPDATE auth.users
SET 
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, '')
WHERE 
  confirmation_token IS NULL 
  OR recovery_token IS NULL 
  OR email_change_token_new IS NULL;
