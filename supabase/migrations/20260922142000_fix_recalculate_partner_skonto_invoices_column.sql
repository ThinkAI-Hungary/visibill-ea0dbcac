-- Migration: 20260922142000_fix_recalculate_partner_skonto_invoices_column.sql
-- Description: Fix recalculate_partner_skonto RPC to use invoices.frissitve (instead of non-existent updated_at)
--              and remove non-existent updated_at from nav_invoices updates.

CREATE OR REPLACE FUNCTION public.recalculate_partner_skonto(
  p_company_id uuid,
  p_partner_name text,
  p_partner_tax text DEFAULT NULL,
  p_has_skonto boolean DEFAULT false,
  p_skonto_days integer DEFAULT 8,
  p_skonto_percent numeric DEFAULT 2.0,
  p_excludes_shipping boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoices_count integer := 0;
  v_nav_count integer := 0;
  v_is_foreign boolean;
  v_tax text;
  v_name text;
  v_shipping_regex text := '(transport|shipping|fracht|fuvard[ií]j|sz[aá]ll[ií]t[aá]s|posta|delivery|porto)';
BEGIN
  -- 1. Authorization check
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
       WHERE company_id = p_company_id
         AND user_id = auth.uid()
    ) AND NOT public.is_support_admin()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND (role IN ('management', 'thinkai', 'support_admin') OR is_support_admin = true)
      ) AND NOT EXISTS (
        SELECT 1 FROM auth.users
         WHERE id = auth.uid() AND email LIKE '%@thinkai.hu'
      ) THEN
      RAISE EXCEPTION 'Nincs jogosultsága a partner skontó újraszámolásához.';
    END IF;
  END IF;

  v_tax := NULLIF(TRIM(p_partner_tax), '');
  v_name := NULLIF(TRIM(p_partner_name), '');
  v_is_foreign := (v_tax IS NULL OR v_tax LIKE 'FOREIGN:%');

  IF v_name IS NULL AND v_tax IS NULL THEN
    RETURN jsonb_build_object('invoices_updated', 0, 'nav_invoices_updated', 0);
  END IF;

  -- 2. If skonto is DISABLED -> Clear skonto on open unpaid invoices
  IF NOT COALESCE(p_has_skonto, false) THEN
    -- ① invoices (uses frissitve timestamp column)
    WITH updated_inv AS (
      UPDATE public.invoices
         SET has_skonto = false,
             skonto_days = NULL,
             skonto_percent = NULL,
             skonto_due_date = NULL,
             skonto_amount = NULL,
             skonto_shipping_amount = 0,
             skonto_selected = false,
             frissitve = now()
       WHERE company_id = p_company_id
         AND invoice_direction = 'INBOUND'
         AND transaction_id IS NULL
         AND COALESCE(fizetve, false) = false
         AND (
           (NOT v_is_foreign AND elado_vat_id = v_tax)
           OR (v_name IS NOT NULL AND elado_nev ILIKE '%' || v_name || '%')
         )
       RETURNING id
    )
    SELECT COUNT(*)::integer INTO v_invoices_count FROM updated_inv;

    -- ② nav_invoices
    WITH updated_nav AS (
      UPDATE public.nav_invoices
         SET has_skonto = false,
             skonto_days = NULL,
             skonto_percent = NULL,
             skonto_due_date = NULL,
             skonto_amount = NULL,
             skonto_shipping_amount = 0,
             skonto_selected = false
       WHERE company_id = p_company_id
         AND invoice_direction = 'INBOUND'
         AND transaction_id IS NULL
         AND COALESCE(paid, false) = false
         AND (
           (NOT v_is_foreign AND supplier_tax_number = v_tax)
           OR (v_name IS NOT NULL AND supplier_name ILIKE '%' || v_name || '%')
         )
       RETURNING id
    )
    SELECT COUNT(*)::integer INTO v_nav_count FROM updated_nav;

    RETURN jsonb_build_object('invoices_updated', v_invoices_count, 'nav_invoices_updated', v_nav_count);
  END IF;

  -- 3. If skonto is ENABLED -> Calculate and update
  -- ① invoices (uses frissitve timestamp column)
  WITH inv_calc AS (
    SELECT
      i.id,
      i.brutto_vegosszeg,
      i.kibocsatas_datuma,
      CASE WHEN p_excludes_shipping THEN
        COALESCE((
          SELECT ROUND(SUM(COALESCE(ii.gross_amount, ii.net_amount, ii.unit_price, 0)))::numeric
            FROM public.invoice_items ii
           WHERE ii.invoice_id = i.id
             AND ii.line_description ~* v_shipping_regex
        ), 0)
      ELSE 0 END AS shipping_amount,
      (COALESCE(i.kibocsatas_datuma, CURRENT_DATE) + (COALESCE(p_skonto_days, 8) * INTERVAL '1 day'))::date AS due_date
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND i.invoice_direction = 'INBOUND'
      AND i.transaction_id IS NULL
      AND COALESCE(i.fizetve, false) = false
      AND (
        (NOT v_is_foreign AND i.elado_vat_id = v_tax)
        OR (v_name IS NOT NULL AND i.elado_nev ILIKE '%' || v_name || '%')
      )
  ),
  updated_inv AS (
    UPDATE public.invoices i
       SET has_skonto = true,
           skonto_days = COALESCE(p_skonto_days, 8),
           skonto_percent = COALESCE(p_skonto_percent, 2.0),
           skonto_due_date = c.due_date,
           skonto_shipping_amount = c.shipping_amount,
           skonto_amount = GREATEST(0, COALESCE(i.brutto_vegosszeg, 0) - ROUND(GREATEST(0, COALESCE(i.brutto_vegosszeg, 0) - c.shipping_amount) * (COALESCE(p_skonto_percent, 2.0) / 100.0))),
           skonto_selected = (c.due_date >= CURRENT_DATE),
           frissitve = now()
      FROM inv_calc c
     WHERE i.id = c.id
     RETURNING i.id
  )
  SELECT COUNT(*)::integer INTO v_invoices_count FROM updated_inv;

  -- ② nav_invoices
  WITH nav_calc AS (
    SELECT
      n.id,
      n.invoice_gross_amount,
      CASE WHEN p_excludes_shipping THEN
        COALESCE((
          SELECT ROUND(SUM(COALESCE(nii.gross_amount, nii.net_amount, nii.unit_price, 0)))::numeric
            FROM public.nav_invoice_items nii
           WHERE nii.nav_invoice_id = n.id
             AND nii.line_description ~* v_shipping_regex
        ), 0)
      ELSE 0 END AS shipping_amount,
      (COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at::date, CURRENT_DATE) + (COALESCE(p_skonto_days, 8) * INTERVAL '1 day'))::date AS due_date
    FROM public.nav_invoices n
    WHERE n.company_id = p_company_id
      AND n.invoice_direction = 'INBOUND'
      AND n.transaction_id IS NULL
      AND COALESCE(n.paid, false) = false
      AND (
        (NOT v_is_foreign AND n.supplier_tax_number = v_tax)
        OR (v_name IS NOT NULL AND n.supplier_name ILIKE '%' || v_name || '%')
      )
  ),
  updated_nav AS (
    UPDATE public.nav_invoices n
       SET has_skonto = true,
           skonto_days = COALESCE(p_skonto_days, 8),
           skonto_percent = COALESCE(p_skonto_percent, 2.0),
           skonto_due_date = c.due_date,
           skonto_shipping_amount = c.shipping_amount,
           skonto_amount = GREATEST(0, COALESCE(n.invoice_gross_amount, 0) - ROUND(GREATEST(0, COALESCE(n.invoice_gross_amount, 0) - c.shipping_amount) * (COALESCE(p_skonto_percent, 2.0) / 100.0))),
           skonto_selected = (c.due_date >= CURRENT_DATE)
      FROM nav_calc c
     WHERE n.id = c.id
     RETURNING n.id
  )
  SELECT COUNT(*)::integer INTO v_nav_count FROM updated_nav;

  RETURN jsonb_build_object('invoices_updated', v_invoices_count, 'nav_invoices_updated', v_nav_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalculate_partner_skonto(uuid, text, text, boolean, integer, numeric, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_partner_skonto(uuid, text, text, boolean, integer, numeric, boolean) TO authenticated, service_role;
