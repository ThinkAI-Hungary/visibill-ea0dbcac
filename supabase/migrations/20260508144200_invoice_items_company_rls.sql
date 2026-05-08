-- Drop old policies
DROP POLICY IF EXISTS "Users can view their own invoice items" ON public.nav_invoice_items;
DROP POLICY IF EXISTS "Service role can manage invoice items" ON public.nav_invoice_items;
DROP POLICY IF EXISTS "Members can manage nav invoice items" ON public.nav_invoice_items;

DROP POLICY IF EXISTS "Users can view their own invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Service role can manage invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Members can manage invoice items" ON public.invoice_items;

-- Recreate policies for nav_invoice_items
CREATE POLICY "Members can manage nav invoice items" ON public.nav_invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.nav_invoices ni
    JOIN public.company_members cm ON cm.company_id = ni.company_id
    WHERE ni.id = nav_invoice_items.nav_invoice_id
    AND cm.user_id = auth.uid()
  ));

-- Recreate policies for invoice_items
CREATE POLICY "Members can manage invoice items" ON public.invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.company_members cm ON cm.company_id = i.company_id
    WHERE i.id = invoice_items.invoice_id
    AND cm.user_id = auth.uid()
  ));
