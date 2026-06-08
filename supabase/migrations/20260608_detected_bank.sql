-- Add detected_bank column to transaction_uploads
-- Stores the actually detected/resolved bank type after processing.
-- If user provided bank_hint → worker copies it here.
-- If no hint → worker auto-detects from filename/content.
-- NULL = unknown/undetected.

ALTER TABLE public.transaction_uploads 
  ADD COLUMN IF NOT EXISTS detected_bank TEXT DEFAULT NULL;

COMMENT ON COLUMN public.transaction_uploads.detected_bank IS 
  'Resolved bank type after processing. Set by worker from bank_hint or auto-detection. Values: otp, cib, raiffeisen, kh, erste, unicredit, magnet, granit, wise, revolut, etc.';

-- Index for efficient grouping by bank on the frontend
CREATE INDEX IF NOT EXISTS idx_transaction_uploads_detected_bank 
  ON public.transaction_uploads(company_id, detected_bank) 
  WHERE detected_bank IS NOT NULL;
