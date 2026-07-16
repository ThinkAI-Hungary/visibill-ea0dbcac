-- Migration: Petty Cash Manual Approval workflow support
-- Created at: 2026-07-16

-- 1. Add confidence_score column to invoices table if not exists
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 1.0;

-- 2. Alter statusz constraint on invoices to allow 'jovahagyasra_var'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_statusz_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_statusz_check 
  CHECK (statusz = ANY (ARRAY[
    'feldolgozas_alatt'::text, 
    'feldolgozott'::text, 
    'kifizetve'::text, 
    'keses'::text, 
    'torolt'::text,
    'jovahagyasra_var'::text
  ]));

-- 3. Re-define sync_petty_cash_entries to exclude 'jovahagyasra_var' invoices
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
  -- Find the default register for this company
  SELECT r.id INTO v_default_register_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id AND r.is_default = true
  LIMIT 1;

  IF v_default_register_id IS NULL THEN
    -- No default register found, cannot sync
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

  -- ① Withdrawals (ATM / counter cash withdrawals → positive, cash comes IN)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz felvétel'),
    ABS(t.amount),
    'HUF',
    'withdrawal',
    t.id,
    'transactions',
    'default'
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('atm készpénzfelvét', 'pénztári kp felvét')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ② Cash deposits (cash goes OUT from petty cash → negative)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz befizetés'),
    -(ABS(t.amount)),
    'HUF',
    'cash_deposit',
    t.id,
    'transactions',
    'default'
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('pénztári kp befizetés', 'kp befizetés atm-en keresztül')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ③ Cash sales (OUTBOUND NAV invoices paid in cash → positive)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    ni.invoice_issue_date,
    'Készpénzes értékesítés - ' || COALESCE(ni.customer_name, 'Ismeretlen'),
    ni.invoice_gross_amount,
    COALESCE(ni.currency, 'HUF'),
    'cash_sale',
    ni.id,
    'nav_invoices',
    'default'
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'OUTBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    );

  -- ④ Cash expenses from submitted invoices (reference_number IS NULL → not linked, statusz != 'jovahagyasra_var')
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    i.kibocsatas_datuma,
    'Készpénzes kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
    -(i.brutto_vegosszeg),
    COALESCE(i.penznem, 'HUF'),
    'cash_expense',
    i.id,
    'invoices',
    'default'
  FROM invoices i
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
    v_default_register_id,
    ni.invoice_issue_date,
    'Készpénzes kiadás (NAV) - ' || COALESCE(ni.supplier_name, 'Ismeretlen'),
    -(ni.invoice_gross_amount),
    COALESCE(ni.currency, 'HUF'),
    'cash_expense',
    ni.id,
    'nav_invoices',
    'default'
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    -- Exclude if already synced
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    )
    -- Exclude duplicates that exist in invoices table
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
    v_default_register_id,
    i.kibocsatas_datuma,
    'Pénztári bevétel (' || COALESCE(i.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(i.vevo_nev, 'Ismeretlen'),
    i.brutto_vegosszeg,
    COALESCE(i.penznem, 'HUF'),
    'cash_sale',
    i.id,
    'invoices',
    'default'
  FROM invoices i
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
    v_default_register_id,
    i.kibocsatas_datuma,
    'Pénztári kiadás (' || COALESCE(i.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
    -(i.brutto_vegosszeg),
    COALESCE(i.penznem, 'HUF'),
    'cash_expense',
    i.id,
    'invoices',
    'default'
  FROM invoices i
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

-- 4. Re-define sync_petty_cash_on_invoice_change trigger function
CREATE OR REPLACE FUNCTION public.sync_petty_cash_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.petty_cash_entries
    WHERE source_table = 'invoices' AND source_id = OLD.id;
    
    PERFORM public.sync_petty_cash_entries(OLD.company_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.invoice_type = 'penztarbizonylat' OR NEW.fizetesi_mod ILIKE '%készpénz%') AND NEW.statusz != 'jovahagyasra_var' THEN
      IF EXISTS (
        SELECT 1 FROM public.petty_cash_entries
        WHERE source_table = 'invoices' AND source_id = NEW.id
      ) THEN
        UPDATE public.petty_cash_entries
        SET 
          entry_date = NEW.kibocsatas_datuma,
          description = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN
              CASE 
                WHEN NEW.invoice_direction = 'OUTBOUND' THEN 'Pénztári bevétel (' || COALESCE(NEW.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(NEW.vevo_nev, 'Ismeretlen')
                ELSE 'Pénztári kiadás (' || COALESCE(NEW.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
              END
            ELSE
              'Készpénzes kiadás - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
          END,
          amount = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'INBOUND' THEN -(NEW.brutto_vegosszeg)
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN NEW.brutto_vegosszeg
            ELSE -(NEW.brutto_vegosszeg)
          END,
          currency = COALESCE(NEW.penznem, 'HUF'),
          source_type = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'OUTBOUND' THEN 'cash_sale'
            ELSE 'cash_expense'
          END
        WHERE source_table = 'invoices' AND source_id = NEW.id;
      ELSE
        PERFORM public.sync_petty_cash_entries(NEW.company_id);
      END IF;
    ELSE
      DELETE FROM public.petty_cash_entries
      WHERE source_table = 'invoices' AND source_id = NEW.id;
      
      -- Also re-sync to ensure everything is recalculated
      PERFORM public.sync_petty_cash_entries(NEW.company_id);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    IF (NEW.invoice_type = 'penztarbizonylat' OR NEW.fizetesi_mod ILIKE '%készpénz%') AND NEW.statusz != 'jovahagyasra_var' THEN
      PERFORM public.sync_petty_cash_entries(NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
