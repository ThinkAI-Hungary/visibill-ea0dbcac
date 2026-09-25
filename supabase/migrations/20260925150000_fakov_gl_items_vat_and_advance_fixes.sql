-- Migration: 20260925150000_fakov_gl_items_vat_and_advance_fixes.sql
-- Description:
-- 1. In get_gl_categorized_items, ensure bizonylatsorszam / voucher_number / document_id
--    is included in description so invoice serial numbers are always visible in Főkönyv.
-- 2. Add GL account 4668 (Levonható ÁFA 4668) to Fakov and generic chart of accounts.
-- 3. Correct Fazekas Attila invoice serial number (OCR-a7b2adb1 -> XSCEA6573585) and partner details.
-- 4. Update search_gl_entities to include invoice_items for comprehensive GL search.

-- ─── 1. RECREATE get_gl_categorized_items ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 500,
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
AS $$
BEGIN
  RETURN QUERY
  WITH debit_map AS (
    SELECT DISTINCT ON (je_inner.debit_account)
      je_inner.debit_account,
      best_debit.id AS mapped_id
    FROM public.gl_journal_entries je_inner
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
  credit_map AS (
    SELECT DISTINCT ON (je_inner.credit_account)
      je_inner.credit_account,
      best_credit.id AS mapped_id
    FROM public.gl_journal_entries je_inner
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
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ② invoice_items (számla tételek with invoice number and advance ref prefix)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      (CASE
        WHEN i.bizonylatsorszam IS NOT NULL AND i.elolegszamla_hivatkozas IS NOT NULL AND i.elolegszamla_hivatkozas <> '' AND i.elolegszamla_hivatkozas <> i.bizonylatsorszam
          THEN i.bizonylatsorszam || ' (Előleg: ' || i.elolegszamla_hivatkozas || ') - ' || COALESCE(ii.line_description, '')
        WHEN i.bizonylatsorszam IS NOT NULL AND ii.line_description IS NOT NULL AND ii.line_description NOT ILIKE '%' || i.bizonylatsorszam || '%'
          THEN i.bizonylatsorszam || ' - ' || ii.line_description
        ELSE COALESCE(ii.line_description, i.bizonylatsorszam)
      END)::text AS description,
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
      AND NOT COALESCE(i.exclude_from_accounting, false)
      AND NOT COALESCE(ii.exclude_from_accounting, false)
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
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with invoice number prefix)
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      (CASE
        WHEN n.invoice_number IS NOT NULL AND ni.line_description IS NOT NULL AND ni.line_description NOT ILIKE '%' || n.invoice_number || '%'
          THEN n.invoice_number || ' - ' || ni.line_description
        ELSE COALESCE(ni.line_description, n.invoice_number)
      END)::text AS description,
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
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      (CASE
        WHEN je.voucher_number IS NOT NULL AND je.description IS NOT NULL AND je.description NOT ILIKE '%' || je.voucher_number || '%'
          THEN je.voucher_number || ' - ' || je.description
        ELSE COALESCE(je.description, je.voucher_number)
      END)::text AS description,
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
      (CASE
        WHEN je.voucher_number IS NOT NULL AND je.description IS NOT NULL AND je.description NOT ILIKE '%' || je.voucher_number || '%'
          THEN je.voucher_number || ' - ' || je.description
        ELSE COALESCE(je.description, je.voucher_number)
      END)::text AS description,
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

    -- ⑥ Internal accounting journals (acc_journal_lines - KONYVELT & SZTORNOZOTT properly net out)
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
      (CASE
        WHEN h.document_id IS NOT NULL AND l.description IS NOT NULL AND l.description NOT ILIKE '%' || h.document_id || '%'
          THEN h.document_id || ' - ' || l.description
        WHEN h.document_id IS NOT NULL AND h.description IS NOT NULL AND h.description NOT ILIKE '%' || h.document_id || '%'
          THEN h.document_id || ' - ' || h.description
        ELSE COALESCE(l.description, h.description, h.document_id)
      END)::text AS description,
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
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) TO authenticated, service_role;


-- ─── 2. ADD GL ACCOUNT 4668 (Levonható ÁFA) TO PRESETS ───────────────────────

INSERT INTO public.gl_accounts (preset_id, gl_number, short_name, description)
SELECT p.id, '4668', 'Levonható ÁFA (4668)', 'Előzetesen felszámított általános forgalmi adó (4668)'
FROM public.chart_of_accounts_presets p
WHERE (p.id = '1e7b21c9-4d95-4723-a794-8306ec75fd14' OR p.id = 'a6c46c77-52b7-499e-bb12-419aa94349af')
  AND NOT EXISTS (
    SELECT 1 FROM public.gl_accounts ga WHERE ga.preset_id = p.id AND ga.gl_number = '4668'
  );


-- ─── 3. FIX FAZEKAS ATTILA INVOICE SERIAL NUMBER & SELLER INFO ───────────────

UPDATE public.invoices
   SET bizonylatsorszam = 'XSCEA6573585',
       elado_nev = 'Fazekas Attila',
       elado_vat_id = '55862930-1-37',
       frissitve = now()
 WHERE id = 'b981db25-5c62-4901-a31c-b1a1d1e3f723';


-- ─── 4. RECREATE search_gl_entities TO INCLUDE invoice_items ─────────────────

