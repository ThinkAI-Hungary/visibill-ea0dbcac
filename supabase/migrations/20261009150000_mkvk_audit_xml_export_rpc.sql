-- Migration: 20261009150000_mkvk_audit_xml_export_rpc.sql
-- Description: MKVK AuditXML v1.0.23.0 data aggregation RPC for statutory auditor general ledger export.

CREATE OR REPLACE FUNCTION public.get_mkvk_audit_xml_data(
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
  -- 1. Security check
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

  -- 2. Fetch company master data
  SELECT id, name, tax_number, address, representative_name, phone, country_code
  INTO v_company
  FROM companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Construct aggregated dataset
  WITH
  -- Journals in company
  raw_journals AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY j.code) AS journal_code_num,
      j.id AS journal_uuid,
      j.code AS journal_code,
      j.name AS journal_name,
      j.type AS journal_type
    FROM acc_journals j
    WHERE j.company_id = p_company_id
  ),
  
  -- Filtered headers
  active_headers AS (
    SELECT 
      h.id AS header_uuid,
      ROW_NUMBER() OVER (ORDER BY h.posting_date, h.document_date, h.journal_number, h.id) AS biz_id,
      h.journal_id,
      rj.journal_code_num,
      rj.journal_code,
      COALESCE(NULLIF(TRIM(h.document_id), ''), 'BIZ-' || h.journal_number::text, h.id::text) AS biz_szam,
      COALESCE(h.document_date, h.posting_date) AS biz_datum,
      EXTRACT(MONTH FROM h.posting_date)::int AS biz_idoszak,
      h.posting_date,
      h.partner_id,
      h.currency,
      h.exchange_rate,
      h.status,
      h.entry_type,
      h.created_by,
      h.posted_by,
      h.created_at,
      h.original_entry_id,
      h.stornoed_entry_id
    FROM acc_journal_headers h
    JOIN raw_journals rj ON h.journal_id = rj.journal_uuid
    WHERE h.company_id = p_company_id
      AND h.posting_date BETWEEN p_date_from AND p_date_to
      AND h.status IN ('KONYVELT', 'KEZI_PISZKOZAT')
      AND (p_include_opening OR rj.journal_type <> 'OPENING')
      AND (p_include_closing OR rj.journal_type <> 'CLOSING')
  ),

  -- Lines of the active headers
  raw_lines AS (
    SELECT 
      l.id,
      l.id AS line_uuid,
      l.header_id,
      ah.biz_id,
      l.sequence_number,
      l.dc_type,
      l.gl_account_id,
      l.amount,
      l.foreign_amount,
      l.vat_code,
      l.vat_role,
      l.parent_line_id,
      l.description,
      l.project_id,
      l.cost_center_id,
      ga.gl_number,
      ga.short_name AS gl_name
    FROM acc_journal_lines l
    JOIN active_headers ah ON l.header_id = ah.header_uuid
    LEFT JOIN gl_accounts ga ON l.gl_account_id = ga.id
  ),

  -- Distinct Chart of Accounts used in lines or preset
  accounts_catalog AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY gl_number) AS account_code_num,
      gl_number,
      COALESCE(NULLIF(TRIM(gl_name), ''), 'Főkönyvi számla ' || gl_number) AS account_name
    FROM (
      SELECT DISTINCT 
        COALESCE(NULLIF(TRIM(gl_number), ''), '499') AS gl_number,
        gl_name
      FROM raw_lines
      UNION
      SELECT DISTINCT
        COALESCE(NULLIF(TRIM(gl_number), ''), '499') AS gl_number,
        short_name AS gl_name
      FROM gl_accounts
      WHERE company_id = p_company_id OR preset_id = (SELECT preset_id FROM gl_accounts WHERE company_id = p_company_id LIMIT 1)
    ) acc_distinct
    WHERE gl_number IS NOT NULL
  ),

  -- Distinct Partners used in active vouchers
  partners_catalog AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY p_name) AS partner_code_num,
      partner_uuid,
      p_name,
      p_tax_number,
      p_eu_tax_number,
      p_is_related,
      p_email
    FROM (
      SELECT DISTINCT 
        p.id AS partner_uuid,
        COALESCE(NULLIF(TRIM(p.name), ''), 'Ismeretlen Partner') AS p_name,
        p.tax_number AS p_tax_number,
        p.eu_tax_number AS p_eu_tax_number,
        CASE WHEN COALESCE(p.related_party, false) THEN 'I' ELSE 'N' END AS p_is_related,
        p.email AS p_email
      FROM active_headers ah
      JOIN partners p ON ah.partner_id = p.id
    ) p_distinct
  ),

  -- Distinct Recorders (Users)
  recorders_catalog AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY user_email) AS recorder_code_num,
      user_uuid,
      COALESCE(NULLIF(TRIM(user_name), ''), user_email, 'Rendszeradminisztrátor') AS recorder_name
    FROM (
      SELECT DISTINCT 
        u.id AS user_uuid,
        COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, 'Rendszeradminisztrátor') AS user_name,
        COALESCE(u.email, 'admin@visibill.hu') AS user_email
      FROM active_headers ah
      LEFT JOIN auth.users u ON COALESCE(ah.posted_by, ah.created_by) = u.id
    ) u_distinct
  ),

  -- Header summary stats for pairing
  header_balance_stats AS (
    SELECT 
      header_id,
      COUNT(*) FILTER (WHERE dc_type = 'T') AS t_cnt,
      COUNT(*) FILTER (WHERE dc_type = 'K') AS k_cnt
    FROM raw_lines
    GROUP BY header_id
  ),

  -- PAIRING ALGORITHM: Generate T-K pairs
  -- Case 1: Simple 1 T and 1 K
  paired_1_to_1 AS (
    SELECT 
      t.header_id,
      t.biz_id,
      1 AS sub_seq,
      t.line_uuid AS orig_line_uuid,
      COALESCE(NULLIF(TRIM(t.description), ''), 'Könyvelési tétel') AS t_szoveg,
      COALESCE(t.gl_number, '499') AS t_gl,
      COALESCE(k.gl_number, '499') AS k_gl,
      t.amount AS t_osszeg,
      t.foreign_amount,
      t.vat_code,
      NULL::numeric AS afa_alap,
      t.project_id,
      t.cost_center_id
    FROM raw_lines t
    JOIN raw_lines k ON t.header_id = k.header_id AND k.dc_type = 'K'
    JOIN header_balance_stats s ON t.header_id = s.header_id
    WHERE t.dc_type = 'T' AND s.t_cnt = 1 AND s.k_cnt = 1
  ),

  -- Case 2: 1 T and N K (e.g. Outbound invoice: 1 Debit line, multiple Credit lines)
  paired_1_to_n AS (
    SELECT 
      k.header_id,
      k.biz_id,
      k.sequence_number AS sub_seq,
      k.line_uuid AS orig_line_uuid,
      COALESCE(NULLIF(TRIM(k.description), ''), NULLIF(TRIM(t.description), ''), 'Könyvelési tétel') AS t_szoveg,
      COALESCE(t.gl_number, '499') AS t_gl,
      COALESCE(k.gl_number, '499') AS k_gl,
      k.amount AS t_osszeg,
      k.foreign_amount,
      k.vat_code,
      CASE WHEN k.vat_role = 'AFA' THEN (
        SELECT amount FROM raw_lines p WHERE p.id = k.parent_line_id LIMIT 1
      ) ELSE NULL END AS afa_alap,
      k.project_id,
      k.cost_center_id
    FROM raw_lines k
    JOIN raw_lines t ON k.header_id = t.header_id AND t.dc_type = 'T'
    JOIN header_balance_stats s ON k.header_id = s.header_id
    WHERE k.dc_type = 'K' AND s.t_cnt = 1 AND s.k_cnt > 1
  ),

  -- Case 3: N T and 1 K (e.g. Inbound invoice: multiple Debit lines, 1 Credit line)
  paired_n_to_1 AS (
    SELECT 
      t.header_id,
      t.biz_id,
      t.sequence_number AS sub_seq,
      t.line_uuid AS orig_line_uuid,
      COALESCE(NULLIF(TRIM(t.description), ''), NULLIF(TRIM(k.description), ''), 'Könyvelési tétel') AS t_szoveg,
      COALESCE(t.gl_number, '499') AS t_gl,
      COALESCE(k.gl_number, '499') AS k_gl,
      t.amount AS t_osszeg,
      t.foreign_amount,
      t.vat_code,
      CASE WHEN t.vat_role = 'AFA' THEN (
        SELECT amount FROM raw_lines p WHERE p.id = t.parent_line_id LIMIT 1
      ) ELSE NULL END AS afa_alap,
      t.project_id,
      t.cost_center_id
    FROM raw_lines t
    JOIN raw_lines k ON t.header_id = k.header_id AND k.dc_type = 'K'
    JOIN header_balance_stats s ON t.header_id = s.header_id
    WHERE t.dc_type = 'T' AND s.t_cnt > 1 AND s.k_cnt = 1
  ),

  -- Case 4: Complex multi-T and multi-K vouchers (Pair through 499 clearing or sequential mapping)
  paired_n_to_m AS (
    SELECT 
      t.header_id,
      t.biz_id,
      t.sequence_number AS sub_seq,
      t.line_uuid AS orig_line_uuid,
      COALESCE(NULLIF(TRIM(t.description), ''), 'Vegyes könyvelési tétel') AS t_szoveg,
      COALESCE(t.gl_number, '499') AS t_gl,
      '499' AS k_gl,
      t.amount AS t_osszeg,
      t.foreign_amount,
      t.vat_code,
      NULL::numeric AS afa_alap,
      t.project_id,
      t.cost_center_id
    FROM raw_lines t
    JOIN header_balance_stats s ON t.header_id = s.header_id
    WHERE t.dc_type = 'T' AND s.t_cnt > 1 AND s.k_cnt > 1
    UNION ALL
    SELECT 
      k.header_id,
      k.biz_id,
      k.sequence_number + 1000 AS sub_seq,
      k.line_uuid AS orig_line_uuid,
      COALESCE(NULLIF(TRIM(k.description), ''), 'Vegyes könyvelési tétel') AS t_szoveg,
      '499' AS t_gl,
      COALESCE(k.gl_number, '499') AS k_gl,
      k.amount AS t_osszeg,
      k.foreign_amount,
      k.vat_code,
      NULL::numeric AS afa_alap,
      k.project_id,
      k.cost_center_id
    FROM raw_lines k
    JOIN header_balance_stats s ON k.header_id = s.header_id
    WHERE k.dc_type = 'K' AND s.t_cnt > 1 AND s.k_cnt > 1
  ),

  -- Unified list of paired items
  all_paired_items AS (
    SELECT * FROM paired_1_to_1
    UNION ALL
    SELECT * FROM paired_1_to_n
    UNION ALL
    SELECT * FROM paired_n_to_1
    UNION ALL
    SELECT * FROM paired_n_to_m
  ),

  -- Final formatted items with sequentially generated TetID
  final_items AS (
    SELECT 
      ROW_NUMBER() OVER (ORDER BY p.biz_id, p.sub_seq, p.orig_line_uuid) AS tet_id,
      p.biz_id,
      p.orig_line_uuid::text AS orig_azon,
      SUBSTRING(p.t_szoveg FROM 1 FOR 50) AS szoveg,
      COALESCE(ac_t.account_code_num, 1) AS tartozik_kod,
      COALESCE(ac_k.account_code_num, 1) AS kovetel_kod,
      p.t_osszeg AS osszeg,
      p.foreign_amount AS dev_osszeg,
      CASE WHEN ah.currency <> 'HUF' THEN ah.currency ELSE NULL END AS dev_nem,
      CASE WHEN ah.currency <> 'HUF' THEN ah.exchange_rate ELSE NULL END AS dev_arfolyam,
      p.afa_alap,
      SUBSTRING(p.vat_code FROM 1 FOR 10) AS afa_kulcs,
      TO_CHAR(ah.posting_date, 'YYYY-MM-DD') AS szt_datum,
      pc.partner_code_num AS partner_kod,
      SUBSTRING(ah.biz_szam FROM 1 FOR 50) AS pu_azo,
      TO_CHAR(ah.biz_datum, 'YYYY-MM-DD') AS telj_datum,
      CASE WHEN ah.status = 'SZTORNOZOTT' OR ah.entry_type = 'SZTORNO' THEN 'I' ELSE NULL END AS szt,
      NULL::bigint AS szt_tet_id,
      COALESCE(rc.recorder_code_num, 1) AS rogzito_kod,
      TO_CHAR(COALESCE(ah.created_at, NOW()), 'YYYY-MM-DD HH24:MI:SS') AS rogzitve,
      EXTRACT(YEAR FROM ah.posting_date)::int AS afa_ev,
      EXTRACT(MONTH FROM ah.posting_date)::int AS afa_honap,
      (SELECT SUBSTRING(name FROM 1 FOR 100) FROM projects WHERE id = p.project_id) AS egyeb1
    FROM all_paired_items p
    JOIN active_headers ah ON p.header_id = ah.header_uuid
    LEFT JOIN accounts_catalog ac_t ON p.t_gl = ac_t.gl_number
    LEFT JOIN accounts_catalog ac_k ON p.k_gl = ac_k.gl_number
    LEFT JOIN partners_catalog pc ON ah.partner_id = pc.partner_uuid
    LEFT JOIN recorders_catalog rc ON COALESCE(ah.posted_by, ah.created_by) = rc.user_uuid
    WHERE p.t_osszeg > 0
  )

  -- 4. Aggregate everything into a JSONB document
  SELECT jsonb_build_object(
    'cegadatok', jsonb_build_object(
      'nev', v_company.name,
      'adoszam', v_company.tax_number,
      'kezdo_datum', TO_CHAR(p_date_from, 'YYYY-MM-DD'),
      'vegso_datum', TO_CHAR(p_date_to, 'YYYY-MM-DD'),
      'penznem', 'HUF',
      'penz_egyseg', 'MNB alapegység',
      'cim_nyers', v_company.address,
      'orszag', COALESCE(v_company.country_code, 'HU'),
      'kapcsolat_tarto', COALESCE(v_company.representative_name, 'n.a.'),
      'telefonszam', COALESCE(v_company.phone, 'n.a.')
    ),
    'naplok', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kod', journal_code_num,
        'nev', SUBSTRING(journal_name FROM 1 FOR 20),
        'kod_str', journal_code
      ) ORDER BY journal_code_num), '[]'::jsonb)
      FROM raw_journals
    ),
    'idoszakok', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kod', m,
        'nev', TO_CHAR(p_date_from, 'YYYY') || '/' || LPAD(m::text, 2, '0')
      ) ORDER BY m), '[]'::jsonb)
      FROM generate_series(1, 12) m
    ),
    'szamlaszamok', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kod', account_code_num,
        'tkod', gl_number,
        'nev', SUBSTRING(account_name FROM 1 FOR 100),
        'itkod', '',
        'inev', ''
      ) ORDER BY account_code_num), '[]'::jsonb)
      FROM accounts_catalog
    ),
    'partnerek', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kod', partner_code_num,
        'tkod', partner_code_num::text,
        'nev', SUBSTRING(p_name FROM 1 FOR 255),
        'adoszam', p_tax_number,
        'eu_adoszam', p_eu_tax_number,
        'kapcsolt_partner', p_is_related,
        'kapcs_tart_email', p_email
      ) ORDER BY partner_code_num), '[]'::jsonb)
      FROM partners_catalog
    ),
    'rogzitok', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'kod', recorder_code_num,
        'tkod', recorder_code_num::text,
        'nev', SUBSTRING(recorder_name FROM 1 FOR 50)
      ) ORDER BY recorder_code_num), '[]'::jsonb)
      FROM recorders_catalog
    ),
    'bizonylatok', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'biz_id', biz_id,
        'naplo', journal_code_num,
        'biz_szam', SUBSTRING(biz_szam FROM 1 FOR 50),
        'datum', TO_CHAR(biz_datum, 'YYYY-MM-DD'),
        'idoszak', biz_idoszak,
        'megr_szam', ''
      ) ORDER BY biz_id), '[]'::jsonb)
      FROM active_headers
    ),
    'tetelek', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'biz_id', biz_id,
        'tet_id', tet_id,
        'orig_azon', orig_azon,
        'szoveg', szoveg,
        'tartozik', tartozik_kod,
        'kovetel', kovetel_kod,
        'osszeg', osszeg,
        'dev_osszeg', dev_osszeg,
        'dev_nem', dev_nem,
        'dev_arfolyam', dev_arfolyam,
        'afa_alap', afa_alap,
        'afa_kulcs', afa_kulcs,
        'szt_datum', szt_datum,
        'partner', partner_kod,
        'pu_azo', pu_azo,
        'telj_datum', telj_datum,
        'szt', szt,
        'szt_tet_id', szt_tet_id,
        'rogzito', rogzito_kod,
        'rogzitve', rogzitve,
        'afa_ev', afa_ev,
        'afa_honap', afa_honap,
        'egyeb1', egyeb1
      ) ORDER BY tet_id), '[]'::jsonb)
      FROM final_items
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Explicit permissions
REVOKE EXECUTE ON FUNCTION public.get_mkvk_audit_xml_data(uuid, date, date, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_mkvk_audit_xml_data(uuid, date, date, boolean, boolean) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_mkvk_audit_xml_data IS 'MKVK AuditXML v1.0.23.0 statutory auditor general ledger export data generator.';
