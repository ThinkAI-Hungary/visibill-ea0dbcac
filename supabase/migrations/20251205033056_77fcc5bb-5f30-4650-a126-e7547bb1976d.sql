-- Add company_id column to bank_statement_uploads table
ALTER TABLE public.bank_statement_uploads
ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Create index for better query performance
CREATE INDEX idx_bank_statement_uploads_company_id ON public.bank_statement_uploads(company_id);