CREATE OR REPLACE FUNCTION public.search_gl_entities(
  p_company_id uuid,
  p_preset_id uuid,
  p_query text,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  entity_type text,
  entity_id text,
  gl_number text,
  title text,
  subtitle text,
  account_id uuid,
  target_gl_number text,
  amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_query text;
BEGIN
  v_clean_query := TRIM(COALESCE(p_query, ''));
  IF LENGTH(v_clean_query) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH acc_matches AS (
    SELECT 
      'account'::text AS entity_type,
      ga.gl_number::text AS entity_id,
      ga.gl_number::text AS gl_number,
      (ga.gl_number || ' - ' || ga.short_name)::text AS title,
      'Főkönyvi számla'::text AS subtitle,
      ga.id AS account_id,
      ga.gl_number::text AS target_gl_number,
      NULL::numeric AS amount,
      1 AS sort_priority
    FROM public.gl_accounts ga
    WHERE ga.preset_id = p_preset_id
      AND (ga.gl_number ILIKE '%' || v_clean_query || '%' OR ga.short_name ILIKE '%' || v_clean_query || '%')
    ORDER BY 
      CASE WHEN ga.gl_number ILIKE v_clean_query || '%' THEN 0 ELSE 1 END,
      LENGTH(ga.gl_number) ASC
    LIMIT 6
  ),
  item_matches AS (
    SELECT * FROM (
      -- 1. gl_journal_entries
      SELECT
        'item'::text AS entity_type,
        ('item_' || je.id::text)::text AS entity_id,
        COALESCE(je.debit_account, je.credit_account, 'UNCLASSIFIED')::text AS gl_number,
        COALESCE(je.description, je.voucher_number)::text AS title,
        (COALESCE(je.partner_name, '') || ' • ' || to_char(COALESCE(je.amount, 0), 'FM999,999,999') || ' Ft')::text AS subtitle,
        NULL::uuid AS account_id,
        COALESCE(je.debit_account, je.credit_account, 'UNCLASSIFIED')::text AS target_gl_number,
        je.amount AS amount,
        2 AS sort_priority
      FROM public.gl_journal_entries je
      WHERE je.company_id = p_company_id
        AND (
          je.voucher_number ILIKE '%' || v_clean_query || '%' 
          OR je.partner_name ILIKE '%' || v_clean_query || '%' 
          OR je.description ILIKE '%' || v_clean_query || '%'
        )
      LIMIT 6
    ) j
    UNION ALL
    SELECT * FROM (
      -- 2. invoice_items
      SELECT
        'item'::text AS entity_type,
        ('item_' || ii.id::text)::text AS entity_id,
        COALESCE(ii.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS gl_number,
        COALESCE(ii.line_description, i.bizonylatsorszam)::text AS title,
        (COALESCE(i.bizonylatsorszam, '') || ' • ' || COALESCE(i.elado_nev, i.vevo_nev, '') || ' • ' || to_char(COALESCE(ii.net_amount, 0), 'FM999,999,999') || ' Ft')::text AS subtitle,
        CASE WHEN (ii.gl_classifications->(p_preset_id::text)->>'gl_account_id') ~ '^[0-9a-fA-F-]{36}$'
          THEN (ii.gl_classifications->(p_preset_id::text)->>'gl_account_id')::uuid
          ELSE NULL END AS account_id,
        COALESCE(ii.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS target_gl_number,
        ii.net_amount AS amount,
        3 AS sort_priority
      FROM public.invoice_items ii
      JOIN public.invoices i ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND (
          ii.line_description ILIKE '%' || v_clean_query || '%' 
          OR i.elado_nev ILIKE '%' || v_clean_query || '%' 
          OR i.vevo_nev ILIKE '%' || v_clean_query || '%' 
          OR i.bizonylatsorszam ILIKE '%' || v_clean_query || '%'
          OR i.elolegszamla_hivatkozas ILIKE '%' || v_clean_query || '%'
        )
      LIMIT 6
    ) inv_items
    UNION ALL
    SELECT * FROM (
      -- 3. nav_invoice_items
      SELECT
        'item'::text AS entity_type,
        ('item_' || ni.id::text)::text AS entity_id,
        COALESCE(ni.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS gl_number,
        COALESCE(ni.line_description, n.invoice_number)::text AS title,
        (COALESCE(n.invoice_number, '') || ' • ' || COALESCE(n.supplier_name, n.customer_name, '') || ' • ' || to_char(COALESCE(ni.net_amount, 0), 'FM999,999,999') || ' Ft')::text AS subtitle,
        CASE WHEN (ni.gl_classifications->(p_preset_id::text)->>'gl_account_id') ~ '^[0-9a-fA-F-]{36}$'
          THEN (ni.gl_classifications->(p_preset_id::text)->>'gl_account_id')::uuid
          ELSE NULL END AS account_id,
        COALESCE(ni.gl_classifications->(p_preset_id::text)->>'gl_number', 'UNCLASSIFIED')::text AS target_gl_number,
        ni.net_amount AS amount,
        4 AS sort_priority
      FROM public.nav_invoice_items ni
      JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
      WHERE n.company_id = p_company_id
        AND (
          ni.line_description ILIKE '%' || v_clean_query || '%' 
          OR n.supplier_name ILIKE '%' || v_clean_query || '%' 
          OR n.customer_name ILIKE '%' || v_clean_query || '%' 
          OR n.invoice_number ILIKE '%' || v_clean_query || '%'
        )
      LIMIT 6
    ) n
  ),
  all_matches AS (
    SELECT * FROM acc_matches
    UNION ALL
    SELECT * FROM item_matches
  )
  SELECT 
    m.entity_type,
    m.entity_id,
    m.gl_number,
    m.title,
    m.subtitle,
    m.account_id,
    m.target_gl_number,
    m.amount
  FROM all_matches m
  ORDER BY m.sort_priority ASC, m.title ASC
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_gl_entities(uuid, uuid, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_gl_entities(uuid, uuid, text, integer) TO authenticated, service_role;
