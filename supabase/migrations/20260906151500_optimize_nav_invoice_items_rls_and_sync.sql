-- Migration: Optimize nav_invoice_items RLS policy and add company_id cascade triggers
-- Description: Eliminates cross-table join in RLS check, enforces BEFORE INSERT OR UPDATE consistency, and cascades parent company_id updates.

-- 1. Cascade parent nav_invoices company_id updates to items
CREATE OR REPLACE FUNCTION public.sync_nav_invoice_items_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    UPDATE public.nav_invoice_items
    SET company_id = NEW.company_id
    WHERE nav_invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_sync_nav_invoice_items_company_id ON public.nav_invoices;
CREATE TRIGGER trg_sync_nav_invoice_items_company_id
  AFTER UPDATE OF company_id ON public.nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_nav_invoice_items_company_id();

-- 2. Ensure BEFORE INSERT OR UPDATE on nav_invoice_items keeps company_id synced
CREATE OR REPLACE FUNCTION public.set_nav_invoice_items_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.company_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.nav_invoice_id IS DISTINCT FROM OLD.nav_invoice_id)) 
     AND NEW.nav_invoice_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id 
    FROM public.nav_invoices 
    WHERE id = NEW.nav_invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_set_nav_invoice_items_company_id ON public.nav_invoice_items;
CREATE TRIGGER trg_set_nav_invoice_items_company_id
  BEFORE INSERT OR UPDATE OF nav_invoice_id, company_id ON public.nav_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_nav_invoice_items_company_id();

-- 3. Optimize RLS policy: Direct company_members check using (SELECT auth.uid()) (ADR A-016 & Supabase Best Practices)
DROP POLICY IF EXISTS "Members can manage nav invoice items" ON public.nav_invoice_items;
CREATE POLICY "Members can manage nav invoice items" ON public.nav_invoice_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = nav_invoice_items.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = nav_invoice_items.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

COMMENT ON POLICY "Members can manage nav invoice items" ON public.nav_invoice_items IS 'Direct company_id index lookup without cross-table join, cached auth.uid() subquery';
