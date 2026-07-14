-- ============================================================================
-- Fix: Prevent race condition in NAV invoice GL classification
-- ============================================================================
-- Problem:
-- When a NAV invoice details are synced, the Edge Function first updates
-- nav_invoices (setting details_fetched = true), and then inserts items into
-- nav_invoice_items in a separate request.
--
-- The previous trigger ran on nav_invoices UPDATE (details_fetched = true),
-- enqueuing the classification job before the items were actually inserted.
-- The worker immediately claimed the job and found 0 items, leaving the
-- subsequently inserted items unclassified.
--
-- Fix:
-- Drop the trigger on nav_invoices and instead run it AFTER INSERT on
-- nav_invoice_items, ensuring items are committed when classification starts.
-- ============================================================================

-- 1. Drop old trigger on nav_invoices
DROP TRIGGER IF EXISTS trg_on_nav_invoice_details_fetched ON public.nav_invoices;
DROP FUNCTION IF EXISTS public.trg_nav_invoice_details_fetched();

-- 2. Create trigger function on nav_invoice_items
CREATE OR REPLACE FUNCTION public.trg_nav_invoice_items_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id
  FROM public.nav_invoices
  WHERE id = NEW.nav_invoice_id;

  IF v_company_id IS NOT NULL THEN
    PERFORM public.enqueue_auto_gl_classification(v_company_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create trigger on nav_invoice_items
DROP TRIGGER IF EXISTS trg_on_nav_invoice_items_inserted ON public.nav_invoice_items;
CREATE TRIGGER trg_on_nav_invoice_items_inserted
AFTER INSERT ON public.nav_invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_nav_invoice_items_inserted();
