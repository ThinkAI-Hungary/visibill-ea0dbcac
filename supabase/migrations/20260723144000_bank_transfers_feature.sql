-- Create company_bank_accounts table
CREATE TABLE public.company_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HUF',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payment_transfers table
CREATE TABLE public.payment_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL,
  partner_account TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HUF',
  narrative TEXT,
  invoice_ids UUID[] NOT NULL,
  invoice_sources TEXT[] NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'matched')),
  matched_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;

-- Create policies for company_bank_accounts
CREATE POLICY "Members can view bank accounts" ON public.company_bank_accounts FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = company_bank_accounts.company_id AND company_members.user_id = auth.uid()));

CREATE POLICY "Members can manage bank accounts" ON public.company_bank_accounts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = company_bank_accounts.company_id AND company_members.user_id = auth.uid() AND company_members.role NOT IN ('employee', 'viewer')));

-- Create policies for payment_transfers
CREATE POLICY "Members can view payment transfers" ON public.payment_transfers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = payment_transfers.company_id AND company_members.user_id = auth.uid()));

CREATE POLICY "Members can manage payment transfers" ON public.payment_transfers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.company_members WHERE company_members.company_id = payment_transfers.company_id AND company_members.user_id = auth.uid() AND company_members.role NOT IN ('employee', 'viewer')));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_company_bank_accounts_updated_at
BEFORE UPDATE ON public.company_bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payment_transfers_updated_at
BEFORE UPDATE ON public.payment_transfers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
