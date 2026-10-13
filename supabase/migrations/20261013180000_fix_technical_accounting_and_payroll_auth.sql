-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration: 20261013180000_fix_technical_accounting_and_payroll_auth.sql
-- Description: Replace narrow company_members checks with public.has_accounty_company_access()
--              in Technical Accounting and Payroll Reconciliation RPCs so that
--              external accountants (accounty_assignments), firm admins, and
--              support admins are properly authorized to view and manage company data.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. detect_accounting_anomalies
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
  IF NOT (
    public.has_accounty_company_access(p_company_id)
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
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

REVOKE ALL ON FUNCTION public.detect_accounting_anomalies(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detect_accounting_anomalies(UUID, DATE, DATE) TO authenticated, service_role;

-- 2. get_partner_360_matrix
CREATE OR REPLACE FUNCTION public.get_partner_360_matrix(
  p_company_id UUID,
  p_partner_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_include_drafts BOOLEAN DEFAULT TRUE
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
  v_has_drafts BOOLEAN := FALSE;
  v_drafts_count INT := 0;
  v_posted_count INT := 0;
BEGIN
  IF NOT (
    public.has_accounty_company_access(p_company_id)
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
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

  -- Javaslatok és könyvelt tételek darabszámának vizsgálata
  SELECT
    COALESCE(COUNT(*) FILTER (WHERE h.status IN ('GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR')), 0),
    COALESCE(COUNT(*) FILTER (WHERE h.status IN ('KONYVELT', 'LEKONYVELT')), 0)
  INTO v_drafts_count, v_posted_count
  FROM public.acc_journal_headers h
  WHERE h.company_id = p_company_id
    AND (h.partner_id = p_partner_id OR EXISTS (
      SELECT 1 FROM public.acc_journal_lines l WHERE l.header_id = h.id AND l.partner_id = p_partner_id
    ))
    AND (p_start_date IS NULL OR h.posting_date >= p_start_date)
    AND (p_end_date IS NULL OR h.posting_date <= p_end_date);

  v_has_drafts := (v_drafts_count > 0);

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
      h.currency,
      h.status
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    WHERE h.company_id = p_company_id
      AND (COALESCE(l.partner_id, h.partner_id) = p_partner_id)
      AND (
        (p_include_drafts IS TRUE AND h.status IN ('KONYVELT', 'LEKONYVELT', 'GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR'))
        OR
        (p_include_drafts IS NOT TRUE AND h.status IN ('KONYVELT', 'LEKONYVELT'))
      )
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
      'compensable_amount', v_compensable_amount,
      'include_drafts', p_include_drafts,
      'has_drafts', v_has_drafts,
      'drafts_count', v_drafts_count,
      'posted_count', v_posted_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_partner_360_matrix(UUID, UUID, DATE, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_360_matrix(UUID, UUID, DATE, DATE, BOOLEAN) TO authenticated, service_role;

-- 3. get_omni_partner_ledger
CREATE OR REPLACE FUNCTION public.get_omni_partner_ledger(
  p_company_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_account_code_prefix TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_include_drafts BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (
    public.has_accounty_company_access(p_company_id)
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
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
      AND (
        (p_include_drafts IS TRUE AND h.status IN ('KONYVELT', 'LEKONYVELT', 'GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR'))
        OR
        (p_include_drafts IS NOT TRUE AND h.status IN ('KONYVELT', 'LEKONYVELT'))
      )
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

REVOKE ALL ON FUNCTION public.get_omni_partner_ledger(UUID, UUID, TEXT, DATE, DATE, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_omni_partner_ledger(UUID, UUID, TEXT, DATE, DATE, BOOLEAN) TO authenticated, service_role;

-- 4. execute_journal_reclassification
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
  IF NOT (
    (public.has_accounty_company_access(p_company_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.rls_write_denied_company_ids('accounty', ARRAY['subledger', 'client_bookkeeping']) denied
       WHERE denied.company_id = p_company_id
     ))
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
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

  -- 3. Főkönyvi számlák ellenőrzése
  SELECT id, gl_number, short_name, account_type INTO v_source_acc
    FROM public.gl_accounts WHERE id = p_source_gl_account_id AND company_id = p_company_id;
  SELECT id, gl_number, short_name, account_type INTO v_target_acc
    FROM public.gl_accounts WHERE id = p_target_gl_account_id AND company_id = p_company_id;

  IF v_source_acc.id IS NULL OR v_target_acc.id IS NULL THEN
    RAISE EXCEPTION 'Érvénytelen forrás vagy cél főkönyvi számla';
  END IF;

  IF p_source_gl_account_id = p_target_gl_account_id THEN
    RAISE EXCEPTION 'A forrás és a cél főkönyvi számla nem lehet azonos!';
  END IF;

  -- 4. Érintett sorok és összeg kiszámítása
  SELECT COALESCE(SUM(l.amount), 0), COUNT(*)
    INTO v_total_amount, v_lines_count
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE l.id = ANY(p_journal_line_ids)
     AND l.gl_account_id = p_source_gl_account_id
     AND h.company_id = p_company_id;

  IF v_lines_count = 0 OR v_total_amount <= 0 THEN
    RAISE EXCEPTION 'Nem található átvezetendő tétel a kiválasztott sorok között!';
  END IF;

  -- 5. Aktuális és szimulált egyenlegek kalkulálása
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_source_curr_balance
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE l.gl_account_id = p_source_gl_account_id
     AND h.company_id = p_company_id
     AND h.status IN ('KONYVELT', 'LEKONYVELT');

  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_target_curr_balance
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
   WHERE l.gl_account_id = p_target_gl_account_id
     AND h.company_id = p_company_id
     AND h.status IN ('KONYVELT', 'LEKONYVELT');

  v_source_new_balance := v_source_curr_balance - v_total_amount;
  v_target_new_balance := v_target_curr_balance + v_total_amount;

  -- Ha szimuláció, visszatérünk a kalkulált adatokkal bizonylat-generálás nélkül
  IF p_is_simulation THEN
    RETURN jsonb_build_object(
      'is_simulation', TRUE,
      'total_amount', v_total_amount,
      'lines_count', v_lines_count,
      'source_account', jsonb_build_object(
        'id', v_source_acc.id,
        'gl_number', v_source_acc.gl_number,
        'short_name', v_source_acc.short_name,
        'current_balance', v_source_curr_balance,
        'projected_balance', v_source_new_balance
      ),
      'target_account', jsonb_build_object(
        'id', v_target_acc.id,
        'gl_number', v_target_acc.gl_number,
        'short_name', v_target_acc.short_name,
        'current_balance', v_target_curr_balance,
        'projected_balance', v_target_new_balance
      )
    );
  END IF;

  -- 6. Bizonylat generálása VE naplóba
  SELECT id INTO v_ve_journal_id
    FROM public.acc_journals
   WHERE company_id = p_company_id
     AND (code = 'VE' OR type = 'MIXED')
     AND is_active = TRUE
   ORDER BY code = 'VE' DESC
   LIMIT 1;

  IF v_ve_journal_id IS NULL THEN
    RAISE EXCEPTION 'A céghez nem található érvényes Vegyes (V) napló a technikai bizonylat kiállításához!';
  END IF;

  v_next_num := public.acc_get_next_journal_number(v_ve_journal_id, v_year);
  v_doc_id := 'V-ATV-' || v_year || '-' || LPAD(v_next_num::text, 4, '0');
  v_batch_num := 'BATCH-ATV-' || TO_CHAR(now(), 'YYYYMMDD-HH24MISS');

  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, journal_number, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id,
    description, justification, currency, created_by, posted_by, posted_at
  ) VALUES (
    p_company_id, v_ve_journal_id, v_year, v_next_num, 'KONYVELT', 'NORMAL', 'KEZI_MODOSITAS',
    p_reclassification_date, p_reclassification_date, now(), v_doc_id,
    'Főkönyvi átvezetés: ' || v_source_acc.gl_number || ' -> ' || v_target_acc.gl_number,
    p_reason, 'HUF', auth.uid(), auth.uid(), now()
  ) RETURNING id INTO v_header_id;

  -- Sorok létrehozása (T cél, K forrás)
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, description
  ) VALUES
    (v_header_id, 1, p_target_gl_account_id, 'T', v_total_amount, 'Technikai átvezetés (cél): ' || v_reason),
    (v_header_id, 2, p_source_gl_account_id, 'K', v_total_amount, 'Technikai átvezetés (forrás): ' || v_reason);

  -- 7. Audit napló bejegyzés (acc_reclassifications)
  INSERT INTO public.acc_reclassifications (
    company_id, batch_number, source_gl_account_id, target_gl_account_id, clearing_gl_account_id,
    reclassified_amount, lines_count, affected_journal_line_ids,
    generated_journal_header_id, reason, status, executed_by
  ) VALUES (
    p_company_id, v_batch_num, p_source_gl_account_id, p_target_gl_account_id, p_clearing_gl_account_id,
    v_total_amount, v_lines_count, p_journal_line_ids,
    v_header_id, p_reason, 'COMPLETED', auth.uid()
  ) RETURNING id INTO v_reclass_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'reclassification_id', v_reclass_id,
    'batch_number', v_batch_num,
    'document_id', v_doc_id,
    'header_id', v_header_id,
    'total_amount', v_total_amount,
    'lines_count', v_lines_count,
    'source_account', jsonb_build_object(
      'gl_number', v_source_acc.gl_number,
      'short_name', v_source_acc.short_name,
      'previous_balance', v_source_curr_balance,
      'new_balance', v_source_new_balance
    ),
    'target_account', jsonb_build_object(
      'gl_number', v_target_acc.gl_number,
      'short_name', v_target_acc.short_name,
      'previous_balance', v_target_curr_balance,
      'new_balance', v_target_new_balance
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.execute_journal_reclassification(UUID, UUID, UUID, UUID[], DATE, TEXT, UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_journal_reclassification(UUID, UUID, UUID, UUID[], DATE, TEXT, UUID, BOOLEAN) TO authenticated, service_role;

-- 5. rollback_journal_reclassification
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
  IF NOT (
    (public.has_accounty_company_access(p_company_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.rls_write_denied_company_ids('accounty', ARRAY['subledger', 'client_bookkeeping']) denied
       WHERE denied.company_id = p_company_id
     ))
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
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

REVOKE ALL ON FUNCTION public.rollback_journal_reclassification(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rollback_journal_reclassification(UUID, UUID, TEXT) TO authenticated, service_role;

-- 6. get_payroll_471_reconciliation
CREATE OR REPLACE FUNCTION public.get_payroll_471_reconciliation(
  p_company_id UUID,
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_record RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_payout_deadline DATE;
  
  -- Főkönyvi 471-es változók
  v_opening_471 NUMERIC(18,2) := 0;
  v_debit_471 NUMERIC(18,2) := 0;
  v_credit_471 NUMERIC(18,2) := 0;
  v_closing_471 NUMERIC(18,2) := 0;
  
  -- Bérszámfejtési összesítők
  v_total_gross NUMERIC(18,2) := 0;
  v_total_net NUMERIC(18,2) := 0;
  v_total_commute NUMERIC(18,2) := 0;
  v_total_szja NUMERIC(18,2) := 0;
  v_total_tb NUMERIC(18,2) := 0;
  v_total_szocho NUMERIC(18,2) := 0;
  v_total_deductions NUMERIC(18,2) := 0;
  v_employee_count INT := 0;

  -- Kifizetési adatok
  v_total_paid NUMERIC(18,2) := 0;
  v_paid_count INT := 0;
  v_pending_count INT := 0;
  v_discrepancy_count INT := 0;
  
  v_employees_list JSONB := '[]'::jsonb;
  v_discrepancies_list JSONB := '[]'::jsonb;
  v_status TEXT := 'PENDING_PAYOUT';
  v_discrepancy_amount NUMERIC(18,2) := 0;
BEGIN
  IF NOT (
    public.has_accounty_company_access(p_company_id)
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég béradatainak megtekintéséhez';
  END IF;

  v_period_start := MAKE_DATE(p_year, p_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month - 1 day')::DATE;
  v_payout_deadline := (v_period_start + INTERVAL '1 month + 9 days')::DATE;

  -- 1. Bérciklus lekérése
  SELECT id, status, current_step, approved_at
    INTO v_cycle_record
    FROM public.accounty_payroll_cycles
   WHERE company_id = p_company_id AND year = p_year AND month = p_month
   LIMIT 1;

  -- 2. Bérszámfejtési kalkulációk összesítése
  IF v_cycle_record.id IS NOT NULL THEN
    SELECT
      COUNT(c.id),
      COALESCE(SUM(c.gross_salary), 0),
      COALESCE(SUM(c.net_salary), 0),
      COALESCE(SUM(c.szja_amount), 0),
      COALESCE(SUM(c.tb_amount), 0),
      COALESCE(SUM(c.szocho_amount), 0),
      COALESCE(SUM(c.total_deductions), 0),
      COALESCE(SUM(COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)), 0)
    INTO
      v_employee_count,
      v_total_gross,
      v_total_net,
      v_total_szja,
      v_total_tb,
      v_total_szocho,
      v_total_deductions,
      v_total_commute
    FROM public.accounty_payroll_calculations c
    WHERE c.cycle_id = v_cycle_record.id;
  END IF;

  -- 3. 471-es Főkönyvi egyenleg lekérése
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
    INTO v_opening_471
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND g.gl_number LIKE '471%'
     AND h.status IN ('KONYVELT', 'LEKONYVELT')
     AND h.posting_date < v_period_start;

  SELECT
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END), 0)
  INTO v_debit_471, v_credit_471
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON l.header_id = h.id
  JOIN public.gl_accounts g ON l.gl_account_id = g.id
  WHERE h.company_id = p_company_id
    AND g.gl_number LIKE '471%'
    AND h.status IN ('KONYVELT', 'LEKONYVELT')
    AND h.posting_date >= v_period_start
    AND h.posting_date <= v_period_end;

  v_closing_471 := v_opening_471 + v_credit_471 - v_debit_471;

  -- 4. Dolgozónkénti kifizetési lista és párosítások lekérése
  IF v_cycle_record.id IS NOT NULL THEN
    WITH employee_data AS (
      SELECT
        c.id AS calculation_id,
        c.employment_id,
        e.id AS employee_id,
        CONCAT(e.last_name, ' ', e.first_name) AS employee_name,
        COALESCE(e.bank_account, e.iban, '') AS bank_account,
        c.gross_salary,
        c.net_salary,
        COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0) AS commute_reimbursement,
        c.total_deductions,
        (c.net_salary + COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)) AS total_payable,
        COALESCE(pm.matched_amount, 0) AS paid_amount,
        COALESCE(pm.match_status, 'PENDING') AS match_status,
        pm.match_type,
        bt.id AS bank_transaction_id,
        bt.transaction_date AS paid_date,
        bt.counterparty_name,
        bt.counterparty_account
      FROM public.accounty_payroll_calculations c
      JOIN public.accounty_employments emp ON c.employment_id = emp.id
      JOIN public.accounty_employees e ON emp.employee_id = e.id
      LEFT JOIN public.accounty_payroll_payout_matches pm ON pm.calculation_id = c.id
      LEFT JOIN public.bank_transactions bt ON pm.bank_transaction_id = bt.id
      WHERE c.cycle_id = v_cycle_record.id
    )
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'calculation_id', calculation_id,
          'employee_id', employee_id,
          'employee_name', employee_name,
          'bank_account', bank_account,
          'gross_salary', gross_salary,
          'net_salary', net_salary,
          'commute_reimbursement', commute_reimbursement,
          'total_payable', total_payable,
          'paid_amount', paid_amount,
          'difference', (paid_amount - total_payable),
          'match_status', CASE
            WHEN paid_amount >= total_payable AND total_payable > 0 THEN 'PAID'
            WHEN paid_amount > 0 AND paid_amount < total_payable THEN 'PARTIAL'
            WHEN paid_amount > total_payable THEN 'OVERPAID'
            ELSE 'PENDING'
          END,
          'match_type', match_type,
          'paid_date', paid_date
        ) ORDER BY employee_name ASC
      ), '[]'::jsonb),
      COALESCE(SUM(paid_amount), 0),
      COUNT(CASE WHEN paid_amount >= total_payable AND total_payable > 0 THEN 1 END),
      COUNT(CASE WHEN paid_amount = 0 THEN 1 END),
      COUNT(CASE WHEN paid_amount > total_payable OR (paid_amount > 0 AND paid_amount < total_payable) THEN 1 END)
    INTO v_employees_list, v_total_paid, v_paid_count, v_pending_count, v_discrepancy_count
    FROM employee_data;
  END IF;

  -- 5. Havi Eltéréslista összeállítása (Discrepancies)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'OVERPAYMENT',
      'severity', 'CRITICAL',
      'title', 'Túlfizetés / Lehetséges Dupla Utalás',
      'employee_name', item->>'employee_name',
      'expected_amount', (item->>'total_payable')::numeric,
      'actual_amount', (item->>'paid_amount')::numeric,
      'diff_amount', (item->>'difference')::numeric,
      'message', CONCAT(item->>'employee_name', ' részére a kifizetett összeg (', (item->>'paid_amount'), ' Ft) meghaladja az előírt nettó bért (', (item->>'total_payable'), ' Ft).')
    )
  ), '[]'::jsonb)
  INTO v_discrepancies_list
  FROM jsonb_array_elements(v_employees_list) AS item
  WHERE (item->>'paid_amount')::numeric > (item->>'total_payable')::numeric;

  IF CURRENT_DATE > v_payout_deadline THEN
    WITH unpaid_items AS (
      SELECT
        item->>'employee_name' AS emp_name,
        (item->>'total_payable')::numeric AS payable,
        (item->>'paid_amount')::numeric AS paid
      FROM jsonb_array_elements(v_employees_list) AS item
      WHERE (item->>'paid_amount')::numeric = 0 AND (item->>'total_payable')::numeric > 0
    )
    SELECT v_discrepancies_list || COALESCE(jsonb_agg(
      jsonb_build_object(
        'type', 'OVERDUE_PAYOUT',
        'severity', 'WARNING',
        'title', 'Kifizetetlen Munkabér (Határidő Lejárt)',
        'employee_name', emp_name,
        'expected_amount', payable,
        'actual_amount', paid,
        'diff_amount', -payable,
        'message', CONCAT(emp_name, ' munkabére (', payable, ' Ft) a kifizetési határidő (', v_payout_deadline, ') ellenére még nem került kifizetésre.')
      )
    ), '[]'::jsonb)
    INTO v_discrepancies_list
    FROM unpaid_items;
  END IF;

  IF ABS(v_credit_471 - (v_total_net + v_total_commute)) > 1 AND v_cycle_record.id IS NOT NULL THEN
    v_discrepancies_list := v_discrepancies_list || jsonb_build_array(
      jsonb_build_object(
        'type', 'GL_PAYROLL_MISMATCH',
        'severity', 'CRITICAL',
        'title', 'Főkönyv 471 Előírás és Béranalitika Eltérés',
        'expected_amount', (v_total_net + v_total_commute),
        'actual_amount', v_credit_471,
        'diff_amount', (v_credit_471 - (v_total_net + v_total_commute)),
        'message', CONCAT('A főkönyvben előírt 471-es követel forgalom (', v_credit_471, ' Ft) eltér a bérszámfejtés szerinti nettó kifizetendő összegtől (', (v_total_net + v_total_commute), ' Ft). Hiányzó vagy nem egyező bérfeladás!')
      )
    );
  END IF;

  v_discrepancy_amount := v_closing_471;
  IF v_closing_471 = 0 AND (v_pending_count = 0 OR v_employee_count = 0) THEN
    v_status := 'BALANCED';
  ELSIF v_closing_471 < 0 THEN
    v_status := 'OVERPAID';
  ELSIF v_closing_471 > 0 AND CURRENT_DATE <= v_payout_deadline THEN
    v_status := 'PENDING_PAYOUT';
  ELSE
    v_status := 'MISMATCH';
  END IF;

  INSERT INTO public.accounty_payroll_reconciliations (
    company_id, cycle_id, year, month,
    opening_balance, total_net_accrued, total_bank_paid, total_cash_paid,
    closing_balance, discrepancy_amount, status, audited_at, audited_by
  ) VALUES (
    p_company_id, v_cycle_record.id, p_year, p_month,
    v_opening_471, (v_total_net + v_total_commute), v_total_paid, 0,
    v_closing_471, v_discrepancy_amount, v_status, now(), auth.uid()
  )
  ON CONFLICT (company_id, year, month) DO UPDATE SET
    cycle_id = EXCLUDED.cycle_id,
    opening_balance = EXCLUDED.opening_balance,
    total_net_accrued = EXCLUDED.total_net_accrued,
    total_bank_paid = EXCLUDED.total_bank_paid,
    closing_balance = EXCLUDED.closing_balance,
    discrepancy_amount = EXCLUDED.discrepancy_amount,
    status = EXCLUDED.status,
    audited_at = now(),
    audited_by = auth.uid(),
    updated_at = now();

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'year', p_year,
    'month', p_month,
    'cycle', jsonb_build_object(
      'id', v_cycle_record.id,
      'status', v_cycle_record.status,
      'payout_deadline', v_payout_deadline
    ),
    'reconciliation', jsonb_build_object(
      'opening_balance', v_opening_471,
      'total_net_accrued', (v_total_net + v_total_commute),
      'credit_471', v_credit_471,
      'debit_471', v_debit_471,
      'total_paid', v_total_paid,
      'closing_balance', v_closing_471,
      'discrepancy_amount', v_discrepancy_amount,
      'is_balanced', (v_closing_471 = 0),
      'status', v_status
    ),
    'payroll_summary', jsonb_build_object(
      'employee_count', v_employee_count,
      'total_gross', v_total_gross,
      'total_net', v_total_net,
      'total_commute', v_total_commute,
      'total_szja', v_total_szja,
      'total_tb', v_total_tb,
      'total_szocho', v_total_szocho,
      'total_deductions', v_total_deductions
    ),
    'payout_stats', jsonb_build_object(
      'total_paid', v_total_paid,
      'paid_count', v_paid_count,
      'pending_count', v_pending_count,
      'discrepancy_count', v_discrepancy_count,
      'payout_ratio', CASE WHEN (v_total_net + v_total_commute) > 0 THEN ROUND((v_total_paid / (v_total_net + v_total_commute)) * 100, 1) ELSE 100 END
    ),
    'employees', v_employees_list,
    'discrepancies', v_discrepancies_list
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_payroll_471_reconciliation(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_payroll_471_reconciliation(UUID, INT, INT) TO authenticated, service_role;

-- 7. auto_match_payroll_bank_transactions
CREATE OR REPLACE FUNCTION public.auto_match_payroll_bank_transactions(
  p_company_id UUID,
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id UUID;
  v_period_start DATE;
  v_search_start DATE;
  v_search_end DATE;
  v_calc RECORD;
  v_matched_count INT := 0;
  v_candidate RECORD;
BEGIN
  IF NOT (
    (public.has_accounty_company_access(p_company_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.rls_write_denied_company_ids('accounty', ARRAY['salaries']) denied
       WHERE denied.company_id = p_company_id
     ))
    OR (auth.jwt() ->> 'role' = 'service_role')
    OR public.is_support_admin()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég béradatainak módosításához';
  END IF;

  v_period_start := MAKE_DATE(p_year, p_month, 1);
  v_search_start := v_period_start + INTERVAL '19 days';
  v_search_end := v_period_start + INTERVAL '1 month + 20 days';

  SELECT id INTO v_cycle_id
    FROM public.accounty_payroll_cycles
   WHERE company_id = p_company_id AND year = p_year AND month = p_month
   LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Nem található bérciklus a megadott időszakra',
      'matched_count', 0
    );
  END IF;

  FOR v_calc IN
    SELECT
      c.id AS calculation_id,
      emp.employee_id,
      e.last_name,
      e.first_name,
      COALESCE(e.bank_account, e.iban, '') AS bank_account,
      REPLACE(REPLACE(COALESCE(e.bank_account, e.iban, ''), '-', ''), ' ', '') AS clean_iban,
      (c.net_salary + COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)) AS expected_amount
    FROM public.accounty_payroll_calculations c
    JOIN public.accounty_employments emp ON c.employment_id = emp.id
    JOIN public.accounty_employees e ON emp.employee_id = e.id
    LEFT JOIN public.accounty_payroll_payout_matches pm ON pm.calculation_id = c.id
    WHERE c.cycle_id = v_cycle_id
      AND pm.id IS NULL
      AND (c.net_salary + COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)) > 0
  LOOP
    v_candidate := NULL;

    -- Tier 1: IBAN/Bankszámla pontos egyezés és összeg egyezés
    IF LENGTH(v_calc.clean_iban) >= 8 THEN
      SELECT bt.id, ABS(bt.amount) AS matched_amount
        INTO v_candidate
        FROM public.bank_transactions bt
       WHERE bt.company_id = p_company_id
         AND bt.amount < 0
         AND bt.transaction_date >= v_search_start
         AND bt.transaction_date <= v_search_end
         AND (
           REPLACE(REPLACE(COALESCE(bt.counterparty_account, ''), '-', ''), ' ', '') = v_calc.clean_iban
           OR
           (LENGTH(v_calc.clean_iban) >= 15 AND REPLACE(COALESCE(bt.counterparty_account, ''), ' ', '') ILIKE '%' || v_calc.clean_iban || '%')
         )
         AND ABS(bt.amount) = v_calc.expected_amount
       LIMIT 1;

      IF v_candidate.id IS NOT NULL THEN
        INSERT INTO public.accounty_payroll_payout_matches (
          company_id, cycle_id, calculation_id, employee_id,
          bank_transaction_id, match_type, match_status,
          matched_amount, expected_amount, matched_by
        ) VALUES (
          p_company_id, v_cycle_id, v_calc.calculation_id, v_calc.employee_id,
          v_candidate.id, 'AUTO_IBAN', 'MATCHED',
          v_candidate.matched_amount, v_calc.expected_amount, auth.uid()
        )
        ON CONFLICT DO NOTHING;

        v_matched_count := v_matched_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Tier 2: Név és pontos összeg egyezés
    SELECT bt.id, ABS(bt.amount) AS matched_amount
      INTO v_candidate
      FROM public.bank_transactions bt
     WHERE bt.company_id = p_company_id
       AND bt.amount < 0
       AND bt.transaction_date >= v_search_start
       AND bt.transaction_date <= v_search_end
       AND ABS(bt.amount) = v_calc.expected_amount
       AND (
         bt.counterparty_name ILIKE '%' || v_calc.last_name || '%'
         AND bt.counterparty_name ILIKE '%' || v_calc.first_name || '%'
       )
     LIMIT 1;

    IF v_candidate.id IS NOT NULL THEN
      INSERT INTO public.accounty_payroll_payout_matches (
        company_id, cycle_id, calculation_id, employee_id,
        bank_transaction_id, match_type, match_status,
        matched_amount, expected_amount, matched_by
      ) VALUES (
        p_company_id, v_cycle_id, v_calc.calculation_id, v_calc.employee_id,
        v_candidate.id, 'AUTO_NAME', 'MATCHED',
        v_candidate.matched_amount, v_calc.expected_amount, auth.uid()
      )
      ON CONFLICT DO NOTHING;

      v_matched_count := v_matched_count + 1;
      CONTINUE;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'matched_count', v_matched_count,
    'cycle_id', v_cycle_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_match_payroll_bank_transactions(UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auto_match_payroll_bank_transactions(UUID, INT, INT) TO authenticated, service_role;
