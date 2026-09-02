-- Migration: 20260903_nav_crosscheck_approval_gate.sql
-- Description: NAV Online Számla Cross-Check & Könyvelői Jóváhagyási Kapu
-- Author: Visibill Feature Planner
-- Date: 2026-09-03

-- ============================================================================
-- 1. Schema Extensions on public.invoices
-- ============================================================================

-- Add nav_status column with check constraint
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS nav_status TEXT DEFAULT 'missing_nav';

-- Add check constraint for nav_status if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.invoices'::regclass AND conname = 'invoices_nav_status_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_nav_status_check 
      CHECK (nav_status IN ('verified', 'missing_nav', 'not_applicable'));
  END IF;
END $$;

-- Add approval audit trail columns
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- Composite index for fast company-level nav_status filtering
CREATE INDEX IF NOT EXISTS idx_invoices_company_nav_status 
  ON public.invoices(company_id, nav_status);

CREATE INDEX IF NOT EXISTS idx_invoices_company_statusz 
  ON public.invoices(company_id, statusz);

-- ============================================================================
-- 2. Update get_filtered_submitted_invoices with p_nav_status & new return columns
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer, text, date, date, text);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text);
DROP FUNCTION IF EXISTS public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text);

CREATE OR REPLACE FUNCTION public.get_filtered_submitted_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'kibocsatas_datuma',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_kpi_filter text DEFAULT 'all',
  p_nav_status text DEFAULT 'all'
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text,
  exclude_from_accounting boolean,
  fizetesi_mod text,
  match_status text,
  paid_amount numeric,
  remaining_amount numeric,
  statusz text,
  nav_status text,
  approval_note text,
  approved_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset integer;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  RETURN QUERY
  WITH base_filtered AS (
    SELECT
      i.id,
      i.bizonylatsorszam,
      i.kibocsatas_datuma,
      i.teljesites_datuma,
      i.elado_nev,
      i.vevo_nev,
      i.adoalap_osszesen,
      i.brutto_vegosszeg,
      i.afa_osszeg_osszesen,
      i.penznem,
      i.category_id,
      i.project_id,
      i.image_url,
      i.melleklet_url,
      i.invoice_direction,
      i.reference_number,
      i.exclude_from_accounting,
      i.fizetesi_mod,
      i.transaction_id,
      i.statusz,
      COALESCE(i.nav_status, 'missing_nav') AS nav_status,
      i.approval_note,
      i.approved_at
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = p_direction
      AND i.kibocsatas_datuma >= p_date_from
      AND i.kibocsatas_datuma <= p_date_to
      AND (p_issue_date_from IS NULL OR i.kibocsatas_datuma >= p_issue_date_from)
      AND (p_issue_date_to IS NULL OR i.kibocsatas_datuma <= p_issue_date_to)
      AND (p_search IS NULL OR p_search = '' OR (
        i.elado_nev ILIKE '%' || p_search || '%'
        OR i.vevo_nev ILIKE '%' || p_search || '%'
        OR i.bizonylatsorszam ILIKE '%' || p_search || '%'
        OR i.brutto_vegosszeg::text ILIKE '%' || p_search || '%'
        OR i.adoalap_osszesen::text ILIKE '%' || p_search || '%'
      ))
      AND (p_currency IS NULL OR p_currency = 'all' OR i.penznem = p_currency)
      AND (p_category_id IS NULL OR p_category_id = 'all'
        OR (p_category_id = 'none' AND i.category_id IS NULL)
        OR i.category_id = p_category_id::uuid)
      AND (p_project_id IS NULL OR p_project_id = 'all'
        OR (p_project_id = 'none' AND i.project_id IS NULL)
        OR i.project_id = p_project_id::uuid)
      AND (p_payment_method IS NULL OR p_payment_method = 'all'
        OR (p_payment_method = 'none' AND i.fizetesi_mod IS NULL)
        OR i.fizetesi_mod = p_payment_method)
      AND (p_amount_min IS NULL OR COALESCE(i.brutto_vegosszeg, 0) >= p_amount_min)
      AND (p_amount_max IS NULL OR COALESCE(i.brutto_vegosszeg, 0) <= p_amount_max)
      AND (
        p_nav_status IS NULL OR p_nav_status = 'all'
        OR (p_nav_status = 'verified' AND i.nav_status = 'verified')
        OR (p_nav_status = 'missing_nav' AND (i.nav_status = 'missing_nav' OR i.statusz = 'jovahagyasra_var'))
        OR (p_nav_status = 'not_applicable' AND i.nav_status = 'not_applicable')
      )
  ),
  tx_matches AS (
    SELECT 
      tx.matched_invoice_id,
      bool_or(tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)) AS is_matched,
      bool_or(tx.match_type != 'manual' AND (tx.is_verified IS NOT TRUE) AND (tx.confidence_score < 0.9)) AS is_suggested,
      COALESCE(SUM(
        CASE 
          WHEN tx.match_type = 'manual' OR tx.is_verified = true OR (tx.confidence_score IS NOT NULL AND tx.confidence_score >= 0.9)
          THEN ABS(tx.amount)
          ELSE 0
        END
      ), 0) AS total_paid_amount
    FROM transactions tx
    WHERE tx.company_id = p_company_id AND tx.matched_invoice_id IS NOT NULL
    GROUP BY tx.matched_invoice_id
  ),
  tim_matches AS (
    SELECT 
      tim.invoice_id,
      COALESCE(SUM(ABS(t.amount)), 0) AS total_tim_amount
    FROM transaction_invoice_matches tim
    JOIN transactions t ON t.id = tim.transaction_id
    WHERE t.company_id = p_company_id
    GROUP BY tim.invoice_id
  ),
  nav_matches AS (
    SELECT 
      ni.invoice_number,
      bool_or(
        ni.paid = true 
        OR ni.transaction_id IS NOT NULL 
        OR ni.is_manual_payment = true
        OR tm.is_matched = true
        OR tim.invoice_id IS NOT NULL
      ) AS is_nav_matched,
      bool_or(tm.is_suggested = true) AS is_nav_suggested,
      COALESCE(MAX(
        CASE 
          WHEN ni.is_manual_payment = true OR ni.payment_method = 'CASH' THEN ABS(COALESCE(ni.invoice_gross_amount, 0))
          ELSE COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)
        END
      ), 0) AS nav_paid_amount
    FROM nav_invoices ni
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = ni.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = ni.id
    WHERE ni.company_id = p_company_id
    GROUP BY ni.invoice_number
  ),
  with_status AS (
    SELECT 
      bf.*,
      CASE
        WHEN bf.fizetesi_mod = 'Készpénz' THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        WHEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(nm.nav_paid_amount, 0)) > 0
        THEN (COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0) + COALESCE(nm.nav_paid_amount, 0))
        WHEN bf.transaction_id IS NOT NULL THEN ABS(COALESCE(bf.brutto_vegosszeg, 0))
        ELSE 0
      END AS computed_paid_raw,
      ABS(COALESCE(bf.brutto_vegosszeg, 0)) AS gross_abs
    FROM base_filtered bf
    LEFT JOIN tx_matches tm ON tm.matched_invoice_id = bf.id
    LEFT JOIN tim_matches tim ON tim.invoice_id = bf.id
    LEFT JOIN nav_matches nm ON nm.invoice_number = bf.bizonylatsorszam
  ),
  with_match_status AS (
    SELECT 
      ws.*,
      CASE
        WHEN ws.computed_paid_raw >= ws.gross_abs AND ws.gross_abs > 0 THEN 'matched'
        WHEN ws.computed_paid_raw > 0 AND ws.computed_paid_raw < ws.gross_abs THEN 'partially_paid'
        WHEN (
          SELECT bool_or(tm.is_suggested OR nm.is_nav_suggested)
          FROM base_filtered bf2
          LEFT JOIN tx_matches tm ON tm.matched_invoice_id = bf2.id
          LEFT JOIN nav_matches nm ON nm.invoice_number = bf2.bizonylatsorszam
          WHERE bf2.id = ws.id
        ) THEN 'suggested'
        ELSE 'unmatched'
      END AS match_status,
      LEAST(ws.computed_paid_raw, ws.gross_abs) AS paid_amount,
      GREATEST(0, ws.gross_abs - ws.computed_paid_raw) AS remaining_amount
    FROM with_status ws
  ),
  kpi_filtered AS (
    SELECT *
    FROM with_match_status wms
    WHERE 
      p_kpi_filter IS NULL 
      OR p_kpi_filter = 'all'
      OR (p_kpi_filter = 'matched' AND wms.match_status IN ('matched', 'partially_paid'))
      OR (p_kpi_filter = 'suggested' AND wms.match_status = 'suggested')
      OR (p_kpi_filter = 'unmatched' AND wms.match_status = 'unmatched')
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM kpi_filtered
  )
  SELECT
    kf.id,
    kf.bizonylatsorszam,
    kf.kibocsatas_datuma,
    kf.teljesites_datuma,
    kf.elado_nev,
    kf.vevo_nev,
    kf.adoalap_osszesen,
    kf.brutto_vegosszeg,
    kf.afa_osszeg_osszesen,
    kf.penznem,
    kf.category_id,
    kf.project_id,
    kf.image_url,
    kf.melleklet_url,
    kf.invoice_direction,
    kf.reference_number,
    kf.exclude_from_accounting,
    kf.fizetesi_mod,
    kf.match_status,
    kf.paid_amount,
    kf.remaining_amount,
    kf.statusz,
    kf.nav_status,
    kf.approval_note,
    kf.approved_at,
    counted.cnt AS total_count
  FROM kpi_filtered kf
  CROSS JOIN counted
  ORDER BY
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'asc' THEN kf.kibocsatas_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'kibocsatas_datuma' AND p_sort_dir = 'desc' THEN kf.kibocsatas_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'asc' THEN kf.teljesites_datuma END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'teljesites_datuma' AND p_sort_dir = 'desc' THEN kf.teljesites_datuma END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'asc' THEN kf.brutto_vegosszeg END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'brutto_vegosszeg' AND p_sort_dir = 'desc' THEN kf.brutto_vegosszeg END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'asc' THEN kf.elado_nev END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'elado_nev' AND p_sort_dir = 'desc' THEN kf.elado_nev END DESC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'asc' THEN kf.bizonylatsorszam END ASC NULLS LAST,
    CASE WHEN p_sort_field = 'bizonylatsorszam' AND p_sort_dir = 'desc' THEN kf.bizonylatsorszam END DESC NULLS LAST,
    kf.kibocsatas_datuma DESC NULLS LAST,
    kf.id ASC
  LIMIT p_page_size
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_filtered_submitted_invoices FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_filtered_submitted_invoices TO authenticated, service_role;

