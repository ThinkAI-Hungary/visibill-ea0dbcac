-- Migration: 20261010223000_vat_osa_three_way_reconciliation_rpc.sql
-- Description: Three-way reconciliation RPC between NAV OSA, Invoice Registry, and General Ledger (466/467)
-- Complies with SPEC-2026-VAT-RETURN-20, P-179, A-242, and Header Pre-Materialization Invariant

CREATE OR REPLACE FUNCTION public.get_vat_osa_three_way_reconciliation(
  p_company_id UUID,
  p_date_from DATE,
  p_date_to DATE
)
RETURNS TABLE (
  id TEXT,
  invoice_number VARCHAR,
  direction VARCHAR,
  partner_name TEXT,
  partner_tax_number VARCHAR,
  delivery_date_nav DATE,
  delivery_date_local DATE,
  net_amount_nav NUMERIC,
  vat_amount_nav NUMERIC,
  gross_amount_nav NUMERIC,
  net_amount_local NUMERIC,
  vat_amount_local NUMERIC,
  gross_amount_local NUMERIC,
  gl_debit_amount NUMERIC,
  gl_credit_amount NUMERIC,
  gl_account_numbers TEXT[],
  status VARCHAR,
  anomaly_types TEXT[],
  anomaly_count INTEGER,
  diff_summary TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH
  -- 1. Pre-materialized NAV Invoices
  nav_filtered AS MATERIALIZED (
    SELECT
      n.id::text AS nav_id,
      TRIM(n.invoice_number) AS inv_num,
      LOWER(REGEXP_REPLACE(TRIM(n.invoice_number), '[^a-zA-Z0-9]', '', 'g')) AS norm_num,
      UPPER(COALESCE(n.invoice_direction, 'INBOUND')) AS dir,
      CASE
        WHEN UPPER(COALESCE(n.invoice_direction, 'INBOUND')) = 'OUTBOUND' THEN COALESCE(n.customer_name, 'Ismeretlen vevő')
        ELSE COALESCE(n.supplier_name, 'Ismeretlen szállító')
      END AS p_name,
      CASE
        WHEN UPPER(COALESCE(n.invoice_direction, 'INBOUND')) = 'OUTBOUND' THEN SUBSTRING(COALESCE(n.customer_tax_number, ''), 1, 8)
        ELSE SUBSTRING(COALESCE(n.supplier_tax_number, ''), 1, 8)
      END AS p_tax,
      n.invoice_delivery_date AS del_date,
      COALESCE(n.invoice_net_amount, 0) AS net_amt,
      COALESCE(n.invoice_vat_amount, 0) AS vat_amt,
      COALESCE(n.invoice_gross_amount, 0) AS gross_amt,
      COALESCE(n.invoice_operation, 'CREATE') AS op
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_delivery_date BETWEEN p_date_from AND p_date_to
      AND (n.exclude_from_accounting IS NULL OR n.exclude_from_accounting = false)
  ),
  -- 2. Pre-materialized Local Invoices (Számlatár)
  local_filtered AS MATERIALIZED (
    SELECT
      i.id::text AS loc_id,
      TRIM(i.bizonylatsorszam) AS inv_num,
      LOWER(REGEXP_REPLACE(TRIM(i.bizonylatsorszam), '[^a-zA-Z0-9]', '', 'g')) AS norm_num,
      UPPER(COALESCE(i.invoice_direction, 'INBOUND')) AS dir,
      CASE
        WHEN UPPER(COALESCE(i.invoice_direction, 'INBOUND')) = 'OUTBOUND' THEN COALESCE(i.vevo_nev, 'Ismeretlen vevő')
        ELSE COALESCE(i.elado_nev, 'Ismeretlen szállító')
      END AS p_name,
      CASE
        WHEN UPPER(COALESCE(i.invoice_direction, 'INBOUND')) = 'OUTBOUND' THEN SUBSTRING(COALESCE(i.vevo_vat_id, ''), 1, 8)
        ELSE SUBSTRING(COALESCE(i.elado_vat_id, ''), 1, 8)
      END AS p_tax,
      i.teljesites_datuma AS del_date,
      COALESCE(i.adoalap_osszesen, 0) AS net_amt,
      COALESCE(i.afa_osszeg_osszesen, 0) AS vat_amt,
      COALESCE(i.brutto_vegosszeg, 0) AS gross_amt
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.teljesites_datuma BETWEEN p_date_from AND p_date_to
      AND (i.exclude_from_accounting IS NULL OR i.exclude_from_accounting = false)
  ),
  -- 3. Pre-materialized GL Lines (466 / 467)
  gl_aggregated AS MATERIALIZED (
    SELECT
      LOWER(REGEXP_REPLACE(TRIM(jh.document_id), '[^a-zA-Z0-9]', '', 'g')) AS norm_num,
      SUM(CASE WHEN jl.dc_type = 'D' THEN jl.amount ELSE 0 END) AS deb_amt,
      SUM(CASE WHEN jl.dc_type = 'C' THEN jl.amount ELSE 0 END) AS cred_amt,
      ARRAY_AGG(DISTINCT ga.gl_number::text) FILTER (WHERE ga.gl_number IS NOT NULL) AS accounts
    FROM public.acc_journal_headers jh
    JOIN public.acc_journal_lines jl ON jl.header_id = jh.id
    JOIN public.gl_accounts ga ON ga.id = jl.gl_account_id
    WHERE jh.company_id = p_company_id
      AND jh.document_date BETWEEN p_date_from AND p_date_to
      AND (ga.gl_number LIKE '466%' OR ga.gl_number LIKE '467%')
      AND jh.document_id IS NOT NULL
      AND TRIM(jh.document_id) <> ''
    GROUP BY LOWER(REGEXP_REPLACE(TRIM(jh.document_id), '[^a-zA-Z0-9]', '', 'g'))
  ),
  -- 4. Full Outer Join on Normalized Invoice Number and Direction
  reconciled AS (
    SELECT
      COALESCE(n.nav_id, l.loc_id, gen_random_uuid()::text) AS row_id,
      COALESCE(n.inv_num, l.inv_num) AS row_inv_num,
      COALESCE(n.dir, l.dir, 'INBOUND')::varchar AS row_dir,
      COALESCE(l.p_name, n.p_name) AS row_p_name,
      COALESCE(l.p_tax, n.p_tax)::varchar AS row_p_tax,
      n.del_date AS row_del_nav,
      l.del_date AS row_del_loc,
      COALESCE(n.net_amt, 0) AS row_net_nav,
      COALESCE(n.vat_amt, 0) AS row_vat_nav,
      COALESCE(n.gross_amt, 0) AS row_gross_nav,
      COALESCE(l.net_amt, 0) AS row_net_loc,
      COALESCE(l.vat_amt, 0) AS row_vat_loc,
      COALESCE(l.gross_amt, 0) AS row_gross_loc,
      COALESCE(g.deb_amt, 0) AS row_gl_deb,
      COALESCE(g.cred_amt, 0) AS row_gl_cred,
      COALESCE(g.accounts, ARRAY[]::text[]) AS row_gl_accs,
      n.nav_id IS NOT NULL AS has_nav,
      l.loc_id IS NOT NULL AS has_loc,
      n.op AS row_nav_op
    FROM nav_filtered n
    FULL OUTER JOIN local_filtered l 
      ON n.norm_num = l.norm_num AND n.dir = l.dir
    LEFT JOIN gl_aggregated g 
      ON g.norm_num = COALESCE(n.norm_num, l.norm_num)
  ),
  -- 5. Anomaly Tagging
  with_anomalies AS (
    SELECT
      r.*,
      CASE
        WHEN NOT r.has_loc AND r.has_nav THEN 'MISSING_FROM_LOCAL'
        WHEN r.has_loc AND NOT r.has_nav THEN 'MISSING_FROM_NAV'
        WHEN ABS(r.row_net_nav - r.row_net_loc) > 2 OR ABS(r.row_vat_nav - r.row_vat_loc) > 2 THEN 'DIFF'
        WHEN r.row_del_nav IS DISTINCT FROM r.row_del_loc THEN 'DIFF'
        ELSE 'MATCH'
      END::varchar AS row_status,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN NOT r.has_loc AND r.has_nav THEN 'MISSING_INVOICE' ELSE NULL END,
        CASE WHEN r.has_loc AND NOT r.has_nav THEN 'MISSING_INVOICE' ELSE NULL END,
        CASE WHEN r.has_loc AND r.has_nav AND (ABS(r.row_net_nav - r.row_net_loc) > 2 OR ABS(r.row_vat_nav - r.row_vat_loc) > 2) THEN 'AMOUNT_MISMATCH' ELSE NULL END,
        CASE WHEN r.has_loc AND r.has_nav AND r.row_del_nav IS DISTINCT FROM r.row_del_loc THEN 'DATE_SHIFT' ELSE NULL END,
        CASE WHEN r.has_loc AND r.has_nav AND r.row_nav_op IN ('ANNUL', 'TECHNICAL_ANNUL', 'STORNO') AND r.row_gross_loc > 0 THEN 'STORNO_ASYNC' ELSE NULL END,
        CASE WHEN r.has_loc AND r.has_nav AND r.row_net_loc > 0 AND r.row_net_nav > 0 
                  AND ABS((r.row_vat_loc / r.row_net_loc) - (r.row_vat_nav / r.row_net_nav)) > 0.02 THEN 'TAX_RATE_MISMATCH' ELSE NULL END
      ], NULL) AS anomalies
    FROM reconciled r
  )
  SELECT
    wa.row_id AS id,
    wa.row_inv_num::varchar AS invoice_number,
    wa.row_dir AS direction,
    wa.row_p_name AS partner_name,
    wa.row_p_tax AS partner_tax_number,
    wa.row_del_nav AS delivery_date_nav,
    wa.row_del_loc AS delivery_date_local,
    wa.row_net_nav AS net_amount_nav,
    wa.row_vat_nav AS vat_amount_nav,
    wa.row_gross_nav AS gross_amount_nav,
    wa.row_net_loc AS net_amount_local,
    wa.row_vat_loc AS vat_amount_local,
    wa.row_gross_loc AS gross_amount_local,
    wa.row_gl_deb AS gl_debit_amount,
    wa.row_gl_cred AS gl_credit_amount,
    wa.row_gl_accs AS gl_account_numbers,
    wa.row_status AS status,
    wa.anomalies AS anomaly_types,
    CARDINALITY(wa.anomalies) AS anomaly_count,
    CASE
      WHEN 'MISSING_INVOICE' = ANY(wa.anomalies) AND wa.row_status = 'MISSING_FROM_LOCAL' THEN 'NAV-ban létezik, számlatárban nem rögzített'
      WHEN 'MISSING_INVOICE' = ANY(wa.anomalies) AND wa.row_status = 'MISSING_FROM_NAV' THEN 'Számlatárban létezik, NAV-ban nem található'
      WHEN 'AMOUNT_MISMATCH' = ANY(wa.anomalies) THEN 'Nettó/ÁFA összegeltérés (NAV vs Helyi)'
      WHEN 'DATE_SHIFT' = ANY(wa.anomalies) THEN 'Teljesítési dátumcsúszás'
      WHEN 'STORNO_ASYNC' = ANY(wa.anomalies) THEN 'NAV stornó/érvénytelenítés nincs lekönyvelve'
      WHEN 'TAX_RATE_MISMATCH' = ANY(wa.anomalies) THEN 'Áfakulcs besorolási eltérés'
      ELSE 'Teljes 3-oldalú egyezőség'
    END AS diff_summary
  FROM with_anomalies wa
  ORDER BY 
    CARDINALITY(wa.anomalies) DESC,
    COALESCE(wa.row_del_loc, wa.row_del_nav) DESC;
END;
$$;

-- Security & Permissions
REVOKE EXECUTE ON FUNCTION public.get_vat_osa_three_way_reconciliation(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vat_osa_three_way_reconciliation(UUID, DATE, DATE) TO authenticated, service_role;
