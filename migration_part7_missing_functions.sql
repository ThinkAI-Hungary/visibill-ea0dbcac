-- ============================================================
-- VISIBILL MIGRATION - PART 7: Missing RPC/Query Functions
-- These were not included in the original Part 4
-- NOTE: sync_sandbox_from_taxology is EXCLUDED (contains hardcoded old project UUIDs)
-- ============================================================

-- get_transaction_filter_options
CREATE OR REPLACE FUNCTION public.get_transaction_filter_options(p_company_id uuid)
 RETURNS TABLE(currencies text[], types text[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    array_agg(DISTINCT currency) FILTER (WHERE currency IS NOT NULL),
    array_agg(DISTINCT type) FILTER (WHERE type IS NOT NULL)
  FROM transactions WHERE company_id = p_company_id;
$function$;

-- get_invoice_aggregates
CREATE OR REPLACE FUNCTION public.get_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)
 RETURNS TABLE(currency text, total_gross numeric, processing_count bigint, completed_count bigint, total_count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(i.penznem, 'HUF')::TEXT as currency,
    COALESCE(SUM(i.brutto_vegosszeg), 0)::NUMERIC as total_gross,
    COUNT(*) FILTER (WHERE i.statusz = 'feldolgozas_alatt')::BIGINT as processing_count,
    COUNT(*) FILTER (WHERE i.statusz = 'feldolgozott')::BIGINT as completed_count,
    COUNT(*)::BIGINT as total_count
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.kibocsatas_datuma >= p_date_from AND i.kibocsatas_datuma <= p_date_to
    AND i.reference_number IS NULL
  GROUP BY COALESCE(i.penznem, 'HUF');
END;
$function$;

-- get_linked_invoices
CREATE OR REPLACE FUNCTION public.get_linked_invoices(p_company_id uuid, p_seed_bizonylat text[], p_seed_reference text[], p_exclude_ids uuid[])
 RETURNS TABLE(id uuid, bizonylatsorszam text, kibocsatas_datuma date, teljesites_datuma date, elado_nev text, vevo_nev text, adoalap_osszesen numeric, brutto_vegosszeg numeric, afa_osszeg_osszesen numeric, penznem text, category_id uuid, project_id uuid, image_url text, melleklet_url text, invoice_direction text, reference_number text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH RECURSIVE chain AS (
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number, 1 AS depth
    FROM invoices i
    WHERE i.company_id = p_company_id AND i.id != ALL(p_exclude_ids)
      AND (lower(i.reference_number) = ANY(SELECT lower(unnest(p_seed_bizonylat)))
        OR lower(i.bizonylatsorszam) = ANY(SELECT lower(unnest(p_seed_reference))))
    UNION
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number, c.depth + 1
    FROM invoices i JOIN chain c ON (
      (i.reference_number IS NOT NULL AND lower(i.reference_number) = lower(c.bizonylatsorszam))
      OR (c.reference_number IS NOT NULL AND lower(i.bizonylatsorszam) = lower(c.reference_number)))
    WHERE i.company_id = p_company_id AND i.id != ALL(p_exclude_ids) AND c.depth < 20
  )
  SELECT DISTINCT ON (chain.id)
    chain.id, chain.bizonylatsorszam, chain.kibocsatas_datuma, chain.teljesites_datuma,
    chain.elado_nev, chain.vevo_nev, chain.adoalap_osszesen, chain.brutto_vegosszeg,
    chain.afa_osszeg_osszesen, chain.penznem, chain.category_id, chain.project_id,
    chain.image_url, chain.melleklet_url, chain.invoice_direction, chain.reference_number
  FROM chain;
$function$;

-- get_nav_credentials (uses vault extension)
CREATE OR REPLACE FUNCTION public.get_nav_credentials(p_user_id uuid, p_company_id uuid DEFAULT NULL::uuid)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_cred RECORD; v_password TEXT; v_sign_key TEXT; v_exchange_key TEXT;
BEGIN
  IF p_company_id IS NOT NULL THEN
    SELECT * INTO v_cred FROM public.user_nav_credentials WHERE company_id = p_company_id;
  ELSE
    SELECT * INTO v_cred FROM public.user_nav_credentials WHERE user_id = p_user_id AND company_id IS NULL;
  END IF;
  IF NOT FOUND THEN RETURN json_build_object('error', 'Credentials not found'); END IF;
  SELECT decrypted_secret INTO v_password FROM vault.decrypted_secrets WHERE id = v_cred.password_secret_id;
  SELECT decrypted_secret INTO v_sign_key FROM vault.decrypted_secrets WHERE id = v_cred.sign_key_secret_id;
  SELECT decrypted_secret INTO v_exchange_key FROM vault.decrypted_secrets WHERE id = v_cred.exchange_key_secret_id;
  RETURN json_build_object(
    'nav_username', v_cred.nav_username, 'nav_password', v_password,
    'nav_tax_number', v_cred.nav_tax_number, 'nav_sign_key', v_sign_key,
    'nav_exchange_key', v_exchange_key, 'software_id', v_cred.software_id,
    'software_dev_name', v_cred.software_dev_name, 'software_dev_contact', v_cred.software_dev_contact,
    'is_test_environment', v_cred.is_test_environment);
END;
$function$;

-- save_nav_credentials (uses vault extension)
CREATE OR REPLACE FUNCTION public.save_nav_credentials(p_nav_username text, p_nav_password text, p_nav_tax_number text, p_nav_sign_key text, p_nav_exchange_key text, p_software_dev_name text DEFAULT NULL, p_software_dev_contact text DEFAULT NULL, p_is_test_environment boolean DEFAULT true, p_company_id uuid DEFAULT NULL)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID; v_password_secret_id UUID; v_sign_key_secret_id UUID;
  v_exchange_key_secret_id UUID; v_software_id TEXT;
  v_existing_cred public.user_nav_credentials%ROWTYPE;
  v_password_name TEXT; v_sign_name TEXT; v_exchange_name TEXT; v_company_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_company_id := p_company_id;
  IF v_company_id IS NULL THEN RAISE EXCEPTION 'company_id is required'; END IF;
  IF p_nav_tax_number !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Tax number must be 8 digits'; END IF;
  SELECT * INTO v_existing_cred FROM public.user_nav_credentials WHERE company_id = v_company_id;
  v_password_name := 'nav_password_company_' || v_company_id::text;
  v_sign_name := 'nav_sign_key_company_' || v_company_id::text;
  v_exchange_name := 'nav_exchange_key_company_' || v_company_id::text;
  DELETE FROM vault.secrets WHERE name IN (v_password_name, v_sign_name, v_exchange_name);
  v_password_secret_id := vault.create_secret(p_nav_password, v_password_name, 'NAV password for company');
  v_sign_key_secret_id := vault.create_secret(p_nav_sign_key, v_sign_name, 'NAV sign key for company');
  v_exchange_key_secret_id := vault.create_secret(p_nav_exchange_key, v_exchange_name, 'NAV exchange key for company');
  IF FOUND AND v_existing_cred.software_id IS NOT NULL THEN v_software_id := v_existing_cred.software_id;
  ELSE v_software_id := 'HU' || p_nav_tax_number || substr(md5(random()::text), 1, 8); v_software_id := upper(substr(v_software_id, 1, 18)); END IF;
  INSERT INTO public.user_nav_credentials (user_id, company_id, nav_username, nav_tax_number, password_secret_id, sign_key_secret_id, exchange_key_secret_id, software_id, software_dev_name, software_dev_contact, is_test_environment, validation_status)
  VALUES (v_user_id, v_company_id, p_nav_username, p_nav_tax_number, v_password_secret_id, v_sign_key_secret_id, v_exchange_key_secret_id, v_software_id, p_software_dev_name, p_software_dev_contact, p_is_test_environment, 'pending')
  ON CONFLICT (user_id, company_id) DO UPDATE SET
    nav_username = EXCLUDED.nav_username, nav_tax_number = EXCLUDED.nav_tax_number,
    password_secret_id = EXCLUDED.password_secret_id, sign_key_secret_id = EXCLUDED.sign_key_secret_id,
    exchange_key_secret_id = EXCLUDED.exchange_key_secret_id, software_dev_name = EXCLUDED.software_dev_name,
    software_dev_contact = EXCLUDED.software_dev_contact, is_test_environment = EXCLUDED.is_test_environment,
    validation_status = 'pending', updated_at = NOW();
  RETURN json_build_object('success', true, 'message', 'Credentials saved successfully', 'software_id', v_software_id);
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Error saving credentials: %', SQLERRM;
END;
$function$;

-- override_gl_classification (6 param version - legacy)
CREATE OR REPLACE FUNCTION public.override_gl_classification(p_item_id uuid, p_source_table text, p_new_gl_account_id uuid, p_original_gl_account_id uuid, p_company_id uuid, p_user_id uuid)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
    IF p_source_table = 'transactions' THEN
        UPDATE public.transactions SET gl_account_id = p_new_gl_account_id, gl_is_manually_overridden = true WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
        UPDATE public.invoices SET gl_account_id = p_new_gl_account_id, gl_is_manually_overridden = true WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoices' THEN
        UPDATE public.nav_invoices SET gl_account_id = p_new_gl_account_id, gl_is_manually_overridden = true WHERE id = p_item_id;
    ELSE RAISE EXCEPTION 'Unknown source table: %', p_source_table;
    END IF;
    INSERT INTO public.gl_overrides_log (item_id, new_gl_account_id, original_gl_account_id, company_id, user_id, created_at)
    VALUES (p_item_id, p_new_gl_account_id, p_original_gl_account_id, p_company_id, p_user_id, now());
    RETURN true;
END;
$function$;

-- override_gl_classification (8 param version - with preset)
CREATE OR REPLACE FUNCTION public.override_gl_classification(p_item_id uuid, p_source_table text, p_new_gl_account_id uuid, p_original_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $function$
BEGIN
  IF p_new_gl_account_id IS NULL THEN
    DELETE FROM public.gl_overrides_log WHERE item_id = p_item_id;
    IF p_source_table = 'transactions' THEN UPDATE public.transactions SET gl_classifications = gl_classifications - p_preset_id::text WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN UPDATE public.invoices SET gl_classifications = gl_classifications - p_preset_id::text WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN UPDATE public.invoice_items SET gl_classifications = gl_classifications - p_preset_id::text WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN UPDATE public.nav_invoice_items SET gl_classifications = gl_classifications - p_preset_id::text WHERE id = p_item_id;
    END IF;
  ELSE
    INSERT INTO public.gl_overrides_log (item_id, source_table, original_gl_account_id, new_gl_account_id, company_id, user_id, created_at)
    VALUES (p_item_id, p_source_table, p_original_gl_account_id, p_new_gl_account_id, p_company_id, p_user_id, now());
    IF p_source_table = 'transactions' THEN
      UPDATE public.transactions SET gl_classifications = jsonb_set(COALESCE(gl_classifications, '{}'::jsonb), array[p_preset_id::text], jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')) WHERE id = p_item_id;
    ELSIF p_source_table = 'invoices' THEN
      UPDATE public.invoices SET gl_classifications = jsonb_set(COALESCE(gl_classifications, '{}'::jsonb), array[p_preset_id::text], jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')) WHERE id = p_item_id;
    ELSIF p_source_table = 'invoice_items' THEN
      UPDATE public.invoice_items SET gl_classifications = jsonb_set(COALESCE(gl_classifications, '{}'::jsonb), array[p_preset_id::text], jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')) WHERE id = p_item_id;
    ELSIF p_source_table = 'nav_invoice_items' THEN
      UPDATE public.nav_invoice_items SET gl_classifications = jsonb_set(COALESCE(gl_classifications, '{}'::jsonb), array[p_preset_id::text], jsonb_build_object('gl_account_id', p_new_gl_account_id, 'gl_number', p_new_gl_number, 'is_manual', true, 'reasoning', 'Kézi módosítás az admin felületről')) WHERE id = p_item_id;
    END IF;
  END IF;
  RETURN true;
END;
$function$;

-- override_gl_classifications_batch
CREATE OR REPLACE FUNCTION public.override_gl_classifications_batch(p_items jsonb, p_new_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_item jsonb; v_item_id uuid; v_source_table text; v_original_gl_account_id uuid;
BEGIN
  IF jsonb_typeof(p_items) != 'array' THEN RAISE EXCEPTION 'p_items must be a JSON array'; END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_item_id := (v_item->>'item_id')::uuid;
    v_source_table := v_item->>'source_table';
    IF (v_item->>'original_gl_account_id') IS NOT NULL AND (v_item->>'original_gl_account_id') != '' THEN
      v_original_gl_account_id := (v_item->>'original_gl_account_id')::uuid;
    ELSE v_original_gl_account_id := NULL; END IF;
    PERFORM public.override_gl_classification(v_item_id, v_source_table, p_new_gl_account_id, v_original_gl_account_id, p_company_id, p_user_id, p_preset_id, p_new_gl_number);
  END LOOP;
  RETURN true;
END;
$function$;