-- ============================================================================
-- 3. Accounting Gate: Update get_gl_categorized_items
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb);

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
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
  WITH raw_items AS (
    -- ① transactions
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
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- ② invoice_items (ONLY approved / non-waiting invoices)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      i.kibocsatas_datuma::text AS item_date,
      false AS is_temporary
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND i.statusz != 'jovahagyasra_var'
      AND (i.nav_status IS NULL OR i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
    SELECT
      je.id AS item_id,
      best_debit.id AS mapped_id,
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
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (Követel = negative)
    SELECT
      je.id AS item_id,
      best_credit.id AS mapped_id,
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
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.credit_account IS NOT NULL
      AND je.amount > 0
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
  FROM raw_items r;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items TO authenticated, service_role;

-- ============================================================================
-- 4. Accountant Approval RPC: approve_invoice_for_accounting
-- ============================================================================

CREATE OR REPLACE FUNCTION public.approve_invoice_for_accounting(
  p_invoice_id uuid,
  p_approval_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice record;
  v_user_id uuid;
  v_company_id uuid;
  v_note text;
BEGIN
  v_user_id := auth.uid();
  
  -- Find invoice
  SELECT id, company_id, bizonylatsorszam, statusz, nav_status, invoice_type, fizetesi_mod
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A számla nem található (id: %)', p_invoice_id;
  END IF;

  v_company_id := v_invoice.company_id;

  -- Security check: user must be member of the company, assigned accountant in Accounty, or superadmin
  IF v_user_id IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = v_company_id AND user_id = v_user_id
    )
    OR public.has_accounty_company_access(v_company_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = v_user_id AND role = 'admin'
    )
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég számláinak jóváhagyásához';
  END IF;

  v_note := COALESCE(NULLIF(TRIM(p_approval_note), ''), 'Könyvelői jóváhagyás (NAV adatszolgáltatás nélkül)');

  -- Update invoice status and audit fields
  UPDATE public.invoices
  SET
    statusz = 'feldolgozott',
    approved_at = NOW(),
    approved_by = v_user_id,
    approval_note = v_note,
    frissitve = NOW()
  WHERE id = p_invoice_id;

  -- If it was a petty cash cash invoice, sync petty cash entries now that it is approved!
  IF v_invoice.invoice_type = 'penztarbizonylat' OR v_invoice.fizetesi_mod ILIKE '%készpénz%' THEN
    PERFORM public.sync_petty_cash_entries(v_company_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'statusz', 'feldolgozott',
    'approved_at', NOW(),
    'approved_by', v_user_id,
    'approval_note', v_note
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_invoice_for_accounting FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_invoice_for_accounting TO authenticated, service_role;

-- ============================================================================
-- 5. Auto-sync trigger on nav_invoices insert
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_submitted_invoice_on_nav_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If a new NAV invoice arrives, check if a matching submitted invoice exists that was missing_nav
  UPDATE public.invoices
  SET 
    nav_status = 'verified',
    statusz = CASE 
      WHEN statusz = 'jovahagyasra_var' AND approved_at IS NULL THEN 'feldolgozott'
      ELSE statusz
    END,
    frissitve = NOW()
  WHERE company_id = NEW.company_id
    AND REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(NEW.invoice_number), ' ', '')
    AND nav_status = 'missing_nav';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_submitted_invoice_on_nav_insert ON public.nav_invoices;
CREATE TRIGGER trg_sync_submitted_invoice_on_nav_insert
  AFTER INSERT ON public.nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_submitted_invoice_on_nav_insert();

-- ============================================================================
-- 6. Backfill existing invoices with nav_status
-- ============================================================================

DO $$
BEGIN
  -- 6.1 Mark invoices as 'verified' where an authoritative nav_invoices record exists
  UPDATE public.invoices i
  SET nav_status = 'verified'
  WHERE EXISTS (
    SELECT 1 FROM public.nav_invoices ni
    WHERE ni.company_id = i.company_id
      AND REPLACE(LOWER(ni.invoice_number), ' ', '') = REPLACE(LOWER(i.bizonylatsorszam), ' ', '')
  );

  -- 6.2 Mark foreign purchase invoices as 'not_applicable'
  UPDATE public.invoices i
  SET nav_status = 'not_applicable'
  WHERE i.invoice_direction = 'INBOUND'
    AND i.nav_status IS DISTINCT FROM 'verified'
    AND (
      i.elado_vat_id IS NULL 
      OR (
        i.elado_vat_id NOT LIKE 'HU%' 
        AND i.elado_vat_id !~ '^\d{8}'
      )
    )
    AND (i.penznem IS NOT NULL AND i.penznem != 'HUF');

  -- 6.3 All remaining domestic invoices without NAV record -> 'missing_nav' and 'jovahagyasra_var' if not already deleted or approved
  UPDATE public.invoices i
  SET 
    nav_status = 'missing_nav',
    statusz = CASE 
      WHEN i.statusz NOT IN ('torolt') AND i.approved_at IS NULL THEN 'jovahagyasra_var'
      ELSE i.statusz
    END
  WHERE i.nav_status IS NULL OR i.nav_status NOT IN ('verified', 'not_applicable');
END $$;
