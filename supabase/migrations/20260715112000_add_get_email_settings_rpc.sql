-- ============================================================
-- RPC to fetch decrypted email settings for SMTP/IMAP
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_company_email_settings(
  p_company_id UUID
)
RETURNS TABLE (
  company_id UUID,
  imap_host TEXT,
  imap_port INTEGER,
  imap_username TEXT,
  imap_password TEXT,
  imap_encryption TEXT,
  imap_status TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password TEXT,
  smtp_encryption TEXT,
  smtp_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_member BOOLEAN;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check membership only if auth.uid() is present (user request)
  -- service_role / internal worker calls can bypass this check
  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.company_members m
      WHERE m.company_id = p_company_id AND m.user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég email beállításainak megtekintéséhez';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    s.company_id,
    s.imap_host,
    s.imap_port,
    s.imap_username,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = s.imap_password_secret_id),
    s.imap_encryption,
    s.imap_status,
    s.smtp_host,
    s.smtp_port,
    s.smtp_username,
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE id = s.smtp_password_secret_id),
    s.smtp_encryption,
    s.smtp_status
  FROM public.company_email_settings s
  WHERE s.company_id = p_company_id;
END;
$function$;

-- Revoke and Grant privileges
REVOKE EXECUTE ON FUNCTION public.get_company_email_settings(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_company_email_settings(UUID) TO authenticated, service_role;
