-- Migration: 20260905120000_acc_generate_drafts_robust_partner_matching.sql
-- Description: Improve partner resolution in acc_generate_drafts_from_ledger to support
-- Hungarian 8-digit tax base matching (stripping EU/HU prefix, punctuation, county/VAT suffixes)
-- and case-insensitive trimmed partner name matching.

CREATE OR REPLACE FUNCTION public.acc_generate_drafts_from_ledger(p_company_id uuid, p_preset_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
DECLARE
  v_row RECORD;
  v_journal_id UUID;
  v_header_id UUID;
  v_base_line_id UUID;
  v_gl_bank_id UUID;
  v_gl_cash_id UUID;
  v_gl_cust_id UUID;
  v_gl_supp_id UUID;
  v_gl_vat_ded_id UUID;
  v_gl_vat_pay_id UUID;
  v_count INTEGER := 0;
  v_date DATE;
  v_amount NUMERIC;
  v_amount_foreign NUMERIC;
  v_currency CHAR(3);
  v_exchange_rate NUMERIC(12,6);
  v_exchange_rate_date DATE;
  
  -- Local variables for resolved details
  v_doc_id VARCHAR(64);
  v_partner_id UUID;
  v_partner_name TEXT;
  v_partner_tax VARCHAR(32);
  v_gl_cls JSONB;
  v_final_direction VARCHAR(32);
  v_is_credit BOOLEAN;
  
  -- Item level VAT and Gross amounts
  v_item_net NUMERIC;
  v_item_vat NUMERIC;
  v_item_gross NUMERIC;
  v_item_vat_rate VARCHAR(16);
  
  -- Converted HUF amounts for lines
  v_huf_net NUMERIC;
  v_huf_vat NUMERIC;
  v_huf_gross NUMERIC;
  
  -- Foreign currency amounts for lines
  v_foreign_net NUMERIC;
  v_foreign_vat NUMERIC;
  v_foreign_gross NUMERIC;
BEGIN
  -- 1. Delete existing system suggestions to allow clean refresh
  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  -- 2. Ensure default journals are seeded
  PERFORM public.acc_seed_default_journals(p_company_id);

  -- 3. Resolve Customer (311%) control account
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

  -- 4. Resolve Supplier (454%) control account (prefer 4541 if available)
  SELECT id INTO v_gl_supp_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '4541' OR gl_number LIKE '454%') 
   ORDER BY (gl_number = '4541') DESC, gl_number LIMIT 1;
   
  IF v_gl_supp_id IS NULL THEN
    SELECT id INTO v_gl_supp_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '4541' OR gl_number LIKE '454%') 
     ORDER BY (gl_number = '4541') DESC, gl_number LIMIT 1;
  END IF;

  -- 5. Resolve VAT accounts (466% Levonható, 467% Fizetendő)
  SELECT id INTO v_gl_vat_ded_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '466%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_vat_ded_id IS NULL THEN
    SELECT id INTO v_gl_vat_ded_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '466%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  -- Fallback to system preset or any active 466
  IF v_gl_vat_ded_id IS NULL THEN
    SELECT id INTO v_gl_vat_ded_id 
      FROM public.gl_accounts 
     WHERE gl_number LIKE '466%' 
     ORDER BY (preset_id = 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid) DESC, gl_number 
     LIMIT 1;
  END IF;

  SELECT id INTO v_gl_vat_pay_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND gl_number LIKE '467%' 
   ORDER BY gl_number LIMIT 1;
   
  IF v_gl_vat_pay_id IS NULL THEN
    SELECT id INTO v_gl_vat_pay_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND gl_number LIKE '467%' 
     ORDER BY gl_number LIMIT 1;
  END IF;

  -- Fallback to system preset or any active 467
  IF v_gl_vat_pay_id IS NULL THEN
    SELECT id INTO v_gl_vat_pay_id 
      FROM public.gl_accounts 
     WHERE gl_number LIKE '467%' 
     ORDER BY (preset_id = 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid) DESC, gl_number 
     LIMIT 1;
  END IF;

  -- 6. Loop over classified ledger items (ONLY OPERATIONAL & XML ITEMS, EXCLUDING ACC_JOURNAL_LINES)
  FOR v_row IN 
    SELECT * FROM public.get_gl_categorized_items(p_company_id, p_preset_id)
     WHERE gl_account_id IS NOT NULL 
       AND gl_account_id <> '00000000-0000-0000-0000-000000000000'::uuid
       AND amount IS NOT NULL 
       AND amount <> 0
       AND source_table IN ('transactions', 'invoice_items', 'nav_invoice_items', 'journal_entry')
  LOOP
    -- Double check that gl_account_id exists in gl_accounts table
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE id = v_row.gl_account_id) THEN
      CONTINUE;
    END IF;

    -- Check if already imported
    IF EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_row.item_id::text
    ) THEN
      CONTINUE;
    END IF;

    -- Determine date
    v_date := COALESCE(v_row.item_date::date, CURRENT_DATE);
    v_currency := COALESCE(v_row.original_currency, 'HUF');
    
    -- Currency & daily exchange rate lookup
    IF v_currency <> 'HUF' THEN
      v_amount_foreign := ROUND(ABS(COALESCE(v_row.original_amount, v_row.amount)), 2);
      
      SELECT rate, rate_date 
        INTO v_exchange_rate, v_exchange_rate_date
        FROM public.daily_exchange_rates
       WHERE currency = v_currency
         AND rate_date <= v_date
       ORDER BY rate_date DESC
       LIMIT 1;

      IF v_exchange_rate IS NULL OR v_exchange_rate <= 0 THEN
        SELECT rate, rate_date 
          INTO v_exchange_rate, v_exchange_rate_date
          FROM public.daily_exchange_rates
         WHERE currency = v_currency
         ORDER BY rate_date DESC
         LIMIT 1;
      END IF;

      IF v_exchange_rate IS NULL OR v_exchange_rate <= 0 THEN
        v_exchange_rate := 1.000000;
        v_exchange_rate_date := v_date;
      END IF;

      v_amount := ROUND(v_amount_foreign * v_exchange_rate, 2);
    ELSE
      v_exchange_rate := 1.000000;
      v_exchange_rate_date := v_date;
      v_amount_foreign := NULL;
      v_amount := ROUND(ABS(v_row.amount), 2);
    END IF;

    IF v_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Case A: Bank transaction (2-legged double entry)
    -- ──────────────────────────────────────────────────────────────────────────
    IF v_row.source_table = 'transactions' THEN
      IF v_currency = 'HUF' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
      ELSIF v_currency = 'EUR' THEN
        SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B2' LIMIT 1;
      ELSE
        SELECT id INTO v_journal_id FROM public.acc_journals 
         WHERE company_id = p_company_id AND type = 'BANK' AND currency = v_currency LIMIT 1;
      END IF;

      IF v_journal_id IS NULL THEN
        INSERT INTO public.acc_journals (company_id, code, name, type, connected_gl_account, currency)
        VALUES (
          p_company_id, 
          'B_' || v_currency, 
          'Deviza bank ' || v_currency, 
          'BANK', 
          '386',
          v_currency
        )
        ON CONFLICT (company_id, code) DO UPDATE SET currency = EXCLUDED.currency
        RETURNING id INTO v_journal_id;
      END IF;

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
      
      v_doc_id := 'TR-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Banki tranzakció'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

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

    -- ──────────────────────────────────────────────────────────────────────────
    -- Case B: Invoices (3-legged double entry: Netto + ÁFA = Bruttó)
    -- ──────────────────────────────────────────────────────────────────────────
    ELSIF v_row.source_table IN ('invoice_items', 'nav_invoice_items') THEN
      v_item_net := NULL;
      v_item_vat := NULL;
      v_item_gross := NULL;
      v_item_vat_rate := NULL;

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
            i.vevo_vat_id,
            ii.net_amount,
            ii.vat_amount,
            ii.gross_amount,
            ii.vat_rate
          INTO 
            v_doc_id,
            v_invoice_direction,
            v_elado_nev,
            v_elado_vat,
            v_vevo_nev,
            v_vevo_vat,
            v_item_net,
            v_item_vat,
            v_item_gross,
            v_item_vat_rate
          FROM public.invoice_items ii
          JOIN public.invoices i ON i.id = ii.invoice_id
          WHERE ii.id = v_row.item_id;
          
          v_final_direction := v_invoice_direction;
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
        DECLARE
          v_nav_direction VARCHAR(32);
          v_supplier_name VARCHAR(255);
          v_customer_name VARCHAR(255);
        BEGIN
          SELECT 
            ni.invoice_number,
            ni.invoice_direction,
            ni.supplier_name,
            ni.customer_name,
            ni.customer_tax_number,
            nii.net_amount,
            nii.vat_amount,
            nii.gross_amount,
            nii.vat_rate
          INTO 
            v_doc_id,
            v_nav_direction,
            v_supplier_name,
            v_customer_name,
            v_partner_tax,
            v_item_net,
            v_item_vat,
            v_item_gross,
            v_item_vat_rate
          FROM public.nav_invoice_items nii
          JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
          WHERE nii.id = v_row.item_id;

          v_final_direction := v_nav_direction;
          v_doc_id := COALESCE(v_doc_id, 'NAV-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
          
          IF v_nav_direction = 'OUTBOUND' THEN
            v_partner_name := v_customer_name;
          ELSE
            v_partner_name := v_supplier_name;
          END IF;
        END;
      END IF;

      -- Robust Partner resolution
      v_partner_id := NULL;
      
      -- 1. Try matching by tax number: exact, or normalized 8-digit törzsszám
      IF v_partner_tax IS NOT NULL AND TRIM(v_partner_tax) <> '' THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND (
             tax_number = v_partner_tax
             OR (
               length(regexp_replace(v_partner_tax, '[^0-9]', '', 'g')) >= 8
               AND length(regexp_replace(tax_number, '[^0-9]', '', 'g')) >= 8
               AND SUBSTRING(regexp_replace(tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_tax, '[^0-9]', '', 'g') FROM 1 FOR 8)
             )
           )
         LIMIT 1;
      END IF;
      
      -- 2. Fallback: match by name (case-insensitive & trimmed)
      IF v_partner_id IS NULL AND v_partner_name IS NOT NULL AND TRIM(v_partner_name) <> '' THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name)) 
         LIMIT 1;
      END IF;

      -- Determine amounts
      v_item_net := COALESCE(v_item_net, v_row.amount);
      v_is_credit := (v_item_net < 0);
      
      v_foreign_net := ROUND(ABS(v_item_net), 2);
      v_huf_net := ROUND(v_foreign_net * v_exchange_rate, 2);

      IF v_item_vat IS NOT NULL AND v_item_vat <> 0 THEN
        v_foreign_vat := ROUND(ABS(v_item_vat), 2);
        v_huf_vat := ROUND(v_foreign_vat * v_exchange_rate, 2);
      ELSE
        v_foreign_vat := 0;
        v_huf_vat := 0;
      END IF;

      v_huf_gross := v_huf_net + v_huf_vat;
      IF v_currency <> 'HUF' THEN
        v_foreign_gross := v_foreign_net + v_foreign_vat;
      ELSE
        v_foreign_gross := NULL;
      END IF;

      -- ────────────────────────────────────────────────────────────────────────
      -- B1: Outbound sales invoice (V napló)
      -- ────────────────────────────────────────────────────────────────────────
      IF v_final_direction = 'OUTBOUND' THEN
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
          COALESCE(v_partner_name, 'Vevő') || ' - ' || COALESCE(v_row.description, 'Értékesítés'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        IF NOT v_is_credit THEN
          -- Normal sales: T Customer 311 (Bruttó), K Revenue (Nettó ALAP), K VAT 467 (AFA)
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
          ) VALUES (
            v_header_id, 1, v_gl_cust_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
          );

          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 2, v_row.gl_account_id, 'K', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_gl_vat_pay_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_gl_vat_pay_id, 'K', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Fizetendő ÁFA'
            );
          END IF;
        ELSE
          -- Credit note sales: T Revenue (Nettó ALAP), T VAT 467 (AFA), K Customer 311 (Bruttó)
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_gl_vat_pay_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_gl_vat_pay_id, 'T', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Fizetendő ÁFA helyesbítés'
            );

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_cust_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_cust_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        END IF;

      -- ────────────────────────────────────────────────────────────────────────
      -- B2: Inbound purchase invoice (SZ napló)
      -- ────────────────────────────────────────────────────────────────────────
      ELSE
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
          COALESCE(v_partner_name, 'Szállító') || ' - ' || COALESCE(v_row.description, 'Költség számla'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
          v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
        ) RETURNING id INTO v_header_id;

        IF NOT v_is_credit THEN
          -- Normal purchase: T Expense (Nettó ALAP), T VAT 466 (AFA), K Supplier 4541 (Bruttó)
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_gl_vat_ded_id, 'T', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA'
            );

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        ELSE
          -- Credit note: T Supplier 4541 (Bruttó), K Expense (Nettó ALAP), K VAT 466 (AFA)
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
          ) VALUES (
            v_header_id, 1, v_gl_supp_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
          );

          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 2, v_row.gl_account_id, 'K', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_gl_vat_ded_id, 'K', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA helyesbítés'
            );
          END IF;
        END IF;
      END IF;

    -- ──────────────────────────────────────────────────────────────────────────
    -- Case C: Generic Vegyes (ONLY for external XML audit imports - journal_entry)
    -- ──────────────────────────────────────────────────────────────────────────
    ELSIF v_row.source_table = 'journal_entry' THEN
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
        COALESCE(v_row.description, 'Vegyes bizonylat'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
      VALUES 
        (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
        (v_header_id, 2, v_gl_supp_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
    ELSE
      -- Any other source table (including internal acc_journal_lines) is strictly ignored
      CONTINUE;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;
