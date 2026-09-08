-- Migration: 20260908120000_get_company_live_ai_context.sql
-- Description: Live Business Data Layer for AI Assistant (Context Snapshot & Invoice Search Tools)

-- 1. Live Context Snapshot RPC
CREATE OR REPLACE FUNCTION public.get_company_live_ai_context(
  p_company_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_access boolean;
  v_company record;
  v_result jsonb;
  v_unpaid_inbound jsonb;
  v_unpaid_outbound jsonb;
  v_bank_summary jsonb;
BEGIN
  -- Security check: Verify user membership in company
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = p_user_id
    UNION
    SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.accounty_assignments WHERE company_id = p_company_id AND accountant_user_id = p_user_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Hozzáférés megtagadva: A felhasználó nem jogosult a cég adataihoz.';
  END IF;

  -- 1. Company basic info
  SELECT id, name, tax_number, address, vat_regime
  INTO v_company
  FROM public.companies
  WHERE id = p_company_id;

  -- 2. Unpaid Inbound (Szállítói számlák / tartozások)
  WITH combined_inbound AS (
    -- NAV invoices
    SELECT 
      ni.id,
      ni.invoice_number,
      COALESCE(ni.supplier_name, 'Ismeretlen szállító') as partner_name,
      COALESCE(ni.invoice_gross_amount, 0) as gross_amount,
      COALESCE(ni.currency, 'HUF') as currency,
      ni.invoice_issue_date as issue_date,
      ni.payment_date as due_date,
      CASE 
        WHEN ni.payment_date IS NOT NULL AND ni.payment_date < CURRENT_DATE THEN true 
        ELSE false 
      END as is_overdue
    FROM public.nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = 'INBOUND'
      AND ni.transaction_id IS NULL
      AND (ni.paid IS NULL OR ni.paid = false)
      AND (ni.is_manual_payment IS NULL OR ni.is_manual_payment = false)

    UNION ALL

    -- Manual / uploaded invoices not in NAV
    SELECT 
      i.id,
      i.bizonylatsorszam as invoice_number,
      COALESCE(i.elado_nev, 'Ismeretlen szállító') as partner_name,
      COALESCE(i.brutto_vegosszeg, 0) as gross_amount,
      COALESCE(i.penznem, 'HUF') as currency,
      i.kibocsatas_datuma as issue_date,
      i.fizetesi_hatarido as due_date,
      CASE 
        WHEN i.fizetesi_hatarido IS NOT NULL AND i.fizetesi_hatarido < CURRENT_DATE THEN true 
        ELSE false 
      END as is_overdue
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = 'INBOUND'
      AND i.transaction_id IS NULL
      AND (i.fizetve IS NULL OR i.fizetve = false)
      AND NOT EXISTS (
        SELECT 1 FROM public.nav_invoices ni 
        WHERE ni.company_id = i.company_id 
          AND REPLACE(ni.invoice_number, ' ', '') = REPLACE(i.bizonylatsorszam, ' ', '')
      )
  ),
  inbound_totals AS (
    SELECT 
      currency,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN is_overdue THEN gross_amount ELSE 0 END), 0) as overdue_gross,
      COUNT(CASE WHEN is_overdue THEN 1 END) as overdue_count
    FROM combined_inbound
    GROUP BY currency
  ),
  inbound_top_items AS (
    SELECT jsonb_agg(item) as items FROM (
      SELECT 
        invoice_number,
        partner_name,
        gross_amount,
        currency,
        due_date,
        is_overdue,
        CASE 
          WHEN due_date IS NULL THEN 'Nincs megadva határidő'
          WHEN is_overdue THEN CONCAT('Lejárt ', (CURRENT_DATE - due_date), ' napja')
          WHEN due_date = CURRENT_DATE THEN 'Ma jár le!'
          ELSE CONCAT('Esedékes ', (due_date - CURRENT_DATE), ' nap múlva')
        END as status_text
      FROM combined_inbound
      ORDER BY 
        is_overdue DESC,
        due_date ASC NULLS LAST,
        gross_amount DESC
      LIMIT 5
    ) item
  )
  SELECT jsonb_build_object(
    'total_count', COALESCE((SELECT COUNT(*) FROM combined_inbound), 0),
    'overdue_count', COALESCE((SELECT SUM(overdue_count) FROM inbound_totals), 0),
    'totals_by_currency', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency', currency, 'total_gross', total_gross, 'overdue_gross', overdue_gross)) FROM inbound_totals), '[]'::jsonb),
    'top_items', COALESCE((SELECT items FROM inbound_top_items), '[]'::jsonb)
  ) INTO v_unpaid_inbound;

  -- 3. Unpaid Outbound (Vevői számlák / kintlévőségek)
  WITH combined_outbound AS (
    -- NAV invoices
    SELECT 
      ni.id,
      ni.invoice_number,
      COALESCE(ni.customer_name, 'Ismeretlen vevő') as partner_name,
      COALESCE(ni.invoice_gross_amount, 0) as gross_amount,
      COALESCE(ni.currency, 'HUF') as currency,
      ni.invoice_issue_date as issue_date,
      ni.payment_date as due_date,
      CASE 
        WHEN ni.payment_date IS NOT NULL AND ni.payment_date < CURRENT_DATE THEN true 
        ELSE false 
      END as is_overdue
    FROM public.nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.invoice_direction = 'OUTBOUND'
      AND ni.transaction_id IS NULL
      AND (ni.paid IS NULL OR ni.paid = false)
      AND (ni.is_manual_payment IS NULL OR ni.is_manual_payment = false)

    UNION ALL

    -- Manual / uploaded invoices not in NAV
    SELECT 
      i.id,
      i.bizonylatsorszam as invoice_number,
      COALESCE(i.vevo_nev, 'Ismeretlen vevő') as partner_name,
      COALESCE(i.brutto_vegosszeg, 0) as gross_amount,
      COALESCE(i.penznem, 'HUF') as currency,
      i.kibocsatas_datuma as issue_date,
      i.fizetesi_hatarido as due_date,
      CASE 
        WHEN i.fizetesi_hatarido IS NOT NULL AND i.fizetesi_hatarido < CURRENT_DATE THEN true 
        ELSE false 
      END as is_overdue
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = 'OUTBOUND'
      AND i.transaction_id IS NULL
      AND (i.fizetve IS NULL OR i.fizetve = false)
      AND NOT EXISTS (
        SELECT 1 FROM public.nav_invoices ni 
        WHERE ni.company_id = i.company_id 
          AND REPLACE(ni.invoice_number, ' ', '') = REPLACE(i.bizonylatsorszam, ' ', '')
      )
  ),
  outbound_totals AS (
    SELECT 
      currency,
      COALESCE(SUM(gross_amount), 0) as total_gross,
      COUNT(*) as count,
      COALESCE(SUM(CASE WHEN is_overdue THEN gross_amount ELSE 0 END), 0) as overdue_gross,
      COUNT(CASE WHEN is_overdue THEN 1 END) as overdue_count
    FROM combined_outbound
    GROUP BY currency
  ),
  outbound_top_items AS (
    SELECT jsonb_agg(item) as items FROM (
      SELECT 
        invoice_number,
        partner_name,
        gross_amount,
        currency,
        due_date,
        is_overdue,
        CASE 
          WHEN due_date IS NULL THEN 'Nincs megadva határidő'
          WHEN is_overdue THEN CONCAT('Késedelmes ', (CURRENT_DATE - due_date), ' napja')
          WHEN due_date = CURRENT_DATE THEN 'Ma esedékes!'
          ELSE CONCAT('Várható fizetés ', (due_date - CURRENT_DATE), ' nap múlva')
        END as status_text
      FROM combined_outbound
      ORDER BY 
        is_overdue DESC,
        due_date ASC NULLS LAST,
        gross_amount DESC
      LIMIT 5
    ) item
  )
  SELECT jsonb_build_object(
    'total_count', COALESCE((SELECT COUNT(*) FROM combined_outbound), 0),
    'overdue_count', COALESCE((SELECT SUM(overdue_count) FROM outbound_totals), 0),
    'totals_by_currency', COALESCE((SELECT jsonb_agg(jsonb_build_object('currency', currency, 'total_gross', total_gross, 'overdue_gross', overdue_gross)) FROM outbound_totals), '[]'::jsonb),
    'top_items', COALESCE((SELECT items FROM outbound_top_items), '[]'::jsonb)
  ) INTO v_unpaid_outbound;

  -- 4. Bank summary
  SELECT jsonb_build_object(
    'unmatched_transactions_count', COUNT(CASE WHEN matched_invoice_id IS NULL THEN 1 END),
    'total_transactions_last_30d', COUNT(CASE WHEN transaction_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END),
    'last_transaction_date', MAX(transaction_date)
  ) INTO v_bank_summary
  FROM public.transactions
  WHERE company_id = p_company_id;

  -- Assemble final response
  v_result := jsonb_build_object(
    'company', jsonb_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'tax_number', v_company.tax_number,
      'address', v_company.address,
      'vat_regime', v_company.vat_regime
    ),
    'unpaid_inbound', v_unpaid_inbound,
    'unpaid_outbound', v_unpaid_outbound,
    'bank_summary', COALESCE(v_bank_summary, '{}'::jsonb),
    'as_of_date', CURRENT_DATE
  );

  RETURN v_result;
