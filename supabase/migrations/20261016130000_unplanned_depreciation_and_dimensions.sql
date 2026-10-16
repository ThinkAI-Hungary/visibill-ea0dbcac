-- Migration: 20261016130000_unplanned_depreciation_and_dimensions.sql
-- Cél: Terven felüli ÉCS és visszaírás (866/966), számviteli mozgásnemek bővítése, és dimenziók átadása az időszaki ÉCS feladásban

-- 1. Bővítjük az asset_events.event_type check constraintet az új számviteli mozgásnemekkel
ALTER TABLE public.asset_events DROP CONSTRAINT IF EXISTS asset_events_event_type_check;

ALTER TABLE public.asset_events ADD CONSTRAINT asset_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'activation'::text,
    'transfer'::text,
    'project_transfer'::text,
    'reactivation'::text,
    'disposal'::text,
    'disposal_requested'::text,
    'disposal_approved'::text,
    'disposal_rejected'::text,
    'inventory_check'::text,
    'value_change'::text,
    'document_upload'::text,
    'performance_log'::text,
    'unplanned_depreciation'::text,
    'unplanned_depreciation_reversal'::text,
    'contribution_in_kind'::text,
    'free_transfer_out'::text,
    'free_transfer_in'::text
  ]));

-- 2. Dimenziók átadása az időszaki ÉCS feladásban (post_depreciation_run_to_gl)
DROP FUNCTION IF EXISTS public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.post_depreciation_run_to_gl(
  p_company_id uuid,
  p_period_type text,
  p_date_from date,
  p_date_to date,
  p_posting_date date,
  p_document_id text,
  p_description text,
  p_currency text DEFAULT 'HUF'::text,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_uid uuid;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_item jsonb;
  v_seq smallint := 1;
  v_total_amount numeric := 0;
  v_asset_count integer := 0;
  v_item_amount numeric;
  v_debit_gl uuid;
  v_credit_gl uuid;
  v_journal_number integer;
  v_item_asset_id uuid;
  v_item_cost_center_id uuid;
  v_item_project_id uuid;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága az értékcsökkenés főkönyvi feladásához a céghez (id: %)', p_company_id;
  END IF;

  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = p_document_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ezzel a bizonylatszámmal (%) már létezik lekönyvelt tétel a Vegyes naplóban!', p_document_id;
  END IF;

  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
   ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id AND is_active = true
     LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Nincs feladandó értékcsökkenési tétel a megadott listában.';
  END IF;

  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    currency,
    posting_date,
    document_date,
    document_id,
    description,
    justification,
    created_by,
    posted_by
  ) VALUES (
    p_company_id,
    v_journal_id,
    EXTRACT(YEAR FROM p_posting_date)::smallint,
    'PISZKOZAT',
    'NORMAL',
    'AUTOMATIKUS',
    COALESCE(p_currency, 'HUF'),
    p_posting_date,
    p_date_to,
    p_document_id,
    p_description,
    'Tárgyi eszköz analitika szerinti időszaki értékcsökkenés (' || p_document_id || ')',
    v_uid,
    v_uid
  ) RETURNING id INTO v_header_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_amount := (v_item->>'period_amount')::numeric;
    v_debit_gl := (v_item->>'debit_gl_account_id')::uuid;
    v_credit_gl := (v_item->>'credit_gl_account_id')::uuid;

    IF v_item_amount > 0 AND v_debit_gl IS NOT NULL AND v_credit_gl IS NOT NULL THEN
      v_item_asset_id := NULL;
      v_item_cost_center_id := NULL;
      v_item_project_id := NULL;

      IF (v_item->>'asset_id') IS NOT NULL THEN
        SELECT fa.id, fa.cost_center_id, fa.project_id
          INTO v_item_asset_id, v_item_cost_center_id, v_item_project_id
          FROM public.fixed_assets fa
         WHERE fa.id = (v_item->>'asset_id')::uuid
           AND fa.company_id = p_company_id;
      END IF;

      -- Költség sor (5711) dimenziókkal
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
      ) VALUES (
        v_header_id,
        v_seq,
        v_debit_gl,
        'T',
        v_item_amount,
        'Terv szerinti ÉCS (' || COALESCE(v_item->>'active_months', '1') || ' hó) — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')',
        v_item_asset_id,
        v_item_cost_center_id,
        v_item_project_id
      );
      v_seq := v_seq + 1;

      -- Halmozott ÉCS sor (1x9)
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
      ) VALUES (
        v_header_id,
        v_seq,
        v_credit_gl,
        'K',
        v_item_amount,
        'Halmozott ÉCS elszámolása — ' || COALESCE(v_item->>'asset_name', '') || ' (' || COALESCE(v_item->>'inventory_number', '') || ')',
        v_item_asset_id,
        v_item_cost_center_id,
        v_item_project_id
      );
      v_seq := v_seq + 1;

      v_total_amount := v_total_amount + v_item_amount;
      v_asset_count := v_asset_count + 1;

      IF v_item_asset_id IS NOT NULL THEN
        INSERT INTO public.asset_events (
          asset_id,
          company_id,
          user_id,
          event_type,
          event_date,
          description,
          old_values,
          new_values
        ) VALUES (
          v_item_asset_id,
          p_company_id,
          v_uid,
          'value_change',
          p_posting_date,
          'ÉCS elszámolás (' || p_document_id || '): ' || v_item_amount::text || ' Ft',
          jsonb_build_object(
            'accumulated_before', COALESCE((v_item->>'accumulated_before')::numeric, 0),
            'book_value_before', COALESCE((v_item->>'acquisition_value')::numeric, 0) - COALESCE((v_item->>'accumulated_before')::numeric, 0)
          ),
          jsonb_build_object(
            'period_amount', v_item_amount,
            'accumulated_after', COALESCE((v_item->>'accumulated_before')::numeric, 0) + v_item_amount,
            'book_value_after', COALESCE((v_item->>'remaining_book_value')::numeric, 0),
            'document_id', p_document_id
          )
        );
      END IF;
    END IF;
  END LOOP;

  IF v_asset_count = 0 OR v_total_amount <= 0 THEN
    DELETE FROM public.acc_journal_headers WHERE id = v_header_id;
    RAISE EXCEPTION 'Nem sikerült érvényes könyvelési tételpárokat generálni a megadott adatokból.';
  END IF;

  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number
    FROM public.acc_journal_headers
   WHERE id = v_header_id;

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'total_amount', v_total_amount,
    'asset_count', v_asset_count,
    'message', 'Sikeres ÉCS könyvelés! Bizonylatszám: ' || p_document_id || ' (Naplósorszám: ' || COALESCE(v_journal_number::text, '-') || ')'
  );
