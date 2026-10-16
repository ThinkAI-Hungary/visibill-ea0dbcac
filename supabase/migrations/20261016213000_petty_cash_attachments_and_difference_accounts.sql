-- ==============================================================================
-- Migration: 20261016213000_petty_cash_attachments_and_difference_accounts.sql
-- Description: Házipénztár Revise & Upgrade (4.1 & 4.2)
--              1. Storage: petty-cash-attachments bucket és RLS policy-k
--              2. petty_cash_entries: attachment_url, attachment_path, source_doc_type, source_doc_id
--              3. cash_receipts: attachment_url, attachment_path
--              4. create_cash_receipt_with_seq RPC: attachment_url és attachment_path kezelése
--              5. finalize_cash_report_closing RPC: Sztv. szerinti hiány/többlet számlák (869, 969, 361)
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Storage bucket: petty-cash-attachments
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'petty-cash-attachments',
  'petty-cash-attachments',
  false,
  15728640, -- 15MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

-- Storage bucket RLS policies for petty-cash-attachments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_select_petty_cash_attachments'
  ) THEN
    CREATE POLICY "company_members_select_petty_cash_attachments"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'petty-cash-attachments' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_insert_petty_cash_attachments'
  ) THEN
    CREATE POLICY "company_members_insert_petty_cash_attachments"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'petty-cash-attachments' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_update_petty_cash_attachments'
  ) THEN
    CREATE POLICY "company_members_update_petty_cash_attachments"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
      bucket_id = 'petty-cash-attachments' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_delete_petty_cash_attachments'
  ) THEN
    CREATE POLICY "company_members_delete_petty_cash_attachments"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'petty-cash-attachments' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. petty_cash_entries tábla bővítése
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.petty_cash_entries
  ADD COLUMN IF NOT EXISTS attachment_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_path text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_doc_type text DEFAULT NULL
    CHECK (source_doc_type IS NULL OR source_doc_type IN ('invoice', 'payroll', 'travel_order', 'bank_withdrawal', 'owner_loan', 'other')),
  ADD COLUMN IF NOT EXISTS source_doc_id text DEFAULT NULL;

COMMENT ON COLUMN public.petty_cash_entries.attachment_url IS 'Közvetlenül csatolt bizonylat (fotó/PDF) publikus vagy generált elérési útja';
COMMENT ON COLUMN public.petty_cash_entries.attachment_path IS 'Storage relatív útvonal (company_id/receipts/filename)';
COMMENT ON COLUMN public.petty_cash_entries.source_doc_type IS 'Forrásdokumentum jogcím szerinti típusa (invoice, payroll, travel_order, bank_withdrawal, owner_loan, other)';
COMMENT ON COLUMN public.petty_cash_entries.source_doc_id IS 'Mögöttes bizonylati fedezet sorszáma vagy azonosítója';

CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_source_doc
  ON public.petty_cash_entries(company_id, source_doc_type, source_doc_id)
  WHERE source_doc_type IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cash_receipts tábla bővítése
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.cash_receipts
  ADD COLUMN IF NOT EXISTS attachment_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS attachment_path text DEFAULT NULL;

