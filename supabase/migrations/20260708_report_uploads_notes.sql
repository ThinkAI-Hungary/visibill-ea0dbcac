-- Migration: Add notes and email_sender_domain columns to report_uploads
-- These are needed for the new Mailgun routing path that sends courier reports
-- directly to report_uploads instead of invoice_uploads/transaction_uploads.

-- 1. notes JSONB on report_uploads (processing journey log)
ALTER TABLE public.report_uploads
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT NULL;
COMMENT ON COLUMN public.report_uploads.notes IS
  'Processing log entries tracking the file classification and processing journey';

-- 2. email_sender_domain on report_uploads (for debugging/analytics)
ALTER TABLE public.report_uploads
  ADD COLUMN IF NOT EXISTS email_sender_domain text DEFAULT NULL;
COMMENT ON COLUMN public.report_uploads.email_sender_domain IS
  'Original email sender domain extracted from Mailgun webhook (e.g. gls-hungary.com)';
