-- Migration: 20261012140000_technical_accounting_module.sql
-- Description: 22. Technikai könyvelési és elemzési funkciók:
--              1. acc_journal_lines.partner_id séma bővítés és kompozit indexek
--              2. acc_reclassifications audit tábla
--              3. get_partner_360_matrix RPC
--              4. get_omni_partner_ledger RPC
--              5. execute_journal_reclassification RPC
--              6. rollback_journal_reclassification RPC
--              7. detect_accounting_anomalies RPC

-- ═══════════════════════════════════════════════════════════════
-- 1. Séma bővítés: acc_journal_lines partner_id & indexek
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.acc_journal_lines 
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

-- A korábbi sorok partnerét a COALESCE(l.partner_id, h.partner_id) logika transzparensen kezeli a fejlécből.

-- Indexek a nagy sebességű partneri lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_partner_id
  ON public.acc_journal_lines(partner_id)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_gl_partner
  ON public.acc_journal_lines(gl_account_id, partner_id);

CREATE INDEX IF NOT EXISTS idx_acc_journal_headers_company_partner_date
  ON public.acc_journal_headers(company_id, partner_id, posting_date);

-- ═══════════════════════════════════════════════════════════════
-- 2. acc_reclassifications audit tábla
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.acc_reclassifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  batch_number VARCHAR(64) NOT NULL,
  source_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE RESTRICT NOT NULL,
  target_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE RESTRICT NOT NULL,
  clearing_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE RESTRICT,
  reclassification_date DATE NOT NULL,
  status VARCHAR(32) DEFAULT 'EXECUTED' NOT NULL CHECK (status IN ('SIMULATED', 'EXECUTED', 'ROLLED_BACK')),
  affected_lines_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency CHAR(3) DEFAULT 'HUF' NOT NULL,
  source_journal_line_ids UUID[] NOT NULL DEFAULT '{}',
  generated_journal_header_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE SET NULL,
  storno_journal_header_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE SET NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  rolled_back_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rolled_back_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_acc_reclassifications_company_id 
  ON public.acc_reclassifications(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_acc_reclassifications_batch 
  ON public.acc_reclassifications(company_id, batch_number);

ALTER TABLE public.acc_reclassifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_reclassifications;
CREATE POLICY "Allow read access for company members" ON public.acc_reclassifications
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = acc_reclassifications.company_id AND cm.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_reclassifications;
CREATE POLICY "Allow write access for company members" ON public.acc_reclassifications
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = acc_reclassifications.company_id AND cm.user_id = auth.uid()
  ));

