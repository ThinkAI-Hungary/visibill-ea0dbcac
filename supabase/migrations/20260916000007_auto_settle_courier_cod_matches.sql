-- Migration: 20260916000007_auto_settle_courier_cod_matches.sql
-- Description: Automatically settle and link NAV invoices and bank transactions when courier_reports achieve a full match (COD payout auto-settle), with retroactive backfill.

-- 1. Expand created_by check constraint on transaction_invoice_matches to allow 'courier_auto'
ALTER TABLE public.transaction_invoice_matches 
DROP CONSTRAINT IF EXISTS transaction_invoice_matches_created_by_check;

ALTER TABLE public.transaction_invoice_matches 
ADD CONSTRAINT transaction_invoice_matches_created_by_check 
CHECK (created_by IN ('manual', 'ai', 'courier_auto'));

-- 2. Create or replace trigger function to auto-settle full courier matches
CREATE OR REPLACE FUNCTION public.auto_settle_courier_report_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act if row has both a matched NAV invoice and a matched transaction and status is full
  IF NEW.match_status = 'full' 
     AND NEW.matched_nav_invoice_id IS NOT NULL 
     AND NEW.matched_transaction_id IS NOT NULL THEN

    -- A) Insert into transaction_invoice_matches (idempotent link)
    INSERT INTO public.transaction_invoice_matches (
      transaction_id,
      invoice_id,
      invoice_source,
      created_by
    )
    VALUES (
      NEW.matched_transaction_id,
      NEW.matched_nav_invoice_id,
      'nav',
      'courier_auto'
    )
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- B) Mark NAV invoice as paid and link to transaction
    UPDATE public.nav_invoices
    SET paid = true,
        transaction_id = NEW.matched_transaction_id
    WHERE id = NEW.matched_nav_invoice_id
      AND (paid IS NOT TRUE OR transaction_id IS NULL);

    -- C) Mark transaction as verified multi-invoice match if not already verified
    UPDATE public.transactions
    SET is_verified = true,
        match_type = 'multi_invoice_number',
        confidence_score = 1.0
    WHERE id = NEW.matched_transaction_id
      AND (is_verified IS NOT TRUE OR match_type IS NULL OR match_type = 'ai_match');

  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger to courier_reports
DROP TRIGGER IF EXISTS trg_auto_settle_courier_report ON public.courier_reports;
CREATE TRIGGER trg_auto_settle_courier_report
AFTER INSERT OR UPDATE OF match_status, matched_nav_invoice_id, matched_transaction_id
ON public.courier_reports
FOR EACH ROW
WHEN (NEW.match_status = 'full' AND NEW.matched_nav_invoice_id IS NOT NULL AND NEW.matched_transaction_id IS NOT NULL)
EXECUTE FUNCTION public.auto_settle_courier_report_match();

-- 4. Retroactive backfill for all existing full courier matches
DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT matched_transaction_id, matched_nav_invoice_id
    FROM public.courier_reports
    WHERE match_status = 'full'
      AND matched_nav_invoice_id IS NOT NULL
      AND matched_transaction_id IS NOT NULL
  LOOP
    -- A) Insert join record
    INSERT INTO public.transaction_invoice_matches (
      transaction_id,
      invoice_id,
      invoice_source,
      created_by
    )
    VALUES (
      r.matched_transaction_id,
      r.matched_nav_invoice_id,
      'nav',
      'courier_auto'
    )
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- B) Update invoice
    UPDATE public.nav_invoices
    SET paid = true,
        transaction_id = r.matched_transaction_id
    WHERE id = r.matched_nav_invoice_id
      AND (paid IS NOT TRUE OR transaction_id IS NULL);

    -- C) Update transaction
    UPDATE public.transactions
    SET is_verified = true,
        match_type = 'multi_invoice_number',
        confidence_score = 1.0
    WHERE id = r.matched_transaction_id
      AND (is_verified IS NOT TRUE OR match_type IS NULL OR match_type = 'ai_match');

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Auto-settled % existing full courier matches', v_count;
END;
$$;
