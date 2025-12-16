-- Create table for NAV invoice line items
CREATE TABLE public.nav_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nav_invoice_id UUID NOT NULL REFERENCES public.nav_invoices(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  line_description TEXT,
  quantity NUMERIC,
  unit_of_measure TEXT,
  unit_price NUMERIC,
  net_amount NUMERIC,
  vat_rate TEXT,
  vat_amount NUMERIC,
  gross_amount NUMERIC,
  product_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nav_invoice_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy - users can view items for their own invoices
CREATE POLICY "Users can view their own invoice items"
ON public.nav_invoice_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.nav_invoices
    WHERE nav_invoices.id = nav_invoice_items.nav_invoice_id
    AND nav_invoices.user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_nav_invoice_items_nav_invoice_id ON public.nav_invoice_items(nav_invoice_id);

-- Service role needs full access for edge functions
CREATE POLICY "Service role can manage invoice items"
ON public.nav_invoice_items
FOR ALL
USING (true)
WITH CHECK (true);