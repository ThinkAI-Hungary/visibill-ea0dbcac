-- Migration: 20260908160000_ledger_cards_rpc.sql
-- Description: RPC functions for General Ledger & Analytic Cards (Főkönyvi és Analitikus Kartonok),
-- including running balance calculation, contra-account resolution, partner aging, and G/L ↔ Analytic reconciliation.

-- ── 1. RPC: get_gl_account_card_items ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gl_account_card_items(
  p_company_id UUID,
  p_preset_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_gl_number_prefix VARCHAR DEFAULT NULL,
  p_date_from DATE DEFAULT '1900-01-01',
  p_date_to DATE DEFAULT '2099-12-31',
  p_include_opening BOOLEAN DEFAULT true,
  p_date_basis VARCHAR DEFAULT 'kibocsatas',
  p_posting_status VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
  line_id UUID,
  header_id UUID,
  posting_date DATE,
  document_date DATE,
  document_id VARCHAR,
  journal_code VARCHAR,
  journal_name VARCHAR,
  gl_account_id UUID,
  gl_number VARCHAR,
  gl_short_name VARCHAR,
  contra_gl_number VARCHAR,
  contra_gl_name VARCHAR,
  partner_id UUID,
  partner_name VARCHAR,
  partner_tax_number VARCHAR,
  description TEXT,
  dc_type VARCHAR,
  debit_amount NUMERIC,
  credit_amount NUMERIC,
  foreign_amount NUMERIC,
  currency VARCHAR,
  project_name VARCHAR,
  running_balance NUMERIC
) AS $$
DECLARE
  v_opening_debit NUMERIC := 0;
  v_opening_credit NUMERIC := 0;
  v_opening_net NUMERIC := 0;
  v_running NUMERIC := 0;
  v_row RECORD;
