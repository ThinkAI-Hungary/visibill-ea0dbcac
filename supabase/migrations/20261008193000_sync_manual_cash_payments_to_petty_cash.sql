-- ==============================================================================
-- Migration: 20261008193000_sync_manual_cash_payments_to_petty_cash.sql
-- Description: Automatically record petty cash entries when an invoice is settled 
--              via cash / petty cash on TransfersPage (or elsewhere), and support
--              manual cash invoices in sync_petty_cash_entries RPC.
-- Problem: Settling invoices with payment method 'cash' recorded an expense in 
--          transactions (bank tx table) but never created a petty_cash_entries 
--          record, leaving the petty cash register unaware of the cash payout.
-- Solution: 
--   1. Update record_manual_invoice_payment to insert into petty_cash_entries 
--      when p_payment_type IN ('cash', 'kp', 'petty_cash').
--   2. Update sync_petty_cash_entries to include invoices with 
--      is_manual_payment = true AND manual_payment_type IN ('cash', 'kp', 'petty_cash').
--   3. Backfill all existing manual cash payments into petty_cash_entries.
-- ==============================================================================

-- 1. Enhanced record_manual_invoice_payment RPC
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
  v_partner_name text;
  v_partner_vat text;
  v_direction text;
  v_is_nav boolean := false;
  v_expense_id uuid;
  v_register_id uuid;
  v_partner_id uuid;
BEGIN
  -- 1. Find the invoice (either in 'invoices' or 'nav_invoices')
  SELECT company_id, brutto_vegosszeg, penznem, bizonylatsorszam, 
         COALESCE(elado_nev, vevo_nev), COALESCE(elado_vat_id, vevo_vat_id), invoice_direction
  INTO v_company_id, v_amount, v_currency, v_invoice_number,
       v_partner_name, v_partner_vat, v_direction
  FROM public.invoices 
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    SELECT company_id, invoice_gross_amount, currency, invoice_number,
           COALESCE(supplier_name, customer_name), COALESCE(supplier_tax_number, customer_tax_number), invoice_direction
    INTO v_company_id, v_amount, v_currency, v_invoice_number,
         v_partner_name, v_partner_vat, v_direction
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

  -- 5. If settled via cash / petty cash, also record in petty_cash_entries
  IF LOWER(p_payment_type) IN ('cash', 'kp', 'petty_cash') THEN
    -- Find default register for the company
    SELECT r.id INTO v_register_id
    FROM public.petty_cash_registers r
    WHERE r.company_id = v_company_id AND r.is_default = true
    LIMIT 1;

    IF v_register_id IS NULL THEN
      SELECT r.id INTO v_register_id
      FROM public.petty_cash_registers r
      WHERE r.company_id = v_company_id
      ORDER BY r.created_at ASC
      LIMIT 1;
    END IF;

    -- If no register exists, auto-create a default 'Központi pénztár'
    IF v_register_id IS NULL THEN
      INSERT INTO public.petty_cash_registers (company_id, name, currencies, is_default)
      VALUES (v_company_id, 'Központi pénztár', ARRAY[COALESCE(v_currency, 'HUF')], true)
      RETURNING id INTO v_register_id;
    END IF;

    -- Match partner_id
    IF v_partner_vat IS NOT NULL AND TRIM(v_partner_vat) <> '' THEN
      SELECT p.id INTO v_partner_id
      FROM public.partners p
      WHERE p.company_id = v_company_id
        AND (
          p.tax_number = v_partner_vat
          OR (
            length(regexp_replace(v_partner_vat, '[^0-9]', '', 'g')) >= 8
            AND length(regexp_replace(p.tax_number, '[^0-9]', '', 'g')) >= 8
            AND SUBSTRING(regexp_replace(p.tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_vat, '[^0-9]', '', 'g') FROM 1 FOR 8)
          )
        )
      LIMIT 1;
    END IF;

    IF v_partner_id IS NULL AND v_partner_name IS NOT NULL AND TRIM(v_partner_name) <> '' THEN
      SELECT p.id INTO v_partner_id
      FROM public.partners p
      WHERE p.company_id = v_company_id AND LOWER(TRIM(p.name)) = LOWER(TRIM(v_partner_name))
      LIMIT 1;
    END IF;

    -- Insert into petty_cash_entries if not already present
    IF NOT EXISTS (
      SELECT 1 FROM public.petty_cash_entries e
      WHERE e.source_table = CASE WHEN v_is_nav THEN 'nav_invoices' ELSE 'invoices' END
        AND e.source_id = p_invoice_id
    ) THEN
      INSERT INTO public.petty_cash_entries (
        company_id,
        register_id,
        entry_date,
        description,
        amount,
        currency,
        source_type,
        source_id,
        source_table,
        routed_by,
        status,
        partner_id
      ) VALUES (
        v_company_id,
        v_register_id,
        p_payment_date,
        CASE 
          WHEN v_direction ILIKE '%outbound%' THEN 'Készpénzes bevétel (Kézi rendezés) - ' || COALESCE(v_partner_name, 'Ismeretlen') || ' (' || COALESCE(v_invoice_number, '') || ')'
          ELSE 'Készpénzes kiadás (Kézi rendezés) - ' || COALESCE(v_partner_name, 'Ismeretlen') || ' (' || COALESCE(v_invoice_number, '') || ')'
        END,
        CASE 
          WHEN v_direction ILIKE '%outbound%' THEN ABS(v_amount)
          ELSE -ABS(v_amount)
        END,
        COALESCE(v_currency, 'HUF'),
        CASE 
          WHEN v_direction ILIKE '%outbound%' THEN 'cash_sale'
          ELSE 'cash_expense'
        END,
        p_invoice_id,
        CASE WHEN v_is_nav THEN 'nav_invoices' ELSE 'invoices' END,
        'manual',
        'posted',
        v_partner_id
      );
    END IF;
  END IF;

