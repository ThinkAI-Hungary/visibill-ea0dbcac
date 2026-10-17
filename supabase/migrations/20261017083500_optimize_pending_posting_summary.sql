-- Migration: 20261017083000_optimize_pending_posting_summary.sql
-- Description: Optimize get_pending_posting_summary and get_pending_posting_items
-- Problem: get_pending_posting_summary was joining nav_invoices and invoices in a massive nested loop
-- across 40k+ items without pushing down company_id to item tables, causing 12.9s execution times
-- and statement timeout errors (57014) on large companies (e.g. Mandala Fogadó Kft).
-- Solution:
-- 1. Push down company_id directly to nav_invoice_items and invoice_items.
-- 2. Eliminate unnecessary join to invoice header tables in get_pending_posting_summary.
-- 3. Calculate nav and submitted counts/sums directly using existing company_id indexes.

CREATE OR REPLACE FUNCTION public.get_pending_posting_summary(
    p_company_id UUID,
    p_preset_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item_count INTEGER := 0;
    v_invoice_count INTEGER := 0;
    v_total_net NUMERIC := 0;
    v_preset_key TEXT;
    v_currency TEXT := 'HUF';
BEGIN
    -- Read check: user must be member of company
    PERFORM public.assert_company_role_tier(p_company_id, 'member_read');
    v_preset_key := p_preset_id::TEXT;

    WITH nav_agg AS (
        SELECT
            COUNT(*)::INTEGER AS item_count,
            COUNT(DISTINCT nii.nav_invoice_id)::INTEGER AS invoice_count,
            COALESCE(ROUND(SUM(ABS(COALESCE(nii.net_amount, 0))), 2), 0) AS total_net
        FROM public.nav_invoice_items nii
        WHERE nii.company_id = p_company_id
          AND COALESCE(nii.exclude_from_accounting, false) = false
          AND (
            nii.gl_classifications IS NULL
            OR nii.gl_classifications->v_preset_key IS NULL
            OR (
                COALESCE((nii.gl_classifications->v_preset_key->>'is_approved')::boolean, false) IS NOT TRUE
                AND COALESCE((nii.gl_classifications->v_preset_key->>'is_manual')::boolean, false) IS NOT TRUE
            )
          )
    ),
    sub_agg AS (
        SELECT
            COUNT(*)::INTEGER AS item_count,
            COUNT(DISTINCT ii.invoice_id)::INTEGER AS invoice_count,
            COALESCE(ROUND(SUM(ABS(COALESCE(ii.net_amount, 0))), 2), 0) AS total_net
        FROM public.invoice_items ii
        WHERE ii.company_id = p_company_id
          AND COALESCE(ii.exclude_from_accounting, false) = false
          AND (
            ii.gl_classifications IS NULL
            OR ii.gl_classifications->v_preset_key IS NULL
            OR (
                COALESCE((ii.gl_classifications->v_preset_key->>'is_approved')::boolean, false) IS NOT TRUE
                AND COALESCE((ii.gl_classifications->v_preset_key->>'is_manual')::boolean, false) IS NOT TRUE
            )
          )
    )
    SELECT
        COALESCE(n.item_count, 0) + COALESCE(s.item_count, 0),
        COALESCE(n.invoice_count, 0) + COALESCE(s.invoice_count, 0),
        COALESCE(n.total_net, 0) + COALESCE(s.total_net, 0)
    INTO v_item_count, v_invoice_count, v_total_net
    FROM nav_agg n CROSS JOIN sub_agg s;

    RETURN jsonb_build_object(
        'pending_item_count', v_item_count,
        'pending_invoice_count', v_invoice_count,
        'total_net_amount', v_total_net,
        'currency', v_currency
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pending_posting_summary(UUID, UUID) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_posting_summary(UUID, UUID) TO authenticated, service_role;

-- Also optimize get_pending_posting_items by pushing down company_id to item tables
CREATE OR REPLACE FUNCTION public.get_pending_posting_items(
    p_company_id UUID,
    p_preset_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    item_id UUID,
    source_table TEXT,
    invoice_id UUID,
    invoice_number TEXT,
    invoice_direction TEXT,
    invoice_date TEXT,
    partner_name TEXT,
    partner_tax_number TEXT,
    line_number INTEGER,
    line_description TEXT,
    net_amount NUMERIC,
    vat_amount NUMERIC,
    gross_amount NUMERIC,
    vat_rate TEXT,
    vat_code TEXT,
    currency TEXT,
    suggested_gl_account_id UUID,
    suggested_gl_number TEXT,
    suggested_gl_name TEXT,
    rule_name TEXT,
    reasoning TEXT,
    is_approved BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_preset_key TEXT;
BEGIN
    PERFORM public.assert_company_role_tier(p_company_id, 'member_read');
    v_preset_key := p_preset_id::TEXT;

    RETURN QUERY
    WITH pending_union AS (
        -- 1. NAV invoice items
        SELECT
            nii.id AS item_id,
            'nav_invoice_items'::TEXT AS source_table,
            ni.id AS invoice_id,
            COALESCE(ni.invoice_number, '')::TEXT AS invoice_number,
            COALESCE(ni.invoice_direction, 'INBOUND')::TEXT AS invoice_direction,
            COALESCE(ni.invoice_issue_date::TEXT, ni.invoice_delivery_date::TEXT, ni.created_at::DATE::TEXT)::TEXT AS invoice_date,
            CASE 
                WHEN ni.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.customer_name, 'Ismeretlen vevő')
                ELSE COALESCE(ni.supplier_name, 'Ismeretlen szállító')
            END::TEXT AS partner_name,
            CASE 
                WHEN ni.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.customer_tax_number, '')
                ELSE COALESCE(ni.supplier_tax_number, '')
            END::TEXT AS partner_tax_number,
            COALESCE(nii.line_number, 1)::INTEGER AS line_number,
            COALESCE(nii.line_description, ni.invoice_number, 'Tétel')::TEXT AS line_description,
            COALESCE(nii.net_amount, 0)::NUMERIC AS net_amount,
            COALESCE(nii.vat_amount, 0)::NUMERIC AS vat_amount,
            COALESCE(nii.gross_amount, 0)::NUMERIC AS gross_amount,
            COALESCE(nii.vat_rate, '')::TEXT AS vat_rate,
            COALESCE(nii.vat_code, '')::TEXT AS vat_code,
            COALESCE(ni.currency, 'HUF')::TEXT AS currency,
            CASE 
                WHEN (nii.gl_classifications->v_preset_key->>'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                THEN (nii.gl_classifications->v_preset_key->>'gl_account_id')::UUID 
                ELSE NULL 
            END AS raw_gl_account_id,
            COALESCE(nii.gl_classifications->v_preset_key->>'gl_number', NULL)::TEXT AS raw_gl_number,
            COALESCE(nii.gl_classifications->v_preset_key->>'reasoning', NULL)::TEXT AS raw_reasoning,
            COALESCE((nii.gl_classifications->v_preset_key->>'is_approved')::BOOLEAN, false) AS is_approved
        FROM public.nav_invoice_items nii
        JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
        WHERE ni.company_id = p_company_id
          AND nii.company_id = p_company_id
          AND COALESCE(nii.exclude_from_accounting, false) = false
          AND (
            nii.gl_classifications IS NULL
            OR nii.gl_classifications->v_preset_key IS NULL
            OR (
                COALESCE((nii.gl_classifications->v_preset_key->>'is_approved')::boolean, false) IS NOT TRUE
                AND COALESCE((nii.gl_classifications->v_preset_key->>'is_manual')::boolean, false) IS NOT TRUE
            )
          )

        UNION ALL

        -- 2. Submitted/uploaded invoice items
        SELECT
            ii.id AS item_id,
            'invoice_items'::TEXT AS source_table,
            inv.id AS invoice_id,
            COALESCE(inv.bizonylatsorszam, '')::TEXT AS invoice_number,
            COALESCE(inv.invoice_direction, 'INBOUND')::TEXT AS invoice_direction,
            COALESCE(inv.kibocsatas_datuma::TEXT, inv.teljesites_datuma::TEXT, ii.created_at::DATE::TEXT)::TEXT AS invoice_date,
            CASE 
                WHEN inv.invoice_direction = 'OUTBOUND' THEN COALESCE(inv.vevo_nev, 'Ismeretlen vevő')
                ELSE COALESCE(inv.elado_nev, 'Ismeretlen szállító')
            END::TEXT AS partner_name,
            CASE 
                WHEN inv.invoice_direction = 'OUTBOUND' THEN COALESCE(inv.vevo_vat_id, '')
                ELSE COALESCE(inv.elado_vat_id, '')
            END::TEXT AS partner_tax_number,
            COALESCE(ii.line_number, 1)::INTEGER AS line_number,
            COALESCE(ii.line_description, inv.bizonylatsorszam, 'Tétel')::TEXT AS line_description,
            COALESCE(ii.net_amount, 0)::NUMERIC AS net_amount,
            COALESCE(ii.vat_amount, 0)::NUMERIC AS vat_amount,
            COALESCE(ii.gross_amount, 0)::NUMERIC AS gross_amount,
            COALESCE(ii.vat_rate, '')::TEXT AS vat_rate,
            COALESCE(ii.vat_code, '')::TEXT AS vat_code,
            COALESCE(inv.penznem, 'HUF')::TEXT AS currency,
            CASE 
                WHEN (ii.gl_classifications->v_preset_key->>'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                THEN (ii.gl_classifications->v_preset_key->>'gl_account_id')::UUID 
                ELSE NULL 
            END AS raw_gl_account_id,
            COALESCE(ii.gl_classifications->v_preset_key->>'gl_number', NULL)::TEXT AS raw_gl_number,
            COALESCE(ii.gl_classifications->v_preset_key->>'reasoning', NULL)::TEXT AS raw_reasoning,
            COALESCE((ii.gl_classifications->v_preset_key->>'is_approved')::BOOLEAN, false) AS is_approved
        FROM public.invoice_items ii
        JOIN public.invoices inv ON inv.id = ii.invoice_id
        WHERE inv.company_id = p_company_id
          AND ii.company_id = p_company_id
          AND COALESCE(ii.exclude_from_accounting, false) = false
          AND (
            ii.gl_classifications IS NULL
            OR ii.gl_classifications->v_preset_key IS NULL
            OR (
                COALESCE((ii.gl_classifications->v_preset_key->>'is_approved')::boolean, false) IS NOT TRUE
                AND COALESCE((ii.gl_classifications->v_preset_key->>'is_manual')::boolean, false) IS NOT TRUE
            )
          )
    )
    SELECT
        pu.item_id,
        pu.source_table,
        pu.invoice_id,
        pu.invoice_number,
        pu.invoice_direction,
        pu.invoice_date,
        pu.partner_name,
        pu.partner_tax_number,
        pu.line_number,
        pu.line_description,
        pu.net_amount,
        pu.vat_amount,
        pu.gross_amount,
        pu.vat_rate,
        pu.vat_code,
        pu.currency,
        COALESCE(ga.id, pu.raw_gl_account_id) AS suggested_gl_account_id,
        COALESCE(ga.gl_number, pu.raw_gl_number, 'UNCLASSIFIED')::TEXT AS suggested_gl_number,
        COALESCE(ga.short_name, ga.description, 'Besorolásra vár')::TEXT AS suggested_gl_name,
        CASE 
            WHEN pu.raw_reasoning ILIKE 'Számlaszabály:%' THEN TRIM(SUBSTRING(pu.raw_reasoning FROM 14))
            ELSE NULL 
        END::TEXT AS rule_name,
        pu.raw_reasoning AS reasoning,
        pu.is_approved
    FROM pending_union pu
    LEFT JOIN public.gl_accounts ga ON ga.id = pu.raw_gl_account_id AND ga.preset_id = p_preset_id
    ORDER BY suggested_gl_number ASC, pu.invoice_date DESC, pu.item_id ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_pending_posting_items(UUID, UUID, INTEGER, INTEGER) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_posting_items(UUID, UUID, INTEGER, INTEGER) TO authenticated, service_role;
