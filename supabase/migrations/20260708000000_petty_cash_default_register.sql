-- ==================================================
-- MERGED FROM: 20260708_petty_cash_default_register.sql
-- ==================================================
-- ============================================================
-- Auto-create default Central Cash Register for new companies
-- ============================================================

CREATE OR REPLACE FUNCTION public.on_company_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- 1. Create company membership for the owner
  INSERT INTO public.company_members (user_id, company_id)
  VALUES (NEW.owner_id, NEW.id)
  ON CONFLICT (user_id, company_id) DO NOTHING;
  
  -- 2. Create default Central Petty Cash Register
  INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
  VALUES (NEW.id, 'Központi pénztár', true, '{HUF}', NEW.owner_id)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Backfill existing companies that do not have a default register yet
INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
SELECT c.id, 'Központi pénztár', true, '{HUF}', c.owner_id
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.petty_cash_registers r WHERE r.company_id = c.id AND r.is_default = true
)
ON CONFLICT DO NOTHING;


-- ==================================================
-- MERGED FROM: 20260708_report_uploads_notes.sql
-- ==================================================
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
