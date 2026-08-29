-- Add optional dmp_storage_path column to gl_audit_imports table for Relax DMP ingestion
ALTER TABLE public.gl_audit_imports ADD COLUMN IF NOT EXISTS dmp_storage_path TEXT;
