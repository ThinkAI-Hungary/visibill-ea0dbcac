-- ==============================================================================
-- Migration: 20260911140000_chronological_acc_drafts_ordering.sql
-- Description:
--   Ensure acc_generate_drafts_from_ledger generates journal entries in strict
--   chronological ascending order (item_date ASC) and preserves original
--   bank statement line order (sub.transaction_date ASC, sub.created_at ASC).
--   This aligns draft journal entry sequence with bank statements line-by-line.
-- ==============================================================================

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
  v_journal_ve_id UUID;
  v_header_id UUID;
  v_ve_header_id UUID;
  v_base_line_id UUID;
  v_gl_bank_id UUID;
  v_gl_cash_id UUID;
  v_gl_cust_id UUID;
  v_gl_supp_id UUID;
  v_gl_vat_ded_id UUID;
  v_gl_vat_pay_id UUID;
  v_gl_pf_pay_id UUID; -- 47993 Pénzforgalmi ÁFA kötelezettség
  v_gl_pf_ded_id UUID; -- 3689 Pénzforgalmi levonható ÁFA
  v_count INTEGER := 0;
  v_date DATE;
  v_amount NUMERIC;
  v_amount_foreign NUMERIC;
  v_currency CHAR(3);
  v_exchange_rate NUMERIC(12,6);
  v_exchange_rate_date DATE;
  
  -- Company VAT regime
  v_company_vat_regime TEXT := 'normal';
  v_is_penzforgalmi BOOLEAN := false;

  -- Local variables for resolved details
  v_doc_id VARCHAR(64);
  v_partner_id UUID;
  v_partner_name TEXT;
  v_partner_tax VARCHAR(32);
  v_gl_cls JSONB;
  v_final_direction VARCHAR(32);
  v_is_credit BOOLEAN;
  v_payment_method VARCHAR(32);
  v_is_cash_accounting BOOLEAN;
  v_transaction_id UUID;
  v_manual_payment_date DATE;
  v_is_paid BOOLEAN;
  
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

  -- Selected VAT account for the draft entry
  v_selected_vat_gl_id UUID;
  v_selected_vat_role_desc TEXT;

  -- Matched invoice details for Bank reclassification entry
  v_matched_inv RECORD;
  v_matched_tr RECORD;
