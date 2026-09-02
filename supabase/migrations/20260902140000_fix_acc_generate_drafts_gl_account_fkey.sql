-- Migration: Fix acc_generate_drafts_from_ledger Foreign Key 23503 error on unmapped items (00000000-0000-0000-0000-000000000000)
-- Date: 2026-09-02

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
  v_amount_foreign NUMERIC;
  v_currency CHAR(3);
  v_exchange_rate NUMERIC(12,6);
  
  -- Local variables for resolved details
  v_doc_id VARCHAR(64);
  v_partner_id UUID;
  v_partner_name TEXT;
  v_partner_tax VARCHAR(32);
  v_gl_cls JSONB;
BEGIN
  -- Delete existing system suggestions to allow clean refresh
  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  -- Ensure default journals are seeded
  PERFORM public.acc_seed_default_journals(p_company_id);

  -- Fetch default control accounts from active preset first, then fallback to company-specific
  SELECT id INTO v_gl_cust_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '311%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_cust_id IS NULL THEN
    SELECT id INTO v_gl_cust_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '311%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  SELECT id INTO v_gl_supp_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '454%' 
   ORDER BY gl_number LIMIT 1;

  IF v_gl_supp_id IS NULL THEN
    SELECT id INTO v_gl_supp_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '454%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  -- Default fallback if not found
  IF v_gl_cust_id IS NULL THEN
    SELECT id INTO v_gl_cust_id 
      FROM public.gl_accounts 
     WHERE preset_id = p_preset_id OR company_id = p_company_id 
     ORDER BY gl_number LIMIT 1;
  END IF;
  
  IF v_gl_supp_id IS NULL THEN 
    v_gl_supp_id := v_gl_cust_id; 
  END IF;

  FOR v_row IN 
    SELECT * FROM public.get_gl_categorized_items(p_company_id, p_preset_id)
     WHERE gl_account_id IS NOT NULL 
       AND gl_account_id <> '00000000-0000-0000-0000-000000000000'::uuid
       AND amount IS NOT NULL 
       AND amount <> 0
  LOOP
    -- Double check that gl_account_id exists in gl_accounts table
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE id = v_row.gl_account_id) THEN
      CONTINUE;
    END IF;

    -- Ensure absolute HUF amount is greater than zero
    v_amount := ROUND(ABS(v_row.amount), 2);
    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Check if already imported
    IF EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_row.item_id::text
    ) THEN
      CONTINUE;
    END IF;

    -- Fetch G/L classification details
    IF v_row.source_table = 'transactions' THEN
      SELECT gl_classifications -> p_preset_id::text INTO v_gl_cls FROM public.transactions WHERE id = v_row.item_id;
    ELSIF v_row.source_table = 'invoice_items' THEN
      SELECT gl_classifications -> p_preset_id::text INTO v_gl_cls FROM public.invoice_items WHERE id = v_row.item_id;
    ELSIF v_row.source_table = 'nav_invoice_items' THEN
      SELECT gl_classifications -> p_preset_id::text INTO v_gl_cls FROM public.nav_invoice_items WHERE id = v_row.item_id;
    ELSE
      v_gl_cls := NULL;
    END IF;

    v_date := COALESCE(v_row.item_date::date, CURRENT_DATE);
    v_partner_id := NULL;
    v_partner_name := NULL;
    v_partner_tax := NULL;
    
    -- Resolve currency and exchange rate details
    v_currency := COALESCE(v_row.original_currency, 'HUF');
    v_amount_foreign := ROUND(ABS(COALESCE(v_row.original_amount, v_row.amount)), 2);
    
    IF v_currency <> 'HUF' AND v_amount_foreign <> 0 THEN
      v_exchange_rate := ROUND(v_amount / v_amount_foreign, 6);
    ELSE
      v_exchange_rate := 1.000000;
      v_amount_foreign := NULL;
    END IF;

    -- 1. Determine Journal & Source & Contra account
    IF v_row.source_table = 'transactions' THEN
      -- Bank transaction - resolve or dynamically create foreign currency bank journal
      IF v_currency = 'HUF' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
      ELSIF v_currency = 'EUR' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B2' LIMIT 1;
      ELSE
        -- Check if specific currency bank journal exists
        SELECT id INTO v_journal_id FROM public.acc_journals 
         WHERE company_id = p_company_id AND type = 'BANK' AND currency = v_currency LIMIT 1;
      END IF;

      -- Create dynamic bank journal if not exists (e.g. for USD)
      IF v_journal_id IS NULL THEN
        INSERT INTO public.acc_journals (company_id, code, name, type, connected_gl_account, currency)
        VALUES (
          p_company_id, 
          'B_' || v_currency, 
          'Deviza bank ' || v_currency, 
          'BANK', 
          '386', -- Devizabetét-számlák group
          v_currency
        )
        ON CONFLICT (company_id, code) DO UPDATE SET currency = EXCLUDED.currency
        RETURNING id INTO v_journal_id;
      END IF;

      -- Resolve G/L account for Bank (HUF 3841, or Deviza 386)
      IF v_currency = 'HUF' THEN
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '384%' 
         ORDER BY gl_number LIMIT 1;
      ELSE
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '386%' 
         ORDER BY gl_number LIMIT 1;
      END IF;
      
      IF v_gl_bank_id IS NULL THEN
        SELECT id INTO v_gl_bank_id 
          FROM public.gl_accounts 
         WHERE preset_id = p_preset_id OR company_id = p_company_id 
         ORDER BY gl_number LIMIT 1;
      END IF;

      -- Ensure both sides exist before inserting
      IF v_gl_bank_id IS NULL OR v_row.gl_account_id IS NULL THEN
        CONTINUE;
      END IF;
      
      -- Cleaner doc ID for bank transactions (TR- + first 8 characters of UUID)
      v_doc_id := 'TR-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      -- Create Header
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Banki tranzakció'), v_currency, v_exchange_rate, v_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      -- Create Lines (Double Entry)
      IF v_row.amount >= 0 THEN
        -- Received payment: Debit Bank (T), Credit Mapped Account (K)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        -- Outgoing payment: Debit Mapped Account (T), Credit Bank (K)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
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
        JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
        WHERE nii.id = v_row.item_id;

        v_doc_id := COALESCE(v_doc_id, 'NAV-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
      END IF;

      -- Common partner resolution logic for invoices
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
        IF v_gl_cust_id IS NULL OR v_row.gl_account_id IS NULL THEN
          CONTINUE;
        END IF;

        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'V' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
        
        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, exchange_rate, exchange_rate_date, import_key,
          ai_recommendation, confidence
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Vevő') || ' - ' || COALESCE(v_row.description, 'Értékesítés'), v_currency, v_exchange_rate, v_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_gl_cust_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        -- Inbound purchase: Expense Debit, Supplier (454) Credit
        IF v_gl_supp_id IS NULL OR v_row.gl_account_id IS NULL THEN
          CONTINUE;
        END IF;

        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'SZ' LIMIT 1;
        IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
        
        INSERT INTO public.acc_journal_headers (
          company_id, journal_id, accounting_year, status, entry_type, source,
          posting_date, document_date, document_id, partner_id,
          description, currency, exchange_rate, exchange_rate_date, import_key,
          ai_recommendation, confidence
        ) VALUES (
          p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
          v_date, v_date, v_doc_id, v_partner_id,
          COALESCE(v_partner_name, 'Szállító') || ' - ' || COALESCE(v_row.description, 'Beszerzés'), v_currency, v_exchange_rate, v_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_supp_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      END IF;

    ELSE
      -- Generic Vegyes
      IF v_gl_supp_id IS NULL OR v_row.gl_account_id IS NULL THEN
        CONTINUE;
      END IF;

      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'VE' LIMIT 1;
      IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;

      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_RENDSZER',
        v_date, v_date, 'MISC-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)), NULL,
        COALESCE(v_row.description, 'Vegyes bizonylat'), v_currency, v_exchange_rate, v_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
      VALUES 
        (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
        (v_header_id, 2, v_gl_supp_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
