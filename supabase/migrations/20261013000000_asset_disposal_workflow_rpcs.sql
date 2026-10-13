-- ============================================================================
-- TENY M1.4: Kivezetési (értékesítés / selejtezés / leltárhiány / térítés
-- nélküli átadás) jóváhagyási workflow és atomi könyvelés
-- ----------------------------------------------------------------------------
-- D-4: a kivezetés `fixed_assets.disposal_status` állapotgépen fut:
--   none | rejected -> pending_approval (request_asset_disposal, member_write)
--   pending_approval -> approved        (approve_asset_disposal, ledger_write + könyvelés)
--   pending_approval -> rejected        (reject_asset_disposal,  ledger_write)
--
-- Jóváhagyás nélkül az eszköz NEM kerül ki a könyvekből: az `approved`
-- állapotba lépést a `trg_fixed_assets_disposal_status_guard` trigger is védi.
-- A könyvelési sorokat a kliens szolgáltatás számolja (assetDisposalPostingService),
-- az RPC validálja (kiegyensúlyozott, pozitív összegek, létező főkönyvi számlák)
-- és egy tranzakcióban könyveli + zárja le az eszközt.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Kivezetés kezdeményezése (Jóváhagyásra vár)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_asset_disposal(
  p_company_id uuid,
  p_asset_id uuid,
  p_reason_type text,
  p_disposal_date date,
  p_reason text DEFAULT NULL,
  p_committee jsonb DEFAULT NULL,
  p_waste_info jsonb DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.fixed_assets%ROWTYPE;
BEGIN
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  IF p_reason_type IS NULL OR p_reason_type NOT IN ('sale', 'scrapping', 'inventory_shortage', 'donation') THEN
    RAISE EXCEPTION 'Ismeretlen kivezetési jogcím: %', COALESCE(p_reason_type, 'NULL');
  END IF;

  IF p_disposal_date IS NULL THEN
    RAISE EXCEPTION 'A kivezetés dátuma kötelező.';
  END IF;

  SELECT * INTO v_asset
    FROM public.fixed_assets
   WHERE id = p_asset_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A tárgyi eszköz nem található a megadott cégnél.';
  END IF;

  IF v_asset.status <> 'active' THEN
    RAISE EXCEPTION 'Csak aktív eszköz vezethető ki (jelenlegi státusz: %).', v_asset.status;
  END IF;

  IF v_asset.disposal_status = 'pending_approval' THEN
    RAISE EXCEPTION 'Az eszköz kivezetése már jóváhagyásra vár.';
  END IF;

  IF v_asset.activation_date IS NOT NULL AND p_disposal_date < v_asset.activation_date THEN
    RAISE EXCEPTION 'A kivezetés dátuma nem lehet korábbi az aktiválás dátumánál (%).', v_asset.activation_date;
  END IF;

  UPDATE public.fixed_assets
     SET disposal_status      = 'pending_approval',
         disposal_reason_type = p_reason_type,
         disposal_committee   = p_committee,
         disposal_waste_info  = p_waste_info,
         disposal_details     = COALESCE(p_details, '{}'::jsonb) || jsonb_build_object(
                                  'requested_disposal_date', p_disposal_date,
                                  'reason', p_reason,
                                  'requested_by', v_uid,
                                  'requested_at', now()
                                ),
         updated_at           = now()
   WHERE id = p_asset_id;

  INSERT INTO public.asset_events (
    asset_id, company_id, user_id, event_type, event_date, description, old_values, new_values
  ) VALUES (
    p_asset_id,
    p_company_id,
    v_uid,
    'disposal_requested',
    p_disposal_date,
    COALESCE(NULLIF(btrim(p_reason), ''), 'Kivezetés kezdeményezve') || ' (' || p_reason_type || ')',
    jsonb_build_object('disposal_status', v_asset.disposal_status),
    jsonb_build_object('disposal_status', 'pending_approval', 'reason_type', p_reason_type, 'disposal_date', p_disposal_date)
  );

  RETURN jsonb_build_object('success', true, 'asset_id', p_asset_id, 'disposal_status', 'pending_approval');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_asset_disposal(uuid, uuid, text, date, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_asset_disposal(uuid, uuid, text, date, text, jsonb, jsonb, jsonb) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Kivezetés elutasítása
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_asset_disposal(
  p_company_id uuid,
  p_asset_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.fixed_assets%ROWTYPE;
BEGIN
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  SELECT * INTO v_asset
    FROM public.fixed_assets
   WHERE id = p_asset_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A tárgyi eszköz nem található a megadott cégnél.';
  END IF;

  IF v_asset.disposal_status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Csak jóváhagyásra váró kivezetés utasítható el (jelenlegi állapot: %).', v_asset.disposal_status;
  END IF;

  UPDATE public.fixed_assets
     SET disposal_status  = 'rejected',
         disposal_details = COALESCE(disposal_details, '{}'::jsonb) || jsonb_build_object(
                              'rejected_by', v_uid,
                              'rejected_at', now(),
                              'rejection_reason', p_reason
                            ),
         updated_at       = now()
   WHERE id = p_asset_id;

  INSERT INTO public.asset_events (
    asset_id, company_id, user_id, event_type, event_date, description, old_values, new_values
  ) VALUES (
    p_asset_id,
    p_company_id,
    v_uid,
    'disposal_rejected',
    CURRENT_DATE,
    COALESCE(NULLIF(btrim(p_reason), ''), 'Kivezetés elutasítva'),
    jsonb_build_object('disposal_status', 'pending_approval'),
    jsonb_build_object('disposal_status', 'rejected')
  );

  RETURN jsonb_build_object('success', true, 'asset_id', p_asset_id, 'disposal_status', 'rejected');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reject_asset_disposal(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_asset_disposal(uuid, uuid, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Kivezetés jóváhagyása és főkönyvi könyvelése (atomi)
-- ─────────────────────────────────────────────────────────────────────────────
-- p_lines: [{ "gl_account_id": uuid, "dc_type": "T"|"K", "amount": number, "description": text }, ...]
CREATE OR REPLACE FUNCTION public.approve_asset_disposal(
  p_company_id uuid,
  p_asset_id uuid,
  p_lines jsonb,
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_asset public.fixed_assets%ROWTYPE;
  v_disposal_date date;
  v_clean_inv text;
  v_doc_id text;
  v_existing uuid;
  v_journal_id uuid;
  v_header_id uuid;
  v_journal_number integer;
  v_line jsonb;
  v_seq integer := 0;
  v_amount numeric;
  v_dc text;
  v_total_t numeric := 0;
  v_total_k numeric := 0;
  v_new_status text;
  v_label text;
BEGIN
  PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');

  SELECT * INTO v_asset
    FROM public.fixed_assets
   WHERE id = p_asset_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A tárgyi eszköz nem található a megadott cégnél.';
  END IF;

  IF v_asset.status <> 'active' THEN
    RAISE EXCEPTION 'Csak aktív eszköz vezethető ki (jelenlegi státusz: %).', v_asset.status;
  END IF;

  IF v_asset.disposal_status <> 'pending_approval' OR v_asset.disposal_reason_type IS NULL THEN
    RAISE EXCEPTION 'A kivezetés nem vár jóváhagyásra (állapot: %).', v_asset.disposal_status;
  END IF;

  v_disposal_date := NULLIF(v_asset.disposal_details->>'requested_disposal_date', '')::date;
  IF v_disposal_date IS NULL THEN
    RAISE EXCEPTION 'A kezdeményezett kivezetési dátum hiányzik.';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'A kivezetési könyvelés legalább két tételsort igényel.';
  END IF;

  -- Sorok előzetes validálása (összeg, T/K, létező főkönyvi számla, egyensúly)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_amount := (v_line->>'amount')::numeric;
    v_dc := v_line->>'dc_type';

    IF v_amount IS NULL OR v_amount <= 0 THEN
      RAISE EXCEPTION 'Érvénytelen tételösszeg a kivezetési könyvelésben.';
    END IF;
    IF v_dc IS NULL OR v_dc NOT IN ('T', 'K') THEN
      RAISE EXCEPTION 'Érvénytelen T/K jelölés a kivezetési könyvelésben.';
    END IF;
    IF NOT EXISTS (
      SELECT 1
        FROM public.gl_accounts g
       WHERE g.id = (v_line->>'gl_account_id')::uuid
         AND (
           g.company_id = p_company_id
           OR g.preset_id IN (
             SELECT cp.id FROM public.chart_of_accounts_presets cp
              WHERE cp.company_id = p_company_id OR cp.type = 'generic'
           )
         )
    ) THEN
      RAISE EXCEPTION 'Ismeretlen vagy a céghez nem tartozó főkönyvi számla a kivezetési könyvelésben.';
    END IF;

    IF v_dc = 'T' THEN v_total_t := v_total_t + v_amount; ELSE v_total_k := v_total_k + v_amount; END IF;
  END LOOP;

  IF round(v_total_t, 2) <> round(v_total_k, 2) THEN
    RAISE EXCEPTION 'A kivezetési könyvelés nem egyensúlyban van (T: %, K: %).', v_total_t, v_total_k;
  END IF;

  v_clean_inv := regexp_replace(v_asset.inventory_number, '[^a-zA-Z0-9_-]', '_', 'g');
  v_doc_id := 'KIV-' || v_clean_inv;

  SELECT id INTO v_existing
    FROM public.acc_journal_headers
   WHERE company_id = p_company_id
     AND document_id = v_doc_id
     AND status <> 'SZTORNOZOTT'
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Ehhez az eszközhöz már létezik kivezetési tétel (%).', v_doc_id;
  END IF;

  SELECT id INTO v_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND is_active = true
     AND (code IN ('VE', 'VEG') OR type = 'MIXED' OR name ILIKE '%vegyes%')
   ORDER BY CASE WHEN code = 'VE' THEN 1 WHEN type = 'MIXED' THEN 2 ELSE 3 END
   LIMIT 1;

  IF v_journal_id IS NULL THEN
    SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND is_active = true LIMIT 1;
  END IF;

  IF v_journal_id IS NULL THEN
    RAISE EXCEPTION 'Nem található aktív Vegyes könyvelési napló a cégnél.';
  END IF;

  v_label := CASE v_asset.disposal_reason_type
    WHEN 'sale' THEN 'értékesítés'
    WHEN 'scrapping' THEN 'selejtezés'
    WHEN 'inventory_shortage' THEN 'leltárhiány'
    ELSE 'térítés nélküli átadás'
  END;

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source, currency,
    posting_date, document_date, document_id, description, justification, created_by, posted_by
  ) VALUES (
    p_company_id, v_journal_id, EXTRACT(YEAR FROM v_disposal_date)::smallint, 'PISZKOZAT', 'NORMAL', 'AUTOMATIKUS', 'HUF',
    v_disposal_date, v_disposal_date, v_doc_id,
    COALESCE(NULLIF(btrim(p_description), ''),
             'Tárgyi eszköz kivezetés (' || v_label || '): ' || v_asset.name || ' (' || v_asset.inventory_number || ')'),
    'Kivezetési jegyzőkönyv alapján, jóváhagyott kivezetés: ' || v_asset.name || ' (' || v_asset.inventory_number || ')',
    v_uid, v_uid
  ) RETURNING id INTO v_header_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    v_seq := v_seq + 1;
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description, fixed_asset_id
    ) VALUES (
      v_header_id,
      v_seq,
      (v_line->>'gl_account_id')::uuid,
      v_line->>'dc_type',
      round((v_line->>'amount')::numeric, 2),
      COALESCE(NULLIF(v_line->>'description', ''), 'Kivezetés — ' || v_asset.name),
      p_asset_id
    );
  END LOOP;

  PERFORM public.acc_post_journal_entry(v_header_id, v_uid);

  SELECT journal_number INTO v_journal_number FROM public.acc_journal_headers WHERE id = v_header_id;

  v_new_status := CASE WHEN v_asset.disposal_reason_type = 'sale' THEN 'sold' ELSE 'disposed' END;

  UPDATE public.fixed_assets
     SET status                    = v_new_status,
         disposal_date             = v_disposal_date,
         disposal_status           = 'approved',
         disposal_journal_entry_id = v_header_id,
         disposal_details          = COALESCE(disposal_details, '{}'::jsonb) || jsonb_build_object(
                                       'approved_by', v_uid,
                                       'approved_at', now(),
                                       'document_id', v_doc_id,
                                       'journal_number', v_journal_number,
                                       'line_count', v_seq
                                     ),
         updated_at                = now()
   WHERE id = p_asset_id;

  INSERT INTO public.asset_events (
    asset_id, company_id, user_id, event_type, event_date, description, old_values, new_values
  ) VALUES
  (
    p_asset_id, p_company_id, v_uid, 'disposal_approved', v_disposal_date,
    'Kivezetés jóváhagyva és lekönyvelve (' || v_doc_id || ')',
    jsonb_build_object('disposal_status', 'pending_approval', 'status', 'active'),
    jsonb_build_object('disposal_status', 'approved', 'status', v_new_status, 'document_id', v_doc_id, 'header_id', v_header_id)
  ),
  (
    p_asset_id, p_company_id, v_uid, 'disposal', v_disposal_date,
    COALESCE(NULLIF(v_asset.disposal_details->>'reason', ''), 'Kivezetés (' || v_label || ')'),
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', v_new_status, 'disposal_date', v_disposal_date, 'reason_type', v_asset.disposal_reason_type)
  );

  RETURN jsonb_build_object(
    'success', true,
    'asset_id', p_asset_id,
    'header_id', v_header_id,
    'journal_number', v_journal_number,
    'document_id', v_doc_id,
    'status', v_new_status,
    'message', 'Kivezetés jóváhagyva és lekönyvelve (' || v_doc_id || ')'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.approve_asset_disposal(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_asset_disposal(uuid, uuid, jsonb, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
