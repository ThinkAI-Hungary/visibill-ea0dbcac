-- Migration: 20260930101600_subledger_net_vat_and_lines_agg.sql
-- Description: Enhance get_subledger_items RPC with net_amount, vat_amount, and all_lines (JSONB) for hierarchical invoice view.

DROP FUNCTION IF EXISTS public.get_subledger_items(UUID, UUID, UUID, TEXT, DATE, DATE);
DROP FUNCTION IF EXISTS public.get_subledger_items(UUID, UUID, UUID, TEXT, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.get_subledger_items(
  p_company_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'ALL'
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL,
  p_status_filter TEXT DEFAULT 'ALL_ACTIVE' -- 'ALL_ACTIVE', 'POSTED_ONLY', 'DRAFT_ONLY'
)
RETURNS TABLE(
  line_id UUID,
  header_id UUID,
  posting_date DATE,
  document_date DATE,
  due_date DATE,
  document_id VARCHAR(64),
  settlement_number VARCHAR(64),
  partner_id UUID,
  partner_name TEXT,
  gl_account_id UUID,
  gl_number VARCHAR(16),
  gl_short_name TEXT,
  dc_type CHAR(1),
  amount NUMERIC(18,2),
  foreign_amount NUMERIC(18,2),
  currency CHAR(3),
  settled_amount NUMERIC(18,2),
  remaining_amount NUMERIC(18,2),
  is_settled BOOLEAN,
  match_count INTEGER,
  description TEXT,
  status VARCHAR(32),
  journal_code VARCHAR(8),
  journal_number INTEGER,
  import_key TEXT,
  net_amount NUMERIC(18,2),
  vat_amount NUMERIC(18,2),
  all_lines JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH line_settlements AS (
    SELECT 
      l_id,
      SUM(s_amt) as total_settled,
      COUNT(*)::INTEGER as match_cnt
    FROM (
      SELECT invoice_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches WHERE company_id = p_company_id
      UNION ALL
      SELECT settling_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches WHERE company_id = p_company_id
    ) raw_s
    GROUP BY l_id
  ),
  header_lines_agg AS (
    SELECT
      l2.header_id,
      COALESCE(SUM(CASE WHEN l2.vat_role = 'ALAP' THEN l2.amount END), 0) AS net_sum,
      COALESCE(SUM(CASE WHEN l2.vat_role = 'AFA' THEN l2.amount END), 0) AS vat_sum,
      jsonb_agg(
        jsonb_build_object(
          'id', l2.id,
          'sequence_number', l2.sequence_number,
          'gl_account_id', l2.gl_account_id,
          'gl_number', g2.gl_number,
          'gl_short_name', g2.short_name,
          'dc_type', l2.dc_type,
          'amount', l2.amount,
          'foreign_amount', l2.foreign_amount,
          'vat_role', l2.vat_role,
          'vat_code', l2.vat_code,
          'description', l2.description
        ) ORDER BY l2.sequence_number ASC
      ) AS lines_json
    FROM public.acc_journal_lines l2
    JOIN public.acc_journal_headers h2 ON h2.id = l2.header_id
    LEFT JOIN public.gl_accounts g2 ON g2.id = l2.gl_account_id
    WHERE h2.company_id = p_company_id
    GROUP BY l2.header_id
  )
  SELECT
    l.id as line_id,
    h.id as header_id,
    h.posting_date,
    h.document_date,
    COALESCE(h.due_date, h.document_date + INTERVAL '8 days')::DATE as due_date,
    h.document_id,
    COALESCE(h.document_id, '')::VARCHAR(64) as settlement_number,
    h.partner_id,
    COALESCE(p.name, '')::TEXT as partner_name,
    l.gl_account_id,
    g.gl_number,
    g.short_name::TEXT as gl_short_name,
    l.dc_type,
    l.amount,
    l.foreign_amount,
    COALESCE(h.currency, 'HUF')::CHAR(3) as currency,
    COALESCE(ls.total_settled, 0)::NUMERIC(18,2) as settled_amount,
    GREATEST(0, l.amount - COALESCE(ls.total_settled, 0))::NUMERIC(18,2) as remaining_amount,
    (COALESCE(ls.total_settled, 0) >= (l.amount - 0.01))::BOOLEAN as is_settled,
    COALESCE(ls.match_cnt, 0)::INTEGER as match_count,
    l.description::TEXT as description,
    h.status,
    j.code as journal_code,
    COALESCE(h.journal_number, 0)::INTEGER as journal_number,
    h.import_key::TEXT as import_key,
    COALESCE(
      NULLIF(hla.net_sum, 0),
      CASE WHEN hla.vat_sum = 0 THEN l.amount ELSE GREATEST(0, l.amount - hla.vat_sum) END
    )::NUMERIC(18,2) AS net_amount,
    COALESCE(hla.vat_sum, 0)::NUMERIC(18,2) AS vat_amount,
    COALESCE(hla.lines_json, '[]'::jsonb) AS all_lines
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.acc_journals j ON j.id = h.journal_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  LEFT JOIN public.partners p ON p.id = h.partner_id
  LEFT JOIN line_settlements ls ON ls.l_id = l.id
  LEFT JOIN header_lines_agg hla ON hla.header_id = h.id
  WHERE h.company_id = p_company_id
    AND (
      p_status_filter = 'ALL_ACTIVE' AND h.status IN ('KONYVELT', 'GEPI_JAVASLAT', 'PISZKOZAT', 'KEZI_PISZKOZAT')
      OR (p_status_filter = 'POSTED_ONLY' AND h.status = 'KONYVELT')
      OR (p_status_filter = 'DRAFT_ONLY' AND h.status IN ('GEPI_JAVASLAT', 'PISZKOZAT', 'KEZI_PISZKOZAT'))
    )
    AND (g.is_open_item_managed = true OR g.subledger_type IN ('partner', 'detail'))
    AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
    AND (p_partner_id IS NULL OR h.partner_id = p_partner_id)
    AND (p_date_from IS NULL OR h.posting_date >= p_date_from)
    AND (p_date_to IS NULL OR h.posting_date <= p_date_to)
    AND (
      p_mode = 'ALL'
      OR (p_mode = 'OPEN' AND (COALESCE(ls.total_settled, 0) < (l.amount - 0.01)))
      OR (p_mode = 'CLOSED' AND (COALESCE(ls.total_settled, 0) >= (l.amount - 0.01)))
    )
  ORDER BY h.posting_date ASC, h.document_id ASC, l.sequence_number ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subledger_items(UUID, UUID, UUID, TEXT, DATE, DATE, TEXT) TO authenticated, service_role;
