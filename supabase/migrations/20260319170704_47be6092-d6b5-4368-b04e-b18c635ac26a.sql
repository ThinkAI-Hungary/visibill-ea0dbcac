
-- Step 1: Backfill salary.transaction_id from transactions.matched_invoice_id (while still text type)
UPDATE public.salary s
SET transaction_id = t.id::text
FROM public.transactions t
WHERE t.matched_invoice_id = s.id
  AND (s.transaction_id IS NULL OR s.transaction_id = '');

-- Step 2: Change salary.transaction_id from text to uuid
ALTER TABLE public.salary 
  ALTER COLUMN transaction_id TYPE uuid USING CASE WHEN transaction_id = '' THEN NULL ELSE transaction_id::uuid END;

-- Step 3: Add FK constraint on salary.transaction_id
ALTER TABLE public.salary
  ADD CONSTRAINT salary_transaction_id_fkey 
  FOREIGN KEY (transaction_id) 
  REFERENCES public.transactions(id) 
  ON DELETE SET NULL;

-- Step 4: Add transaction_id column to invoices table with FK
ALTER TABLE public.invoices
  ADD COLUMN transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

-- Step 5: Backfill invoices.transaction_id from transactions.matched_invoice_id
UPDATE public.invoices i
SET transaction_id = t.id
FROM public.transactions t
WHERE t.matched_invoice_id = i.id
  AND i.transaction_id IS NULL;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_salary_transaction_id ON public.salary(transaction_id);
CREATE INDEX IF NOT EXISTS idx_invoices_transaction_id ON public.invoices(transaction_id);
