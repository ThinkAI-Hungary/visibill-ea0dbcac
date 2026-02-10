
-- Drop existing RLS policies on transactions table
DROP POLICY IF EXISTS "Users can view their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view transactions via upload" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert transactions via upload" ON public.transactions;
DROP POLICY IF EXISTS "Users can update transactions via upload" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete transactions via upload" ON public.transactions;

-- Create company-based RLS policies for transactions
-- Users can SELECT transactions belonging to companies they own
CREATE POLICY "Company members can view transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = transactions.company_id
    AND companies.owner_id = auth.uid()
  )
);

-- Users can INSERT transactions for companies they own
CREATE POLICY "Company members can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = transactions.company_id
    AND companies.owner_id = auth.uid()
  )
);

-- Users can UPDATE transactions for companies they own
CREATE POLICY "Company members can update transactions"
ON public.transactions
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = transactions.company_id
    AND companies.owner_id = auth.uid()
  )
);

-- Users can DELETE transactions for companies they own
CREATE POLICY "Company members can delete transactions"
ON public.transactions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.companies
    WHERE companies.id = transactions.company_id
    AND companies.owner_id = auth.uid()
  )
);