BEGIN
  -- 1. Delete existing system suggestions to allow clean refresh
  DELETE FROM public.acc_journal_headers 
   WHERE company_id = p_company_id 
     AND status = 'GEPI_JAVASLAT';

  -- 2. Ensure default journals are seeded
  PERFORM public.acc_seed_default_journals(p_company_id);

  -- 2.1 Lookup company VAT regime
  SELECT COALESCE(c.vat_regime, 'normal') INTO v_company_vat_regime
  FROM public.companies c WHERE c.id = p_company_id;
  v_is_penzforgalmi := (v_company_vat_regime = 'penzforgalmi');

  -- 2.2 Resolve Vegyes (VE) journal
  SELECT id INTO v_journal_ve_id 
    FROM public.acc_journals 
   WHERE company_id = p_company_id AND code = 'VE' 
   LIMIT 1;

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

  -- 5.1 Resolve Pénzforgalmi VAT accounts (47993 Fizetendő, 3689 Levonható)
  SELECT id INTO v_gl_pf_pay_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '47993' OR gl_number LIKE '4799%') 
   ORDER BY (gl_number = '47993') DESC, gl_number LIMIT 1;

  IF v_gl_pf_pay_id IS NULL THEN
    SELECT id INTO v_gl_pf_pay_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '47993' OR gl_number LIKE '4799%') 
     ORDER BY (gl_number = '47993') DESC, gl_number LIMIT 1;
  END IF;

  IF v_gl_pf_pay_id IS NULL THEN
    v_gl_pf_pay_id := v_gl_vat_pay_id;
  END IF;

  SELECT id INTO v_gl_pf_ded_id 
    FROM public.gl_accounts 
   WHERE preset_id = p_preset_id AND (gl_number = '3689' OR gl_number LIKE '368%') 
   ORDER BY (gl_number = '3689') DESC, gl_number LIMIT 1;

  IF v_gl_pf_ded_id IS NULL THEN
    SELECT id INTO v_gl_pf_ded_id 
      FROM public.gl_accounts 
     WHERE company_id = p_company_id AND (gl_number = '3689' OR gl_number LIKE '368%') 
     ORDER BY (gl_number = '3689') DESC, gl_number LIMIT 1;
  END IF;

  IF v_gl_pf_ded_id IS NULL THEN
    v_gl_pf_ded_id := v_gl_vat_ded_id;
  END IF;

  -- 6. Loop over operative items from GL categorized items
  FOR v_row IN 
      SELECT * FROM public.get_gl_categorized_items(p_company_id, p_preset_id, null, null)
       WHERE gl_account_id IS NOT NULL 
         AND gl_account_id <> '00000000-0000-0000-0000-000000000000'::uuid
         AND amount IS NOT NULL 
         AND amount <> 0
         AND source_table IN ('transactions', 'invoice_items', 'nav_invoice_items', 'journal_entry')
       ORDER BY item_date ASC, item_id ASC
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

    -- Case A: Bank transaction (2-legged double entry in B1/B2, + Pénzforgalmi ÁFA átvezetés ha párosított)
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

      -- Check if this transaction settles a cash-basis transfer invoice -> generate secondary ÁFA reclassification in VE
      FOR v_matched_inv IN
        SELECT ni.id, ni.invoice_number, ni.invoice_direction, ni.is_cash_accounting, 
               COALESCE(ni.invoice_vat_amount, 0) as vat_amount, ni.payment_method
          FROM public.nav_invoices ni
         WHERE ni.company_id = p_company_id 
           AND (ni.transaction_id = v_row.item_id OR ni.id = (SELECT matched_invoice_id FROM public.transactions WHERE id = v_row.item_id)
                OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = v_row.item_id AND tim.invoice_id = ni.id))
        UNION
        SELECT inv.id, inv.bizonylatsorszam AS invoice_number, inv.invoice_direction, inv.penzforgalmi_elszamolas AS is_cash_accounting,
               COALESCE(inv.afa_osszeg_osszesen, 0) as vat_amount, inv.fizetesi_mod AS payment_method
          FROM public.invoices inv
         WHERE inv.company_id = p_company_id
           AND (inv.transaction_id = v_row.item_id OR inv.id = (SELECT matched_invoice_id FROM public.transactions WHERE id = v_row.item_id)
                OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = v_row.item_id AND tim.invoice_id = inv.id))
      LOOP
        IF v_matched_inv.id IS NOT NULL AND v_matched_inv.vat_amount > 0 AND COALESCE(v_matched_inv.payment_method, '') <> 'CASH' AND v_journal_ve_id IS NOT NULL THEN
          -- Case A.1: Outbound invoice customer payment -> Reclassify 47993 to 467
          IF v_matched_inv.invoice_direction = 'OUTBOUND' AND v_is_penzforgalmi THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.acc_journal_headers
               WHERE company_id = p_company_id 
                 AND import_key = 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
            ) THEN
              INSERT INTO public.acc_journal_headers (
                company_id, journal_id, accounting_year, status, entry_type, source,
                posting_date, document_date, document_id, partner_id,
                description, currency, exchange_rate, exchange_rate_date, import_key
              ) VALUES (
                p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
                v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_inv.id::text FROM 1 FOR 4)), NULL,
                'Pénzforgalmi ÁFA átvezetés (47993->467) - ' || COALESCE(v_matched_inv.invoice_number, ''),
                'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
              ) RETURNING id INTO v_ve_header_id;

              INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
              VALUES 
                (v_ve_header_id, 1, v_gl_pf_pay_id, 'T', v_matched_inv.vat_amount, 'Pénzforgalmi ÁFA kötelezettség kivezetése'),
                (v_ve_header_id, 2, v_gl_vat_pay_id, 'K', v_matched_inv.vat_amount, 'Fizetendő ÁFA előírása');
            END IF;

          -- Case A.2: Inbound invoice supplier payment -> Reclassify 3689 to 466
          ELSIF v_matched_inv.invoice_direction = 'INBOUND' AND (v_is_penzforgalmi OR COALESCE(v_matched_inv.is_cash_accounting, false) = true) THEN
            IF NOT EXISTS (
              SELECT 1 FROM public.acc_journal_headers
               WHERE company_id = p_company_id 
                 AND import_key = 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
            ) THEN
              INSERT INTO public.acc_journal_headers (
                company_id, journal_id, accounting_year, status, entry_type, source,
                posting_date, document_date, document_id, partner_id,
                description, currency, exchange_rate, exchange_rate_date, import_key
              ) VALUES (
                p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
                v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_inv.id::text FROM 1 FOR 4)), NULL,
                'Pénzforgalmi ÁFA átvezetés (466->3689) - ' || COALESCE(v_matched_inv.invoice_number, ''),
                'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_row.item_id::text || '-' || v_matched_inv.id::text
              ) RETURNING id INTO v_ve_header_id;

              INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
              VALUES 
                (v_ve_header_id, 1, v_gl_vat_ded_id, 'T', v_matched_inv.vat_amount, 'Levonható ÁFA előírása'),
                (v_ve_header_id, 2, v_gl_pf_ded_id, 'K', v_matched_inv.vat_amount, 'Pénzforgalmi levonható ÁFA kivezetése');
            END IF;
          END IF;
        END IF;
      END LOOP;

    -- Case B: Invoices (Double entry with Deductibility and Cash-Basis Support)
    ELSIF v_row.source_table IN ('invoice_items', 'nav_invoice_items') THEN
      v_item_net := NULL;
      v_item_vat := NULL;
      v_item_gross := NULL;
      v_item_vat_rate := NULL;
      v_deductible_pct := 100.00;
      v_payment_method := 'TRANSFER';
      v_is_cash_accounting := false;
      v_transaction_id := NULL;
      v_manual_payment_date := NULL;

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
            COALESCE(ii.deductible_percentage, 100.00),
            COALESCE(i.fizetesi_mod, 'TRANSFER'),
            COALESCE(i.penzforgalmi_elszamolas, false),
            i.transaction_id,
            i.manual_payment_date
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
            v_deductible_pct,
            v_payment_method,
            v_is_cash_accounting,
            v_transaction_id,
            v_manual_payment_date
          FROM public.invoice_items ii
          JOIN public.invoices i ON i.id = ii.invoice_id
          WHERE ii.id = v_row.item_id;

          v_final_direction := v_invoice_direction;
          v_doc_id := COALESCE(v_doc_id, 'SZ-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8)));
          
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
            CASE WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_tax_number ELSE ni.supplier_tax_number END,
            nii.net_amount,
            nii.vat_amount,
            nii.gross_amount,
            nii.vat_rate,
            COALESCE(nii.deductible_percentage, 100.00),
            COALESCE(ni.payment_method, 'TRANSFER'),
            COALESCE(ni.is_cash_accounting, false),
            ni.transaction_id,
            ni.manual_payment_date
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
            v_deductible_pct,
            v_payment_method,
            v_is_cash_accounting,
            v_transaction_id,
            v_manual_payment_date
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

      -- Check if invoice is paid
      v_is_paid := (COALESCE(v_payment_method, '') = 'CASH' OR v_transaction_id IS NOT NULL OR v_manual_payment_date IS NOT NULL);

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
        -- For outbound sales, VAT is 100%
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

        -- Resolve VAT account: if cash-basis and unpaid transfer, use 47993
        IF v_is_penzforgalmi AND COALESCE(v_payment_method, '') <> 'CASH' AND NOT v_is_paid THEN
          v_selected_vat_gl_id := v_gl_pf_pay_id;
          v_selected_vat_role_desc := 'Pénzforgalmi ÁFA kötelezettség';
        ELSE
          v_selected_vat_gl_id := v_gl_vat_pay_id;
          v_selected_vat_role_desc := 'Fizetendő ÁFA';
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

          IF v_huf_vat > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_selected_vat_gl_id, 'K', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc
            );
          END IF;
        ELSE
          INSERT INTO public.acc_journal_lines (
            header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, description
          ) VALUES (
            v_header_id, 1, v_row.gl_account_id, 'T', v_huf_net, v_foreign_net, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'ALAP', COALESCE(v_row.description, '')
          ) RETURNING id INTO v_base_line_id;

          IF v_huf_vat > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_selected_vat_gl_id, 'T', v_huf_vat, v_foreign_vat, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc || ' helyesbítés'
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

      -- B2: Inbound purchase invoice (SZ napló with Deductibility and Cash-Basis Support)
      ELSE
        IF v_gl_supp_id IS NULL OR v_row.gl_account_id IS NULL THEN
          CONTINUE;
        END IF;

        -- Resolve VAT account: if cash-basis (company or supplier) and unpaid transfer, use 3689
        IF (v_is_penzforgalmi OR COALESCE(v_is_cash_accounting, false) = true) AND COALESCE(v_payment_method, '') <> 'CASH' AND NOT v_is_paid THEN
          v_selected_vat_gl_id := v_gl_pf_ded_id;
          v_selected_vat_role_desc := 'Pénzforgalmi levonható ÁFA';
        ELSE
          v_selected_vat_gl_id := v_gl_vat_ded_id;
          v_selected_vat_role_desc := 'Levonható ÁFA';
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

          -- 2. T Levonható ÁFA (ONLY if deductible VAT > 0)
          IF v_huf_vat_deductible > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 2, v_selected_vat_gl_id, 'T', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc
            );

            -- 3. K Supplier: Gross amount
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 3, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          ELSE
            -- 0% VAT or non-deductible: 2-legged entry
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_role, description
            ) VALUES (
              v_header_id, 2, v_gl_supp_id, 'K', v_huf_gross, v_foreign_gross, 'NONE', COALESCE(v_row.description, '')
            );
          END IF;
        ELSE
          -- Credit note / Storno purchase:
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

          IF v_huf_vat_deductible > 0 AND v_selected_vat_gl_id IS NOT NULL THEN
            INSERT INTO public.acc_journal_lines (
              header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, vat_code, vat_role, parent_line_id, description
            ) VALUES (
              v_header_id, 3, v_selected_vat_gl_id, 'K', v_huf_vat_deductible, v_foreign_vat_deductible, SUBSTRING(v_item_vat_rate FROM 1 FOR 16), 'AFA', v_base_line_id, v_selected_vat_role_desc || ' helyesbítés'
            );
          END IF;
        END IF;
      END IF;

    -- Case C: External Audit Journal Entry (Vegyes napló)
    ELSIF v_row.source_table = 'journal_entry' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'VE' LIMIT 1;
      IF v_journal_id IS NULL THEN SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id LIMIT 1; END IF;
      
      v_doc_id := 'VE-' || UPPER(SUBSTRING(v_row.item_id::text FROM 1 FOR 8));
      
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key,
        ai_recommendation, confidence
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_VEGYES',
        v_date, v_date, v_doc_id, NULL,
        COALESCE(v_row.description, 'Vegyes könyvelési tétel'), v_currency, v_exchange_rate, v_exchange_rate_date, v_row.item_id::text,
        v_gl_cls, (v_gl_cls ->> 'confidence_score')::numeric
      ) RETURNING id INTO v_header_id;

      IF v_row.amount >= 0 THEN
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'T', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      ELSE
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount, description)
        VALUES 
          (v_header_id, 1, v_row.gl_account_id, 'K', v_amount, v_amount_foreign, COALESCE(v_row.description, ''));
      END IF;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  -- 7. Loop over MATCHED bank transactions to book Bank settlements and Pénzforgalmi ÁFA reclassifications
  FOR v_matched_tr IN
    WITH all_matches AS (
      -- 1. Direct matched_invoice_id or nav_invoices.transaction_id
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.created_at,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        ni.id AS invoice_id,
        ni.invoice_number,
        ni.invoice_direction,
        COALESCE(ni.is_cash_accounting, false) AS is_cash_accounting,
        COALESCE(ni.payment_method, 'TRANSFER') AS payment_method,
        COALESCE(ni.invoice_vat_amount, 0) AS vat_amount,
        ni.customer_name,
        ni.customer_tax_number AS customer_tax,
        ni.supplier_name,
        ni.supplier_tax_number AS supplier_tax
      FROM public.transactions t
      JOIN public.nav_invoices ni ON ni.company_id = p_company_id AND (ni.transaction_id = t.id OR ni.id = t.matched_invoice_id)
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0

      UNION

      -- 2. Direct submitted invoices (invoices table)
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.created_at,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        inv.id AS invoice_id,
        inv.bizonylatsorszam AS invoice_number,
        inv.invoice_direction,
        COALESCE(inv.penzforgalmi_elszamolas, false) AS is_cash_accounting,
        COALESCE(inv.fizetesi_mod, 'TRANSFER') AS payment_method,
        COALESCE(inv.afa_osszeg_osszesen, 0) AS vat_amount,
        inv.vevo_nev AS customer_name,
        inv.vevo_vat_id AS customer_tax,
        inv.elado_nev AS supplier_name,
        inv.elado_vat_id AS supplier_tax
      FROM public.transactions t
      JOIN public.invoices inv ON inv.company_id = p_company_id AND (inv.transaction_id = t.id OR inv.id = t.matched_invoice_id)
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0

      UNION

      -- 3. Matches via transaction_invoice_matches (multi-match table)
      SELECT 
        t.id AS transaction_id,
        t.transaction_date,
        t.created_at,
        t.description,
        t.amount,
        COALESCE(t.currency, 'HUF') AS currency,
        COALESCE(ni.id, inv.id) AS invoice_id,
        COALESCE(ni.invoice_number, inv.bizonylatsorszam) AS invoice_number,
        COALESCE(ni.invoice_direction, inv.invoice_direction) AS invoice_direction,
        COALESCE(ni.is_cash_accounting, inv.penzforgalmi_elszamolas, false) AS is_cash_accounting,
        COALESCE(ni.payment_method, inv.fizetesi_mod, 'TRANSFER') AS payment_method,
        COALESCE(ni.invoice_vat_amount, inv.afa_osszeg_osszesen, 0) AS vat_amount,
        COALESCE(ni.customer_name, inv.vevo_nev) AS customer_name,
        COALESCE(ni.customer_tax_number, inv.vevo_vat_id) AS customer_tax,
        COALESCE(ni.supplier_name, inv.elado_nev) AS supplier_name,
        COALESCE(ni.supplier_tax_number, inv.elado_vat_id) AS supplier_tax
      FROM public.transactions t
      JOIN public.transaction_invoice_matches tim ON tim.transaction_id = t.id
      LEFT JOIN public.nav_invoices ni ON ni.id = tim.invoice_id AND tim.invoice_source = 'nav'
      LEFT JOIN public.invoices inv ON inv.id = tim.invoice_id AND tim.invoice_source = 'submitted'
      WHERE t.company_id = p_company_id
        AND t.amount IS NOT NULL AND t.amount <> 0
        AND (ni.id IS NOT NULL OR inv.id IS NOT NULL)
    )
    SELECT * FROM (
      SELECT DISTINCT ON (transaction_id, invoice_id) *
      FROM all_matches
      ORDER BY transaction_id, invoice_id
    ) sub
    ORDER BY sub.transaction_date ASC, sub.created_at ASC, sub.transaction_id ASC
  LOOP
    v_date := COALESCE(v_matched_tr.transaction_date::date, CURRENT_DATE);
    v_currency := COALESCE(v_matched_tr.currency, 'HUF');
    v_amount := ROUND(ABS(v_matched_tr.amount), 2);
    
    -- Resolve Bank Journal
    IF v_currency = 'HUF' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B1' LIMIT 1;
    ELSIF v_currency = 'EUR' THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND code = 'B2' LIMIT 1;
    ELSE
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND type = 'BANK' AND currency = v_currency LIMIT 1;
    END IF;
    IF v_journal_id IS NULL THEN
      SELECT id INTO v_journal_id FROM public.acc_journals WHERE company_id = p_company_id AND type = 'BANK' LIMIT 1;
    END IF;

    -- Resolve Bank GL Account (384 for HUF, 386 for FX)
    IF v_currency = 'HUF' THEN
      SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '384%' ORDER BY gl_number LIMIT 1;
    ELSE
      SELECT id INTO v_gl_bank_id FROM public.gl_accounts WHERE (preset_id = p_preset_id OR company_id = p_company_id) AND gl_number LIKE '386%' ORDER BY gl_number LIMIT 1;
    END IF;

    v_doc_id := 'TR-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 8));

    -- Resolve Partner
    v_partner_id := NULL;
    IF v_matched_tr.invoice_direction = 'OUTBOUND' THEN
      v_partner_name := v_matched_tr.customer_name;
      v_partner_tax := v_matched_tr.customer_tax;
    ELSE
      v_partner_name := v_matched_tr.supplier_name;
      v_partner_tax := v_matched_tr.supplier_tax;
    END IF;

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
       WHERE company_id = p_company_id AND LOWER(TRIM(name)) = LOWER(TRIM(v_partner_name))
       LIMIT 1;
    END IF;

    -- 1. Insert Bank Journal Entry ONCE per transaction_id
    IF NOT EXISTS (
      SELECT 1 FROM public.acc_journal_headers 
       WHERE company_id = p_company_id AND import_key = v_matched_tr.transaction_id::text
    ) THEN
      INSERT INTO public.acc_journal_headers (
        company_id, journal_id, accounting_year, status, entry_type, source,
        posting_date, document_date, document_id, partner_id,
        description, currency, exchange_rate, exchange_rate_date, import_key
      ) VALUES (
        p_company_id, v_journal_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_BANK',
        v_date, v_date, v_doc_id, v_partner_id,
        COALESCE(v_matched_tr.description, 'Banki kiegyenlítés - ' || COALESCE(v_matched_tr.invoice_number, '')),
        v_currency, 1.0, v_date, v_matched_tr.transaction_id::text
      ) RETURNING id INTO v_header_id;

      IF v_matched_tr.amount >= 0 THEN
        -- Inflow: Customer Payment (T 384 Bank - K 311 Vevő)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_bank_id, 'T', v_amount, COALESCE(v_matched_tr.description, 'Bank jóváírás')),
          (v_header_id, 2, v_gl_cust_id, 'K', v_amount, 'Vevő követelés kiegyenlítése - ' || COALESCE(v_matched_tr.invoice_number, ''));
      ELSE
        -- Outflow: Supplier Payment (T 454 Szállító - K 384 Bank)
        INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
        VALUES 
          (v_header_id, 1, v_gl_supp_id, 'T', v_amount, 'Szállító tartozás kiegyenlítése - ' || COALESCE(v_matched_tr.invoice_number, '')),
          (v_header_id, 2, v_gl_bank_id, 'K', v_amount, COALESCE(v_matched_tr.description, 'Bank terhelés'));
      END IF;

      v_count := v_count + 1;
    END IF;

    -- 2. Pénzforgalmi ÁFA átvezetés Vegyes naplóban (VE) for each settled invoice
    IF v_matched_tr.invoice_id IS NOT NULL 
       AND v_matched_tr.vat_amount > 0 
       AND COALESCE(v_matched_tr.payment_method, '') <> 'CASH' 
       AND v_journal_ve_id IS NOT NULL 
    THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers
         WHERE company_id = p_company_id 
           AND import_key = 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
      ) THEN
        -- Case A: Outbound invoice customer payment -> Reclassify 47993 to 467
        IF v_matched_tr.invoice_direction = 'OUTBOUND' AND v_is_penzforgalmi THEN
          INSERT INTO public.acc_journal_headers (
            company_id, journal_id, accounting_year, status, entry_type, source,
            posting_date, document_date, document_id, partner_id,
            description, currency, exchange_rate, exchange_rate_date, import_key
          ) VALUES (
            p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
            v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_tr.invoice_id::text FROM 1 FOR 4)), v_partner_id,
            'Pénzforgalmi ÁFA átvezetés (47993->467) - ' || COALESCE(v_matched_tr.invoice_number, ''),
            'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
          ) RETURNING id INTO v_ve_header_id;

          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES 
            (v_ve_header_id, 1, v_gl_pf_pay_id, 'T', v_matched_tr.vat_amount, 'Pénzforgalmi ÁFA kötelezettség kivezetése'),
            (v_ve_header_id, 2, v_gl_vat_pay_id, 'K', v_matched_tr.vat_amount, 'Fizetendő ÁFA előírása');

          v_count := v_count + 1;

        -- Case B: Inbound invoice supplier payment -> Reclassify 3689 to 466
        ELSIF v_matched_tr.invoice_direction = 'INBOUND' AND (v_is_penzforgalmi OR COALESCE(v_matched_tr.is_cash_accounting, false) = true) THEN
          INSERT INTO public.acc_journal_headers (
            company_id, journal_id, accounting_year, status, entry_type, source,
            posting_date, document_date, document_id, partner_id,
            description, currency, exchange_rate, exchange_rate_date, import_key
          ) VALUES (
            p_company_id, v_journal_ve_id, EXTRACT(YEAR FROM v_date)::SMALLINT, 'GEPI_JAVASLAT', 'NORMAL', 'AUTO_SZAMLA',
            v_date, v_date, 'AFA-' || UPPER(SUBSTRING(v_matched_tr.transaction_id::text FROM 1 FOR 4)) || '-' || UPPER(SUBSTRING(v_matched_tr.invoice_id::text FROM 1 FOR 4)), v_partner_id,
            'Pénzforgalmi ÁFA átvezetés (466->3689) - ' || COALESCE(v_matched_tr.invoice_number, ''),
            'HUF', 1.0, v_date, 'PF-VAT-TR-' || v_matched_tr.transaction_id::text || '-' || v_matched_tr.invoice_id::text
          ) RETURNING id INTO v_ve_header_id;

          INSERT INTO public.acc_journal_lines (header_id, sequence_number, gl_account_id, dc_type, amount, description)
          VALUES 
            (v_ve_header_id, 1, v_gl_vat_ded_id, 'T', v_matched_tr.vat_amount, 'Levonható ÁFA előírása'),
            (v_ve_header_id, 2, v_gl_pf_ded_id, 'K', v_matched_tr.vat_amount, 'Pénzforgalmi levonható ÁFA kivezetése');

          v_count := v_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger(uuid, uuid) TO authenticated, service_role;
