-- Migration: Add notes JSONB, email_sender_domain, and fallback_from_* columns
-- to both invoice_uploads and transaction_uploads tables.
--
-- Purpose:
--   - notes: Processing log entries tracking the full classification + processing journey
--   - email_sender_domain: Original sender domain for analytics/debugging
--   - fallback_from_*: Link to the source record when created via fallback pipeline

-- ── transaction_uploads ──────────────────────────────────────────

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
COMMENT ON COLUMN public.transaction_uploads.notes IS
  'Processing log entries tracking the file classification and processing journey';

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS email_sender_domain text DEFAULT NULL;

ALTER TABLE public.transaction_uploads
  ADD COLUMN IF NOT EXISTS fallback_from_invoice_upload_id uuid DEFAULT NULL;

-- ── invoice_uploads ──────────────────────────────────────────────

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
COMMENT ON COLUMN public.invoice_uploads.notes IS
  'Processing log entries tracking the file classification and processing journey';

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS email_sender_domain text DEFAULT NULL;

ALTER TABLE public.invoice_uploads
  ADD COLUMN IF NOT EXISTS fallback_from_transaction_upload_id uuid DEFAULT NULL;
