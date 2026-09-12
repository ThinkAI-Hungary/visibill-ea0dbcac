-- ============================================================
-- Migration: 20260912140000_petty_cash_routing_rules_in_sync.sql
-- Description: Wire petty_cash_routing_rules into sync_petty_cash_entries
-- Author: Antigravity / Pair Programming
-- ============================================================

-- 1. Helper function: resolve target register according to active routing rules
CREATE OR REPLACE FUNCTION public.resolve_petty_cash_register(
  p_company_id uuid,
  p_source_type text,
  p_currency text DEFAULT 'HUF',
  p_partner text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS TABLE (register_id uuid, routed_by text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rule_target uuid;
  v_default_id uuid;
BEGIN
  -- ① Check active routing rules (highest priority wins)
  SELECT r.target_register_id INTO v_rule_target
  FROM petty_cash_routing_rules r
  WHERE r.company_id = p_company_id
    AND r.is_active = true
    AND (r.match_source_type IS NULL OR r.match_source_type = p_source_type)
    AND (r.match_currency IS NULL OR r.match_currency = p_currency)
    AND (r.match_partner_pattern IS NULL OR (p_partner IS NOT NULL AND p_partner ILIKE '%' || r.match_partner_pattern || '%'))
    AND (r.match_description_pattern IS NULL OR (p_description IS NOT NULL AND p_description ILIKE '%' || r.match_description_pattern || '%'))
  ORDER BY r.priority DESC, r.created_at ASC
  LIMIT 1;

  IF v_rule_target IS NOT NULL THEN
    RETURN QUERY SELECT v_rule_target, 'rule'::text;
    RETURN;
  END IF;

  -- ② Fallback: Default register for company
  SELECT r.id INTO v_default_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id AND r.is_default = true
  LIMIT 1;

  IF v_default_id IS NOT NULL THEN
    RETURN QUERY SELECT v_default_id, 'default'::text;
    RETURN;
  END IF;

  -- ③ Final fallback: Any register for company
  SELECT r.id INTO v_default_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id
  ORDER BY r.created_at ASC
  LIMIT 1;

  RETURN QUERY SELECT v_default_id, 'fallback'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_petty_cash_register(uuid, text, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_petty_cash_register(uuid, text, text, text, text) TO authenticated, service_role;


-- 2. Update sync_petty_cash_entries to apply resolve_petty_cash_register on inserts
CREATE OR REPLACE FUNCTION public.sync_petty_cash_entries(p_company_id uuid)
RETURNS TABLE (inserted_count integer, skipped_count integer)
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
  -- Find the default register for company (used for start_date reference)
  SELECT r.id INTO v_default_register_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id AND r.is_default = true
  LIMIT 1;

  IF v_default_register_id IS NULL THEN
    -- Fallback to any register
    SELECT r.id INTO v_default_register_id
    FROM petty_cash_registers r
    WHERE r.company_id = p_company_id
    ORDER BY r.created_at ASC
    LIMIT 1;
  END IF;

  IF v_default_register_id IS NULL THEN
    -- No register found at all, cannot sync
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Get start_date from opening balance (if set on default register)
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

  -- ② Cash deposits (cash goes OUT from petty cash -> negative)
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

  -- ③ Cash sales (OUTBOUND NAV invoices paid in cash -> positive)
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

  -- ④ Cash expenses from submitted invoices (reference_number IS NULL -> not linked, statusz != 'jovahagyasra_var')
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
    AND i.fizetesi_mod ILIKE '%készpénz%'
    AND i.reference_number IS NULL
    AND i.invoice_type != 'penztarbizonylat'
    AND i.statusz != 'jovahagyasra_var'
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    );

  -- ⑤ NAV cash expenses (INBOUND, excluding duplicates already in invoices table)
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
    AND NOT EXISTS (
      SELECT 1 FROM invoices i2
      WHERE i2.company_id = p_company_id
        AND i2.bizonylatsorszam = ni.invoice_number
        AND i2.fizetesi_mod ILIKE '%készpénz%'
        AND i2.reference_number IS NULL
    );

  -- ⑥ Cash sales from submitted cash vouchers (invoice_type = 'penztarbizonylat' and direction = 'OUTBOUND', statusz != 'jovahagyasra_var')
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    i.kibocsatas_datuma,
    'Pénztári bevétel - ' || COALESCE(i.vevo_nev, 'Ismeretlen'),
    i.brutto_vegosszeg,
    COALESCE(i.penznem, 'HUF'),
    'cash_sale',
    i.id,
    'invoices',
    reg.routed_by
  FROM invoices i
  CROSS JOIN LATERAL public.resolve_petty_cash_register(p_company_id, 'cash_sale', COALESCE(i.penznem, 'HUF'), i.vevo_nev, 'Pénztári bevétel - ' || COALESCE(i.vevo_nev, 'Ismeretlen')) reg
  WHERE i.company_id = p_company_id
    AND i.invoice_type = 'penztarbizonylat'
    AND i.invoice_direction = 'OUTBOUND'
    AND i.statusz != 'jovahagyasra_var'
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    );

  -- ⑦ Cash payments from submitted cash vouchers (invoice_type = 'penztarbizonylat' and direction = 'INBOUND', statusz != 'jovahagyasra_var')
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    reg.register_id,
    i.kibocsatas_datuma,
    'Pénztári kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
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
    AND i.statusz != 'jovahagyasra_var'
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


-- 3. Fix existing historical cash_sale records for Victoria Music Kft.
-- Move all cash_sale entries from default register (Központ) to target register (Üzlettér) as per routing rule
UPDATE public.petty_cash_entries
SET register_id = '58d7f589-589a-42e4-8cd3-3e763b91a666',
    routed_by = 'rule'
WHERE company_id = '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e'
  AND source_type = 'cash_sale'
  AND register_id = 'c415f60e-a130-4cb4-9f75-f45449a37d54';
