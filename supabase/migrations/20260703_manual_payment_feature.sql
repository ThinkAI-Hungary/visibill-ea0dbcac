-- ============================================================
-- Manual Payment Feature - Corrected to use Transactions
-- ============================================================

-- 1. Extend invoices table to track manual payment status (keep these for status flags)
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS is_manual_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_payment_date date,
ADD COLUMN IF NOT EXISTS manual_payment_type text, -- 'private_card', 'cash', etc.
ADD COLUMN IF NOT EXISTS manual_payment_note text;

-- 2. Extend nav_invoices table to track manual payment status
ALTER TABLE public.nav_invoices
ADD COLUMN IF NOT EXISTS is_manual_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS manual_payment_date date,
ADD COLUMN IF NOT EXISTS manual_payment_type text,
ADD COLUMN IF NOT EXISTS manual_payment_note text;

-- 3. Create or replace the RPC to record manual payment using transactions
-- This creates two transactions: 
-- one for the owner's loan (income) and one for the invoice payment (expense)
CREATE OR REPLACE FUNCTION public.record_manual_invoice_payment(
  p_invoice_id uuid,
  p_payment_date date,
  p_payment_type text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
  v_amount numeric;
  v_currency text;
  v_invoice_number text;
  v_is_nav boolean := false;
  v_income_id uuid;
  v_expense_id uuid;
BEGIN
  -- 1. Find the invoice (either in 'invoices' or 'nav_invoices')
  SELECT company_id, brutto_vegosszeg, penznem, bizonylatsorszam 
  INTO v_company_id, v_amount, v_currency, v_invoice_number
  FROM public.invoices 
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    SELECT company_id, invoice_gross_amount, currency, invoice_number 
    INTO v_company_id, v_amount, v_currency, v_invoice_number
    FROM public.nav_invoices 
    WHERE id = p_invoice_id;
    
    v_is_nav := true;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  -- 2. Record the Invoice Payment Expense (Kiadás) as a single transaction
  INSERT INTO public.transactions (
    company_id,
    transaction_date,
    description,
    amount,
    currency,
    type,
    matched_invoice_id,
    match_type,
    is_verified
  ) VALUES (
    v_company_id,
    p_payment_date,
    'Kifizetés (' || p_payment_type || '): ' || COALESCE(v_invoice_number, '') || 
    CASE WHEN p_note IS NOT NULL THEN ' - ' || p_note ELSE '' END,
    -v_amount, -- Negative expense
    COALESCE(v_currency, 'HUF'),
    'manual_expense',
    p_invoice_id,
    CASE WHEN v_is_nav THEN 'nav' ELSE 'submitted' END,
    true
  ) RETURNING id INTO v_expense_id;

  -- 3. Create match in transaction_invoice_matches table
  INSERT INTO public.transaction_invoice_matches (
    transaction_id,
    invoice_id,
    invoice_source,
    created_by
  ) VALUES (v_expense_id, p_invoice_id, CASE WHEN v_is_nav THEN 'nav' ELSE 'submitted' END, 'manual');

  -- 5. Mark the invoice as manually paid
  IF v_is_nav THEN
    UPDATE public.nav_invoices 
    SET 
      is_manual_payment = true,
      manual_payment_date = p_payment_date,
      manual_payment_type = p_payment_type,
      manual_payment_note = p_note
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices 
    SET 
      is_manual_payment = true,
      manual_payment_date = p_payment_date,
      manual_payment_type = p_payment_type,
      manual_payment_note = p_note
    WHERE id = p_invoice_id;
  END IF;

END;
$$;

-- 4. Set RLS for the new columns if necessary
GRANT EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) TO authenticated;
