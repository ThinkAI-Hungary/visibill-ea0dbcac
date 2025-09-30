-- Create table for storing NAV outbound invoice data
CREATE TABLE public.nav_outbound_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  supplier_tax_number TEXT,
  customer_tax_number TEXT,
  invoice_operation TEXT, -- CREATE, MODIFY, STORNO
  ins_date TIMESTAMP WITH TIME ZONE,
  invoice_amount NUMERIC,
  currency TEXT DEFAULT 'HUF',
  invoice_xml TEXT,
  raw_nav_response JSONB,
  nav_environment TEXT NOT NULL DEFAULT 'test', -- 'test' or 'production'
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, invoice_number, nav_environment)
);

-- Enable Row Level Security
ALTER TABLE public.nav_outbound_invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own NAV invoices" 
ON public.nav_outbound_invoices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own NAV invoices" 
ON public.nav_outbound_invoices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NAV invoices" 
ON public.nav_outbound_invoices 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own NAV invoices" 
ON public.nav_outbound_invoices 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX idx_nav_outbound_invoices_user_id ON public.nav_outbound_invoices(user_id);
CREATE INDEX idx_nav_outbound_invoices_ins_date ON public.nav_outbound_invoices(ins_date);
CREATE INDEX idx_nav_outbound_invoices_invoice_number ON public.nav_outbound_invoices(invoice_number);
CREATE INDEX idx_nav_outbound_invoices_environment ON public.nav_outbound_invoices(nav_environment);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_nav_outbound_invoices_updated_at
BEFORE UPDATE ON public.nav_outbound_invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();