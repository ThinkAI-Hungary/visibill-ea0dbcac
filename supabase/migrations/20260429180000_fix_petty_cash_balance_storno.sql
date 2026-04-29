-- Fix get_petty_cash_balance to handle storno (negative) invoices correctly
CREATE OR REPLACE FUNCTION public.get_petty_cash_balance(p_company_id uuid)
RETURNS TABLE(balance numeric, has_settings boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_balance numeric;
  v_start_date date;
  v_withdrawals numeric;
  v_cash_deposits numeric;
  v_cash_sales numeric;
  v_cash_expenses numeric;
  v_nav_cash_expenses numeric;
BEGIN
  -- Get settings
  SELECT hp.opening_balance, hp.start_date
  INTO v_opening_balance, v_start_date
  FROM hp_settings hp
  WHERE hp.company_id = p_company_id;

  IF NOT FOUND OR v_start_date IS NULL THEN
    RETURN QUERY SELECT 0::numeric, false;
    RETURN;
  END IF;

  v_opening_balance := COALESCE(v_opening_balance, 0);

  -- Withdrawals (ATM/counter cash withdrawals)
  -- Uses ABS because bank transactions might be negative but are an addition to petty cash
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_withdrawals
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('atm készpénzfelvét', 'pénztári kp felvét')
    AND t.transaction_date >= v_start_date;

  -- Cash deposits
  -- Uses ABS because bank transactions might be positive but are a deduction from petty cash
  SELECT COALESCE(SUM(ABS(t.amount)), 0) INTO v_cash_deposits
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('pénztári kp befizetés', 'kp befizetés atm-en keresztül')
    AND t.transaction_date >= v_start_date;

  -- Cash sales (outbound NAV invoices paid in cash)
  -- Removed ABS to handle storno invoices correctly (negative amount should decrease petty cash)
  SELECT COALESCE(SUM(ni.invoice_gross_amount), 0) INTO v_cash_sales
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'OUTBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND ni.invoice_issue_date >= v_start_date;

  -- Cash expenses (submitted invoices paid in cash, excluding linked/reference invoices)
  -- Removed ABS to handle storno invoices correctly (negative amount should decrease the expense sum, thus adding back to petty cash)
  SELECT COALESCE(SUM(i.brutto_vegosszeg), 0) INTO v_cash_expenses
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.fizetesi_mod ILIKE '%készpénz%'
    AND i.reference_number IS NULL
    AND i.kibocsatas_datuma >= v_start_date;

  -- NAV cash expenses (inbound), excluding duplicates already in invoices table
  -- Removed ABS to handle storno invoices correctly
  SELECT COALESCE(SUM(ni.invoice_gross_amount), 0) INTO v_nav_cash_expenses
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND ni.invoice_issue_date >= v_start_date
    AND NOT EXISTS (
      SELECT 1 FROM invoices i2
      WHERE i2.company_id = p_company_id
        AND i2.bizonylatsorszam = ni.invoice_number
        AND i2.fizetesi_mod ILIKE '%készpénz%'
        AND i2.reference_number IS NULL
    );

  RETURN QUERY SELECT
    (v_opening_balance + v_withdrawals - v_cash_deposits + v_cash_sales - v_cash_expenses - v_nav_cash_expenses)::numeric,
    true;
END;
$$;
