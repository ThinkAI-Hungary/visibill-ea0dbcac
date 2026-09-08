-- Migration: 20260908140000_fix_asset_documents_storage_rls.sql
-- Description: Fix storage.objects RLS policies for asset-documents bucket allowing company-scoped asset document uploads.

DROP POLICY IF EXISTS "Users can upload own asset documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to asset-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own asset documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from asset-documents" ON storage.objects;
DROP POLICY IF EXISTS "asset_documents_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "asset_documents_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "asset_documents_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "asset_documents_delete_policy" ON storage.objects;

CREATE POLICY "asset_documents_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'asset-documents'
);

CREATE POLICY "asset_documents_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'asset-documents'
);

CREATE POLICY "asset_documents_update_policy"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'asset-documents'
)
WITH CHECK (
  bucket_id = 'asset-documents'
);

CREATE POLICY "asset_documents_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'asset-documents'
);
