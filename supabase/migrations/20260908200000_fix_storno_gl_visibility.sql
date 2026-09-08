-- ==============================================================================
-- Migration: 20260908200000_fix_storno_gl_visibility.sql
-- Description: Fix General Ledger visibility for stornoed journal entries.
--              When filtering for posted entries ('KONYVELT' / 'posted'), include
--              both 'KONYVELT' and 'SZTORNOZOTT' headers so that original entries
--              and their reversing storno entries both appear on General Ledger cards
--              and balances, properly netting out to 0 and preserving audit trails.
-- Author: Visibill Agentic Team
-- ==============================================================================

-- ─── 1. UPDATE ACC_GET_GL_CARD_LINES ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.acc_get_gl_card_lines(
  p_company_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_gl_number_prefix VARCHAR DEFAULT NULL,
  p_date_from DATE DEFAULT '1970-01-01',
  p_date_to DATE DEFAULT '2099-12-31',
  p_date_basis VARCHAR DEFAULT 'kibocsatas',
  p_posting_status VARCHAR DEFAULT 'all',
  p_include_opening BOOLEAN DEFAULT TRUE
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
  contra_gl_number TEXT,
  contra_gl_name TEXT,
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_debit NUMERIC := 0;
  v_opening_credit NUMERIC := 0;
  v_opening_net NUMERIC := 0;
  v_running NUMERIC := 0;
  v_row RECORD;
BEGIN
  -- 1. Calculate opening balance (prior to p_date_from)
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
    AND (p_posting_status = 'all' OR h.status IN ('KONYVELT', 'SZTORNOZOTT'));

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
      AND (p_posting_status = 'all' OR h.status IN ('KONYVELT', 'SZTORNOZOTT'))
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
    
    -- Calculate running net balance (T positive, K negative)
    IF dc_type = 'T' THEN
      v_running := v_running + debit_amount;
    ELSE
      v_running := v_running - credit_amount;
    END IF;
    
    running_balance := v_running;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_get_gl_card_lines(UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, VARCHAR, BOOLEAN) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_get_gl_card_lines(UUID, UUID, VARCHAR, DATE, DATE, VARCHAR, VARCHAR, BOOLEAN) TO authenticated, service_role;