END;
$$;

-- 3. Terven felüli ÉCS és visszaírás könyvelése (post_unplanned_depreciation_to_gl)
CREATE OR REPLACE FUNCTION public.post_unplanned_depreciation_to_gl(
  p_company_id uuid,
  p_asset_id uuid,
  p_event_type text, -- 'unplanned_depreciation' vagy 'unplanned_depreciation_reversal'
  p_amount numeric,
  p_posting_date date,
  p_document_id text,
  p_reason text,
  p_currency text DEFAULT 'HUF'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_asset record;
  v_existing_id uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_contra_gl_account_id uuid;
  v_contra_gl_number text;
  v_asset_gl_number text;
  v_deprec_gl_account_id uuid;
  v_deprec_gl_number text;
  v_journal_number integer;
  v_is_reversal boolean;
  v_seq smallint := 1;
BEGIN
  v_uid := auth.uid();

  IF NOT public.check_user_can_auto_post_gl(p_company_id, false) THEN
    RAISE EXCEPTION 'Nincs jogosultsága terven felüli értékcsökkenés feladásához a céghez (id: %)', p_company_id;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Az összegnek 0-nál nagyobbnak kell lennie!';
  END IF;

  IF p_event_type NOT IN ('unplanned_depreciation', 'unplanned_depreciation_reversal') THEN
    RAISE EXCEPTION 'Érvénytelen jogcím: %, megengedett: unplanned_depreciation, unplanned_depreciation_reversal', p_event_type;
  END IF;

  v_is_reversal := (p_event_type = 'unplanned_depreciation_reversal');

  -- Eszköz lekérdezése
  SELECT fa.*, ga.gl_number as asset_gl_number
    INTO v_asset
    FROM public.fixed_assets fa
    LEFT JOIN public.gl_accounts ga ON ga.id = fa.gl_account_id
   WHERE fa.id = p_asset_id
     AND fa.company_id = p_company_id;

  IF v_asset.id IS NULL THEN
    RAISE EXCEPTION 'A megadott eszköz nem található ennél a cégnél.';
  END IF;

  -- Duplikáció ellenőrzés
  SELECT id INTO v_existing_id
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = p_document_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ezzel a bizonylatszámmal (%) már létezik lekönyvelt tétel a Vegyes naplóban!', p_document_id;
  END IF;

  -- Vegyes napló megkeresése
  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
   ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id
      FROM public.acc_journals
     WHERE company_id = p_company_id AND is_active = true
     LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
  END IF;

  -- 1x9 halmozott/terven felüli ÉCS számla feloldása
  v_asset_gl_number := COALESCE(v_asset.asset_gl_number, '131');
  IF v_asset_gl_number LIKE '12%' THEN
    v_deprec_gl_number := '129';
  ELSIF v_asset_gl_number LIKE '13%' THEN
    v_deprec_gl_number := '139';
  ELSIF v_asset_gl_number LIKE '14%' THEN
    v_deprec_gl_number := '149';
  ELSIF v_asset_gl_number LIKE '11%' THEN
    v_deprec_gl_number := '119';
  ELSE
    v_deprec_gl_number := '139';
  END IF;

  SELECT id INTO v_deprec_gl_account_id
    FROM public.gl_accounts
   WHERE gl_number LIKE v_deprec_gl_number || '%'
   ORDER BY length(gl_number) ASC
   LIMIT 1;

  IF v_deprec_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Nem található megfelelő halmozott ÉCS számla (pl. %) a számlatükörben.', v_deprec_gl_number;
  END IF;

  -- 866 (Ráfordítás) vagy 966 (Bevétel visszaírás) számla feloldása
  IF NOT v_is_reversal THEN
    -- Elszámolás: T 866 -> K 1x9
    SELECT id, gl_number INTO v_contra_gl_account_id, v_contra_gl_number
      FROM public.gl_accounts
     WHERE gl_number LIKE '866%'
     ORDER BY length(gl_number) ASC
     LIMIT 1;

    IF v_contra_gl_account_id IS NULL THEN
      -- Fallback 86-os egyéb ráfordítás
      SELECT id, gl_number INTO v_contra_gl_account_id, v_contra_gl_number
        FROM public.gl_accounts
       WHERE gl_number LIKE '86%'
       ORDER BY length(gl_number) ASC
       LIMIT 1;
    END IF;
  ELSE
    -- Visszaírás: T 1x9 -> K 966
    SELECT id, gl_number INTO v_contra_gl_account_id, v_contra_gl_number
      FROM public.gl_accounts
     WHERE gl_number LIKE '966%'
     ORDER BY length(gl_number) ASC
     LIMIT 1;

    IF v_contra_gl_account_id IS NULL THEN
      -- Fallback 96-os egyéb bevétel
      SELECT id, gl_number INTO v_contra_gl_account_id, v_contra_gl_number
        FROM public.gl_accounts
       WHERE gl_number LIKE '96%'
       ORDER BY length(gl_number) ASC
       LIMIT 1;
    END IF;
  END IF;

  IF v_contra_gl_account_id IS NULL THEN
    RAISE EXCEPTION 'Nem található megfelelő 866 vagy 966 számla a számlatükörben.';
  END IF;

  -- Fejléc létrehozása
  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    currency,
    posting_date,
    document_date,
    document_id,
    description,
    justification,
    created_by,
    posted_by
  ) VALUES (
    p_company_id,
    v_journal_id,
    EXTRACT(YEAR FROM p_posting_date)::smallint,
    'PISZKOZAT',
    'NORMAL',
    'AUTOMATIKUS',
    COALESCE(p_currency, 'HUF'),
    p_posting_date,
    p_posting_date,
    p_document_id,
    CASE WHEN v_is_reversal 
      THEN 'Terven felüli ÉCS visszaírása: ' || v_asset.name || ' (' || v_asset.inventory_number || ')'
      ELSE 'Terven felüli ÉCS elszámolása: ' || v_asset.name || ' (' || v_asset.inventory_number || ')'
    END,
    COALESCE(p_reason, 'Tárgyi eszköz terven felüli értékváltozás'),
    v_uid,
    v_uid
  ) RETURNING id INTO v_header_id;

  -- Sorok beszúrása dimenziókkal
  IF NOT v_is_reversal THEN
    -- Elszámolás: T 866 -> K 1x9
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
    ) VALUES (
      v_header_id, v_seq, v_contra_gl_account_id, 'T', p_amount,
      'Terven felüli ÉCS ráfordítás — ' || v_asset.name || ' (' || v_asset.inventory_number || ')',
      v_asset.id, v_asset.cost_center_id, v_asset.project_id
    );
    v_seq := v_seq + 1;

    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
    ) VALUES (
      v_header_id, v_seq, v_deprec_gl_account_id, 'K', p_amount,
      'Halmozott ÉCS (terven felüli) — ' || v_asset.name || ' (' || v_asset.inventory_number || ')',
      v_asset.id, v_asset.cost_center_id, v_asset.project_id
    );
  ELSE
    -- Visszaírás: T 1x9 -> K 966
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
    ) VALUES (
      v_header_id, v_seq, v_deprec_gl_account_id, 'T', p_amount,
      'Halmozott ÉCS visszaírása — ' || v_asset.name || ' (' || v_asset.inventory_number || ')',
      v_asset.id, v_asset.cost_center_id, v_asset.project_id
    );
    v_seq := v_seq + 1;

    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id, cost_center_id, project_id
    ) VALUES (
      v_header_id, v_seq, v_contra_gl_account_id, 'K', p_amount,
      'Terven felüli ÉCS visszaírás bevétele — ' || v_asset.name || ' (' || v_asset.inventory_number || ')',
      v_asset.id, v_asset.cost_center_id, v_asset.project_id
    );
  END IF;

  -- Könyvelés véglegesítése
  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number
    FROM public.acc_journal_headers
   WHERE id = v_header_id;

  -- Esemény bejegyzése a timeline-ra
  INSERT INTO public.asset_events (
    asset_id,
    company_id,
    user_id,
    event_type,
    event_date,
    description,
    old_values,
    new_values
  ) VALUES (
    v_asset.id,
    p_company_id,
    v_uid,
    p_event_type,
    p_posting_date,
    CASE WHEN v_is_reversal 
      THEN 'Terven felüli ÉCS visszaírás (' || p_document_id || '): +' || p_amount::text || ' Ft — ' || COALESCE(p_reason, '')
      ELSE 'Terven felüli ÉCS elszámolás (' || p_document_id || '): -' || p_amount::text || ' Ft — ' || COALESCE(p_reason, '')
    END,
    jsonb_build_object(
      'event_type', p_event_type,
      'document_id', p_document_id
    ),
    jsonb_build_object(
      'amount', p_amount,
      'posting_date', p_posting_date,
      'journal_header_id', v_header_id,
      'journal_number', v_journal_number,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'amount', p_amount,
    'event_type', p_event_type,
    'message', CASE WHEN v_is_reversal 
      THEN 'Terven felüli ÉCS visszaírás sikeresen lekönyvelve! Bizonylatszám: ' || p_document_id || ' (Naplósorszám: ' || COALESCE(v_journal_number::text, '-') || ')'
      ELSE 'Terven felüli ÉCS elszámolás sikeresen lekönyvelve! Bizonylatszám: ' || p_document_id || ' (Naplósorszám: ' || COALESCE(v_journal_number::text, '-') || ')'
    END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.post_unplanned_depreciation_to_gl(uuid, uuid, text, numeric, date, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_unplanned_depreciation_to_gl(uuid, uuid, text, numeric, date, text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_depreciation_run_to_gl(uuid, text, date, date, date, text, text, text, jsonb) TO authenticated, service_role;
