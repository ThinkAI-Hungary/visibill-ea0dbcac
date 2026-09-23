-- ==============================================================================
-- Migration: 20260924130000_update_invoice_item_rules_rpc_tax_and_escape.sql
-- Description:
--   1. Update apply_invoice_item_rules RPC:
--      - Robust partner tax number matching (8-digit Hungarian tax base matching
--        and whitespace/dash stripped foreign VAT ID matching).
--      - Escape SQL ILIKE wildcard characters ('%', '_') in description_pattern.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.apply_invoice_item_rules(
    p_company_id UUID,
    p_preset_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_only_unclassified BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_rule RECORD;
    v_escaped_pattern TEXT;
    v_clean_rule_tax TEXT;
    v_is_hungarian_tax BOOLEAN;
    v_updated_invoice_items INTEGER := 0;
    v_updated_nav_items INTEGER := 0;
    v_total_invoice_items INTEGER := 0;
    v_total_nav_items INTEGER := 0;
    v_rules_count INTEGER := 0;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());

    -- Iterate through active rules for this company and tenant scope
    FOR v_rule IN (
        SELECT *
        FROM public.invoice_item_rules
        WHERE is_active = true
          AND (
            company_id = p_company_id
            OR (scope = 'tenant' AND (v_user_id IS NULL OR user_id = v_user_id))
            OR scope = 'global'
          )
        ORDER BY priority ASC, created_at DESC
    )
    LOOP
        v_rules_count := v_rules_count + 1;

        -- 1. Escape ILIKE wildcards in pattern
        v_escaped_pattern := REPLACE(REPLACE(REPLACE(v_rule.description_pattern, '\', '\\'), '%', '\%'), '_', '\_');

        -- 2. Clean partner tax number
        IF v_rule.partner_tax_number IS NOT NULL AND TRIM(v_rule.partner_tax_number) <> '' THEN
            IF v_rule.partner_tax_number ~ '^[0-9\-\s]+$' AND LENGTH(REGEXP_REPLACE(v_rule.partner_tax_number, '[^0-9]', '', 'g')) >= 8 THEN
                v_is_hungarian_tax := true;
                v_clean_rule_tax := SUBSTRING(REGEXP_REPLACE(v_rule.partner_tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8);
            ELSE
                v_is_hungarian_tax := false;
                v_clean_rule_tax := UPPER(REGEXP_REPLACE(v_rule.partner_tax_number, '[\s\-]', '', 'g'));
            END IF;
        ELSE
            v_clean_rule_tax := NULL;
            v_is_hungarian_tax := false;
        END IF;

        -- 3. Apply to submitted invoice_items
        WITH matched_items AS (
            SELECT ii.id
            FROM public.invoice_items ii
            JOIN public.invoices inv ON inv.id = ii.invoice_id
            WHERE inv.company_id = p_company_id
              AND (
                v_rule.direction = 'ALL' 
                OR (v_rule.direction = 'INBOUND' AND inv.type = 'INBOUND')
                OR (v_rule.direction = 'OUTBOUND' AND inv.type = 'OUTBOUND')
              )
              AND (
                v_clean_rule_tax IS NULL
                OR (
                    v_is_hungarian_tax AND 
                    SUBSTRING(REGEXP_REPLACE(COALESCE(inv.partner_tax_number, ''), '[^0-9]', '', 'g') FROM 1 FOR 8) = v_clean_rule_tax
                )
                OR (
                    NOT v_is_hungarian_tax AND 
                    UPPER(REGEXP_REPLACE(COALESCE(inv.partner_tax_number, ''), '[\s\-]', '', 'g')) = v_clean_rule_tax
                )
              )
              AND (
                (v_rule.pattern_type = 'contains' AND ii.line_description ILIKE ('%' || v_escaped_pattern || '%') ESCAPE '\')
                OR (v_rule.pattern_type = 'exact' AND ii.line_description ILIKE v_escaped_pattern ESCAPE '\')
              )
              AND (
                NOT p_only_unclassified 
                OR ii.gl_classifications IS NULL 
                OR ii.gl_classifications->p_preset_id::text IS NULL
                OR (ii.gl_classifications->p_preset_id::text->>'is_manual')::boolean IS NOT TRUE
              )
        ),
        updated AS (
            UPDATE public.invoice_items ii
            SET gl_classifications = jsonb_set(
                    COALESCE(ii.gl_classifications, '{}'::jsonb),
                    ARRAY[p_preset_id::text],
                    jsonb_build_object(
                        'gl_account_id', v_rule.target_gl_account_id,
                        'gl_number', v_rule.target_gl_number,
                        'is_manual', false,
                        'rule_id', v_rule.id,
                        'reasoning', 'Számlaszabály: ' || v_rule.name
                    )
                ),
                vat_code_id = CASE 
                    WHEN v_rule.target_vat_code_id IS NOT NULL THEN v_rule.target_vat_code_id 
                    ELSE ii.vat_code_id 
                END,
                vat_code = CASE 
                    WHEN v_rule.target_vat_code_id IS NOT NULL AND v_rule.target_vat_code IS NOT NULL THEN v_rule.target_vat_code 
                    ELSE ii.vat_code 
                END
            FROM matched_items mi
            WHERE ii.id = mi.id
            RETURNING ii.id
        )
        SELECT COUNT(*) INTO v_updated_invoice_items FROM updated;
        v_total_invoice_items := v_total_invoice_items + v_updated_invoice_items;

        -- 4. Apply to nav_invoice_items
        WITH matched_nav_items AS (
            SELECT nii.id
            FROM public.nav_invoice_items nii
            JOIN public.nav_invoices ni ON ni.id = nii.invoice_id
            WHERE ni.company_id = p_company_id
              AND (
                v_rule.direction = 'ALL' 
                OR (v_rule.direction = 'INBOUND' AND ni.invoice_direction = 'INBOUND')
                OR (v_rule.direction = 'OUTBOUND' AND ni.invoice_direction = 'OUTBOUND')
              )
              AND (
                v_clean_rule_tax IS NULL
                OR (
                    v_is_hungarian_tax AND (
                        SUBSTRING(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[^0-9]', '', 'g') FROM 1 FOR 8) = v_clean_rule_tax
                        OR SUBSTRING(REGEXP_REPLACE(COALESCE(ni.customer_tax_number, ''), '[^0-9]', '', 'g') FROM 1 FOR 8) = v_clean_rule_tax
                    )
                )
                OR (
                    NOT v_is_hungarian_tax AND (
                        UPPER(REGEXP_REPLACE(COALESCE(ni.supplier_tax_number, ''), '[\s\-]', '', 'g')) = v_clean_rule_tax
                        OR UPPER(REGEXP_REPLACE(COALESCE(ni.customer_tax_number, ''), '[\s\-]', '', 'g')) = v_clean_rule_tax
                    )
                )
              )
              AND (
                (v_rule.pattern_type = 'contains' AND nii.line_description ILIKE ('%' || v_escaped_pattern || '%') ESCAPE '\')
                OR (v_rule.pattern_type = 'exact' AND nii.line_description ILIKE v_escaped_pattern ESCAPE '\')
              )
              AND (
                NOT p_only_unclassified 
                OR nii.gl_classifications IS NULL 
                OR nii.gl_classifications->p_preset_id::text IS NULL
                OR (nii.gl_classifications->p_preset_id::text->>'is_manual')::boolean IS NOT TRUE
              )
        ),
        updated_nav AS (
            UPDATE public.nav_invoice_items nii
            SET gl_classifications = jsonb_set(
                    COALESCE(nii.gl_classifications, '{}'::jsonb),
                    ARRAY[p_preset_id::text],
                    jsonb_build_object(
                        'gl_account_id', v_rule.target_gl_account_id,
                        'gl_number', v_rule.target_gl_number,
                        'is_manual', false,
                        'rule_id', v_rule.id,
                        'reasoning', 'Számlaszabály: ' || v_rule.name
                    )
                ),
                vat_code_id = CASE 
                    WHEN v_rule.target_vat_code_id IS NOT NULL THEN v_rule.target_vat_code_id 
                    ELSE nii.vat_code_id 
                END,
                vat_code = CASE 
                    WHEN v_rule.target_vat_code_id IS NOT NULL AND v_rule.target_vat_code IS NOT NULL THEN v_rule.target_vat_code 
                    ELSE nii.vat_code 
                END
            FROM matched_nav_items mni
            WHERE nii.id = mni.id
            RETURNING nii.id
        )
        SELECT COUNT(*) INTO v_updated_nav_items FROM updated_nav;
        v_total_nav_items := v_total_nav_items + v_updated_nav_items;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'rules_count', v_rules_count,
        'updated_invoice_items', v_total_invoice_items,
        'updated_nav_items', v_total_nav_items,
        'total_updated', v_total_invoice_items + v_total_nav_items
    );
END;
$$;
