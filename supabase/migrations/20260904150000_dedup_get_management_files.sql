-- =============================================================================
-- Migration: Update get_management_files RPC with deduplication
-- Description: Ensures management files view does not display duplicate rows
--              for files that underwent pipeline fallback or multiple retries.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_management_files(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_sort_by text DEFAULT 'created_at',
  p_sort_dir text DEFAULT 'desc',
  p_search text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_file_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
  v_page_size integer;
  v_total_count bigint := 0;
  v_success_count bigint := 0;
  v_error_count bigint := 0;
  v_pending_count bigint := 0;
  v_dismissed_count bigint := 0;
  v_total_rows bigint := 0;
  v_files json;
  v_status_arr text[];
  v_clean_search text;
BEGIN
  v_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 25)));
  v_offset := (GREATEST(1, COALESCE(p_page, 1)) - 1) * v_page_size;
  v_clean_search := NULLIF(TRIM(p_search), '');

  IF p_status IS NOT NULL AND TRIM(p_status) != '' THEN
    v_status_arr := string_to_array(p_status, ',');
  END IF;

  DROP TABLE IF EXISTS temp_filtered_uploads_raw;
  DROP TABLE IF EXISTS temp_filtered_uploads;

  -- Create temporary table to hold raw uploads across all 4 tables
  CREATE TEMP TABLE temp_filtered_uploads_raw ON COMMIT DROP AS
  SELECT 
    iu.id,
    'invoice'::text AS source_table,
    'Számla'::text AS file_type_label,
    iu.company_id,
    c.name AS company_name,
    iu.user_id,
    CASE 
      WHEN (iu.metadata->>'source') = 'email_alias' THEN 'Mailgun'
      WHEN iu.user_id IS NOT NULL THEN COALESCE(p.name, 'Mailgun')
      ELSE 'Mailgun'
    END AS user_name,
    iu.metadata->>'sender' AS user_email,
    iu.file_name,
    iu.file_size,
    iu.file_type,
    iu.file_url,
    iu.upload_status,
    iu.processing_status,
    iu.error_message,
    iu.created_at,
    iu.updated_at,
    CASE
      WHEN iu.processing_status = 'redirected' THEN 'redirected'
      WHEN iu.error_message ILIKE '%már létezik a rendszerben%' THEN 'dismissed'
      WHEN iu.error_message IS NOT NULL AND LOWER(iu.error_message) NOT LIKE '%job completed%' THEN 'error'
      WHEN iu.processing_status IN ('done', 'completed', 'processed', 'webhook_sent', 'cmr_attached') THEN 'success'
      WHEN iu.processing_status IN ('dismissed', 'ignored') THEN 'dismissed'
      WHEN iu.processing_status IN ('error', 'failed', 'webhook_failed') THEN 'error'
      ELSE 'pending'
    END AS status_category
  FROM invoice_uploads iu
  LEFT JOIN companies c ON c.id = iu.company_id
  LEFT JOIN profiles p ON p.user_id = iu.user_id
  WHERE (p_file_type IS NULL OR p_file_type = '' OR p_file_type = 'invoice')
    AND (p_company_id IS NULL OR iu.company_id = p_company_id)
    AND (p_user_id IS NULL OR iu.user_id = p_user_id)
    AND (p_date_from IS NULL OR iu.created_at >= p_date_from)
    AND (p_date_to IS NULL OR iu.created_at <= p_date_to)
    AND (v_clean_search IS NULL OR iu.file_name ILIKE '%' || v_clean_search || '%' OR iu.error_message ILIKE '%' || v_clean_search || '%')

  UNION ALL

  SELECT 
    tu.id,
    'transaction'::text AS source_table,
    'Tranzakció'::text AS file_type_label,
    tu.company_id,
    c.name AS company_name,
    tu.user_id,
    CASE 
      WHEN (tu.metadata->>'source') = 'email_alias' THEN 'Mailgun'
      WHEN tu.user_id IS NOT NULL THEN COALESCE(p.name, 'Mailgun')
      ELSE 'Mailgun'
    END AS user_name,
    tu.metadata->>'sender' AS user_email,
    tu.file_name,
    tu.file_size,
    tu.file_type,
    tu.file_url,
    tu.upload_status,
    tu.processing_status,
    tu.error_message,
    tu.created_at,
    tu.updated_at,
    CASE
      WHEN tu.processing_status = 'redirected' THEN 'redirected'
      WHEN tu.error_message ILIKE '%már létezik a rendszerben%' THEN 'dismissed'
      WHEN tu.error_message IS NOT NULL AND LOWER(tu.error_message) NOT LIKE '%job completed%' THEN 'error'
      WHEN tu.processing_status IN ('done', 'completed', 'processed', 'webhook_sent', 'cmr_attached') THEN 'success'
      WHEN tu.processing_status IN ('dismissed', 'ignored') THEN 'dismissed'
      WHEN tu.processing_status IN ('error', 'failed', 'webhook_failed') THEN 'error'
      ELSE 'pending'
    END AS status_category
  FROM transaction_uploads tu
  LEFT JOIN companies c ON c.id = tu.company_id
  LEFT JOIN profiles p ON p.user_id = tu.user_id
  WHERE (p_file_type IS NULL OR p_file_type = '' OR p_file_type = 'transaction')
    AND (p_company_id IS NULL OR tu.company_id = p_company_id)
    AND (p_user_id IS NULL OR tu.user_id = p_user_id)
    AND (p_date_from IS NULL OR tu.created_at >= p_date_from)
    AND (p_date_to IS NULL OR tu.created_at <= p_date_to)
    AND (v_clean_search IS NULL OR tu.file_name ILIKE '%' || v_clean_search || '%' OR tu.error_message ILIKE '%' || v_clean_search || '%')

  UNION ALL

  SELECT 
    bu.id,
    'bank'::text AS source_table,
    'Bankkivonat'::text AS file_type_label,
    bu.company_id,
    c.name AS company_name,
    bu.user_id,
    CASE 
      WHEN (bu.metadata->>'source') = 'email_alias' THEN 'Mailgun'
      WHEN bu.user_id IS NOT NULL THEN COALESCE(p.name, 'Mailgun')
      ELSE 'Mailgun'
    END AS user_name,
    bu.metadata->>'sender' AS user_email,
    bu.file_name,
    bu.file_size,
    bu.file_type,
    bu.file_url,
    bu.upload_status,
    bu.processing_status,
    bu.error_message,
    bu.created_at,
    bu.updated_at,
    CASE
      WHEN bu.processing_status = 'redirected' THEN 'redirected'
      WHEN bu.error_message ILIKE '%már létezik a rendszerben%' THEN 'dismissed'
      WHEN bu.error_message IS NOT NULL AND LOWER(bu.error_message) NOT LIKE '%job completed%' THEN 'error'
      WHEN bu.processing_status IN ('done', 'completed', 'processed', 'webhook_sent', 'cmr_attached') THEN 'success'
      WHEN bu.processing_status IN ('dismissed', 'ignored') THEN 'dismissed'
      WHEN bu.processing_status IN ('error', 'failed', 'webhook_failed') THEN 'error'
      ELSE 'pending'
    END AS status_category
  FROM bank_statement_uploads bu
  LEFT JOIN companies c ON c.id = bu.company_id
  LEFT JOIN profiles p ON p.user_id = bu.user_id
  WHERE (p_file_type IS NULL OR p_file_type = '' OR p_file_type = 'bank')
    AND (p_company_id IS NULL OR bu.company_id = p_company_id)
    AND (p_user_id IS NULL OR bu.user_id = p_user_id)
    AND (p_date_from IS NULL OR bu.created_at >= p_date_from)
    AND (p_date_to IS NULL OR bu.created_at <= p_date_to)
    AND (v_clean_search IS NULL OR bu.file_name ILIKE '%' || v_clean_search || '%' OR bu.error_message ILIKE '%' || v_clean_search || '%')

  UNION ALL

  SELECT 
    ru.id,
    'report'::text AS source_table,
    'Riport'::text AS file_type_label,
    ru.company_id,
    c.name AS company_name,
    ru.user_id,
    CASE 
      WHEN (ru.metadata->>'source') = 'email_alias' THEN 'Mailgun'
      WHEN ru.user_id IS NOT NULL THEN COALESCE(p.name, 'Mailgun')
      ELSE 'Mailgun'
    END AS user_name,
    ru.metadata->>'sender' AS user_email,
    ru.file_name,
    ru.file_size,
    ru.file_type,
    ru.file_url,
    ru.upload_status,
    ru.processing_status,
    ru.error_message,
    ru.created_at,
    ru.updated_at,
    CASE
      WHEN ru.processing_status = 'redirected' THEN 'redirected'
      WHEN ru.error_message ILIKE '%már létezik a rendszerben%' THEN 'dismissed'
      WHEN ru.error_message IS NOT NULL AND LOWER(ru.error_message) NOT LIKE '%job completed%' THEN 'error'
      WHEN ru.processing_status IN ('done', 'completed', 'processed', 'webhook_sent', 'cmr_attached') THEN 'success'
      WHEN ru.processing_status IN ('dismissed', 'ignored') THEN 'dismissed'
      WHEN ru.processing_status IN ('error', 'failed', 'webhook_failed') THEN 'error'
      ELSE 'pending'
    END AS status_category
  FROM report_uploads ru
  LEFT JOIN companies c ON c.id = ru.company_id
  LEFT JOIN profiles p ON p.user_id = ru.user_id
  WHERE (p_file_type IS NULL OR p_file_type = '' OR p_file_type = 'report')
    AND (p_company_id IS NULL OR ru.company_id = p_company_id)
    AND (p_user_id IS NULL OR ru.user_id = p_user_id)
    AND (p_date_from IS NULL OR ru.created_at >= p_date_from)
    AND (p_date_to IS NULL OR ru.created_at <= p_date_to)
    AND (v_clean_search IS NULL OR ru.file_name ILIKE '%' || v_clean_search || '%' OR ru.error_message ILIKE '%' || v_clean_search || '%');

  -- Deduplicate raw uploads per company and file (favor success over error, then latest created_at)
  CREATE TEMP TABLE temp_filtered_uploads ON COMMIT DROP AS
  SELECT 
    id,
    source_table,
    file_type_label,
    company_id,
    company_name,
    user_id,
    user_name,
    user_email,
    file_name,
    file_size,
    file_type,
    file_url,
    upload_status,
    processing_status,
    error_message,
    created_at,
    updated_at,
    status_category
  FROM (
    SELECT 
      *,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, LOWER(COALESCE(file_name, file_url))
        ORDER BY 
          CASE WHEN status_category = 'success' THEN 1 WHEN status_category = 'error' THEN 2 ELSE 3 END,
          created_at DESC
      ) as rn
    FROM temp_filtered_uploads_raw
  ) ranked
  WHERE ranked.rn = 1;

  -- Calculate Stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status_category = 'success'),
    COUNT(*) FILTER (WHERE status_category = 'error'),
    COUNT(*) FILTER (WHERE status_category = 'pending'),
    COUNT(*) FILTER (WHERE status_category = 'dismissed')
  INTO 
    v_total_count,
    v_success_count,
    v_error_count,
    v_pending_count,
    v_dismissed_count
  FROM temp_filtered_uploads;

  -- Count rows matching the status filter
  SELECT COUNT(*)
  INTO v_total_rows
  FROM temp_filtered_uploads
  WHERE (
    v_status_arr IS NULL 
    OR processing_status = ANY(v_status_arr)
    OR status_category = ANY(v_status_arr)
  );

  -- Fetch the paginated rows
  SELECT COALESCE(json_agg(t), '[]'::json)
  INTO v_files
  FROM (
    SELECT 
      id,
      source_table,
      file_type_label,
      company_id,
      company_name,
      user_id,
      user_name,
      user_email,
      file_name,
      file_size,
      file_type,
      file_url,
      upload_status,
      processing_status,
      error_message,
      created_at,
      updated_at
    FROM temp_filtered_uploads
    WHERE (
      v_status_arr IS NULL 
      OR processing_status = ANY(v_status_arr)
      OR status_category = ANY(v_status_arr)
    )
    ORDER BY
      CASE WHEN p_sort_by = 'file_name' AND LOWER(p_sort_dir) = 'asc' THEN file_name END ASC,
      CASE WHEN p_sort_by = 'file_name' AND LOWER(p_sort_dir) = 'desc' THEN file_name END DESC,
      CASE WHEN p_sort_by = 'file_size' AND LOWER(p_sort_dir) = 'asc' THEN file_size END ASC,
      CASE WHEN p_sort_by = 'file_size' AND LOWER(p_sort_dir) = 'desc' THEN file_size END DESC,
      CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_dir) = 'asc' THEN company_name END ASC,
      CASE WHEN p_sort_by = 'company_name' AND LOWER(p_sort_dir) = 'desc' THEN company_name END DESC,
      CASE WHEN p_sort_by = 'user_name' AND LOWER(p_sort_dir) = 'asc' THEN user_name END ASC,
      CASE WHEN p_sort_by = 'user_name' AND LOWER(p_sort_dir) = 'desc' THEN user_name END DESC,
      CASE WHEN p_sort_by = 'processing_status' AND LOWER(p_sort_dir) = 'asc' THEN processing_status END ASC,
      CASE WHEN p_sort_by = 'processing_status' AND LOWER(p_sort_dir) = 'desc' THEN processing_status END DESC,
      CASE WHEN (p_sort_by IS NULL OR p_sort_by = 'created_at' OR p_sort_by NOT IN ('file_name', 'file_size', 'company_name', 'user_name', 'processing_status')) AND LOWER(p_sort_dir) = 'asc' THEN created_at END ASC,
      CASE WHEN (p_sort_by IS NULL OR p_sort_by = 'created_at' OR p_sort_by NOT IN ('file_name', 'file_size', 'company_name', 'user_name', 'processing_status')) AND (p_sort_dir IS NULL OR LOWER(p_sort_dir) = 'desc') THEN created_at END DESC
    LIMIT v_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'totalRows', v_total_rows,
    'files', v_files,
    'stats', json_build_object(
      'totalCount', v_total_count,
      'successCount', v_success_count,
      'errorCount', v_error_count,
      'pendingCount', v_pending_count,
      'dismissedCount', v_dismissed_count
    )
  );
END;
$$;
