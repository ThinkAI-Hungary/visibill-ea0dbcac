-- ==============================================================================
-- Migration: 20261007223500_fix_record_manual_invoice_payment_conflict.sql
-- Description: Fix duplicate key violation on transaction_invoice_matches in
--              record_manual_invoice_payment RPC.
-- Problem: The trg_mark_nav_paid_on_match trigger on public.transactions automatically
--          inserts into transaction_invoice_matches when matched_invoice_id is populated.
--          The subsequent explicit INSERT in record_manual_invoice_payment lacked an
--          ON CONFLICT clause, throwing error 23505 and rolling back manual payments.
-- Solution: Add ON CONFLICT (transaction_id, invoice_id) DO UPDATE SET ... clause
--           with safe search_path and proper security privileges.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.record_manual_invoice_payment(
  p_invoice_id uuid,
  p_payment_date date,
  p_payment_type text,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_company_id uuid;
  v_amount numeric;
  v_currency text;
  v_invoice_number text;
  v_is_nav boolean := false;
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
  -- Note: trg_mark_nav_paid_on_match trigger will fire on this insert
  -- and may insert into transaction_invoice_matches.
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

  -- 3. Upsert match in transaction_invoice_matches table
  -- ON CONFLICT ensures idempotency if trg_mark_nav_paid_on_match already inserted it
  INSERT INTO public.transaction_invoice_matches (
    transaction_id,
    invoice_id,
    invoice_source,
    created_by
  ) VALUES (
    v_expense_id,
    p_invoice_id,
    CASE WHEN v_is_nav THEN 'nav' ELSE 'submitted' END,
    'manual'
  )
  ON CONFLICT (transaction_id, invoice_id) DO UPDATE SET
    invoice_source = EXCLUDED.invoice_source,
    created_by = 'manual';

  -- 4. Mark the invoice as manually paid
  IF v_is_nav THEN
    UPDATE public.nav_invoices 
    SET 
      is_manual_payment = true,
      manual_payment_date = p_payment_date,
      manual_payment_type = p_payment_type,
      manual_payment_note = p_note,
      paid = true,
      transaction_id = v_expense_id
    WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices 
    SET 
      is_manual_payment = true,
      manual_payment_date = p_payment_date,
      manual_payment_type = p_payment_type,
      manual_payment_note = p_note,
      fizetve = true,
      transaction_id = v_expense_id
    WHERE id = p_invoice_id;
  END IF;

END;
$function$;

-- Security privileges: prevent anon / public execution, allow authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) IS 
'Records a manual invoice payment by creating an expense transaction, linking it via transaction_invoice_matches (resilient to trigger duplication), and updating invoice payment status.';
