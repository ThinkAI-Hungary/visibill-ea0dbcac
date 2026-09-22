-- Migration: 20260922150000_fix_petty_cash_dedup_and_routing.sql
-- Description: Fix petty cash synchronization:
--   1. Enforce strict invoice_direction = 'INBOUND' for cash expenses (prevents outbound sales from being booked as negative expenses)
--   2. Implement bidirectional deduplication between invoices and nav_invoices (normalized number OR date+amount+supplier)
--   3. Retain dynamic routing rules (resolve_petty_cash_register) and cash register closure (penztargep_zaras) support
--   4. Cleanup historical duplicate and erroneous outbound entries for Victoria Music Kft.

-- ============================================================================
-- 1. CLEANUP HISTORICAL ERRORS IN petty_cash_entries FOR Victoria Music Kft.
-- ============================================================================

-- A) Delete fake expenses erroneously created from OUTBOUND invoices
DELETE FROM public.petty_cash_entries pce
WHERE pce.company_id = '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e'
  AND pce.source_table = 'invoices'
  AND pce.amount < 0
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = pce.source_id
      AND i.invoice_direction = 'OUTBOUND'
  );

-- B) Delete redundant duplicate inbound entries where a nav_invoices entry already exists
DELETE FROM public.petty_cash_entries pce_inv
WHERE pce_inv.company_id = '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e'
  AND pce_inv.source_table = 'invoices'
  AND EXISTS (
    SELECT 1 
    FROM public.invoices i
    JOIN public.petty_cash_entries pce_nav ON pce_nav.company_id = pce_inv.company_id 
                                          AND pce_nav.source_table = 'nav_invoices'
                                          AND pce_nav.entry_date = pce_inv.entry_date
                                          AND pce_nav.amount = pce_inv.amount
    JOIN public.nav_invoices ni ON ni.id = pce_nav.source_id
    WHERE i.id = pce_inv.source_id
      AND i.invoice_direction = 'INBOUND'
      AND (
        TRIM(UPPER(ni.invoice_number)) = TRIM(UPPER(i.bizonylatsorszam))
        OR (
          ni.supplier_name ILIKE '%' || LEFT(i.elado_nev, 8) || '%'
          OR i.elado_nev ILIKE '%' || LEFT(ni.supplier_name, 8) || '%'
        )
      )
  );

-- ============================================================================
-- 2. UPDATED sync_petty_cash_entries RPC WITH BIDIRECTIONAL DEDUP & ROUTING
-- ============================================================================

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

  -- ③ Cash sales from nav_invoices (OUTBOUND NAV invoices paid in cash -> positive)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    ni.invoice_issue_date,
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
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    );

  -- ④ Cash expenses from submitted invoices (INBOUND ONLY, strictly deduplicated against nav_invoices)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    i.kibocsatas_datuma,
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
    AND i.fizetesi_mod ILIKE '%készpénz%'
    AND i.reference_number IS NULL
    AND i.invoice_type NOT IN ('penztarbizonylat', 'penztargep_zaras')
    AND i.statusz NOT IN ('jovahagyasra_var', 'rejected')
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    )
    -- Robust dedup: Skip if nav_invoices already has this exact expense
    AND NOT EXISTS (
      SELECT 1 FROM nav_invoices ni
      WHERE ni.company_id = p_company_id
        AND ni.invoice_direction = 'INBOUND'
        AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
        AND (
          (i.bizonylatsorszam IS NOT NULL AND TRIM(UPPER(ni.invoice_number)) = TRIM(UPPER(i.bizonylatsorszam)))
          OR (
            ni.invoice_gross_amount = i.brutto_vegosszeg
            AND ni.invoice_issue_date = i.kibocsatas_datuma
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
    ni.invoice_issue_date,
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
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    )
    -- Robust dedup: Skip if invoices already has this exact expense
    AND NOT EXISTS (
      SELECT 1 FROM invoices i2
      WHERE i2.company_id = p_company_id
        AND i2.invoice_direction = 'INBOUND'
        AND i2.fizetesi_mod ILIKE '%készpénz%'
        AND i2.reference_number IS NULL
        AND (
          (i2.bizonylatsorszam IS NOT NULL AND TRIM(UPPER(i2.bizonylatsorszam)) = TRIM(UPPER(ni.invoice_number)))
          OR (
            i2.brutto_vegosszeg = ni.invoice_gross_amount
            AND i2.kibocsatas_datuma = ni.invoice_issue_date
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

  -- Count after
  SELECT COUNT(*)::integer INTO v_total_after
  FROM petty_cash_entries e
  WHERE e.company_id = p_company_id;

  v_inserted := v_total_after - v_total_before;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_petty_cash_entries(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_petty_cash_entries(uuid) TO authenticated, service_role;
