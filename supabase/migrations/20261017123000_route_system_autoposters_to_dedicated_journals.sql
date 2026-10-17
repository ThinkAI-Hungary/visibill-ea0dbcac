-- Migration: Route system autoposters to dedicated journals (TE for fixed assets, ELH for accruals)
-- Date: 2026-10-17

-- 1. post_asset_activation_to_gl: prioritize TE (Tárgyi eszköz napló)
CREATE OR REPLACE FUNCTION public.post_asset_activation_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_asset_name text,
  p_inventory_number text,
  p_acquisition_value numeric,
  p_activation_date date,
  p_gl_account_id uuid,
  p_cip_gl_account_id uuid,
  p_currency text DEFAULT 'HUF'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid;
  v_clean_inv text;
  v_doc_id text;
  v_existing RECORD;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
  v_asset_id uuid;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az eszközaktiválás feladásához a céghez (id: %)', p_company_id;
  END IF;

  IF p_acquisition_value <= 0 THEN
    RAISE EXCEPTION 'Az aktiválási bekerülési értéknek pozitívnak kell lennie.';
  END IF;

  IF p_gl_account_id IS NULL OR p_cip_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'A főkönyvi számlák megadása kötelező az aktiváláshoz.';
  END IF;

  v_clean_inv := TRIM(COALESCE(p_inventory_number, ''));
  IF v_clean_inv = '' THEN
    v_clean_inv := SUBSTRING(p_asset_id::text, 1, 8);
  END IF;
  v_doc_id := 'AKT-' || v_clean_inv;

  SELECT id INTO v_asset_id
    FROM public.fixed_assets
   WHERE id = p_asset_id
     AND company_id = p_company_id;

  SELECT id, journal_number INTO v_existing
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'header_id', v_existing.id,
      'journal_number', v_existing.journal_number,
      'is_already_posted', true,
      'message', 'Az eszköz aktiválása már korábban le lett könyvelve (' || v_doc_id || ').'
    );
  END IF;

  -- Tárgyi Eszköz (TE) vagy Vegyes (VE) napló prioritás
  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code = 'TE' OR sub_type = 'ASSET' OR code IN ('VE', 'VEG') OR type = 'MIXED')
   ORDER BY CASE WHEN code = 'TE' OR sub_type = 'ASSET' THEN 1 WHEN code = 'VE' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív könyvelési napló a cégnél.';
  END IF;

  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    posting_date,
    document_date,
    document_id,
    description,
    currency,
    created_by,
    created_at
  ) VALUES (
    p_company_id,
    v_journal_id,
    EXTRACT(YEAR FROM p_activation_date)::smallint,
    'KONYVELT',
    'NORMAL',
    'AUTO_RENDSZER',
    p_activation_date,
    p_activation_date,
    v_doc_id,
    'Tárgyi eszköz aktiválás: ' || COALESCE(p_asset_name, v_clean_inv),
    COALESCE(p_currency, 'HUF'),
    v_uid,
    NOW()
  ) RETURNING id, journal_number INTO v_header_id, v_journal_number;

  INSERT INTO public.acc_journal_lines (
    header_id,
    sequence_number,
    gl_account_id,
    dc_type,
    amount,
    currency,
    fixed_asset_id
  ) VALUES
    (v_header_id, 1, p_gl_account_id, 'T', p_acquisition_value, COALESCE(p_currency, 'HUF'), v_asset_id),
    (v_header_id, 2, p_cip_gl_account_id, 'K', p_acquisition_value, COALESCE(p_currency, 'HUF'), v_asset_id);

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'is_already_posted', false,
    'message', 'Aktiválás sikeresen lekönyvelve (' || v_doc_id || ').'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_asset_activation_to_gl(uuid, uuid, text, text, numeric, date, uuid, uuid, text) TO authenticated, service_role;