END;
$function$;

REVOKE EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_manual_invoice_payment(uuid, date, text, text) TO authenticated, service_role;

-- 2. Enhanced sync_petty_cash_entries RPC
CREATE OR REPLACE FUNCTION public.sync_petty_cash_entries(p_company_id uuid)
RETURNS TABLE(inserted_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_register_id uuid;
  v_start_date date;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total_before integer;
  v_total_after integer;
BEGIN
  -- Find the default register for this company (used for start_date reference)
  SELECT r.id INTO v_default_register_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id AND r.is_default = true
  LIMIT 1;

  IF v_default_register_id IS NULL THEN
    SELECT r.id INTO v_default_register_id
    FROM petty_cash_registers r
    WHERE r.company_id = p_company_id
    ORDER BY r.created_at ASC
    LIMIT 1;
  END IF;

  IF v_default_register_id IS NULL THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Get start_date from opening balance (if set)
  SELECT ob.start_date INTO v_start_date
  FROM petty_cash_opening_balances ob
  WHERE ob.register_id = v_default_register_id AND ob.currency = 'HUF'
  LIMIT 1;

  -- Count existing entries
  SELECT COUNT(*)::integer INTO v_total_before
  FROM petty_cash_entries e
  WHERE e.company_id = p_company_id;

  -- ① Withdrawals (ATM / counter cash withdrawals -> positive, cash comes IN)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz felvétel'),
    ABS(t.amount),
    'HUF',
    'withdrawal',
    t.id,
    'transactions',
    reg.routed_by
  FROM transactions t
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'withdrawal', 'HUF', NULL, t.description) reg
  WHERE t.company_id = p_company_id
    AND t.type IN ('atm készpénzfelvét', 'pénztári kp felvét')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ② Cash deposits (cash goes OUT from petty cash to bank -> negative)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz befizetés'),
    -(ABS(t.amount)),
    'HUF',
    'cash_deposit',
    t.id,
    'transactions',
    reg.routed_by
  FROM transactions t
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_deposit', 'HUF', NULL, t.description) reg
  WHERE t.company_id = p_company_id
    AND t.type IN ('pénztári kp befizetés', 'kp befizetés atm-en keresztül')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ③ Cash sales from nav_invoices (OUTBOUND NAV invoices paid in cash or manual cash -> positive)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    COALESCE(ni.manual_payment_date, ni.invoice_issue_date),
    'Készpénzes értékesítés - ' || COALESCE(ni.customer_name, 'Ismeretlen'),
    ni.invoice_gross_amount,
    COALESCE(ni.currency, 'HUF'),
    'cash_sale',
    ni.id,
    'nav_invoices',
    reg.routed_by
  FROM nav_invoices ni
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_sale', COALESCE(ni.currency, 'HUF'), ni.customer_name, 'Készpénzes értékesítés - ' || COALESCE(ni.customer_name, 'Ismeretlen')) reg
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'OUTBOUND'
    AND (
      ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
      OR (ni.is_manual_payment = true AND LOWER(ni.manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
    )
    AND (v_start_date IS NULL OR COALESCE(ni.manual_payment_date, ni.invoice_issue_date) >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    );

  -- ④ Cash expenses from submitted invoices (INBOUND ONLY, strictly deduplicated against nav_invoices)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    COALESCE(i.manual_payment_date, i.kibocsatas_datuma),
    'Készpénzes kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
    -(i.brutto_vegosszeg),
    COALESCE(i.penznem, 'HUF'),
    'cash_expense',
    i.id,
    'invoices',
    reg.routed_by
  FROM invoices i
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_expense', COALESCE(i.penznem, 'HUF'), i.elado_nev, 'Készpénzes kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen')) reg
  WHERE i.company_id = p_company_id
    AND i.invoice_direction = 'INBOUND'
    AND (
      i.fizetesi_mod ILIKE '%készpénz%'
      OR (i.is_manual_payment = true AND LOWER(i.manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
    )
    AND i.reference_number IS NULL
    AND i.invoice_type NOT IN ('penztarbizonylat', 'penztargep_zaras')
    AND i.statusz NOT IN ('jovahagyasra_var', 'rejected')
    AND (v_start_date IS NULL OR COALESCE(i.manual_payment_date, i.kibocsatas_datuma) >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    )
    -- Robust dedup: Skip if nav_invoices already has this exact expense
    AND NOT EXISTS (
      SELECT 1 FROM nav_invoices ni
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = 'INBOUND'
        AND (
          ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
          OR (ni.is_manual_payment = true AND LOWER(ni.manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
        )
        AND (
          (i.bizonylatsorszam IS NOT NULL AND TRIM(UPPER(ni.invoice_number)) = TRIM(UPPER(i.bizonylatsorszam)))
          OR (
            ni.invoice_gross_amount = i.brutto_vegosszeg
            AND COALESCE(ni.manual_payment_date, ni.invoice_issue_date) = COALESCE(i.manual_payment_date, i.kibocsatas_datuma)
            AND (
              (i.elado_nev IS NOT NULL AND ni.supplier_name ILIKE '%' || LEFT(i.elado_nev, 8) || '%')
              OR (ni.supplier_name IS NOT NULL AND i.elado_nev ILIKE '%' || LEFT(ni.supplier_name, 8) || '%')
            )
          )
        )
    );

  -- ⑤ NAV cash expenses (INBOUND, strictly deduplicated against submitted invoices)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    COALESCE(ni.manual_payment_date, ni.invoice_issue_date),
    'Készpénzes kiadás (NAV) - ' || COALESCE(ni.supplier_name, 'Ismeretlen'),
    -(ni.invoice_gross_amount),
    COALESCE(ni.currency, 'HUF'),
    'cash_expense',
    ni.id,
    'nav_invoices',
    reg.routed_by
  FROM nav_invoices ni
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_expense', COALESCE(ni.currency, 'HUF'), ni.supplier_name, 'Készpénzes kiadás (NAV) - ' || COALESCE(ni.supplier_name, 'Ismeretlen')) reg
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND (
      ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
      OR (ni.is_manual_payment = true AND LOWER(ni.manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
    )
    AND (v_start_date IS NULL OR COALESCE(ni.manual_payment_date, ni.invoice_issue_date) >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    )
    -- Robust dedup: Skip if invoices already has this exact expense
    AND NOT EXISTS (
      SELECT 1 FROM invoices i2
      WHERE i2.company_id = p_company_id
        AND i2.invoice_direction = 'INBOUND'
        AND (
          i2.fizetesi_mod ILIKE '%készpénz%'
          OR (i2.is_manual_payment = true AND LOWER(i2.manual_payment_type) IN ('cash', 'kp', 'petty_cash'))
        )
        AND i2.reference_number IS NULL
        AND (
          (i2.bizonylatsorszam IS NOT NULL AND TRIM(UPPER(i2.bizonylatsorszam)) = TRIM(UPPER(ni.invoice_number)))
          OR (
            i2.brutto_vegosszeg = ni.invoice_gross_amount
            AND COALESCE(i2.manual_payment_date, i2.kibocsatas_datuma) = COALESCE(ni.manual_payment_date, ni.invoice_issue_date)
            AND (
              (ni.supplier_name IS NOT NULL AND i2.elado_nev ILIKE '%' || LEFT(ni.supplier_name, 8) || '%')
              OR (i2.elado_nev IS NOT NULL AND ni.supplier_name ILIKE '%' || LEFT(i2.elado_nev, 8) || '%')
            )
          )
        )
    );

  -- ⑥ Cash sales from submitted cash vouchers & cash register closures (OUTBOUND)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    i.kibocsatas_datuma,
    CASE
      WHEN i.invoice_type = 'penztargep_zaras' THEN 'Pénztárgép napi zárás (' || COALESCE(i.bizonylatsorszam, 'Zárás') || ')'
      ELSE 'Pénztári bevétel (' || COALESCE(i.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(i.vevo_nev, 'Ismeretlen')
    END,
    i.brutto_vegosszeg,
    COALESCE(i.penznem, 'HUF'),
    'cash_sale',
    i.id,
    'invoices',
    reg.routed_by
  FROM invoices i
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_sale', COALESCE(i.penznem, 'HUF'), i.vevo_nev, 'Pénztári bevétel - ' || COALESCE(i.vevo_nev, 'Ismeretlen')) reg
  WHERE i.company_id = p_company_id
    AND i.invoice_type IN ('penztarbizonylat', 'penztargep_zaras')
    AND i.invoice_direction = 'OUTBOUND'
    AND i.statusz IN ('feldolgozott', 'processed')
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    );

  -- ⑦ Cash payments from submitted cash vouchers (INBOUND, invoice_type = 'penztarbizonylat')
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    i.kibocsatas_datuma,
    'Pénztári kiadás (' || COALESCE(i.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
    -(i.brutto_vegosszeg),
    COALESCE(i.penznem, 'HUF'),
    'cash_expense',
    i.id,
    'invoices',
    reg.routed_by
  FROM invoices i
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_expense', COALESCE(i.penznem, 'HUF'), i.elado_nev, 'Pénztári kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen')) reg
  WHERE i.company_id = p_company_id
    AND i.invoice_type = 'penztarbizonylat'
    AND i.invoice_direction = 'INBOUND'
    AND i.statusz IN ('feldolgozott', 'processed')
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    );

  -- Count after insert to determine actually inserted count
  SELECT COUNT(*)::integer INTO v_total_after
  FROM petty_cash_entries e
  WHERE e.company_id = p_company_id;

  v_inserted := v_total_after - v_total_before;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_petty_cash_entries(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_petty_cash_entries(uuid) TO authenticated, service_role;

-- 3. Backfill existing manual cash payments across all companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT DISTINCT company_id 
    FROM nav_invoices 
    WHERE is_manual_payment = true AND LOWER(manual_payment_type) IN ('cash', 'kp', 'petty_cash')
    UNION
    SELECT DISTINCT company_id 
    FROM invoices 
    WHERE is_manual_payment = true AND LOWER(manual_payment_type) IN ('cash', 'kp', 'petty_cash')
  ) LOOP
    PERFORM public.sync_petty_cash_entries(r.company_id);
  END LOOP;
END $$;
