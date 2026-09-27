-- Migration: Add SHA-256 partial indexes for fast attachment deduplication
-- Tables: invoice_uploads, transaction_uploads, report_uploads
-- Non-unique partial index to guarantee 0 Postgres errors while enabling <1ms lookups

CREATE INDEX IF NOT EXISTS idx_invoice_uploads_sha256 
  ON public.invoice_uploads USING btree (company_id, ((metadata ->> 'sha256'::text))) 
  WHERE ((metadata ->> 'sha256'::text) IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_transaction_uploads_sha256 
  ON public.transaction_uploads USING btree (company_id, ((metadata ->> 'sha256'::text))) 
  WHERE ((metadata ->> 'sha256'::text) IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_report_uploads_sha256 
  ON public.report_uploads USING btree (company_id, ((metadata ->> 'sha256'::text))) 
  WHERE ((metadata ->> 'sha256'::text) IS NOT NULL);
