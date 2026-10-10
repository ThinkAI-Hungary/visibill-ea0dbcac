-- Migration: 20261010203000_accounty_audit_export_rpcs.sql
-- Description: RPCs for Module 19 (Auditor Export & Data Provision)
-- 1. get_auditor_gl_journal_export (20 standardized auditor columns + summary)
-- 2. get_subsequent_settlements_report (ISA 560 balance sheet subsequent cash settlements)
-- 3. check_audit_export_staleness (Detect modifications after last export snapshot)

-- ==============================================================================
-- 1. get_auditor_gl_journal_export
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_auditor_gl_journal_export(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_include_opening boolean DEFAULT true,
  p_include_closing boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_company record;
  v_result jsonb;
BEGIN
  -- Security check
  IF current_user IN ('postgres', 'supabase_admin') 
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    v_is_authorized := true;
  ELSIF v_user_id IS NOT NULL THEN
    v_is_authorized := (
      user_is_company_member(p_company_id, v_user_id)
      OR user_is_support_admin(v_user_id)
      OR EXISTS (
        SELECT 1 FROM accounty_assignments
        WHERE company_id = p_company_id AND accountant_user_id = v_user_id
      )
    );
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied to company accounting data (company_id: %)', p_company_id
      USING ERRCODE = '42501';
  END IF;

  -- Company info
  SELECT id, name, tax_number INTO v_company
  FROM companies WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id USING ERRCODE = 'P0002';
  END IF;

  WITH
  raw_journals AS (
    SELECT 
      j.id AS journal_uuid,
      j.code AS journal_code,
      j.name AS journal_name,
      j.type AS journal_type
    FROM acc_journals j
    WHERE j.company_id = p_company_id
  ),
  active_headers AS (
    SELECT 
      h.id AS header_id,
      h.journal_id,
      rj.journal_code,
      h.journal_number,
      h.posting_date,
      h.document_date,
      h.document_id,
      h.partner_id,
      h.description AS header_description,
      COALESCE(h.currency, 'HUF') AS currency,
      h.exchange_rate,
      h.created_by,
      h.posted_by,
      h.import_key
    FROM acc_journal_headers h
    JOIN raw_journals rj ON h.journal_id = rj.journal_uuid
    WHERE h.company_id = p_company_id
      AND h.posting_date BETWEEN p_date_from AND p_date_to
      AND h.status IN ('KONYVELT', 'KEZI_PISZKOZAT', 'GEPI_JAVASLAT')
      AND (p_include_opening OR rj.journal_type <> 'OPENING')
      AND (p_include_closing OR rj.journal_type <> 'CLOSING')
  ),
  matched_invoices AS (
    SELECT 
      inv.company_id,
      inv.bizonylatsorszam,
      inv.fizetesi_hatarido
    FROM invoices inv
    WHERE inv.company_id = p_company_id
  ),
  matched_nav_invoices AS (
    SELECT 
      ni.company_id,
      ni.invoice_number,
      ni.payment_date
    FROM nav_invoices ni
    WHERE ni.company_id = p_company_id
  ),
  lines_with_details AS (
    SELECT 
      l.id AS line_id,
      ah.header_id,
      ah.journal_code,
      ah.journal_number,
      ah.posting_date AS accounting_date,
      ah.document_date,
      COALESCE(mi.fizetesi_hatarido, mni.payment_date, ah.document_date) AS due_date,
      COALESCE(ga.gl_number, '499') AS gl_account_number,
      COALESCE(ga.short_name, ga.description, 'Főkönyvi számla') AS gl_account_name,
      l.dc_type,
      l.amount,
      ah.currency,
      l.foreign_amount,
      ah.exchange_rate,
      p.tax_number AS partner_tax_number,
      COALESCE(p.name, 'Ismeretlen Partner') AS partner_name,
      COALESCE(cc.name, cc.code, '') AS cost_center,
      l.sequence_number::text AS job_code,
      COALESCE(prj.name, prj.id::text, '') AS project_id,
      COALESCE(prj.client_name, '') AS grant_id,
      COALESCE(NULLIF(TRIM(l.description), ''), ah.header_description, '') AS description,
      COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, 'Rendszer') AS created_by
    FROM acc_journal_lines l
    JOIN active_headers ah ON l.header_id = ah.header_id
    LEFT JOIN gl_accounts ga ON l.gl_account_id = ga.id
    LEFT JOIN partners p ON ah.partner_id = p.id
    LEFT JOIN accounty_cost_centers cc ON l.cost_center_id = cc.id
    LEFT JOIN projects prj ON l.project_id = prj.id
    LEFT JOIN auth.users u ON COALESCE(ah.posted_by, ah.created_by) = u.id
    LEFT JOIN matched_invoices mi ON mi.bizonylatsorszam = ah.document_id
    LEFT JOIN matched_nav_invoices mni ON mni.invoice_number = ah.document_id
  ),
  aggregated_totals AS (
    SELECT 
      COUNT(*)::int AS total_lines,
      COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE 0 END), 0)::numeric(18,2) AS total_debit,
      COALESCE(SUM(CASE WHEN dc_type = 'K' THEN amount ELSE 0 END), 0)::numeric(18,2) AS total_credit
    FROM lines_with_details
  )
  SELECT jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'tax_number', v_company.tax_number
    ),
    'period', jsonb_build_object(
      'date_from', p_date_from,
      'date_to', p_date_to,
      'include_opening', p_include_opening,
      'include_closing', p_include_closing
    ),
    'summary', jsonb_build_object(
      'total_lines', agg.total_lines,
      'total_debit', agg.total_debit,
      'total_credit', agg.total_credit,
      'is_balanced', (agg.total_debit = agg.total_credit),
      'imbalance_diff', (agg.total_debit - agg.total_credit)
    ),
    'lines', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'line_id', lwd.line_id,
            'header_id', lwd.header_id,
            'journal_code', lwd.journal_code,
            'journal_number', lwd.journal_number,
            'accounting_date', lwd.accounting_date,
            'document_date', lwd.document_date,
            'due_date', lwd.due_date,
            'gl_account_number', lwd.gl_account_number,
            'gl_account_name', lwd.gl_account_name,
            'dc_type', lwd.dc_type,
            'amount', lwd.amount,
            'currency', lwd.currency,
            'foreign_amount', lwd.foreign_amount,
            'exchange_rate', lwd.exchange_rate,
            'partner_tax_number', lwd.partner_tax_number,
            'partner_name', lwd.partner_name,
            'cost_center', lwd.cost_center,
            'job_code', lwd.job_code,
            'project_id', lwd.project_id,
            'grant_id', lwd.grant_id,
            'description', lwd.description,
            'created_by', lwd.created_by
          )
          ORDER BY lwd.accounting_date, lwd.document_date, lwd.journal_code, lwd.journal_number, lwd.line_id
        )
        FROM lines_with_details lwd
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM aggregated_totals agg;

  RETURN v_result;