END;
$$;

-- 2. Search Company Invoices RPC (for AI Tool Calling)
CREATE OR REPLACE FUNCTION public.search_company_invoices_ai(
  p_company_id uuid,
  p_user_id uuid,
  p_query text DEFAULT NULL,
  p_direction text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_access boolean;
  v_result jsonb;
  v_limit int;
BEGIN
  -- Security check: Verify user membership in company
  SELECT EXISTS (
    SELECT 1 FROM public.companies WHERE id = p_company_id AND owner_id = p_user_id
    UNION
    SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = p_user_id
    UNION
    SELECT 1 FROM public.accounty_assignments WHERE company_id = p_company_id AND accountant_user_id = p_user_id
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Hozzáférés megtagadva: A felhasználó nem jogosult a cég adataihoz.';
  END IF;

  v_limit := LEAST(COALESCE(p_limit, 10), 25);

  WITH all_invoices AS (
    -- NAV Invoices
    SELECT 
      ni.id,
      ni.invoice_number,
      ni.invoice_direction,
      COALESCE(CASE WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name ELSE ni.supplier_name END, '') as partner_name,
      COALESCE(CASE WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_tax_number ELSE ni.supplier_tax_number END, '') as partner_tax_number,
      COALESCE(ni.invoice_gross_amount, 0) as gross_amount,
      COALESCE(ni.currency, 'HUF') as currency,
      ni.invoice_issue_date as issue_date,
      ni.payment_date as due_date,
      CASE 
        WHEN ni.transaction_id IS NOT NULL OR ni.paid = true OR ni.is_manual_payment = true THEN 'paid'
        ELSE 'unpaid'
      END as payment_status,
      'nav' as source
    FROM public.nav_invoices ni
    WHERE ni.company_id = p_company_id

    UNION ALL

    -- Manual / Uploaded Invoices not in NAV
    SELECT 
      i.id,
      i.bizonylatsorszam as invoice_number,
      i.invoice_direction,
      COALESCE(CASE WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_nev ELSE i.elado_nev END, '') as partner_name,
      COALESCE(CASE WHEN i.invoice_direction = 'OUTBOUND' THEN i.vevo_vat_id ELSE i.elado_vat_id END, '') as partner_tax_number,
      COALESCE(i.brutto_vegosszeg, 0) as gross_amount,
      COALESCE(i.penznem, 'HUF') as currency,
      i.kibocsatas_datuma as issue_date,
      i.fizetesi_hatarido as due_date,
      CASE 
        WHEN i.transaction_id IS NOT NULL OR i.fizetve = true THEN 'paid'
        ELSE 'unpaid'
      END as payment_status,
      'manual' as source
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.nav_invoices ni 
        WHERE ni.company_id = i.company_id 
          AND REPLACE(ni.invoice_number, ' ', '') = REPLACE(i.bizonylatsorszam, ' ', '')
      )
  ),
  filtered AS (
    SELECT *
    FROM all_invoices
    WHERE 
      (p_direction IS NULL OR UPPER(p_direction) = invoice_direction)
      AND (p_status IS NULL OR p_status = payment_status)
      AND (
        p_query IS NULL 
        OR invoice_number ILIKE '%' || p_query || '%' 
        OR partner_name ILIKE '%' || p_query || '%'
        OR partner_tax_number ILIKE '%' || p_query || '%'
      )
    ORDER BY issue_date DESC NULLS LAST, due_date DESC NULLS LAST
    LIMIT v_limit
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', id,
      'invoice_number', invoice_number,
      'direction', invoice_direction,
      'partner_name', partner_name,
      'gross_amount', gross_amount,
      'currency', currency,
      'issue_date', issue_date,
      'due_date', due_date,
      'payment_status', payment_status,
      'is_overdue', CASE WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE AND payment_status = 'unpaid' THEN true ELSE false END
    )
  ), '[]'::jsonb) INTO v_result
  FROM filtered;

  RETURN v_result;
END;
$$;

-- Permissions
REVOKE ALL ON FUNCTION public.get_company_live_ai_context(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_company_live_ai_context(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_company_invoices_ai(uuid, uuid, text, text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_company_invoices_ai(uuid, uuid, text, text, text, int) TO authenticated, service_role;
