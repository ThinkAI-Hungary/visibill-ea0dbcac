-- Migration: 20260909_sync_vat_deductibility_to_journals_and_gl.sql
-- Description: Synchronize invoice item VAT deductibility (deductible_percentage) with:
-- 1. acc_generate_drafts_from_ledger: non-deductible VAT increases expense, 0% VAT creates 2-legged entry (no 466 line), partial (e.g. 70/30) splits correctly.
-- 2. get_gl_categorized_items: operative invoice item cost amount reflects non-deductible VAT.
-- 3. get_gl_balances: operative invoice item balances reflect non-deductible VAT.
-- 4. sync_item_deductible_to_journal_draft: trigger function on invoice_items and nav_invoice_items to immediately update GEPI_JAVASLAT journal lines upon deductible_percentage change.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RECREATE ACC_GENERATE_DRAFTS_FROM_LEDGER (VAT DEDUCTIBILITY SUPPORT)
-- ─────────────────────────────────────────────────────────────────────────────
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
  
  -- Item level VAT, Gross, and Deductibility
  v_item_net NUMERIC;
  v_item_vat NUMERIC;
  v_item_gross NUMERIC;
  v_item_vat_rate VARCHAR(16);
  v_deductible_pct NUMERIC;
  
  -- Converted HUF amounts for lines
  v_huf_net NUMERIC;
  v_huf_vat NUMERIC;
  v_huf_gross NUMERIC;
  v_huf_vat_deductible NUMERIC;
  v_huf_vat_non_deductible NUMERIC;
  v_huf_expense NUMERIC;
  
  -- Foreign currency amounts for lines
  v_foreign_net NUMERIC;
  v_foreign_vat NUMERIC;
  v_foreign_gross NUMERIC;
  v_foreign_vat_deductible NUMERIC;
  v_foreign_vat_non_deductible NUMERIC;
  v_foreign_expense NUMERIC;
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

    -- Case A: Bank transaction (2-legged double entry)
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
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      END IF;

    -- Case B: Invoices (Double entry with Deductibility Support)
    ELSIF v_row.source_table IN ('invoice_items', 'nav_invoice_items') THEN
      v_item_net := NULL;
      v_item_vat := NULL;
      v_item_gross := NULL;
      v_item_vat_rate := NULL;
      v_deductible_pct := 100.00;

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
            ii.vat_rate,
            COALESCE(ii.deductible_percentage, 100.00)
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
            v_item_vat_rate,
            v_deductible_pct
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
            nii.vat_rate,
            COALESCE(nii.deductible_percentage, 100.00)
          INTO 
            v_doc_id,
            v_nav_direction,
            v_supplier_name,
            v_customer_name,
            v_partner_tax,
            v_item_net,
            v_item_vat,
            v_item_gross,
            v_item_vat_rate,
            v_deductible_pct
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
      
      IF v_partner_id IS NULL AND v_partner_name IS NOT NULL AND TRIM(v_partner_name) <> '' THEN
        SELECT id INTO v_partner_id FROM public.partners 
         WHERE company_id = p_company_id 
           AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name)) 
           AND (
             v_partner_tax IS NULL OR TRIM(v_partner_tax) = ''
             OR tax_number IS NULL OR tax_number LIKE 'FOREIGN:%'
             OR length(regexp_replace(v_partner_tax, '[^0-9]', '', 'g')) < 8
             OR length(regexp_replace(tax_number, '[^0-9]', '', 'g')) < 8
             OR SUBSTRING(regexp_replace(tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_partner_tax, '[^0-9]', '', 'g') FROM 1 FOR 8)
           )
         LIMIT 1;
      END IF;

      -- Determine base amounts
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

      -- Calculate VAT deductibility split for Inbound purchases
      v_deductible_pct := COALESCE(v_deductible_pct, 100.00);
      IF v_final_direction <> 'OUTBOUND' THEN
        v_huf_vat_deductible := ROUND(v_huf_vat * (v_deductible_pct / 100.0), 2);
        v_huf_vat_non_deductible := v_huf_vat - v_huf_vat_deductible;
        v_huf_expense := v_huf_net + v_huf_vat_non_deductible;
        
        IF v_foreign_vat IS NOT NULL AND v_foreign_vat <> 0 THEN
          v_foreign_vat_deductible := ROUND(v_foreign_vat * (v_deductible_pct / 100.0), 2);
          v_foreign_vat_non_deductible := v_foreign_vat - v_foreign_vat_deductible;
          v_foreign_expense := v_foreign_net + v_foreign_vat_non_deductible;
        ELSE
          v_foreign_vat_deductible := 0;
          v_foreign_vat_non_deductible := 0;
          v_foreign_expense := v_foreign_net;
        END IF;
      ELSE
        -- For outbound sales, VAT is always 100% payable
        v_huf_vat_deductible := v_huf_vat;
        v_huf_vat_non_deductible := 0;
        v_huf_expense := v_huf_net;
        v_foreign_vat_deductible := v_foreign_vat;
        v_foreign_vat_non_deductible := 0;
        v_foreign_expense := v_foreign_net;
      END IF;

      -- B1: Outbound sales invoice (V napló)
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

      -- B2: Inbound purchase invoice (SZ napló with Deductibility Support)
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
          -- Normal purchase:
          -- 1. T Expense: Net amount + Non-deductible VAT
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_expense, v_foreign_expense, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          -- 2. T Levonható ÁFA 466 (ONLY if deductible VAT > 0)
          IF v_huf_vat_deductible > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_gl_vat_ded_id, 'T', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA'
            );

            -- 3. K Supplier 4541: Gross amount
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            -- 2-legged entry: T Expense (gross) / K Supplier 4541 (gross)
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        ELSE
          -- Credit note:
          IF v_huf_vat_deductible > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 1, v_gl_supp_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
            ) VALUES (
              v_header_id, 2, v_row.gl_account_id, 'K', v_huf_expense, v_foreign_expense, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
            ) RETURNING id INTO v_base_line_id;

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_gl_vat_ded_id, 'K', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA helyesbítés'
            );
          ELSE
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 1, v_gl_supp_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );

            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
            ) VALUES (
              v_header_id, 2, v_row.gl_account_id, 'K', v_huf_expense, v_foreign_expense, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
            );
          END IF;
        END IF;
      END IF;

    -- Case C: Generic Vegyes
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
      CONTINUE;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RECREATE GET_GL_CATEGORIZED_ITEMS (PRESERVING EXACT SIGNATURE AND PLPGSQL BODY)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  original_amount numeric,
  original_currency text,
  item_date text,
  is_temporary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH debit_map AS MATERIALIZED (
    SELECT je_inner.debit_account, best_debit.id as mapped_id
    FROM (
      SELECT debit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND debit_account IS NOT NULL
      GROUP BY debit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_debit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_debit.id AND ga.preset_id = p_preset_id)))
      OR best_debit.id = p_gl_account_id
    )
  ),
  credit_map AS MATERIALIZED (
    SELECT je_inner.credit_account, best_credit.id as mapped_id
    FROM (
      SELECT credit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND credit_account IS NOT NULL
      GROUP BY credit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_credit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_credit.id AND ga.preset_id = p_preset_id)))
      OR best_credit.id = p_gl_account_id
    )
  ),
  raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id AS item_id,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'transactions'::text AS source_table,
      'Banki tranzakció'::text AS item_type,
      NULL::text AS partner,
      t.description::text AS description,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      t.amount::numeric AS original_amount,
      COALESCE(t.currency, 'HUF')::text AS original_currency,
      t.transaction_date::text AS item_date,
      false AS is_temporary
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END AS item_date,
      false AS is_temporary
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND i.statusz != 'jovahagyasra_var'
      AND (i.nav_status IS NULL OR i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN debit_map dm ON je.debit_account = dm.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      -je.amount AS amount,
      -je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN credit_map dm ON je.credit_account = dm.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.credit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines - KONYVELT)
    SELECT
      l.id AS item_id,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      'acc_journal_lines'::text AS source_table,
      CASE
        WHEN h.entry_type = 'OPENING' OR j.code = 'NY' THEN 'Nyitó tétel'
        WHEN h.entry_type = 'CLOSING' OR j.code = 'Z' THEN 'Záró tétel'
        WHEN j.code = 'VE' THEN 'Vegyes napló tétel'
        WHEN l.dc_type = 'T' THEN 'Könyvelt napló tétel (T)'
        ELSE 'Könyvelt napló tétel (K)'
      END::text AS item_type,
      p.name::text AS partner,
      COALESCE(l.description, h.description, h.document_id)::text AS description,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      (CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, l.amount) ELSE -COALESCE(l.foreign_amount, l.amount) END)::numeric AS original_amount,
      COALESCE(h.currency, 'HUF')::text AS original_currency,
      CASE
        WHEN p_date_basis = 'teljesites' THEN COALESCE(h.posting_date, h.document_date)::text
        ELSE COALESCE(h.document_date, h.posting_date)::text
      END AS item_date,
      false AS is_temporary
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN public.partners p ON h.partner_id = p.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status = 'KONYVELT'
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR COALESCE(CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END, best_active.id, g.id) = p_gl_account_id
      )
  )
  SELECT
    r.item_id,
    r.mapped_id AS gl_account_id,
    r.source_table,
    r.item_type,
    r.partner,
    r.description,
    r.amount,
    r.original_amount,
    r.original_currency,
    r.item_date,
    r.is_temporary
  FROM raw_items r
  ORDER BY r.item_date DESC, r.item_id ASC
  LIMIT p_limit
  OFFSET COALESCE(p_offset, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RECREATE GET_GL_BALANCES (PRESERVING EXACT SIGNATURE AND PLPGSQL BODY)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_posting_status text DEFAULT 'ALL'::text,
  p_date_basis text DEFAULT 'kibocsatas'::text
)
RETURNS TABLE(
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric,
  final_balance numeric,
  temp_balance numeric,
  item_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ii.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ni.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      SUM(je.amount) AS amount,
      best_debit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.debit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.debit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.debit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    GROUP BY best_debit.id

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      -SUM(je.amount) AS amount,
      best_credit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.credit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.credit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.credit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    GROUP BY best_credit.id

    UNION ALL

    -- ⑥ FX differences (Árfolyamkülönbözet)
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      best_fx.id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.get_fx_differences(p_company_id, p_date_from, p_date_to) fd
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE
            (CASE WHEN fd.fx_difference >= 0
              THEN COALESCE((SELECT fxs.fx_gain_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '976')
              ELSE COALESCE((SELECT fxs.fx_loss_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '876')
            END) || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_fx ON true
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'

    UNION ALL

    -- ⑦ Internal accounting journals (acc_journal_lines - KONYVELT)
    SELECT
      l.id AS item_id,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status = 'KONYVELT'
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
  ),
  aggregated_by_mapped_id AS (
    SELECT 
      r.mapped_id, 
      SUM(r.amount) AS total_balance,
      SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END) AS final_balance,
      SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END) AS temp_balance,
      SUM(r.sub_count)::bigint AS item_count
    FROM raw_items r
    GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance,
      COALESCE(a.final_balance, 0)::numeric AS final_balance,
      COALESCE(a.temp_balance, 0)::numeric AS temp_balance,
      COALESCE(a.item_count, 0)::bigint AS item_count
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT 
      SUM(a.total_balance) AS orphan_balance,
      SUM(a.final_balance) AS orphan_final_balance,
      SUM(a.temp_balance) AS orphan_temp_balance,
      SUM(a.item_count) AS orphan_item_count
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g 
           ON a.mapped_id = check_g.id 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT 
    res.gl_account_id, 
    res.gl_number, 
    res.short_name, 
    res.total_balance,
    res.final_balance,
    res.temp_balance,
    res.item_count
  FROM (
    SELECT 
      m.gl_account_id, 
      m.gl_number, 
      m.short_name, 
      m.total_balance,
      m.final_balance,
      m.temp_balance,
      m.item_count
    FROM mapped_to_active m

    UNION ALL

    SELECT
      NULL::uuid AS gl_account_id,
      'UNCLASSIFIED'::text AS gl_number,
      'Besorolatlan tételek'::text AS short_name,
      COALESCE((SELECT orphan_balance FROM orphan_sum), 0)::numeric AS total_balance,
      COALESCE((SELECT orphan_final_balance FROM orphan_sum), 0)::numeric AS final_balance,
      COALESCE((SELECT orphan_temp_balance FROM orphan_sum), 0)::numeric AS temp_balance,
      COALESCE((SELECT orphan_item_count FROM orphan_sum), 0)::bigint AS item_count
    WHERE COALESCE((SELECT orphan_item_count FROM orphan_sum), 0) > 0
  ) res
  ORDER BY 
    CASE WHEN res.gl_number = 'UNCLASSIFIED' THEN 1 ELSE 0 END,
    res.gl_number ASC;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REAL-TIME TRIGGER FUNCTION: SYNC DEDUCTIBILITY TO DRAFT JOURNAL ENTRIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_item_deductible_to_journal_draft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_gl_supp_id UUID;
  v_gl_vat_ded_id UUID;
  v_exp_gl_id UUID;
  v_vat_rate VARCHAR(16);
  v_currency CHAR(3);
  v_exchange_rate NUMERIC(12,6);
  v_item_net NUMERIC;
  v_item_vat NUMERIC;
  v_item_gross NUMERIC;
  v_deductible_pct NUMERIC;
  v_huf_net NUMERIC;
  v_huf_vat NUMERIC;
  v_huf_gross NUMERIC;
  v_foreign_net NUMERIC;
  v_foreign_vat NUMERIC;
  v_foreign_gross NUMERIC;
  v_huf_vat_deductible NUMERIC;
  v_huf_vat_non_deductible NUMERIC;
  v_huf_expense NUMERIC;
  v_foreign_vat_deductible NUMERIC;
  v_foreign_vat_non_deductible NUMERIC;
  v_foreign_expense NUMERIC;
  v_base_line_id UUID;
  v_desc TEXT;
BEGIN
  -- Only process if deductible_percentage, net_amount, or vat_amount has actually changed
  IF OLD.deductible_percentage IS NOT DISTINCT FROM NEW.deductible_percentage
     AND OLD.net_amount IS NOT DISTINCT FROM NEW.net_amount
     AND OLD.vat_amount IS NOT DISTINCT FROM NEW.vat_amount THEN
    RETURN NEW;
  END IF;

  -- Find any unposted GEPI_JAVASLAT journal entry matching this item
  FOR v_header IN
    SELECT h.id, h.company_id, h.currency, h.exchange_rate, h.description
      FROM public.acc_journal_headers h
     WHERE h.import_key = NEW.id::text
       AND h.status = 'GEPI_JAVASLAT'
  LOOP
    -- Get expense GL account from the existing line 1 or ALAP line
    SELECT l.gl_account_id, l.vat_code, l.description
      INTO v_exp_gl_id, v_vat_rate, v_desc
      FROM public.acc_journal_lines l
     WHERE l.header_id = v_header.id
       AND l.vat_role = 'ALAP'
     ORDER BY l.sequence_number
     LIMIT 1;

    -- If no ALAP line found, try the first non-supplier and non-vat line
    IF v_exp_gl_id IS NULL THEN
      SELECT l.gl_account_id, l.vat_code, l.description
        INTO v_exp_gl_id, v_vat_rate, v_desc
        FROM public.acc_journal_lines l
        JOIN public.gl_accounts ga ON ga.id = l.gl_account_id
       WHERE l.header_id = v_header.id
         AND ga.gl_number NOT LIKE '454%'
         AND ga.gl_number NOT LIKE '466%'
       ORDER BY l.sequence_number
       LIMIT 1;
    END IF;

    IF v_exp_gl_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Resolve supplier and VAT accounts for the company
    SELECT id INTO v_gl_supp_id 
      FROM public.gl_accounts 
     WHERE (company_id = v_header.company_id OR preset_id = 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid) 
       AND (gl_number = '4541' OR gl_number LIKE '454%') 
     ORDER BY (gl_number = '4541') DESC, gl_number LIMIT 1;

    SELECT id INTO v_gl_vat_ded_id 
      FROM public.gl_accounts 
     WHERE (company_id = v_header.company_id OR preset_id = 'a6c46c77-52b7-499e-bb12-419aa94349af'::uuid) 
       AND gl_number LIKE '466%' 
     ORDER BY gl_number LIMIT 1;

    -- Calculate amounts
    v_exchange_rate := COALESCE(v_header.exchange_rate, 1.0);
    v_currency := COALESCE(v_header.currency, 'HUF');
    v_item_net := COALESCE(NEW.net_amount, 0);
    v_item_vat := COALESCE(NEW.vat_amount, 0);
    v_deductible_pct := COALESCE(NEW.deductible_percentage, 100.00);

    v_foreign_net := ROUND(ABS(v_item_net), 2);
    v_huf_net := ROUND(v_foreign_net * v_exchange_rate, 2);

    v_foreign_vat := ROUND(ABS(v_item_vat), 2);
    v_huf_vat := ROUND(v_foreign_vat * v_exchange_rate, 2);

    v_huf_vat_deductible := ROUND(v_huf_vat * (v_deductible_pct / 100.0), 2);
    v_huf_vat_non_deductible := v_huf_vat - v_huf_vat_deductible;
    v_huf_expense := v_huf_net + v_huf_vat_non_deductible;

    IF v_currency <> 'HUF' THEN
      v_foreign_vat_deductible := ROUND(v_foreign_vat * (v_deductible_pct / 100.0), 2);
      v_foreign_vat_non_deductible := v_foreign_vat - v_foreign_vat_deductible;
      v_foreign_expense := v_foreign_net + v_foreign_vat_non_deductible;
      v_foreign_gross := v_foreign_net + v_foreign_vat;
    ELSE
      v_foreign_vat_deductible := NULL;
      v_foreign_vat_non_deductible := NULL;
      v_foreign_expense := NULL;
      v_foreign_gross := NULL;
    END IF;
    v_huf_gross := v_huf_net + v_huf_vat;

    -- Replace lines for this draft entry
    DELETE FROM public.acc_journal_lines WHERE header_id = v_header.id;

    IF v_item_net >= 0 THEN
      -- Normal purchase
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
      ) VALUES (
        v_header.id, 1, v_exp_gl_id, 'T', v_huf_expense, v_foreign_expense, SUBSTRING(v_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_desc, '')
      ) RETURNING id INTO v_base_line_id;

      IF v_huf_vat_deductible > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
        INSERT INTO public.acc_journal_lines (
          header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
        ) VALUES (
          v_header.id, 2, v_gl_vat_ded_id, 'T', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA'
        );

        INSERT INTO public.acc_journal_lines (
          header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
        ) VALUES (
          v_header.id, 3, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_desc, '')
        );
      ELSE
        INSERT INTO public.acc_journal_lines (
          header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
        ) VALUES (
          v_header.id, 2, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_desc, '')
        );
      END IF;
    ELSE
      -- Credit note
      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
      ) VALUES (
        v_header.id, 1, v_gl_supp_id, 'T', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_desc, '')
      );

      INSERT INTO public.acc_journal_lines (
        header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
      ) VALUES (
        v_header.id, 2, v_exp_gl_id, 'K', v_huf_expense, v_foreign_expense, SUBSTRING(v_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_desc, '')
      ) RETURNING id INTO v_base_line_id;

      IF v_huf_vat_deductible > 0 AND v_gl_vat_ded_id IS NOT NULL THEN
        INSERT INTO public.acc_journal_lines (
          header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
        ) VALUES (
          v_header.id, 3, v_gl_vat_ded_id, 'K', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, 'Levonható ÁFA helyesbítés'
        );
      END IF;
    END IF;

  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.sync_item_deductible_to_journal_draft() FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_item_deductible_to_journal_draft() TO authenticated, service_role;

-- Attach triggers to invoice_items and nav_invoice_items
DROP TRIGGER IF EXISTS trg_sync_invoice_item_deductible_to_journal ON public.invoice_items;
CREATE TRIGGER trg_sync_invoice_item_deductible_to_journal
  AFTER UPDATE OF deductible_percentage, net_amount, vat_amount ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_deductible_to_journal_draft();

DROP TRIGGER IF EXISTS trg_sync_nav_invoice_item_deductible_to_journal ON public.nav_invoice_items;
CREATE TRIGGER trg_sync_nav_invoice_item_deductible_to_journal
  AFTER UPDATE OF deductible_percentage, net_amount, vat_amount ON public.nav_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_item_deductible_to_journal_draft();