END;
$$;


-- ==============================================================================
-- 2. get_subsequent_settlements_report (ISA 560 Subsequent Cash Settlements)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_subsequent_settlements_report(
  p_company_id uuid,
  p_fiscal_year integer,
  p_cutoff_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_year_end_date date;
  v_subsequent_start date;
  v_cutoff_date date;
  v_result jsonb;
BEGIN
  -- Security check
  IF current_user IN ('postgres', 'supabase_admin') 
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    v_is_authorized := true;
  ELSIF v_user_id IS NOT NULL THEN
    v_is_authorized := (
      user_is_company_member(p_company_id, v_user_id)
      OR user_is_support_admin(v_user_id)
      OR EXISTS (
        SELECT 1 FROM accounty_assignments
        WHERE company_id = p_company_id AND accountant_user_id = v_user_id
      )
    );
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied to company accounting data (company_id: %)', p_company_id
      USING ERRCODE = '42501';
  END IF;

  v_year_end_date := make_date(p_fiscal_year, 12, 31);
  v_subsequent_start := make_date(p_fiscal_year + 1, 1, 1);
  v_cutoff_date := COALESCE(p_cutoff_date, make_date(p_fiscal_year + 1, 4, 30));

  WITH
  -- 1. All invoices issued on or before year end
  base_invoices AS (
    SELECT 
      inv.id AS invoice_id,
      inv.company_id,
      COALESCE(inv.bizonylatsorszam, inv.id::text) AS invoice_number,
      CASE 
        WHEN inv.invoice_direction = 'OUTBOUND' THEN 'AR'
        ELSE 'AP'
      END AS direction,
      CASE 
        WHEN inv.invoice_direction = 'OUTBOUND' THEN COALESCE(inv.vevo_nev, p.name, 'Ismeretlen Vevő')
        ELSE COALESCE(inv.elado_nev, p.name, 'Ismeretlen Szállító')
      END AS partner_name,
      CASE 
        WHEN inv.invoice_direction = 'OUTBOUND' THEN COALESCE(inv.vevo_vat_id, p.tax_number, '')
        ELSE COALESCE(inv.elado_vat_id, p.tax_number, '')
      END AS partner_tax_number,
      COALESCE(inv.kibocsatas_datuma, inv.letrehozva::date) AS issue_date,
      COALESCE(inv.fizetesi_hatarido, inv.kibocsatas_datuma, inv.letrehozva::date) AS due_date,
      COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma) AS fulfillment_date,
      COALESCE(inv.brutto_vegosszeg, inv.fizetendo_osszeg, 0)::numeric(18,2) AS invoice_gross,
      COALESCE(inv.penznem, 'HUF') AS currency
    FROM invoices inv
    LEFT JOIN partners p ON inv.user_id = p.id
    WHERE inv.company_id = p_company_id
      AND COALESCE(inv.kibocsatas_datuma, inv.letrehozva::date) <= v_year_end_date
  ),
  -- 2. Payments occurred on or before Dec 31
  pre_year_end_payments AS (
    SELECT 
      t.matched_invoice_id AS invoice_id,
      COALESCE(SUM(ABS(t.amount)), 0)::numeric(18,2) AS paid_before_dec31
    FROM transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NOT NULL
      AND COALESCE(t.transaction_date, t.terheles_datuma, t.created_at::date) <= v_year_end_date
    GROUP BY t.matched_invoice_id
  ),
  -- 3. Payments occurred during subsequent events period (Jan 1 to Cutoff Date)
  subsequent_payments AS (
    SELECT 
      t.matched_invoice_id AS invoice_id,
      COALESCE(SUM(ABS(t.amount)), 0)::numeric(18,2) AS subsequent_paid,
      MIN(COALESCE(t.transaction_date, t.terheles_datuma, t.created_at::date)) AS first_settlement_date,
      MAX(COALESCE(t.transaction_date, t.terheles_datuma, t.created_at::date)) AS last_settlement_date,
      CASE 
        WHEN bool_or(t.type = 'BANK' OR t.a8_transaction_id IS NOT NULL) THEN 'BANK'
        ELSE 'OTHER'
      END AS method
    FROM transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NOT NULL
      AND COALESCE(t.transaction_date, t.terheles_datuma, t.created_at::date) BETWEEN v_subsequent_start AND v_cutoff_date
    GROUP BY t.matched_invoice_id
  ),
  -- 4. Calculate open amount at Dec 31 and combine
  open_and_settled AS (
    SELECT 
      bi.invoice_id,
      bi.invoice_number,
      bi.direction,
      bi.partner_name,
      bi.partner_tax_number,
      bi.issue_date,
      bi.due_date,
      bi.fulfillment_date,
      (bi.invoice_gross - COALESCE(pyp.paid_before_dec31, 0)) AS open_amount_dec31,
      bi.currency,
      COALESCE(sp.subsequent_paid, 0) AS subsequent_settled_amount,
      sp.first_settlement_date,
      sp.last_settlement_date,
      COALESCE(sp.method, 'NONE') AS settlement_method,
      CASE 
        WHEN (bi.invoice_gross - COALESCE(pyp.paid_before_dec31, 0)) <= 0 THEN 100.0
        ELSE ROUND((LEAST(COALESCE(sp.subsequent_paid, 0), (bi.invoice_gross - COALESCE(pyp.paid_before_dec31, 0))) / (bi.invoice_gross - COALESCE(pyp.paid_before_dec31, 0))) * 100, 1)
      END AS settlement_percentage
    FROM base_invoices bi
    LEFT JOIN pre_year_end_payments pyp ON bi.invoice_id = pyp.invoice_id
    LEFT JOIN subsequent_payments sp ON bi.invoice_id = sp.invoice_id
    WHERE (bi.invoice_gross - COALESCE(pyp.paid_before_dec31, 0)) > 0
  ),
  final_items AS (
    SELECT 
      o.*,
      CASE 
        WHEN o.settlement_percentage >= 99.9 THEN 'SETTLED'
        WHEN o.settlement_percentage > 0 THEN 'PARTIALLY_SETTLED'
        ELSE 'UNSETTLED'
      END AS settlement_status
    FROM open_and_settled o
  ),
  summary_calc AS (
    SELECT 
      COALESCE(SUM(CASE WHEN direction = 'AR' THEN open_amount_dec31 ELSE 0 END), 0)::numeric(18,2) AS total_receivables_open_dec31,
      COALESCE(SUM(CASE WHEN direction = 'AR' THEN LEAST(subsequent_settled_amount, open_amount_dec31) ELSE 0 END), 0)::numeric(18,2) AS settled_receivables_subsequent,
      COALESCE(SUM(CASE WHEN direction = 'AP' THEN open_amount_dec31 ELSE 0 END), 0)::numeric(18,2) AS total_payables_open_dec31,
      COALESCE(SUM(CASE WHEN direction = 'AP' THEN LEAST(subsequent_settled_amount, open_amount_dec31) ELSE 0 END), 0)::numeric(18,2) AS settled_payables_subsequent
    FROM final_items
  )
  SELECT jsonb_build_object(
    'fiscal_year', p_fiscal_year,
    'year_end_date', v_year_end_date,
    'cutoff_date', v_cutoff_date,
    'summary', jsonb_build_object(
      'total_receivables_open_dec31', sc.total_receivables_open_dec31,
      'settled_receivables_subsequent', sc.settled_receivables_subsequent,
      'receivables_settlement_rate', CASE 
        WHEN sc.total_receivables_open_dec31 > 0 
        THEN ROUND((sc.settled_receivables_subsequent / sc.total_receivables_open_dec31) * 100, 1)
        ELSE 100.0 END,
      'total_payables_open_dec31', sc.total_payables_open_dec31,
      'settled_payables_subsequent', sc.settled_payables_subsequent,
      'payables_settlement_rate', CASE 
        WHEN sc.total_payables_open_dec31 > 0 
        THEN ROUND((sc.settled_payables_subsequent / sc.total_payables_open_dec31) * 100, 1)
        ELSE 100.0 END
    ),
    'items', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'invoice_id', fi.invoice_id,
            'invoice_number', fi.invoice_number,
            'direction', fi.direction,
            'partner_name', fi.partner_name,
            'partner_tax_number', fi.partner_tax_number,
            'issue_date', fi.issue_date,
            'due_date', fi.due_date,
            'fulfillment_date', fi.fulfillment_date,
            'open_amount_dec31', fi.open_amount_dec31,
            'currency', fi.currency,
            'subsequent_settled_amount', fi.subsequent_settled_amount,
            'first_settlement_date', fi.first_settlement_date,
            'last_settlement_date', fi.last_settlement_date,
            'settlement_method', fi.settlement_method,
            'settlement_percentage', fi.settlement_percentage,
            'settlement_status', fi.settlement_status
          )
          ORDER BY fi.direction, fi.open_amount_dec31 DESC
        )
        FROM final_items fi
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM summary_calc sc;

  RETURN v_result;