COMMENT ON COLUMN public.cash_receipts.attachment_url IS 'Közvetlenül csatolt bizonylat elérési útja';
COMMENT ON COLUMN public.cash_receipts.attachment_path IS 'Storage relatív útvonal';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. create_cash_receipt_with_seq RPC frissítése (Attachment támogatással)
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.create_cash_receipt_with_seq(uuid, uuid, uuid, text, date, text, text, numeric, text, text, text, text, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_cash_receipt_with_seq(uuid, uuid, uuid, text, date, text, text, numeric, text, text, text, text, uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_cash_receipt_with_seq(
  p_company_id uuid,
  p_cash_register_id uuid,
  p_cash_entry_id uuid,
  p_receipt_type text,
  p_issued_at date,
  p_payer_or_payee_name text,
  p_payer_or_payee_address text,
  p_amount numeric,
  p_currency text,
  p_amount_in_words text,
  p_legal_title text,
  p_description text,
  p_partner_id uuid DEFAULT NULL,
  p_payer_signature text DEFAULT NULL,
  p_recipient_signature text DEFAULT NULL,
  p_source_doc_type text DEFAULT NULL,
  p_source_doc_id text DEFAULT NULL,
  p_attachment_url text DEFAULT NULL,
  p_attachment_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_year text;
  v_seq_no integer;
  v_base_prefix text;
  v_reg_prefix text;
  v_full_prefix text;
  v_receipt_number text;
  v_receipt_id uuid;
  v_result jsonb;
BEGIN
  -- Multi-tenancy membership check
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = (SELECT auth.uid())
    )
    OR auth.uid() IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég pénztárbizonylatainak kiállítására.';
  END IF;

  IF p_receipt_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Érvénytelen bizonylat típus: % (csak in vagy out megengedett)', p_receipt_type;
  END IF;

  -- Pénztár egyedi prefix kiolvasása (pl. 'GYOR-')
  SELECT COALESCE(trim(receipt_prefix), '')
    INTO v_reg_prefix
    FROM public.petty_cash_registers
   WHERE id = p_cash_register_id;

  v_year := to_char(COALESCE(p_issued_at, CURRENT_DATE), 'YYYY');
  v_base_prefix := CASE WHEN p_receipt_type = 'in' THEN 'BPB-' ELSE 'KPB-' END;

  IF v_reg_prefix <> '' THEN
    IF NOT v_reg_prefix LIKE '%-' THEN
      v_reg_prefix := v_reg_prefix || '-';
    END IF;
    v_full_prefix := v_base_prefix || v_reg_prefix;
  ELSE
    v_full_prefix := v_base_prefix;
  END IF;

  -- Advisory lock a céges és pénztári bizonylatsorszám hézagmentességének biztosítására
  PERFORM pg_advisory_xact_lock(hashtext('cash_receipt_' || p_company_id::text || '_' || p_cash_register_id::text || '_' || p_receipt_type || '_' || v_year));

  SELECT COALESCE(MAX(seq_no), 0) + 1
    INTO v_seq_no
    FROM public.cash_receipts
   WHERE company_id = p_company_id
     AND cash_register_id = p_cash_register_id
     AND receipt_type = p_receipt_type
     AND to_char(issued_at, 'YYYY') = v_year;

  v_receipt_number := v_full_prefix || v_year || '-' || lpad(v_seq_no::text, 5, '0');

  INSERT INTO public.cash_receipts (
    company_id,
    cash_register_id,
    cash_entry_id,
    receipt_type,
    seq_no,
    receipt_number,
    issued_at,
    partner_id,
    payer_or_payee_name,
    payer_or_payee_address,
    amount,
    currency,
    amount_in_words,
    legal_title,
    description,
    payer_signature,
    recipient_signature,
    source_doc_type,
    source_doc_id,
    attachment_url,
    attachment_path,
    created_by
  ) VALUES (
    p_company_id,
    p_cash_register_id,
    p_cash_entry_id,
    p_receipt_type,
    v_seq_no,
    v_receipt_number,
    COALESCE(p_issued_at, CURRENT_DATE),
    p_partner_id,
    p_payer_or_payee_name,
    p_payer_or_payee_address,
    p_amount,
    COALESCE(p_currency, 'HUF'),
    p_amount_in_words,
    p_legal_title,
    p_description,
    p_payer_signature,
    p_recipient_signature,
    p_source_doc_type,
    p_source_doc_id,
    p_attachment_url,
    p_attachment_path,
    (SELECT auth.uid())
  )
  RETURNING id INTO v_receipt_id;

  -- Ha van csatolt petty_cash_entry, kössük vissza a bizonylatszámot és csatolmányt
  IF p_cash_entry_id IS NOT NULL THEN
    UPDATE public.petty_cash_entries
       SET receipt_id = v_receipt_id,
           receipt_number = v_receipt_number,
           direction = p_receipt_type,
           legal_title = COALESCE(legal_title, p_legal_title),
           attachment_url = COALESCE(attachment_url, p_attachment_url),
           attachment_path = COALESCE(attachment_path, p_attachment_path),
           source_doc_type = COALESCE(source_doc_type, p_source_doc_type),
           source_doc_id = COALESCE(source_doc_id, p_source_doc_id)
     WHERE id = p_cash_entry_id
       AND company_id = p_company_id;
  END IF;

  SELECT to_jsonb(r) INTO v_result
    FROM public.cash_receipts r
   WHERE r.id = v_receipt_id;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_cash_receipt_with_seq(uuid, uuid, uuid, text, date, text, text, numeric, text, text, text, text, uuid, text, text, text, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_cash_receipt_with_seq(uuid, uuid, uuid, text, date, text, text, numeric, text, text, text, text, uuid, text, text, text, text, text, text) TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. finalize_cash_report_closing RPC frissítése: Sztv. leltáreltérés számlák
--    Többlet: 969 (Egyéb bevételek)
--    Hiány: 869 (Egyéb ráfordítások) vagy 361 (Munkavállalóval szembeni követelés)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalize_cash_report_closing(
  p_company_id uuid,
  p_cash_report_id uuid,
  p_closing_balance_actual numeric,
  p_denomination_rows jsonb DEFAULT '[]'::jsonb,
  p_difference_reason text DEFAULT NULL,
  p_difference_action text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_expected_book_balance numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_report RECORD;
  v_total_in numeric := 0;
  v_total_out numeric := 0;
  v_closing_book numeric := 0;
  v_diff numeric := 0;
  v_balancing_entry_id uuid;
  v_line_no integer := 1;
  v_entry RECORD;
  v_content_to_hash text := '';
  v_hash text;
  v_contra_account text;
  v_legal_title text;
  v_action_desc text;
BEGIN
  v_user_id := (SELECT auth.uid());

  -- Jogosultság ellenőrzés
  IF NOT (
    public.is_company_member_or_above(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.company_members cm 
       WHERE cm.company_id = p_company_id 
         AND cm.user_id = v_user_id
    )
    OR v_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a pénztárjelentés lezárására.';
  END IF;

  SELECT * INTO v_report
    FROM public.cash_reports
   WHERE id = p_cash_report_id
     AND company_id = p_company_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A pénztárjelentés nem található.';
  END IF;

  IF v_report.status NOT IN ('open', 'closing', 'reopened') THEN
    RAISE EXCEPTION 'Csak nyitott vagy újranyitott pénztárjelentés zárható le! (Jelenlegi státusz: %)', v_report.status;
  END IF;

  -- Nyitott, árva tételek csatolása az időszakhoz
  UPDATE public.petty_cash_entries
     SET cash_report_id = p_cash_report_id
   WHERE company_id = p_company_id
     AND register_id = v_report.cash_register_id
     AND currency = v_report.currency
     AND entry_date >= v_report.period_start
     AND entry_date <= v_report.period_end
     AND (
       cash_report_id IS NULL 
       OR cash_report_id = p_cash_report_id
       OR cash_report_id IN (
         SELECT cr.id FROM public.cash_reports cr 
          WHERE cr.id = petty_cash_entries.cash_report_id 
            AND cr.status IN ('open', 'closing', 'reopened')
       )
     )
     AND status <> 'cancelled';

  -- 1. Bevételek és kiadások kalkulálása a csatolt tételekből
  SELECT 
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)
  INTO v_total_in, v_total_out
  FROM public.petty_cash_entries
  WHERE cash_report_id = p_cash_report_id
    AND status <> 'cancelled';

  v_closing_book := v_report.opening_balance + v_total_in - v_total_out;

  -- Optimista konkurencia ellenőrzés
  IF p_expected_book_balance IS NOT NULL AND ABS(v_closing_book - p_expected_book_balance) > 0.01 THEN
    RAISE EXCEPTION 'A könyv szerinti záró egyenleg a számlálás közben megváltozott (eredeti: %, aktuális: %)! Kérjük, nyisd meg újra a varázslót és ellenőrizd az időközben érkezett tételeket.', p_expected_book_balance, v_closing_book;
  END IF;

  v_diff := p_closing_balance_actual - v_closing_book;

  -- 2. Eltérés esetén Sztv. szerinti kiegyenlítő tétel rögzítése
  IF v_diff <> 0 THEN
    IF p_difference_reason IS NULL OR trim(p_difference_reason) = '' THEN
      RAISE EXCEPTION 'Az eltéréshez (% %) indoklás megadása kötelező a Számviteli törvény szerint!', v_diff, v_report.currency;
    END IF;

    IF v_diff > 0 THEN
      -- Többlet: bevétel (969 Egyéb bevétel ellenszámla az Sztv. szerint)
      v_contra_account := '969';
      v_legal_title := 'Pénztári leltártöbblet';
      v_action_desc := 'Pénztári többlet elszámolása (T 381 → K 969): ' || p_difference_reason;

      INSERT INTO public.petty_cash_entries (
        company_id,
        register_id,
        cash_report_id,
        entry_date,
        description,
        amount,
        currency,
        source_type,
        direction,
        legal_title,
        gl_contra_account,
        status,
        created_by
      ) VALUES (
        p_company_id,
        v_report.cash_register_id,
        p_cash_report_id,
        v_report.period_end,
        v_action_desc,
        v_diff,
        v_report.currency,
        'manual',
        'in',
        v_legal_title,
        v_contra_account,
        'posted',
        v_user_id
      ) RETURNING id INTO v_balancing_entry_id;

      v_total_in := v_total_in + v_diff;
    ELSE
      -- Hiány: kiadás (869 Egyéb ráfordítás vagy 361 Dolgozói kártérítés)
      IF p_difference_action IN ('shortage_employee_claim', 'cashier_claim') THEN
        v_contra_account := '361';
        v_legal_title := 'Pénztári leltárhiány (dolgozói kártérítés)';
        v_action_desc := 'Pénztárosi hiány megtérítési előírás (T 361 → K 969 / K 381): ' || p_difference_reason;
      ELSE
        v_contra_account := '869';
        v_legal_title := 'Pénztári leltárhiány (egyéb ráfordítás)';
        v_action_desc := 'Pénztári hiány elszámolása (T 869 → K 381): ' || p_difference_reason;
      END IF;

      INSERT INTO public.petty_cash_entries (
        company_id,
        register_id,
        cash_report_id,
        entry_date,
        description,
        amount,
        currency,
        source_type,
        direction,
        legal_title,
        gl_contra_account,
        status,
        created_by
      ) VALUES (
        p_company_id,
        v_report.cash_register_id,
        p_cash_report_id,
        v_report.period_end,
        v_action_desc,
        v_diff, -- negatív összeg kiadásként
        v_report.currency,
        'manual',
        'out',
        v_legal_title,
        v_contra_account,
        'posted',
        v_user_id
      ) RETURNING id INTO v_balancing_entry_id;

      v_total_out := v_total_out + ABS(v_diff);
    END IF;
  END IF;

  -- 3. Sorfolytonos line_no kiosztása és bizonylatszám rendezése
  v_line_no := 1;
  FOR v_entry IN
    SELECT id, entry_date, created_at
      FROM public.petty_cash_entries
     WHERE cash_report_id = p_cash_report_id
       AND status <> 'cancelled'
     ORDER BY entry_date ASC, created_at ASC
  LOOP
    UPDATE public.petty_cash_entries
       SET line_no = v_line_no
     WHERE id = v_entry.id;

    v_line_no := v_line_no + 1;
  END LOOP;

  -- 4. SHA-256 Integritási hash képzése
  v_content_to_hash := p_company_id::text || '|' ||
                       v_report.cash_register_id::text || '|' ||
                       COALESCE(v_report.report_number, '') || '|' ||
                       v_report.opening_balance::text || '|' ||
                       v_total_in::text || '|' ||
                       v_total_out::text || '|' ||
                       p_closing_balance_actual::text;

  v_hash := encode(digest(v_content_to_hash, 'sha256'), 'hex');

  -- 5. Címletjegyzék mentése (ha érkezett)
  IF p_denomination_rows IS NOT NULL AND jsonb_array_length(p_denomination_rows) > 0 THEN
    DELETE FROM public.cash_report_denominations
     WHERE cash_report_id = p_cash_report_id;

    INSERT INTO public.cash_report_denominations (
      cash_report_id,
      denomination,
      count,
      subtotal
    )
    SELECT 
      p_cash_report_id,
      (elem->>'denomination')::numeric,
      (elem->>'count')::integer,
      (elem->>'subtotal')::numeric
    FROM jsonb_array_elements(p_denomination_rows) AS elem;
  END IF;

  -- 6. Zárási jegyzőkönyv frissítése / mentése
  INSERT INTO public.cash_closing_protocols (
    cash_report_id,
    company_id,
    register_id,
    difference,
    difference_reason,
    action_taken,
    notes,
    verified_by
  ) VALUES (
    p_cash_report_id,
    p_company_id,
    v_report.cash_register_id,
    v_diff,
    p_difference_reason,
    COALESCE(p_difference_action, CASE WHEN v_diff = 0 THEN 'balanced' ELSE 'booked_as_expense' END),
    p_notes,
    v_user_id
  )
  ON CONFLICT (cash_report_id) DO UPDATE SET
    difference = EXCLUDED.difference,
    difference_reason = EXCLUDED.difference_reason,
    action_taken = EXCLUDED.action_taken,
    notes = EXCLUDED.notes,
    verified_by = EXCLUDED.verified_by,
    verified_at = now();

  -- 7. Pénztárjelentés státusz frissítése: closed
  UPDATE public.cash_reports
     SET status = 'closed',
         total_in = v_total_in,
         total_out = v_total_out,
         closing_balance_book = v_closing_book,
         closing_balance_actual = p_closing_balance_actual,
         difference = v_diff,
         content_hash = v_hash,
         closed_by = v_user_id,
         closed_at = now(),
         updated_at = now()
   WHERE id = p_cash_report_id;

  RETURN jsonb_build_object(
    'success', true,
    'cash_report_id', p_cash_report_id,
    'status', 'closed',
    'total_in', v_total_in,
    'total_out', v_total_out,
    'closing_balance_book', v_closing_book,
    'closing_balance_actual', p_closing_balance_actual,
    'difference', v_diff,
    'balancing_entry_id', v_balancing_entry_id,
    'content_hash', v_hash
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_cash_report_closing(uuid, uuid, numeric, jsonb, text, text, text, numeric) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_cash_report_closing(uuid, uuid, numeric, jsonb, text, text, text, numeric) TO authenticated, service_role;
