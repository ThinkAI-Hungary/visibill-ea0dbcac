-- ==============================================================================
-- Migration: 20261013140000_posting_wizard_and_approval_pool.sql
-- Description:
--   1. Add posting_mode to public.companies ('wizard' | 'auto', default 'wizard').
--   2. Add indexes for fast pending pool queries on invoice items.
--   3. Create get_pending_posting_summary RPC for pool counter and metrics.
--   4. Create get_pending_posting_items RPC for Posting Wizard grouping & pagination.
--   5. Create approve_posting_batch RPC for atomic approval and 3-way rule creation.
--   6. Create set_company_posting_mode RPC for toggle management.
-- ==============================================================================

-- 1. Add posting_mode to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS posting_mode TEXT NOT NULL DEFAULT 'wizard'
CHECK (posting_mode IN ('wizard', 'auto'));

COMMENT ON COLUMN public.companies.posting_mode IS 'Accounting posting mode: wizard (interactive accountant approval pool) or auto (background automated posting)';

-- 2. Create helper indexes for fast pending classification lookup
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_company_id
  ON public.nav_invoice_items(company_id);

CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_nav_inv_id
  ON public.nav_invoice_items(nav_invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id
  ON public.invoice_items(invoice_id);

-- 3. get_pending_posting_summary RPC
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

    WITH pending_nav AS (
        SELECT
            nii.id AS item_id,
            ni.id AS invoice_id,
            COALESCE(nii.net_amount, 0) AS net_amount,
            COALESCE(ni.currency, 'HUF') AS currency
        FROM public.nav_invoice_items nii
        JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
        WHERE ni.company_id = p_company_id
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
    pending_submitted AS (
        SELECT
            ii.id AS item_id,
            inv.id AS invoice_id,
            COALESCE(ii.net_amount, 0) AS net_amount,
            COALESCE(inv.penznem, 'HUF') AS currency
        FROM public.invoice_items ii
        JOIN public.invoices inv ON inv.id = ii.invoice_id
        WHERE inv.company_id = p_company_id
          AND COALESCE(ii.exclude_from_accounting, false) = false
          AND (
            ii.gl_classifications IS NULL
            OR ii.gl_classifications->v_preset_key IS NULL
            OR (
                COALESCE((ii.gl_classifications->v_preset_key->>'is_approved')::boolean, false) IS NOT TRUE
                AND COALESCE((ii.gl_classifications->v_preset_key->>'is_manual')::boolean, false) IS NOT TRUE
            )
          )
    ),
    all_pending AS (
        SELECT item_id, invoice_id, net_amount, currency FROM pending_nav
        UNION ALL
        SELECT item_id, invoice_id, net_amount, currency FROM pending_submitted
    )
    SELECT
        COUNT(*)::INTEGER,
        COUNT(DISTINCT invoice_id)::INTEGER,
        COALESCE(ROUND(SUM(ABS(net_amount)), 2), 0)
    INTO v_item_count, v_invoice_count, v_total_net
    FROM all_pending;

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

-- 4. get_pending_posting_items RPC
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

-- 5. approve_posting_batch RPC
CREATE OR REPLACE FUNCTION public.approve_posting_batch(
    p_company_id UUID,
    p_preset_id UUID,
    p_items JSONB,
    p_rules_to_create JSONB DEFAULT '[]'::jsonb,
    p_rule_scope TEXT DEFAULT 'none'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_item JSONB;
    v_rule JSONB;
    v_preset_key TEXT;
    v_approved_count INTEGER := 0;
    v_rules_created INTEGER := 0;
    v_item_id UUID;
    v_source_table TEXT;
    v_gl_account_id UUID;
    v_gl_number TEXT;
    v_existing_class JSONB;
    v_clean_tax TEXT;
BEGIN
    -- Permission check: write access required
    PERFORM public.assert_company_role_tier(p_company_id, 'member_write');
    v_user_id := auth.uid();
    v_preset_key := p_preset_id::TEXT;

    -- 1. Process items approval
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::UUID;
        v_source_table := v_item->>'source_table';
        v_gl_account_id := (v_item->>'gl_account_id')::UUID;
        v_gl_number := v_item->>'gl_number';

        IF v_source_table = 'nav_invoice_items' THEN
            SELECT gl_classifications INTO v_existing_class
            FROM public.nav_invoice_items
            WHERE id = v_item_id AND (company_id = p_company_id OR company_id IS NULL);

            UPDATE public.nav_invoice_items
            SET gl_classifications = jsonb_set(
                COALESCE(v_existing_class, '{}'::jsonb),
                ARRAY[v_preset_key],
                jsonb_build_object(
                    'gl_account_id', v_gl_account_id,
                    'gl_number', v_gl_number,
                    'is_manual', true,
                    'is_approved', true,
                    'status', 'KONYVELT',
                    'approved_at', now(),
                    'approved_by', v_user_id,
                    'reasoning', COALESCE(v_item->>'reasoning', 'Kontírozás varázsló jóváhagyás')
                )
            )
            WHERE id = v_item_id;

            v_approved_count := v_approved_count + 1;

        ELSIF v_source_table = 'invoice_items' THEN
            SELECT gl_classifications INTO v_existing_class
            FROM public.invoice_items ii
            JOIN public.invoices inv ON inv.id = ii.invoice_id
            WHERE ii.id = v_item_id AND inv.company_id = p_company_id;

            UPDATE public.invoice_items
            SET gl_classifications = jsonb_set(
                COALESCE(v_existing_class, '{}'::jsonb),
                ARRAY[v_preset_key],
                jsonb_build_object(
                    'gl_account_id', v_gl_account_id,
                    'gl_number', v_gl_number,
                    'is_manual', true,
                    'is_approved', true,
                    'status', 'KONYVELT',
                    'approved_at', now(),
                    'approved_by', v_user_id,
                    'reasoning', COALESCE(v_item->>'reasoning', 'Kontírozás varázsló jóváhagyás')
                )
            )
            WHERE id = v_item_id;

            v_approved_count := v_approved_count + 1;
        END IF;
    END LOOP;

    -- 2. Create rules if requested (scope: 'company' or 'tenant')
    IF p_rule_scope IN ('company', 'tenant') AND jsonb_array_length(p_rules_to_create) > 0 THEN
        FOR v_rule IN SELECT * FROM jsonb_array_elements(p_rules_to_create)
        LOOP
            -- Normalize partner tax number (first 8 digits for HU)
            v_clean_tax := v_rule->>'partner_tax_number';
            IF v_clean_tax IS NOT NULL AND LENGTH(REGEXP_REPLACE(v_clean_tax, '[^0-9]', '', 'g')) >= 8 THEN
                v_clean_tax := SUBSTRING(REGEXP_REPLACE(v_clean_tax, '[^0-9]', '', 'g') FROM 1 FOR 8);
            END IF;

            -- Insert rule if not already existing
            IF NOT EXISTS (
                SELECT 1 FROM public.invoice_item_rules
                WHERE is_active = true
                  AND (
                    (p_rule_scope = 'company' AND company_id = p_company_id)
                    OR (p_rule_scope = 'tenant' AND scope = 'tenant' AND user_id = v_user_id)
                  )
                  AND description_pattern = TRIM(v_rule->>'description_pattern')
                  AND target_gl_number = TRIM(v_rule->>'target_gl_number')
                  AND COALESCE(partner_tax_number, '') = COALESCE(v_clean_tax, '')
            ) THEN
                INSERT INTO public.invoice_item_rules (
                    company_id,
                    user_id,
                    name,
                    priority,
                    is_active,
                    scope,
                    pattern_type,
                    description_pattern,
                    partner_name,
                    partner_tax_number,
                    direction,
                    target_gl_account_id,
                    target_gl_number,
                    target_vat_code_id,
                    target_vat_code
                ) VALUES (
                    CASE WHEN p_rule_scope = 'company' THEN p_company_id ELSE NULL END,
                    v_user_id,
                    COALESCE(v_rule->>'name', 'Varázsló szabály: ' || TRIM(v_rule->>'description_pattern')),
                    100,
                    true,
                    p_rule_scope,
                    COALESCE(v_rule->>'pattern_type', 'contains'),
                    TRIM(v_rule->>'description_pattern'),
                    NULLIF(TRIM(v_rule->>'partner_name'), ''),
                    v_clean_tax,
                    COALESCE(v_rule->>'direction', 'ALL'),
                    (v_rule->>'target_gl_account_id')::UUID,
                    TRIM(v_rule->>'target_gl_number'),
                    CASE WHEN (v_rule->>'target_vat_code_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
                         THEN (v_rule->>'target_vat_code_id')::UUID ELSE NULL END,
                    NULLIF(TRIM(v_rule->>'target_vat_code'), '')
                );

                v_rules_created := v_rules_created + 1;
            END IF;
        END LOOP;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'approved_count', v_approved_count,
        'rules_created', v_rules_created,
        'scope', p_rule_scope
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_posting_batch(UUID, UUID, JSONB, JSONB, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_posting_batch(UUID, UUID, JSONB, JSONB, TEXT) TO authenticated, service_role;

-- 6. set_company_posting_mode RPC
CREATE OR REPLACE FUNCTION public.set_company_posting_mode(
    p_company_id UUID,
    p_posting_mode TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.assert_company_role_tier(p_company_id, 'member_write');
    IF p_posting_mode NOT IN ('wizard', 'auto') THEN
        RAISE EXCEPTION 'Érvénytelen működési mód: %', p_posting_mode;
    END IF;

    UPDATE public.companies
    SET posting_mode = p_posting_mode,
        updated_at = now()
    WHERE id = p_company_id;

    RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_company_posting_mode(UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_company_posting_mode(UUID, TEXT) TO authenticated, service_role;
