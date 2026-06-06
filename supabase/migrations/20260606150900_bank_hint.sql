-- Add bank_hint column to transaction_uploads
-- This allows users to explicitly select which bank format to use for parsing,
-- instead of relying solely on filename-based detection.
-- NULL = auto-detect from filename/content (legacy behavior preserved)
ALTER TABLE public.transaction_uploads 
  ADD COLUMN IF NOT EXISTS bank_hint TEXT DEFAULT NULL;

COMMENT ON COLUMN public.transaction_uploads.bank_hint IS 
  'User-selected bank hint for parser routing. NULL = auto-detect from filename/content. Values: otp, cib, raiffeisen, kh, erste, unicredit, magnet, granit, wise, revolut, etc.';