-- ═══════════════════════════════════════════════════════════════
-- 3. RPC: get_partner_360_matrix
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_partner_360_matrix(
  p_company_id UUID,
  p_partner_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_partner_record RECORD;
  v_lines JSONB := '[]'::jsonb;
  v_total_receivables NUMERIC(18,2) := 0;
  v_total_payables NUMERIC(18,2) := 0;
  v_net_position NUMERIC(18,2) := 0;
  v_can_compensate BOOLEAN := FALSE;
  v_compensable_amount NUMERIC(18,2) := 0;
BEGIN
  -- Jogosultság ellenőrzése
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég adatainak megtekintéséhez';
  END IF;

  -- Partner adatok lekérése
  SELECT id, name, tax_number, partner_type, email, address, bank_account_number
    INTO v_partner_record
    FROM public.partners
   WHERE id = p_partner_id AND (company_id = p_company_id OR company_id IS NULL);

  IF v_partner_record.id IS NULL THEN
    RAISE EXCEPTION 'A megadott partner nem található';
  END IF;

  -- Főkönyvi számlák szerinti aggregáció
  WITH partner_lines AS (
    SELECT
      l.gl_account_id,
      g.gl_number,
      g.short_name,
      l.dc_type,
      l.amount,
      h.posting_date,
      h.document_id,
      h.currency
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    WHERE h.company_id = p_company_id
      AND (COALESCE(l.partner_id, h.partner_id) = p_partner_id)
      AND h.status IN ('KONYVELT', 'LEKONYVELT')
      AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
      AND (p_end_date IS NULL OR h.posting_date <= p_end_date)
  ),
  aggregated_accounts AS (
    SELECT
      gl_account_id,
      gl_number,
      short_name,
      COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE 0 END), 0) AS total_credit,
      COUNT(*) AS entries_count,
      MAX(posting_date) AS last_posting_date,
      CASE
        WHEN gl_number LIKE '31%' THEN 'RECEIVABLE'
        WHEN gl_number LIKE '454%' THEN 'PAYABLE'
        WHEN gl_number LIKE '35%' THEN 'ADVANCE_GIVEN'
        WHEN gl_number LIKE '453%' THEN 'ADVANCE_RECEIVED'
        WHEN gl_number LIKE '368%' THEN 'RETAINED_WARRANTY'
        WHEN gl_number LIKE '36%' THEN 'OTHER_RECEIVABLE'
        WHEN gl_number LIKE '44%' OR gl_number LIKE '458%' THEN 'LOAN_LIABILITY'
        WHEN gl_number LIKE '47%' THEN 'OTHER_LIABILITY'
        WHEN gl_number LIKE '5%' THEN 'COST'
        WHEN gl_number LIKE '9%' THEN 'REVENUE'
        ELSE 'OTHER'
      END AS account_nature,
      CASE
        WHEN gl_number LIKE '1%' OR gl_number LIKE '2%' OR gl_number LIKE '3%' OR gl_number LIKE '5%' OR gl_number LIKE '8%'
        THEN COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE 0 END), 0)
        ELSE COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE 0 END), 0)
      END AS balance,
      -- Eredeti T-K előjeles nettó egyenleg
      COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0) AS raw_balance
    FROM partner_lines
    GROUP BY gl_account_id, gl_number, short_name
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'gl_account_id', gl_account_id,
        'gl_number', gl_number,
        'short_name', short_name,
        'account_nature', account_nature,
        'total_debit', total_debit,
        'total_credit', total_credit,
        'balance', balance,
        'raw_balance', raw_balance,
        'entries_count', entries_count,
        'last_posting_date', last_posting_date
      ) ORDER BY gl_number
    ), '[]'::jsonb),
    COALESCE(SUM(CASE 
      WHEN account_nature IN ('RECEIVABLE', 'ADVANCE_GIVEN', 'RETAINED_WARRANTY', 'OTHER_RECEIVABLE') AND raw_balance > 0 THEN raw_balance
      WHEN account_nature IN ('PAYABLE', 'ADVANCE_RECEIVED', 'OTHER_LIABILITY') AND raw_balance > 0 THEN raw_balance
      ELSE 0 
    END), 0),
    COALESCE(SUM(CASE 
      WHEN account_nature IN ('PAYABLE', 'ADVANCE_RECEIVED', 'LOAN_LIABILITY', 'OTHER_LIABILITY') AND raw_balance < 0 THEN ABS(raw_balance)
      WHEN account_nature IN ('RECEIVABLE', 'ADVANCE_GIVEN') AND raw_balance < 0 THEN ABS(raw_balance)
      ELSE 0 
    END), 0)
  INTO v_lines, v_total_receivables, v_total_payables
  FROM aggregated_accounts;

  -- Likvid pozíció és kompenzáció kalkuláció
  v_net_position := v_total_receivables - v_total_payables;
  IF v_total_receivables > 0 AND v_total_payables > 0 THEN
    v_can_compensate := TRUE;
    v_compensable_amount := LEAST(v_total_receivables, v_total_payables);
  ELSE
    v_can_compensate := FALSE;
    v_compensable_amount := 0;
  END IF;

  RETURN jsonb_build_object(
    'partner', jsonb_build_object(
      'id', v_partner_record.id,
      'name', v_partner_record.name,
      'tax_number', v_partner_record.tax_number,
      'partner_type', v_partner_record.partner_type,
      'email', v_partner_record.email,
      'address', v_partner_record.address,
      'bank_account_number', v_partner_record.bank_account_number
    ),
    'accounts', v_lines,
    'summary', jsonb_build_object(
      'total_receivables', v_total_receivables,
      'total_payables', v_total_payables,
      'net_position', v_net_position,
      'position_type', CASE 
        WHEN v_net_position > 0 THEN 'NET_RECEIVABLE'
        WHEN v_net_position < 0 THEN 'NET_PAYABLE'
        ELSE 'BALANCED'
      END,
      'can_compensate', v_can_compensate,
      'compensable_amount', v_compensable_amount
    )
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. RPC: get_omni_partner_ledger
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_omni_partner_ledger(
  p_company_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_account_code_prefix TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég adatainak megtekintéséhez';
  END IF;

  WITH filtered_lines AS (
    SELECT
      l.id AS line_id,
      l.amount,
      l.dc_type,
      h.posting_date,
      h.document_id,
      l.description AS line_description,
      g.id AS gl_account_id,
      g.gl_number,
      g.short_name AS gl_account_name,
      COALESCE(l.partner_id, h.partner_id) AS resolved_partner_id,
      p.name AS partner_name,
      p.tax_number AS partner_tax_number
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN public.partners p ON COALESCE(l.partner_id, h.partner_id) = p.id
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'LEKONYVELT')
      AND (p_gl_account_id IS NULL OR g.id = p_gl_account_id)
      AND (p_account_code_prefix IS NULL OR g.gl_number LIKE p_account_code_prefix || '%')
      AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
      AND (p_end_date IS NULL OR h.posting_date <= p_end_date)
  ),
  partner_summary AS (
    SELECT
      COALESCE(resolved_partner_id, '00000000-0000-0000-0000-000000000000'::uuid) AS partner_id,
      COALESCE(partner_name, 'Partner nélküli tételek') AS partner_name,
      partner_tax_number,
      COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE 0 END), 0) AS total_debit,
      COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE 0 END), 0) AS total_credit,
      COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0) AS net_balance,
      COUNT(*) AS entries_count,
      MAX(posting_date) AS last_entry_date
    FROM filtered_lines
    GROUP BY resolved_partner_id, partner_name, partner_tax_number
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'partner_id', CASE WHEN partner_id = '00000000-0000-0000-0000-000000000000'::uuid THEN NULL ELSE partner_id END,
      'partner_name', partner_name,
      'partner_tax_number', partner_tax_number,
      'total_debit', total_debit,
      'total_credit', total_credit,
      'net_balance', net_balance,
      'entries_count', entries_count,
      'last_entry_date', last_entry_date
    ) ORDER BY ABS(net_balance) DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM partner_summary;

  RETURN v_result;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. RPC: execute_journal_reclassification
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_journal_reclassification(
  p_company_id UUID,
  p_source_gl_account_id UUID,
  p_target_gl_account_id UUID,
  p_journal_line_ids UUID[],
  p_reclassification_date DATE,
  p_reason TEXT,
  p_clearing_gl_account_id UUID DEFAULT NULL,
  p_is_simulation BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_acc RECORD;
  v_target_acc RECORD;
  v_clearing_acc RECORD;
  v_total_amount NUMERIC(18,2) := 0;
  v_lines_count INTEGER := 0;
  v_source_curr_balance NUMERIC(18,2) := 0;
  v_target_curr_balance NUMERIC(18,2) := 0;
  v_source_new_balance NUMERIC(18,2) := 0;
  v_target_new_balance NUMERIC(18,2) := 0;
  v_ve_journal_id UUID;
  v_year SMALLINT;
  v_next_num INTEGER;
  v_doc_id VARCHAR(64);
  v_batch_num VARCHAR(64);
  v_header_id UUID;
  v_reclass_id UUID;
  v_primary_dc CHAR(1);
  v_counter_dc CHAR(1);
BEGIN
  -- 1. Jogosultság ellenőrzése
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég könyvelési műveleteinek elvégzéséhez';
  END IF;

  v_year := EXTRACT(YEAR FROM p_reclassification_date)::SMALLINT;

  -- 2. Zárt időszak ellenőrzése
  IF EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
    WHERE company_id = p_company_id
      AND p_reclassification_date BETWEEN start_date AND end_date
      AND is_closed = TRUE
  ) THEN
    RAISE EXCEPTION 'A megadott átvezetési dátum (%s) lezárt könyvelési időszakba esik!', p_reclassification_date;
  END IF;

  -- 3. Számlák feloldása és érvényesítése
  SELECT id, gl_number, short_name INTO v_source_acc 
    FROM public.gl_accounts WHERE id = p_source_gl_account_id;
  SELECT id, gl_number, short_name INTO v_target_acc 
    FROM public.gl_accounts WHERE id = p_target_gl_account_id;

  IF v_source_acc.id IS NULL OR v_target_acc.id IS NULL THEN
    RAISE EXCEPTION 'Érvénytelen forrás vagy cél főkönyvi számla';
  END IF;

  IF p_source_gl_account_id = p_target_gl_account_id THEN
    RAISE EXCEPTION 'A forrás és a cél főkönyvi számla nem lehet azonos!';
  END IF;

  -- 4. Érintett tételek összegzése
  SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_amount, v_lines_count
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE h.company_id = p_company_id
     AND l.gl_account_id = p_source_gl_account_id
     AND l.id = ANY(p_journal_line_ids);

  IF v_lines_count = 0 OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'Nem található átvezetendő tétel a kiválasztott sorok között!';
  END IF;

  -- 5. Jelenlegi egyenlegek számítása
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_source_curr_balance
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE h.company_id = p_company_id
     AND l.gl_account_id = p_source_gl_account_id
     AND h.status IN ('KONYVELT', 'LEKONYVELT');

  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
    INTO v_target_curr_balance
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE h.company_id = p_company_id
     AND l.gl_account_id = p_target_gl_account_id
     AND h.status IN ('KONYVELT', 'LEKONYVELT');

  -- Szimulált új egyenlegek (Költség/eszköz T jellegű esetén)
  v_source_new_balance := v_source_curr_balance - v_total_amount;
  v_target_new_balance := v_target_curr_balance + v_total_amount;

  -- Ha csak szimuláció, visszaadjuk az előrejelzést és kilépünk
  IF p_is_simulation THEN
    RETURN jsonb_build_object(
      'is_simulation', TRUE,
      'affected_lines_count', v_lines_count,
      'total_amount', v_total_amount,
      'source_account', jsonb_build_object(
        'id', v_source_acc.id,
        'gl_number', v_source_acc.gl_number,
        'short_name', v_source_acc.short_name,
        'current_balance', v_source_curr_balance,
        'simulated_balance', v_source_new_balance,
        'delta', -v_total_amount
      ),
      'target_account', jsonb_build_object(
        'id', v_target_acc.id,
        'gl_number', v_target_acc.gl_number,
        'short_name', v_target_acc.short_name,
        'current_balance', v_target_curr_balance,
        'simulated_balance', v_target_new_balance,
        'delta', v_total_amount
      ),
      'has_cross_class_impact', (SUBSTRING(v_source_acc.gl_number FROM 1 FOR 1) <> SUBSTRING(v_target_acc.gl_number FROM 1 FOR 1))
    );
  END IF;

  -- 6. ÉLES VÉGREHAJTÁS (Sztv. szerinti V-ATV vegyes bizonylat)
  SELECT id INTO v_ve_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND (code IN ('V', 'VE') OR type = 'VEGYES')
   LIMIT 1;

  IF v_ve_journal_id IS NULL THEN
    RAISE EXCEPTION 'A céghez nem található érvényes Vegyes (V) napló a technikai bizonylat kiállításához!';
  END IF;

  v_next_num := public.acc_get_next_journal_number(v_ve_journal_id, v_year);
  v_doc_id := 'V-ATV-' || v_year || '-' || LPAD(v_next_num::text, 4, '0');
  v_batch_num := 'BATCH-ATV-' || v_year || '-' || LPAD(v_next_num::text, 4, '0');

  -- Kontírozási irány meghatározása
  -- Eszköz/költség (1, 2, 3, 5, 8) átsorolás: Cél = T, Forrás = K
  -- Forrás/kötelezettség (4, 9) átsorolás: Forrás = T, Cél = K
  IF SUBSTRING(v_source_acc.gl_number FROM 1 FOR 1) IN ('4', '9') THEN
    v_primary_dc := 'K'; -- Cél számlára Követel
    v_counter_dc := 'T'; -- Forrás számláról Tartozik
  ELSE
    v_primary_dc := 'T'; -- Cél számlára Tartozik
    v_counter_dc := 'K'; -- Forrás számláról Követel
  END IF;

  -- Fejléc rögzítése
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id,
    description, justification, currency, created_by, posted_by, posted_at
  ) VALUES (
    p_company_id, v_ve_journal_id, v_year, v_next_num, 'KONYVELT', 'RECLASSIFICATION', 'TECHNIKAI_ATVEZETES',
    p_reclassification_date, p_reclassification_date, now(), v_doc_id,
    COALESCE(p_reason, 'Tömeges főkönyvi átvezetés: ' || v_source_acc.gl_number || ' -> ' || v_target_acc.gl_number),
    p_reason, 'HUF', auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_header_id;

  -- Tételsorok rögzítése (Közvetlen vagy 3899 közbeiktatásával)
  IF p_clearing_gl_account_id IS NOT NULL THEN
    -- 1. lépés: Forrás -> 3899
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description
    ) VALUES 
      (v_header_id, 1, p_clearing_gl_account_id, v_primary_dc, v_total_amount, 'Átvezetés függő elszámolás: ' || v_source_acc.gl_number),
      (v_header_id, 2, p_source_gl_account_id, v_counter_dc, v_total_amount, 'Átvezetés forrás kivezetése: ' || v_source_acc.gl_number);

    -- 2. lépés: 3899 -> Cél
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description
    ) VALUES 
      (v_header_id, 3, p_target_gl_account_id, v_primary_dc, v_total_amount, 'Átvezetés cél bevezetése: ' || v_target_acc.gl_number),
      (v_header_id, 4, p_clearing_gl_account_id, v_counter_dc, v_total_amount, 'Átvezetés függő elszámolás zárása (3899=0)');
  ELSE
    -- Közvetlen átvezetés
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, description
    ) VALUES 
      (v_header_id, 1, p_target_gl_account_id, v_primary_dc, v_total_amount, 'Átvezetés jóváírás: ' || v_target_acc.gl_number),
      (v_header_id, 2, p_source_gl_account_id, v_counter_dc, v_total_amount, 'Átvezetés kivezetés: ' || v_source_acc.gl_number);
  END IF;

  -- 7. Audit tábla bejegyzés létrehozása
  INSERT INTO public.acc_reclassifications (
    company_id, batch_number, source_gl_account_id, target_gl_account_id, clearing_gl_account_id,
    reclassification_date, status, affected_lines_count, total_amount, currency,
    source_journal_line_ids, generated_journal_header_id, reason, created_by
  ) VALUES (
    p_company_id, v_batch_num, p_source_gl_account_id, p_target_gl_account_id, p_clearing_gl_account_id,
    p_reclassification_date, 'EXECUTED', v_lines_count, v_total_amount, 'HUF',
    p_journal_line_ids, v_header_id, p_reason, auth.uid()
  ) RETURNING id INTO v_reclass_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'reclassification_id', v_reclass_id,
    'batch_number', v_batch_num,
    'document_id', v_doc_id,
    'header_id', v_header_id,
    'affected_lines_count', v_lines_count,
    'total_amount', v_total_amount
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 6. RPC: rollback_journal_reclassification
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rollback_journal_reclassification(
  p_company_id UUID,
  p_reclassification_id UUID,
  p_reason TEXT DEFAULT 'Átvezetési csomag visszagörgetése'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec RECORD;
  v_orig_header RECORD;
  v_storno_header_id UUID;
  v_storno_doc_id VARCHAR(64);
  v_next_num INTEGER;
  v_storno_year SMALLINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég könyvelési műveleteinek elvégzéséhez';
  END IF;

  SELECT * INTO v_rec FROM public.acc_reclassifications
   WHERE id = p_reclassification_id AND company_id = p_company_id;

  IF v_rec.id IS NULL THEN
    RAISE EXCEPTION 'Az átvezetési köteg nem található';
  END IF;

  IF v_rec.status = 'ROLLED_BACK' THEN
    RAISE EXCEPTION 'Ez az átvezetési köteg már korábban vissza lett görgetve!';
  END IF;

  -- Eredeti fejléc lekérése
  SELECT * INTO v_orig_header FROM public.acc_journal_headers
   WHERE id = v_rec.generated_journal_header_id AND company_id = p_company_id;

  IF v_orig_header.id IS NULL THEN
    RAISE EXCEPTION 'A kapcsolódó technikai bizonylat nem található';
  END IF;

  v_storno_year := v_orig_header.accounting_year;
  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);
  v_storno_doc_id := 'V-STV-' || v_storno_year || '-' || LPAD(v_next_num::text, 4, '0');

  -- Sztornó fejléc beszúrása
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id,
    description, justification, currency, stornoed_entry_id, original_entry_id,
    created_by, posted_by, posted_at
  ) VALUES (
    p_company_id, v_orig_header.journal_id, v_storno_year, v_next_num, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_orig_header.posting_date, v_orig_header.document_date, now(), v_storno_doc_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency,
    v_orig_header.id, v_orig_header.id, auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_storno_header_id;

  -- Sorok másolása fordított T/K iránnyal
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  )
  SELECT
    v_storno_header_id, sequence_number, gl_account_id,
    CASE WHEN dc_type = 'T' THEN 'K' ELSE 'T' END,
    amount, 'Sztornó: ' || COALESCE(description, '')
  FROM public.acc_journal_lines
  WHERE header_id = v_orig_header.id;

  -- Eredeti bizonylat státuszának frissítése
  UPDATE public.acc_journal_headers
     SET status = 'SZTORNOZOTT'
   WHERE id = v_orig_header.id;

  -- Átvezetési köteg státuszának frissítése
  UPDATE public.acc_reclassifications
     SET status = 'ROLLED_BACK',
         storno_journal_header_id = v_storno_header_id,
         rolled_back_by = auth.uid(),
         rolled_back_at = now()
   WHERE id = p_reclassification_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'storno_document_id', v_storno_doc_id,
    'storno_header_id', v_storno_header_id
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 7. RPC: detect_accounting_anomalies
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.detect_accounting_anomalies(
  p_company_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anomalies JSONB := '[]'::jsonb;
  v_missing_partners JSONB := '[]'::jsonb;
  v_inverted_balances JSONB := '[]'::jsonb;
  v_misclassifications JSONB := '[]'::jsonb;
  v_vat_inconsistencies JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég könyvelési adatainak auditálásához';
  END IF;

  -- 1. Partner nélküli tételek (vevő, szállító, előleg, elszámolási és külső igénybe vett szolgáltatások)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'MISSING_PARTNER',
      'severity', 'WARNING',
      'line_id', l.id,
      'header_id', h.id,
      'document_id', h.document_id,
      'posting_date', h.posting_date,
      'gl_number', g.gl_number,
      'gl_name', g.short_name,
      'amount', l.amount,
      'dc_type', l.dc_type,
      'description', l.description,
      'message', 'Kötelező partner-dimenziójú számlán (pl. vevő, szállító, külső szolgáltatás) hiányzik a partner hozzárendelés.'
    )
  ), '[]'::jsonb)
  INTO v_missing_partners
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON l.header_id = h.id
  JOIN public.gl_accounts g ON l.gl_account_id = g.id
  WHERE h.company_id = p_company_id
    AND h.status IN ('KONYVELT', 'LEKONYVELT')
    AND COALESCE(l.partner_id, h.partner_id) IS NULL
    AND (
      g.gl_number LIKE '31%' OR g.gl_number LIKE '454%' OR 
      g.gl_number LIKE '35%' OR g.gl_number LIKE '453%' OR 
      g.gl_number LIKE '52%' OR g.gl_number LIKE '44%'  OR 
      g.gl_number LIKE '458%'
    )
    AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
    AND (p_end_date IS NULL OR h.posting_date <= p_end_date)
  LIMIT 50;

  -- 2. Szokatlan egyenlegek és fordított mozgásirányok
  -- a) Negatív pénztár (381) vagy bank (384)
  -- b) Szállítói Tartozik egyenleg (454 túlfizetés/hiányzó számla)
  -- c) Árbevétel (91-92) Tartozik mozgás sztornó jelzés nélkül
  WITH balances AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number,
      g.short_name,
      COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0) AS net_t_balance,
      COUNT(*) AS total_entries
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'LEKONYVELT')
      AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
      AND (p_end_date IS NULL OR h.posting_date <= p_end_date)
    GROUP BY g.id, g.gl_number, g.short_name
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'INVERTED_BALANCE',
      'severity', 'CRITICAL',
      'gl_number', gl_number,
      'gl_name', short_name,
      'balance', net_t_balance,
      'message', CASE 
        WHEN gl_number LIKE '381%' AND net_t_balance < 0 THEN 'A házipénztár egyenlege negatívba futott (-' || ABS(net_t_balance)::text || ' Ft), ami számviteli törvénysértés!'
        WHEN gl_number LIKE '384%' AND net_t_balance < 0 THEN 'A bankszámla negatív egyenleget mutat (-' || ABS(net_t_balance)::text || ' Ft).'
        WHEN gl_number LIKE '454%' AND net_t_balance > 0 THEN 'A szállítói számla Tartozik (túlfizetés) egyenleget mutat (+' || net_t_balance::text || ' Ft).'
        ELSE 'Inverz számlaegyenleg detektálva.'
      END
    )
  ), '[]'::jsonb)
  INTO v_inverted_balances
  FROM balances
  WHERE (gl_number LIKE '381%' AND net_t_balance < 0)
     OR (gl_number LIKE '384%' AND net_t_balance < 0)
     OR (gl_number LIKE '454%' AND net_t_balance > 100);

  -- 3. ÁFA-kód és Főkönyvi számla inkonzisztencia (pl. 552 reprezentáció levonható 27%-kal)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'VAT_INCONSISTENCY',
      'severity', 'WARNING',
      'line_id', l.id,
      'header_id', h.id,
      'document_id', h.document_id,
      'gl_number', g.gl_number,
      'gl_name', g.short_name,
      'vat_code', l.vat_code,
      'amount', l.amount,
      'message', 'Törvényileg levonási tiltás alá eső számlán (pl. 552 reprezentáció) levonható ÁFA-kód lett megadva.'
    )
  ), '[]'::jsonb)
  INTO v_vat_inconsistencies
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON l.header_id = h.id
  JOIN public.gl_accounts g ON l.gl_account_id = g.id
  WHERE h.company_id = p_company_id
    AND h.status IN ('KONYVELT', 'LEKONYVELT')
    AND g.gl_number LIKE '552%'
    AND l.vat_code IN ('27%', '18%', '5%')
    AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
    AND (p_end_date IS NULL OR h.posting_date <= p_end_date)
  LIMIT 20;

  RETURN jsonb_build_object(
    'total_anomalies_count', 
      jsonb_array_length(v_missing_partners) + 
      jsonb_array_length(v_inverted_balances) + 
      jsonb_array_length(v_vat_inconsistencies),
    'missing_partners', v_missing_partners,
    'inverted_balances', v_inverted_balances,
    'vat_inconsistencies', v_vat_inconsistencies
  );
END;
$$;