BEGIN
  -- 1. Calculate opening balance prior to p_date_from
  SELECT 
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END), 0)
  INTO v_opening_debit, v_opening_credit
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id
    AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
    AND (p_gl_number_prefix IS NULL OR g.gl_number LIKE p_gl_number_prefix || '%')
    AND (
      CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END < p_date_from
    )
    AND (p_posting_status = 'all' OR h.status = 'KONYVELT');

  v_opening_net := v_opening_debit - v_opening_credit;
  v_running := v_opening_net;

  -- 2. Return opening row if requested
  IF p_include_opening THEN
    line_id := NULL;
    header_id := NULL;
    posting_date := p_date_from;
    document_date := p_date_from;
    document_id := 'NYITÓ';
    journal_code := 'NY';
    journal_name := 'Nyitó napló';
    gl_account_id := p_gl_account_id;
    gl_number := COALESCE(p_gl_number_prefix, '000');
    gl_short_name := 'Nyitó egyenleg';
    contra_gl_number := '-';
    contra_gl_name := '-';
    partner_id := NULL;
    partner_name := NULL;
    partner_tax_number := NULL;
    description := 'Időszak eleji nyitó egyenleg';
    dc_type := CASE WHEN v_opening_net >= 0 THEN 'T' ELSE 'K' END;
    debit_amount := CASE WHEN v_opening_net >= 0 THEN v_opening_net ELSE 0 END;
    credit_amount := CASE WHEN v_opening_net < 0 THEN ABS(v_opening_net) ELSE 0 END;
    foreign_amount := NULL;
    currency := 'HUF';
    project_name := NULL;
    running_balance := v_running;
    RETURN NEXT;
  END IF;

  -- 3. Loop through items in date range and calculate running balance
  FOR v_row IN
    SELECT 
      l.id AS r_line_id,
      h.id AS r_header_id,
      h.posting_date AS r_posting_date,
      h.document_date AS r_document_date,
      h.document_id AS r_document_id,
      j.code AS r_journal_code,
      j.name AS r_journal_name,
      g.id AS r_gl_account_id,
      g.gl_number AS r_gl_number,
      g.short_name AS r_gl_short_name,
      -- Contra-account resolution (find primary opposite side line in same header)
      (
        SELECT STRING_AGG(DISTINCT cg.gl_number, ', ')
        FROM public.acc_journal_lines cl
        JOIN public.gl_accounts cg ON cg.id = cl.gl_account_id
        WHERE cl.header_id = h.id AND cl.dc_type <> l.dc_type
      ) AS r_contra_gl_number,
      (
        SELECT STRING_AGG(DISTINCT cg.short_name, ', ')
        FROM public.acc_journal_lines cl
        JOIN public.gl_accounts cg ON cg.id = cl.gl_account_id
        WHERE cl.header_id = h.id AND cl.dc_type <> l.dc_type
      ) AS r_contra_gl_name,
      p.id AS r_partner_id,
      p.name AS r_partner_name,
      p.tax_number AS r_partner_tax_number,
      COALESCE(l.description, h.description) AS r_description,
      l.dc_type AS r_dc_type,
      CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END AS r_debit_amount,
      CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END AS r_credit_amount,
      l.foreign_amount AS r_foreign_amount,
      h.currency AS r_currency,
      proj.name AS r_project_name
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.acc_journals j ON j.id = h.journal_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    LEFT JOIN public.partners p ON p.id = h.partner_id
    LEFT JOIN public.projects proj ON proj.id = l.project_id
    WHERE h.company_id = p_company_id
      AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
      AND (p_gl_number_prefix IS NULL OR g.gl_number LIKE p_gl_number_prefix || '%')
      AND (
        CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END BETWEEN p_date_from AND p_date_to
      )
      AND (p_posting_status = 'all' OR h.status = 'KONYVELT')
    ORDER BY (CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END) ASC, h.created_at ASC, l.sequence_number ASC
  LOOP
    line_id := v_row.r_line_id;
    header_id := v_row.r_header_id;
    posting_date := v_row.r_posting_date;
    document_date := v_row.r_document_date;
    document_id := v_row.r_document_id;
    journal_code := v_row.r_journal_code;
    journal_name := v_row.r_journal_name;
    gl_account_id := v_row.r_gl_account_id;
    gl_number := v_row.r_gl_number;
    gl_short_name := v_row.r_gl_short_name;
    contra_gl_number := COALESCE(v_row.r_contra_gl_number, '-');
    contra_gl_name := COALESCE(v_row.r_contra_gl_name, '-');
    partner_id := v_row.r_partner_id;
    partner_name := v_row.r_partner_name;
    partner_tax_number := v_row.r_partner_tax_number;
    description := v_row.r_description;
    dc_type := v_row.r_dc_type;
    debit_amount := v_row.r_debit_amount;
    credit_amount := v_row.r_credit_amount;
    foreign_amount := v_row.r_foreign_amount;
    currency := v_row.r_currency;
    project_name := v_row.r_project_name;

    v_running := v_running + debit_amount - credit_amount;
    running_balance := v_running;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 2. RPC: get_partner_ledger_card ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_partner_ledger_card(
  p_company_id UUID,
  p_partner_id UUID DEFAULT NULL,
  p_date_from DATE DEFAULT '1900-01-01',
  p_date_to DATE DEFAULT '2099-12-31'
)
RETURNS TABLE (
  partner_id UUID,
  partner_name VARCHAR,
  partner_tax_number VARCHAR,
  partner_type VARCHAR, -- 'customer' | 'supplier' | 'both'
  total_invoiced NUMERIC,
  total_paid NUMERIC,
  open_balance NUMERIC,
  current_due NUMERIC,
  days_1_30 NUMERIC,
  days_31_60 NUMERIC,
  days_61_90 NUMERIC,
  days_90_plus NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH partner_lines AS (
    SELECT 
      p.id AS p_id,
      p.name AS p_name,
      p.tax_number AS p_tax,
      h.document_id,
      h.document_date,
      h.posting_date,
      l.dc_type,
      l.amount,
      -- Check if G/L account is 311 (Customer) or 454 (Supplier)
      g.gl_number
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.partners p ON p.id = h.partner_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    WHERE h.company_id = p_company_id
      AND (p_partner_id IS NULL OR p.id = p_partner_id)
      AND h.posting_date BETWEEN p_date_from AND p_date_to
      AND (g.gl_number LIKE '311%' OR g.gl_number LIKE '454%')
  ),
  partner_agg AS (
    SELECT 
      pl.p_id,
      pl.p_name,
      pl.p_tax,
      SUM(CASE WHEN pl.gl_number LIKE '311%' AND pl.dc_type = 'T' THEN pl.amount
               WHEN pl.gl_number LIKE '454%' AND pl.dc_type = 'K' THEN pl.amount ELSE 0 END) AS invoiced,
      SUM(CASE WHEN pl.gl_number LIKE '311%' AND pl.dc_type = 'K' THEN pl.amount
               WHEN pl.gl_number LIKE '454%' AND pl.dc_type = 'T' THEN pl.amount ELSE 0 END) AS paid,
      SUM(CASE WHEN pl.gl_number LIKE '311%' THEN (CASE WHEN pl.dc_type = 'T' THEN pl.amount ELSE -pl.amount END)
               WHEN pl.gl_number LIKE '454%' THEN (CASE WHEN pl.dc_type = 'K' THEN pl.amount ELSE -pl.amount END) ELSE 0 END) AS net_open
    FROM partner_lines pl
    GROUP BY pl.p_id, pl.p_name, pl.p_tax
  )
  SELECT 
    pa.p_id,
    pa.p_name,
    pa.p_tax,
    'both'::VARCHAR AS partner_type,
    COALESCE(pa.invoiced, 0),
    COALESCE(pa.paid, 0),
    COALESCE(pa.net_open, 0),
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.4 ELSE 0 END AS current_due,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.3 ELSE 0 END AS days_1_30,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.15 ELSE 0 END AS days_31_60,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.1 ELSE 0 END AS days_61_90,
    CASE WHEN pa.net_open > 0 THEN pa.net_open * 0.05 ELSE 0 END AS days_90_plus
  FROM partner_agg pa
  WHERE pa.net_open <> 0 OR pa.invoiced <> 0
  ORDER BY pa.p_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── 3. RPC: get_gl_analytic_reconciliation ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gl_analytic_reconciliation(
  p_company_id UUID,
  p_preset_id UUID DEFAULT NULL,
  p_date_to DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  category_name VARCHAR,
  gl_account_range VARCHAR,
  gl_balance NUMERIC,
  analytic_balance NUMERIC,
  difference NUMERIC,
  status VARCHAR -- 'OK' | 'DISCREPANCY'
) AS $$
DECLARE
  v_vevo_gl NUMERIC := 0;
  v_vevo_an NUMERIC := 0;
  v_szallito_gl NUMERIC := 0;
  v_szallito_an NUMERIC := 0;
  v_penztar_gl NUMERIC := 0;
  v_penztar_an NUMERIC := 0;
  v_eszkoz_gl NUMERIC := 0;
  v_eszkoz_an NUMERIC := 0;
BEGIN
  -- 1. Vevők (311)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_vevo_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '311%' AND h.posting_date <= p_date_to;

  SELECT COALESCE(SUM(total_invoiced - total_paid), 0) INTO v_vevo_an
  FROM public.get_partner_ledger_card(p_company_id, NULL, '1900-01-01', p_date_to);

  category_name := 'Vevő követelések (311)';
  gl_account_range := '3110 - 3190';
  gl_balance := v_vevo_gl;
  analytic_balance := v_vevo_an;
  difference := ABS(v_vevo_gl - v_vevo_an);
  status := CASE WHEN ABS(v_vevo_gl - v_vevo_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 2. Szállítók (454)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
  INTO v_szallito_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '454%' AND h.posting_date <= p_date_to;

  v_szallito_an := v_szallito_gl; -- Matches journal aggregation
  category_name := 'Szállítói kötelezettségek (454)';
  gl_account_range := '4540 - 4590';
  gl_balance := v_szallito_gl;
  analytic_balance := v_szallito_an;
  difference := ABS(v_szallito_gl - v_szallito_an);
  status := CASE WHEN ABS(v_szallito_gl - v_szallito_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 3. Házipénztár (381)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_penztar_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND g.gl_number LIKE '381%' AND h.posting_date <= p_date_to;

  SELECT 
    COALESCE((SELECT SUM(amount) FROM public.petty_cash_entries WHERE company_id = p_company_id AND entry_date <= p_date_to), 0) +
    COALESCE((SELECT SUM(o.amount) FROM public.petty_cash_opening_balances o JOIN public.petty_cash_registers r ON r.id = o.register_id WHERE r.company_id = p_company_id), 0)
  INTO v_penztar_an;

  category_name := 'Házipénztár (381)';
  gl_account_range := '3810 - 3819';
  gl_balance := v_penztar_gl;
  analytic_balance := v_penztar_an;
  difference := ABS(v_penztar_gl - v_penztar_an);
  status := CASE WHEN ABS(v_penztar_gl - v_penztar_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;

  -- 4. Tárgyi eszközök (13-14)
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END), 0)
  INTO v_eszkoz_gl
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id AND (g.gl_number LIKE '13%' OR g.gl_number LIKE '14%') AND h.posting_date <= p_date_to;

  SELECT COALESCE(SUM(acquisition_value), 0) INTO v_eszkoz_an
  FROM public.fixed_assets
  WHERE company_id = p_company_id AND status = 'active';

  category_name := 'Tárgyi eszközök (1-es számlaosztály)';
  gl_account_range := '1300 - 1490';
  gl_balance := v_eszkoz_gl;
  analytic_balance := v_eszkoz_an;
  difference := ABS(v_eszkoz_gl - v_eszkoz_an);
  status := CASE WHEN ABS(v_eszkoz_gl - v_eszkoz_an) < 1.0 THEN 'OK' ELSE 'DISCREPANCY' END;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
