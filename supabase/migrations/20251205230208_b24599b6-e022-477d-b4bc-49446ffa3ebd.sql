-- Create partners table for caching company names by tax number
CREATE TABLE public.partners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  tax_number TEXT NOT NULL,
  name TEXT NOT NULL,
  partner_type TEXT NOT NULL DEFAULT 'both' CHECK (partner_type IN ('customer', 'supplier', 'both')),
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, tax_number)
);

-- Enable Row Level Security
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own partners"
  ON public.partners FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own partners"
  ON public.partners FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own partners"
  ON public.partners FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own partners"
  ON public.partners FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_partners_company_tax ON public.partners(company_id, tax_number);
CREATE INDEX idx_partners_user_id ON public.partners(user_id);