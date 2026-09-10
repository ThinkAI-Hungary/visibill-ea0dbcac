-- Migration: 20260910213000_realtime_resolve_accounty_missing_items.sql
-- Description:
-- 1. Backfill resolve open/notified accounty_missing_items that already have matching invoices in public.invoices.
-- 2. Resolve known stornoed NAV invoice pairs for VBV Vision Kft.
-- 3. Upgrade mark_nav_invoice_as_submitted() trigger function to auto-resolve matching accounty_missing_items
--    in real time on invoice insert or update.

-- 1. Backfill: Resolve all open/notified accounty_missing_items matching existing invoices
UPDATE public.accounty_missing_items mi
SET status = 'resolved',
    resolved_at = NOW()
FROM public.invoices inv
WHERE inv.company_id = mi.company_id
  AND REPLACE(LOWER(inv.bizonylatsorszam), ' ', '') = REPLACE(LOWER(mi.invoice_number), ' ', '')
  AND mi.status IN ('open', 'notified')
  AND mi.source = 'nav_detektor';

-- 2. Backfill: Resolve stornoed NAV items for VBV Vision Kft.
UPDATE public.accounty_missing_items
SET status = 'resolved',
    resolved_at = NOW()
WHERE company_id = '5364d0be-e92a-4b94-9704-f457cf71f140'
  AND invoice_number IN ('KL01-2026-1', 'KL01-2026-2', 'MR-2026-1', 'MR-2026-2')
  AND status IN ('open', 'notified');

-- 3. Upgrade mark_nav_invoice_as_submitted() function to auto-resolve in real time
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_as_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- 1. Mark target NAV invoice as submitted
  IF NEW.bizonylatsorszam IS NOT NULL THEN
    UPDATE public.nav_invoices
    SET submitted = true
    WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
      AND (
        (company_id = NEW.company_id) 
        OR (company_id IS NULL AND NEW.company_id IS NULL)
      )
      AND (submitted IS NULL OR submitted = false);

    -- 2. Auto-resolve matching accounty_missing_items in real time
    UPDATE public.accounty_missing_items
    SET status = 'resolved',
        resolved_at = NOW()
    WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(NEW.bizonylatsorszam), ' ', '')
      AND (
        (company_id = NEW.company_id) 
        OR (company_id IS NULL AND NEW.company_id IS NULL)
      )
      AND status IN ('open', 'notified');
  END IF;

  -- 3. If bizonylatsorszam changed on UPDATE, reset previous NAV invoice submitted flag if no other invoice uses it
  IF TG_OP = 'UPDATE' AND OLD.bizonylatsorszam IS NOT NULL AND (NEW.bizonylatsorszam IS NULL OR OLD.bizonylatsorszam != NEW.bizonylatsorszam) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.invoices
      WHERE id != NEW.id
        AND company_id = OLD.company_id
        AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
    ) THEN
      UPDATE public.nav_invoices
      SET submitted = false
      WHERE REPLACE(LOWER(invoice_number), ' ', '') = REPLACE(LOWER(OLD.bizonylatsorszam), ' ', '')
        AND (
          (company_id = OLD.company_id)
          OR (company_id IS NULL AND OLD.company_id IS NULL)
        )
        AND submitted = true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;