END;
$$;


-- ==============================================================================
-- 3. check_audit_export_staleness
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_audit_export_staleness(
  p_company_id uuid,
  p_fiscal_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_authorized boolean := false;
  v_last_export record;
  v_max_header_date timestamptz;
  v_max_invoice_date timestamptz;
  v_latest_activity timestamptz;
  v_modified_count integer := 0;
  v_is_stale boolean := false;
BEGIN
  -- Security check
  IF current_user IN ('postgres', 'supabase_admin') 
     OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    v_is_authorized := true;
  ELSIF v_user_id IS NOT NULL THEN
    v_is_authorized := (
      user_is_company_member(p_company_id, v_user_id)
      OR user_is_support_admin(v_user_id)
      OR EXISTS (
        SELECT 1 FROM accounty_assignments
        WHERE company_id = p_company_id AND accountant_user_id = v_user_id
      )
    );
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied to company accounting data (company_id: %)', p_company_id
      USING ERRCODE = '42501';
  END IF;

  -- 1. Find latest export for this fiscal year
  SELECT id, version_label, file_hash_sha256, created_at, is_stale, stale_detected_at
  INTO v_last_export
  FROM accounty_audit_exports
  WHERE company_id = p_company_id AND fiscal_year = p_fiscal_year
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'has_export', false,
      'is_stale', false,
      'fiscal_year', p_fiscal_year
    );
  END IF;

  -- 2. Find latest activity in journal entries for this fiscal year
  SELECT MAX(COALESCE(posted_at, created_at))
  INTO v_max_header_date
  FROM acc_journal_headers
  WHERE company_id = p_company_id
    AND EXTRACT(YEAR FROM posting_date) = p_fiscal_year;

  -- 3. Invoices for this year
  SELECT MAX(COALESCE(frissitve, letrehozva))
  INTO v_max_invoice_date
  FROM invoices
  WHERE company_id = p_company_id
    AND EXTRACT(YEAR FROM COALESCE(kibocsatas_datuma, letrehozva::date)) = p_fiscal_year;

  v_latest_activity := GREATEST(v_max_header_date, v_max_invoice_date);

  -- 4. Check staleness against export creation timestamp
  IF v_latest_activity IS NOT NULL AND v_latest_activity > v_last_export.created_at THEN
    v_is_stale := true;

    -- Count changes since export
    SELECT COUNT(*) INTO v_modified_count
    FROM acc_journal_headers
    WHERE company_id = p_company_id
      AND EXTRACT(YEAR FROM posting_date) = p_fiscal_year
      AND COALESCE(posted_at, created_at) > v_last_export.created_at;

    -- Update is_stale flag if not already set
    IF NOT v_last_export.is_stale THEN
      UPDATE accounty_audit_exports
      SET is_stale = true,
          stale_detected_at = now()
      WHERE id = v_last_export.id;
    END IF;
  ELSE
    v_is_stale := v_last_export.is_stale;
  END IF;

  RETURN jsonb_build_object(
    'has_export', true,
    'export_id', v_last_export.id,
    'last_export_version', v_last_export.version_label,
    'last_export_at', v_last_export.created_at,
    'file_hash_sha256', v_last_export.file_hash_sha256,
    'is_stale', v_is_stale,
    'stale_detected_at', COALESCE(v_last_export.stale_detected_at, now()),
    'modified_entries_count', v_modified_count,
    'last_activity_at', v_latest_activity
  );
END;
$$;

-- Revoke from anon, grant to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_auditor_gl_journal_export(uuid, date, date, boolean, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_auditor_gl_journal_export(uuid, date, date, boolean, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_subsequent_settlements_report(uuid, integer, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_subsequent_settlements_report(uuid, integer, date) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_audit_export_staleness(uuid, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_audit_export_staleness(uuid, integer) TO authenticated, service_role;
