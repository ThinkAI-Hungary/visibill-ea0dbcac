-- Create bank_statements table
CREATE TABLE public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  file_type TEXT,
  bank_name TEXT,
  account_number TEXT,
  statement_period_start DATE,
  statement_period_end DATE,
  opening_balance DECIMAL(15,2),
  closing_balance DECIMAL(15,2),
  total_credits DECIMAL(15,2) DEFAULT 0,
  total_debits DECIMAL(15,2) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'HUF',
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'error')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create bank_transactions table for individual transactions
CREATE TABLE public.bank_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  value_date DATE,
  description TEXT NOT NULL,
  reference TEXT,
  amount DECIMAL(15,2) NOT NULL,
  balance DECIMAL(15,2),
  transaction_type TEXT CHECK (transaction_type IN ('credit', 'debit')),
  category TEXT,
  counterparty_name TEXT,
  counterparty_account TEXT,
  currency TEXT DEFAULT 'HUF',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for bank_statements
CREATE POLICY "Users can view their own bank statements" 
ON public.bank_statements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bank statements" 
ON public.bank_statements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank statements" 
ON public.bank_statements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank statements" 
ON public.bank_statements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for bank_transactions
CREATE POLICY "Users can view transactions from their bank statements" 
ON public.bank_transactions 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.bank_statements 
  WHERE bank_statements.id = bank_transactions.bank_statement_id 
  AND bank_statements.user_id = auth.uid()
));

CREATE POLICY "Users can create transactions for their bank statements" 
ON public.bank_transactions 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM public.bank_statements 
  WHERE bank_statements.id = bank_transactions.bank_statement_id 
  AND bank_statements.user_id = auth.uid()
));

CREATE POLICY "Users can update transactions from their bank statements" 
ON public.bank_transactions 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM public.bank_statements 
  WHERE bank_statements.id = bank_transactions.bank_statement_id 
  AND bank_statements.user_id = auth.uid()
));

CREATE POLICY "Users can delete transactions from their bank statements" 
ON public.bank_transactions 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM public.bank_statements 
  WHERE bank_statements.id = bank_transactions.bank_statement_id 
  AND bank_statements.user_id = auth.uid()
));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_bank_statements_updated_at
BEFORE UPDATE ON public.bank_statements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bank_transactions_updated_at
BEFORE UPDATE ON public.bank_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_bank_statements_user_id ON public.bank_statements(user_id);
CREATE INDEX idx_bank_statements_status ON public.bank_statements(status);
CREATE INDEX idx_bank_transactions_statement_id ON public.bank_transactions(bank_statement_id);
CREATE INDEX idx_bank_transactions_date ON public.bank_transactions(transaction_date);

-- Create storage bucket for bank statements
INSERT INTO storage.buckets (id, name, public) 
VALUES ('bank-statements', 'bank-statements', false);