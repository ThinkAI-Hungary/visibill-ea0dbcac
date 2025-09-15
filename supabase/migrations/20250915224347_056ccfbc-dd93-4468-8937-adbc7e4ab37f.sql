-- Drop the existing invoices table to recreate it with the new structure
DROP TABLE IF EXISTS public.invoices CASCADE;

-- Create the comprehensive invoices table based on the CSV structure
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id),
  
  -- Invoice identification
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL,
  performance_date DATE,
  
  -- Seller information
  seller_vat_id TEXT,
  seller_name TEXT NOT NULL,
  seller_address TEXT,
  
  -- Buyer information  
  buyer_name TEXT NOT NULL,
  buyer_address TEXT,
  buyer_vat_id TEXT,
  
  -- Financial details
  tax_base_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  vat_rate_breakdown TEXT, -- JSON or text field for VAT breakdown
  vat_amount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  gross_total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'HUF',
  
  -- Tax and regulatory information
  reverse_charge BOOLEAN DEFAULT false,
  tax_exemption_reference TEXT,
  self_billing BOOLEAN DEFAULT false,
  cash_accounting BOOLEAN DEFAULT false,
  
  -- Processing metadata
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'paid', 'overdue', 'cancelled')),
  attachment_url TEXT,
  email_message_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, invoice_number)
);

-- Enable Row Level Security
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own invoices" 
ON public.invoices 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoices" 
ON public.invoices 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoices" 
ON public.invoices 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoices" 
ON public.invoices 
FOR DELETE 
USING (auth.uid() = user_id);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX idx_invoices_issue_date ON public.invoices(issue_date);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_invoice_number ON public.invoices(invoice_number);

-- Insert sample data based on the CSV for testing
INSERT INTO public.invoices (
  user_id,
  invoice_number,
  issue_date,
  seller_vat_id,
  seller_name,
  seller_address,
  buyer_name,
  buyer_address,
  buyer_vat_id,
  performance_date,
  tax_base_total,
  vat_rate_breakdown,
  vat_amount_total,
  gross_total_amount,
  reverse_charge,
  tax_exemption_reference,
  self_billing,
  cash_accounting
) VALUES 
-- Note: These will need actual user_ids, using a placeholder for now
-- Users will need to replace with their actual user ID
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89', -- Replace with actual user ID
  'AAA-2025-15',
  '2025-08-05',
  'HU73185581',
  'KOÓS ZSUZSANNA',
  'Magyarország 1082 BUDAPEST, FUTÓ utca 16. FSZ. em. 1.',
  'BUSINESS CLASS EDUCATION CENTRE SZOLGÁLTATÓ KORLÁTOLT FELELŐSSÉGŰ TÁRSASÁG',
  'Magyarország 3532 MISKOLC, GYÓRI KAPU 69. 1. em. 2.',
  'HU13996828',
  '2025-08-20',
  136800,
  '0',
  0,
  136800,
  false,
  'Alanyi adómentes, SZJ: 8559, Adómentesség leírása: Alanyi adómentes',
  false,
  false
),
(
  'e5b822ee-4240-4350-9ebe-a14357d5bd89', -- Replace with actual user ID
  'BOSZE-2025-39',
  '2025-08-04',
  'HU60258900',
  'Bősze Márta Zlta',
  '1039 Budapest, Sarkadi Imre utca 2.',
  'Business Class EC Kft.',
  '1082 Budapest, Futó utca 16. FSZ. 1. üzlet',
  'HU13996828',
  '2025-08-18',
  300325,
  '0',
  0,
  300325,
  false,
  'AAM',
  false,
  false
);