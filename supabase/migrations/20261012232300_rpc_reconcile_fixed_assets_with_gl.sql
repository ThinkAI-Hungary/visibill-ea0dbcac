-- ============================================================================
-- TENY M1.2: Főkönyv <-> Tárgyi eszköz nyilvántartó rekonciliációs motor
-- ----------------------------------------------------------------------------
-- RPC: reconcile_fixed_assets_with_gl(p_company_id uuid, p_date date)
--
-- Szerveroldali (STABLE, SECURITY DEFINER) aggregáció az 1-es számlaosztály
-- tárgyieszköz-számláira (D-5):
--   gross : 11x/12x/13x/14x (kivéve 119/129/139/149)   egyenleg = T - K
--   accum : 119/129/139/149 (halmozott ÉCS)           egyenleg = K - T
--   cip   : 161 (befejezetlen beruházás)               egyenleg = T - K
--
-- Eszközönként a `acc_journal_lines.fixed_asset_id` (M1.1) alapján kapcsol.
-- A jelöletlen (fixed_asset_id IS NULL) sorok `orphans` listába kerülnek.
--
-- A várható halmozott ÉCS-t (analitika) a kliens számolja a meglévő
-- `calculateDepreciation` motorral (egyetlen igazságforrás a degresszív /
-- teljesítmény / egyedi leírási módokra) - az RPC az eszközönkénti
-- főkönyvi oldalt (gl_accum) adja vissza az összevetéshez.
--
-- Beszámított fejlécek: KONYVELT és SZTORNOZOTT (a sztornó ellenoldali
-- tételei KONYVELT státuszban vannak, így az eredő nulla).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_fixed_assets_with_gl(
  p_company_id uuid,
  p_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_date date := COALESCE(p_date, CURRENT_DATE);
  v_result jsonb;
BEGIN
  -- Olvasási szint: cégtag (owner/admin/member/assistant) vagy hozzárendelt könyvelő
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  WITH gl_lines AS (
    SELECT
      l.id            AS line_id,
      l.header_id,
      l.fixed_asset_id,
      l.dc_type,
      l.amount,
      l.description,
      h.posting_date,
      h.document_id,
      g.gl_number,
      x.cls,
      CASE
        WHEN x.cls = 'accum' THEN CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END
        ELSE CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END
      END AS signed_amount
    FROM public.acc_journal_headers h
    JOIN public.acc_journal_lines l ON l.header_id = h.id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    CROSS JOIN LATERAL (
      SELECT CASE
        WHEN regexp_replace(g.gl_number, '[^0-9]', '', 'g') ~ '^(119|129|139|149)' THEN 'accum'
        WHEN regexp_replace(g.gl_number, '[^0-9]', '', 'g') ~ '^(11|12|13|14)'     THEN 'gross'
        WHEN regexp_replace(g.gl_number, '[^0-9]', '', 'g') ~ '^161'                THEN 'cip'
        ELSE NULL
      END AS cls
    ) x
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      AND x.cls IS NOT NULL
  ),
  asset_gl AS (
    SELECT
      gl.fixed_asset_id,
      COALESCE(SUM(gl.signed_amount) FILTER (WHERE gl.cls = 'gross' AND gl.posting_date <= v_date), 0) AS gl_gross,
      COALESCE(SUM(gl.signed_amount) FILTER (WHERE gl.cls = 'accum' AND gl.posting_date <= v_date), 0) AS gl_accum,
      COALESCE(SUM(gl.signed_amount) FILTER (WHERE gl.cls = 'cip'   AND gl.posting_date <= v_date), 0) AS gl_cip,
      COALESCE(SUM(gl.signed_amount) FILTER (WHERE gl.cls = 'gross'), 0) AS gl_gross_all,
      COUNT(*) FILTER (WHERE gl.cls = 'gross') AS gross_line_count,
      MIN(gl.posting_date) FILTER (WHERE gl.cls = 'gross' AND gl.dc_type = 'T') AS first_gross_posting_date
    FROM gl_lines gl
    WHERE gl.fixed_asset_id IS NOT NULL
    GROUP BY gl.fixed_asset_id
  ),
  assets AS (
    SELECT
      fa.id AS asset_id,
      fa.inventory_number,
      fa.name,
      fa.status,
      fa.activation_date,
      fa.disposal_date,
      fa.acquisition_value,
      CASE
        WHEN fa.activation_date IS NOT NULL
         AND fa.activation_date <= v_date
         AND NOT (fa.status <> 'active' AND (fa.disposal_date IS NULL OR fa.disposal_date <= v_date))
        THEN COALESCE(fa.acquisition_value, 0)
        ELSE 0
      END AS expected_gross,
      COALESCE(ag.gl_gross, 0) AS gl_gross,
      COALESCE(ag.gl_accum, 0) AS gl_accum,
      COALESCE(ag.gl_cip, 0)   AS gl_cip,
      COALESCE(ag.gl_gross_all, 0) AS gl_gross_all,
      COALESCE(ag.gross_line_count, 0) AS gross_line_count,
      ag.first_gross_posting_date
    FROM public.fixed_assets fa
    LEFT JOIN asset_gl ag ON ag.fixed_asset_id = fa.id
    WHERE fa.company_id = p_company_id
  ),
  classified AS (
    SELECT
      a.*,
      CASE
        WHEN a.expected_gross > 0 AND a.gl_gross_all = 0 THEN 'unposted'
        WHEN a.gross_line_count > 0
         AND ((a.expected_gross > 0 AND a.gl_gross = 0 AND a.gl_gross_all <> 0)
           OR (a.expected_gross = 0 AND a.gl_gross <> 0
               AND a.activation_date IS NOT NULL AND a.activation_date > v_date))
        THEN 'period_mismatch'
        WHEN abs(a.expected_gross - a.gl_gross) >= 1 THEN 'value_mismatch'
        ELSE 'ok'
      END AS issue
    FROM assets a
  ),
  orphan_lines AS (
    SELECT gl.*
    FROM gl_lines gl
    WHERE gl.fixed_asset_id IS NULL
      AND gl.posting_date <= v_date
  ),
  orphan_totals AS (
    SELECT
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'gross'), 0) AS gross,
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'accum'), 0) AS accum,
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'cip'),   0) AS cip,
      COUNT(*) AS line_count
    FROM orphan_lines
  ),
  orphan_sample AS (
    SELECT COALESCE(jsonb_agg(o.row_json ORDER BY o.posting_date DESC, o.line_id), '[]'::jsonb) AS rows
    FROM (
      SELECT
        ol.posting_date,
        ol.line_id,
        jsonb_build_object(
          'line_id', ol.line_id,
          'header_id', ol.header_id,
          'posting_date', ol.posting_date,
          'document_id', ol.document_id,
          'gl_number', ol.gl_number,
          'cls', ol.cls,
          'dc_type', ol.dc_type,
          'amount', ol.amount,
          'signed_amount', ol.signed_amount,
          'description', ol.description
        ) AS row_json
      FROM orphan_lines ol
      ORDER BY ol.posting_date DESC, ol.line_id
      LIMIT 200
    ) o
  ),
  gl_totals AS (
    SELECT
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'gross' AND posting_date <= v_date), 0) AS gross,
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'accum' AND posting_date <= v_date), 0) AS accum,
      COALESCE(SUM(signed_amount) FILTER (WHERE cls = 'cip'   AND posting_date <= v_date), 0) AS cip
    FROM gl_lines
  ),
  an_totals AS (
    SELECT
      COALESCE(SUM(expected_gross), 0) AS gross,
      COALESCE(SUM(gl_gross), 0)  AS gl_gross_tagged,
      COALESCE(SUM(gl_accum), 0)  AS gl_accum_tagged,
      COALESCE(SUM(gl_cip), 0)    AS gl_cip_tagged,
      COUNT(*)                                            AS assets_total,
      COUNT(*) FILTER (WHERE issue = 'unposted')          AS unposted_count,
      COUNT(*) FILTER (WHERE issue = 'period_mismatch')   AS period_mismatch_count,
      COUNT(*) FILTER (WHERE issue = 'value_mismatch')    AS value_mismatch_count,
      COUNT(*) FILTER (WHERE issue = 'ok')                AS ok_count,
      COALESCE(SUM(expected_gross) FILTER (WHERE issue = 'unposted'), 0)          AS unposted_amount,
      COALESCE(SUM(expected_gross - gl_gross) FILTER (WHERE issue = 'period_mismatch'), 0) AS period_mismatch_amount,
      COALESCE(SUM(expected_gross - gl_gross) FILTER (WHERE issue = 'value_mismatch'), 0)  AS value_mismatch_amount
    FROM classified
  )
  SELECT jsonb_build_object(
    'company_id', p_company_id,
    'as_of', v_date,
    'totals', jsonb_build_object(
      'gross', jsonb_build_object(
        'gl', gl.gross,
        'gl_tagged', an.gl_gross_tagged,
        'gl_untagged', ot.gross,
        'analytic', an.gross,
        'difference', gl.gross - an.gross
      ),
      'accum', jsonb_build_object(
        'gl', gl.accum,
        'gl_tagged', an.gl_accum_tagged,
        'gl_untagged', ot.accum
      ),
      'cip', jsonb_build_object(
        'gl', gl.cip,
        'gl_tagged', an.gl_cip_tagged,
        'gl_untagged', ot.cip
      )
    ),
    'root_causes', jsonb_build_object(
      'unposted_assets', jsonb_build_object('count', an.unposted_count, 'amount', an.unposted_amount),
      'orphan_gl_lines', jsonb_build_object('count', ot.line_count, 'amount', ot.gross),
      'period_mismatches', jsonb_build_object('count', an.period_mismatch_count, 'amount', an.period_mismatch_amount),
      'value_mismatches', jsonb_build_object('count', an.value_mismatch_count, 'amount', an.value_mismatch_amount)
    ),
    'counts', jsonb_build_object(
      'assets_total', an.assets_total,
      'assets_ok', an.ok_count
    ),
    'assets', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'asset_id', c.asset_id,
          'inventory_number', c.inventory_number,
          'name', c.name,
          'status', c.status,
          'activation_date', c.activation_date,
          'disposal_date', c.disposal_date,
          'acquisition_value', c.acquisition_value,
          'expected_gross', c.expected_gross,
          'gl_gross', c.gl_gross,
          'gl_accum', c.gl_accum,
          'gl_cip', c.gl_cip,
          'gross_line_count', c.gross_line_count,
          'first_gross_posting_date', c.first_gross_posting_date,
          'issue', c.issue
        )
        ORDER BY c.inventory_number
      )
      FROM classified c
    ), '[]'::jsonb),
    'orphans', os.rows
  )
  INTO v_result
  FROM gl_totals gl, an_totals an, orphan_totals ot, orphan_sample os;

  RETURN v_result;
END;
$function$;

COMMENT ON FUNCTION public.reconcile_fixed_assets_with_gl(uuid, date) IS
  'TENY M1.2: Főkönyv (1-es számlaosztály) <-> tárgyi eszköz analitika rekonciliáció, root-cause bontással (unposted_assets, orphan_gl_lines, period_mismatches, value_mismatches).';

REVOKE EXECUTE ON FUNCTION public.reconcile_fixed_assets_with_gl(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_fixed_assets_with_gl(uuid, date) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
