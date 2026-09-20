-- Migration: acc_opening_croatian_and_multicurrency_support
-- Purpose: Support Croatian RRIF chart of accounts (classes 0, 1, 2, 3, 9) and multi-currency (EUR, HUF) in opening entries validation RPC

CREATE OR REPLACE FUNCTION public.acc_validate_and_post_opening_entry(
  p_header_id UUID,
  p_user_id UUID
) RETURNS JSONB 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_header RECORD;
  v_next_num INTEGER;
  v_imbalance NUMERIC;
  v_491_balance NUMERIC;
  v_invalid_class_count INTEGER;
  v_is_croatian BOOLEAN := false;
  v_curr TEXT;
BEGIN
  -- Lock header for update
  SELECT h.*, j.code AS journal_code 
    INTO v_header 
    FROM public.acc_journal_headers h
    JOIN public.acc_journals j ON h.journal_id = j.id
   WHERE h.id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nyitó bizonylat nem található.');
  END IF;
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Már lekönyvelt bizonylat.');
  END IF;

  v_curr := COALESCE(v_header.currency, 'HUF');

  -- 0. Tételsor ellenőrzés: nyitó bizonylat nem lehet üres!
  IF NOT EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE header_id = p_header_id) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'A nyitó bizonylat nem tartalmaz egyetlen tételsort sem! Üres bizonylat nem könyvelhető le.'
    );
  END IF;

  -- 1. Dátum ellenőrzés: nyitó tétel csak az üzleti év 1. napja lehet
  IF EXTRACT(MONTH FROM v_header.posting_date) <> 1 OR EXTRACT(DAY FROM v_header.posting_date) <> 1 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'A nyitó tételek könyvelési dátuma kizárólag az üzleti év első napja (január 1.) lehet.'
    );
  END IF;

  -- Detect if Croatian / RRIF chart of accounts is used
  SELECT EXISTS (
    SELECT 1 
      FROM public.acc_journal_lines l
      JOIN public.gl_accounts g ON l.gl_account_id = g.id
      JOIN public.chart_of_accounts_presets p ON g.preset_id = p.id
     WHERE l.header_id = p_header_id
       AND (p.name ILIKE '%hr%' OR p.name ILIKE '%croat%')
  ) INTO v_is_croatian;

  -- 2. Számlaosztály ellenőrzés:
  -- Magyar számvitel: 1-4. mérlegszámlák nyithatók (5-9. eredményszámlák nem)
  -- Horvát (RRIF) számvitel: 0, 1, 2, 3, 9. mérlegszámlák és 4910 technikai nyitható (4 egyéb, 5, 6, 7, 8 nem)
  IF v_is_croatian THEN
    SELECT COUNT(*) INTO v_invalid_class_count
      FROM public.acc_journal_lines l
      JOIN public.gl_accounts g ON l.gl_account_id = g.id
     WHERE l.header_id = p_header_id
       AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') NOT LIKE '491%'
       AND LEFT(REPLACE(g.gl_number, '.', ''), 1) IN ('4', '5', '6', '7', '8');

    IF v_invalid_class_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Horvát számlatükör esetén az eredményszámlák (4-8. számlaosztály) nem nyithatók egyenleggel! Csak a 0, 1, 2, 3, 9. mérlegszámlák nyithatók.'
      );
    END IF;
  ELSE
    SELECT COUNT(*) INTO v_invalid_class_count
      FROM public.acc_journal_lines l
      JOIN public.gl_accounts g ON l.gl_account_id = g.id
     WHERE l.header_id = p_header_id
       AND LEFT(REPLACE(g.gl_number, '.', ''), 1) IN ('5', '6', '7', '8', '9');

    IF v_invalid_class_count > 0 THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Az eredményszámlák (5-9. számlaosztály) nem nyithatók egyenleggel! Az előző évi eredmény a 419. Adózott eredmény számlán nyílik meg.'
      );
    END IF;
  END IF;

  -- 3. Kettős könyvvitel egyensúly ellenőrzés (SUM T = SUM K)
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_imbalance
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF v_imbalance <> 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', FORMAT('A nyitó bizonylat nem egyensúlyos! Eltérés: %s %s.', v_imbalance, v_curr)
    );
  END IF;

  -- 4. 491-es Technikai Nyitómérleg számla egyenlegének ellenőrzése (0-ra kell futnia)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_491_balance
    FROM public.acc_journal_lines l
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE l.header_id = p_header_id
     AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE '491%';

  IF v_491_balance <> 0 THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', FORMAT('A 491. Nyitómérleg technikai számla egyenlege nem 0 %s! Jelenlegi egyenleg: %s %s (Σ Eszköz nyitó = Σ Forrás nyitó kötelező).', v_curr, v_491_balance, v_curr)
    );
  END IF;

  -- Get next sequential number in NY journal
  v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);

  -- Update header to KONYVELT
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = p_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'A nyitó bizonylat sikeresen ellenőrizve és lekönyvelve!',
    'journal_number', v_next_num
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_validate_and_post_opening_entry(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_validate_and_post_opening_entry(UUID, UUID) TO authenticated, service_role;
