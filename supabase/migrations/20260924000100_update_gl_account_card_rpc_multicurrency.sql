-- Migration: Update get_gl_account_card_items RPC to support foreign currency opening balances and currency detection
-- File: supabase/migrations/20260924000100_update_gl_account_card_rpc_multicurrency.sql

CREATE OR REPLACE FUNCTION public.get_gl_account_card_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_gl_number_prefix character varying DEFAULT NULL::character varying,
  p_date_from date DEFAULT '1900-01-01'::date,
  p_date_to date DEFAULT '2099-12-31'::date,
  p_include_opening boolean DEFAULT true,
  p_date_basis character varying DEFAULT 'kibocsatas'::character varying,
  p_posting_status character varying DEFAULT 'all'::character varying
)
RETURNS TABLE(
  line_id uuid,
  header_id uuid,
  posting_date date,
  document_date date,
  document_id character varying,
  journal_code character varying,
  journal_name character varying,
  gl_account_id uuid,
  gl_number character varying,
  gl_short_name character varying,
  contra_gl_number character varying,
  contra_gl_name character varying,
  partner_id uuid,
  partner_name character varying,
  partner_tax_number character varying,
  description text,
  dc_type character varying,
  debit_amount numeric,
  credit_amount numeric,
  foreign_amount numeric,
  currency character varying,
  project_name character varying,
  running_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_opening_debit NUMERIC := 0;
  v_opening_credit NUMERIC := 0;
  v_opening_net NUMERIC := 0;
  v_opening_foreign_debit NUMERIC := 0;
  v_opening_foreign_credit NUMERIC := 0;
  v_opening_foreign_net NUMERIC := 0;
  v_running NUMERIC := 0;
  v_detected_currency VARCHAR := NULL;
  v_row RECORD;
BEGIN
  -- 1. Determine currency of the account if explicitly set in gl_accounts
  IF p_gl_account_id IS NOT NULL THEN
    SELECT g.currency INTO v_detected_currency
    FROM public.gl_accounts g
    WHERE g.id = p_gl_account_id;
  ELSIF p_gl_number_prefix IS NOT NULL THEN
    SELECT g.currency INTO v_detected_currency
    FROM public.gl_accounts g
    WHERE g.gl_number LIKE p_gl_number_prefix || '%'
      AND g.currency IS NOT NULL
    LIMIT 1;
  END IF;

  -- 2. Calculate opening balance prior to p_date_from (both in HUF and in Foreign Currency)
  SELECT 
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, 0) ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN COALESCE(l.foreign_amount, 0) ELSE 0 END), 0)
  INTO v_opening_debit, v_opening_credit, v_opening_foreign_debit, v_opening_foreign_credit
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
  v_opening_foreign_net := v_opening_foreign_debit - v_opening_foreign_credit;
  v_running := v_opening_net;

  -- If currency wasn't on gl_account, attempt to discover from prior foreign lines
  IF v_detected_currency IS NULL AND (v_opening_foreign_debit > 0 OR v_opening_foreign_credit > 0) THEN
    SELECT h.currency INTO v_detected_currency
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    WHERE h.company_id = p_company_id
      AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
      AND (p_gl_number_prefix IS NULL OR g.gl_number LIKE p_gl_number_prefix || '%')
      AND h.currency IS NOT NULL AND h.currency <> 'HUF'
    LIMIT 1;
  END IF;

  -- 3. Return opening row if requested
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
    foreign_amount := CASE WHEN v_opening_foreign_net <> 0 OR (v_detected_currency IS NOT NULL AND v_detected_currency <> 'HUF') THEN v_opening_foreign_net ELSE NULL END;
    currency := COALESCE(v_detected_currency, 'HUF');
    project_name := NULL;
    running_balance := v_running;
    RETURN NEXT;
  END IF;

  -- 4. Loop through items in date range and calculate running balance
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
      COALESCE(h.currency, 'HUF') AS r_currency,
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

    v_running := v_running + debit_amount - credit_amount;
    running_balance := v_running;

    RETURN NEXT;
  END LOOP;
END;
$function$;
