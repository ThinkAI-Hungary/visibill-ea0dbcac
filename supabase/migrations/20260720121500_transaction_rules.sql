-- Create transaction_rules table
CREATE TABLE public.transaction_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description_pattern TEXT NOT NULL,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('regex', 'contains')),
    amount_min NUMERIC,
    amount_max NUMERIC,
    direction TEXT CHECK (direction IN ('INFLOW', 'OUTFLOW', 'ALL')),
    target_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
    auto_verify BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;

-- Enable SELECT for members of the same company
CREATE POLICY "Enable read access for transaction rules" 
  ON public.transaction_rules 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = transaction_rules.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- Enable INSERT for members of the target company
CREATE POLICY "Enable insert for transaction rules" 
  ON public.transaction_rules 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = transaction_rules.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- Enable UPDATE for members of the same company
CREATE POLICY "Enable update for transaction rules" 
  ON public.transaction_rules 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = transaction_rules.company_id 
      AND cm.user_id = auth.uid()
    )
  );

-- Enable DELETE for members of the same company
CREATE POLICY "Enable delete for transaction rules" 
  ON public.transaction_rules 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm 
      WHERE cm.company_id = transaction_rules.company_id 
      AND cm.user_id = auth.uid()
    )
  );
