-- Migration: 20260904140000_cleanup_duplicate_error_uploads.sql
-- Description: Clean up duplicate error uploads across invoice_uploads, transaction_uploads,
--              and report_uploads, preserving only the newest / final fallback error record per (company_id, file_name).

DO $$
DECLARE
  v_deleted_count integer := 0;
BEGIN
  -- 1. Identify and delete redundant duplicate error rows in invoice_uploads
  WITH global_ranked AS (
    SELECT 
      id,
      'invoice_uploads' AS tbl,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, file_name 
        ORDER BY updated_at DESC, created_at DESC
      ) AS global_rn
    FROM (
      SELECT id, company_id, file_name, created_at, updated_at FROM invoice_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM transaction_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM report_uploads WHERE processing_status = 'error'
    ) sub
  )
  DELETE FROM invoice_uploads
  WHERE id IN (
    SELECT id FROM global_ranked WHERE tbl = 'invoice_uploads' AND global_rn > 1
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % duplicate rows from invoice_uploads', v_deleted_count;

  -- 2. Identify and delete redundant duplicate error rows in transaction_uploads
  WITH global_ranked AS (
    SELECT 
      id,
      'transaction_uploads' AS tbl,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, file_name 
        ORDER BY updated_at DESC, created_at DESC
      ) AS global_rn
    FROM (
      SELECT id, company_id, file_name, created_at, updated_at FROM invoice_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM transaction_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM report_uploads WHERE processing_status = 'error'
    ) sub
  )
  DELETE FROM transaction_uploads
  WHERE id IN (
    SELECT id FROM global_ranked WHERE tbl = 'transaction_uploads' AND global_rn > 1
  );

  -- 3. Identify and delete redundant duplicate error rows in report_uploads
  WITH global_ranked AS (
    SELECT 
      id,
      'report_uploads' AS tbl,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, file_name 
        ORDER BY updated_at DESC, created_at DESC
      ) AS global_rn
    FROM (
      SELECT id, company_id, file_name, created_at, updated_at FROM invoice_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM transaction_uploads WHERE processing_status = 'error'
      UNION ALL
      SELECT id, company_id, file_name, created_at, updated_at FROM report_uploads WHERE processing_status = 'error'
    ) sub
  )
  DELETE FROM report_uploads
  WHERE id IN (
    SELECT id FROM global_ranked WHERE tbl = 'report_uploads' AND global_rn > 1
  );

END $$;
