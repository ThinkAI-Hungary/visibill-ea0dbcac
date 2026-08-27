-- Migration: Fix Journals Backfill Partner Resolution
-- Date: 2026-08-27

CREATE OR REPLACE FUNCTION public.acc_generate_drafts_from_ledger(
  p_company_id UUID,
  p_preset_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_row RECORD;
  v_journal_id UUID;
  v_header_id UUID;
  v_gl_bank_id UUID;
  v_gl_cash_id UUID;
  v_gl_cust_id UUID;
  v_gl_supp_id UUID;
  v_count INTEGER := 0;
  v_date DATE;
  v_amount NUMERIC;
  
  -- Local variables for resolved details
  v_doc_id VARCHAR(64);
  v_partner_id UUID;
  v_partner_name TEXT;
  v_partner_tax VARCHAR(32);
BEGIN
  -- Delete existing system suggestions to allow clean refresh
  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  -- Ensure default journals are seeded
  PERFORM public.acc_seed_default_journals(p_company_id);

  -- Fetch default control accounts
  SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '384%' LIMIT 1;
  SELECT id INTO v_gl_cash_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '381%' LIMIT 1;
  SELECT id INTO v_gl_cust_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '311%' LIMIT 1;
  SELECT id INTO v_gl_supp_id FROM public.gl_accounts WHERE company_id = p_company_id AND gl_number LIKE '454%' LIMIT 1;

  -- Default fallback if not found
  IF v_gl_bank_id IS NULL THEN
    SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE company_id = p_company_id ORDER BY gl_number LIMIT 1;
  END IF;
  IF v_gl_cash_id IS NULL THEN v_gl_cash_id := v_gl_bank_id; END IF;
  IF v_gl_cust_id IS NULL THEN v_gl_cust_id := v_gl_bank_id; END IF;
  IF v_gl_supp_id IS NULL THEN v_gl_supp_id := v_gl_bank_id; END IF;

  FOR v_row IN 
    SELECT * FROM public.get_gl_categorized_items(p_company_id, p_preset_id)
     WHERE gl_account_id IS NOT NULL 
       AND amount IS NOT NULL 
       AND amount <> 0
  LOOP
    -- Ensure absolute amount is greater than zero
    v_amount := ROUND(ABS(v_row.amount), 2);
    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Check if already imported (in case of manually saved/posted items with the same import key)
    IF EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_row.item_id::text
    ) THEN
      CONTINUE;
    END IF;

    v_date := COALESCE(v_row.item_date::date, CURRENT_DATE);
    v_partner_id := NULL;
    v_partner_name := NULL;
    v_partner_tax := NULL;

    -- 1. Determine Journal & Source & Contra account
    IF v_row.source_table = 'transactions' THEN
      -- Bank transaction
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
      IF v_journal_id IS NULL THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1;
      END IF;
      
      -- Cleaner doc ID for bank transactions (TR- + first 8 characters of UUID)
      v_doc_id := 'TR-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      -- Create Header
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, import_key
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Banki tranzakció'), 'HUF', v_row.item_id::text
      ) RETURNING id INTO v_header_id;

      -- Create Lines (Double Entry)
      IF v_row.amount >= 0 THEN
        -- Received payment: Debit Bank (T), Credit Mapped Account (K)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, COALESCE(v_row.description, ''));
      ELSE
        -- Outgoing payment: Debit Mapped Account (T), Credit Bank (K)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, COALESCE(v_row.description, ''));
      END IF;

    ELSIF v_row.source_table IN ('invoice_items', 'nav_invoice_items') THEN
      -- Resolve invoice details
      IF v_row.source_table = 'invoice_items' THEN
        DECLARE
          v_invoice_direction VARCHAR(32);
          v_elado_nev VARCHAR(255);
          v_elado_vat VARCHAR(255);
          v_vevo_nev VARCHAR(255);
          v_vevo_vat VARCHAR(255);
        BEGIN
          SELECT 
            i.bizonylatsorszam,
            i.invoice_direction,
            i.elado_nev,
            i.elado_vat_id,
            i.vevo_nev,
            i.vevo_vat_id
          INTO 
            v_doc_id,
            v_invoice_direction,
            v_elado_nev,
            v_elado_vat,
            v_vevo_nev,
            v_vevo_vat
          FROM public.invoice_items ii
          JOIN public.invoices i ON i.id = ii.invoice_id
          WHERE ii.id = v_row.item_id;
          
          v_doc_id := COALESCE(v_doc_id, 'INV-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
          
          IF v_invoice_direction = 'OUTBOUND' THEN
            v_partner_name := v_vevo_nev;
            v_partner_tax := v_vevo_vat;
          ELSE
            v_partner_name := v_elado_nev;
            v_partner_tax := v_elado_vat;
          END IF;
        END;
      ELSE
        -- nav_invoice_items
        SELECT 
          ni.invoice_number,
          ni.customer_name,
          ni.customer_tax_number
        INTO 
          v_doc_id,
          v_partner_name,
          v_partner_tax
        FROM public.nav_invoice_items nii
        JOIN public.nav_invoices ni ON ni.id = nii.invoice_id
        WHERE nii.id = v_row.item_id;

        v_doc_id := COALESCE(v_doc_id, 'NAV-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
      END IF;

      IF v_partner_tax IS NOT NULL THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND tax_number LIKE SPLIT_PART(v_partner_tax, '-', 1) || '%'
         LIMIT 1;
      END IF;
      
      IF v_partner_id IS NULL AND v_partner_name IS NOT NULL THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name)) 
         LIMIT 1;
      END IF;

      -- Invoice Direction / Journal mapping
      IF v_row.amount >= 0 THEN
        -- Outbound sales: Customer (311) Debit, Revenue Credit
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'V' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
        
        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, import_key
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Vevő') || ' - ' || COALESCE(v_row.description, 'Értékesítés'), 'HUF', v_row.item_id::text
        ) RETURNING id INTO v_header_id;

        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_cust_id, 'T', v_amount, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, COALESCE(v_row.description, ''));
      ELSE
        -- Inbound purchase: Expense Debit, Supplier (454) Credit
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'SZ' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
        
        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, import_key
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Szállító') || ' - ' || COALESCE(v_row.description, 'Beszerzés'), 'HUF', v_row.item_id::text
        ) RETURNING id INTO v_header_id;

        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_supp_id, 'K', v_amount, COALESCE(v_row.description, ''));
      END IF;

    ELSE
      -- Generic Vegyes
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'VE' LIMIT 1;
      IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;

      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, import_key
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_RENDSZER',
        v_date, v_date, 'MISC-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)), NULL,
        COALESCE(v_row.description, 'Vegyes bizonylat'), 'HUF', v_row.item_id::text
      ) RETURNING id INTO v_header_id;

      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
      VALUES 
        (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, COALESCE(v_row.description, '')),
        (v_header_id, 2, v_gl_supp_id, 'K', v_amount, COALESCE(v_row.description, ''));
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
