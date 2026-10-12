-- ═══════════════════════════════════════════════════════════════
-- Migration: 20261012160000_partner_360_draft_status_filter.sql
-- Description: Add p_include_drafts parameter to get_partner_360_matrix
--              and get_omni_partner_ledger RPC functions to allow viewing
--              unposted proposals (GEPI_JAVASLAT) alongside posted entries.
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_partner_360_matrix(UUID, UUID, DATE, DATE);

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
      h.currency
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
      ) ORDER BY gl_number ASC
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

-- ═══════════════════════════════════════════════════════════════
-- Omni Partner Ledger draft status support
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_omni_partner_ledger(UUID, UUID, TEXT, DATE, DATE);

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
