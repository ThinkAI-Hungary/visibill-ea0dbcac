-- ==============================================================================
-- Migration: 20261014100000_optimize_apply_invoice_item_rules_and_triggers.sql
-- Description:
--   1. Optimize apply_item_project_rules trigger function to directly use NEW.company_id
--      on nav_invoice_items instead of subquerying nav_invoices row-by-row.
--   2. Restrict trg_nav_invoice_items_auto_vat to UPDATE OF vat_rate, net_amount, vat_amount
--      so accounting classifications do not trigger unnecessary VAT recomputations.
--   3. Add p_date_from and p_date_to support, composite index filtering, idempotency
--      checks, and SET statement_timeout = '60s' to apply_invoice_item_rules RPC.
--   4. Drop obsolete 4-parameter overload to avoid Postgres function ambiguity (42725).
-- ==============================================================================

-- 1. Optimize apply_item_project_rules trigger
CREATE OR REPLACE FUNCTION public.apply_item_project_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rule_project_id UUID;
  item_gl_number TEXT;
  item_company_id UUID;
BEGIN
  -- If project_id is already set, do not override
  IF NEW.project_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Extract G/L number
  item_gl_number := public.get_gl_number_from_classifications(NEW.gl_classifications);
  IF item_gl_number IS NULL OR NEW.line_description IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch company_id (use NEW.company_id if already present)
  IF TG_TABLE_NAME = 'nav_invoice_items' THEN
    item_company_id := NEW.company_id;
    IF item_company_id IS NULL THEN
      SELECT company_id INTO item_company_id FROM public.nav_invoices WHERE id = NEW.nav_invoice_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'invoice_items' THEN
    SELECT company_id INTO item_company_id FROM public.invoices WHERE id = NEW.invoice_id;
  END IF;

  IF item_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find matching rule (exact, case-insensitive match on description and exact match on gl_number)
  SELECT project_id INTO rule_project_id
  FROM public.item_project_rules
  WHERE company_id = item_company_id
    AND LOWER(TRIM(line_description)) = LOWER(TRIM(NEW.line_description))
    AND gl_number = item_gl_number
  LIMIT 1;

  IF rule_project_id IS NOT NULL THEN
    NEW.project_id := rule_project_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Restrict trg_nav_invoice_items_auto_vat trigger columns
DROP TRIGGER IF EXISTS trg_nav_invoice_items_auto_vat ON public.nav_invoice_items;
CREATE TRIGGER trg_nav_invoice_items_auto_vat 
BEFORE INSERT OR UPDATE OF vat_rate, net_amount, vat_amount 
ON public.nav_invoice_items 
FOR EACH ROW 
EXECUTE FUNCTION public.nav_invoice_items_auto_vat_func();

-- 3. Drop obsolete function overloads
DROP FUNCTION IF EXISTS public.apply_invoice_item_rules(UUID, UUID, UUID, BOOLEAN);
DROP FUNCTION IF EXISTS public.apply_invoice_item_rules(UUID, UUID, UUID, BOOLEAN, DATE, DATE);

-- 4. Recreate apply_invoice_item_rules RPC with high performance & date-range support
CREATE OR REPLACE FUNCTION public.apply_invoice_item_rules(
    p_company_id UUID,
    p_preset_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_only_unclassified BOOLEAN DEFAULT true,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '60s'
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
              AND (p_date_from IS NULL OR COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma) >= p_date_from)
              AND (p_date_to IS NULL OR COALESCE(inv.teljesites_datuma, inv.kibocsatas_datuma) <= p_date_to)
              AND (
                v_rule.direction = 'ALL' 
                OR (v_rule.direction = 'INBOUND' AND COALESCE(inv.invoice_direction, 'INBOUND') = 'INBOUND')
                OR (v_rule.direction = 'OUTBOUND' AND COALESCE(inv.invoice_direction, 'INBOUND') = 'OUTBOUND')
              )
              AND (
                v_clean_rule_tax IS NULL
                OR (
                    v_is_hungarian_tax AND (
                        SUBSTRING(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[^0-9]', '', 'g') FROM 1 FOR 8) = v_clean_rule_tax
                        OR SUBSTRING(REGEXP_REPLACE(COALESCE(inv.vevo_vat_id, ''), '[^0-9]', '', 'g') FROM 1 FOR 8) = v_clean_rule_tax
                    )
                )
                OR (
                    NOT v_is_hungarian_tax AND (
                        UPPER(REGEXP_REPLACE(COALESCE(inv.elado_vat_id, ''), '[\s\-]', '', 'g')) = v_clean_rule_tax
                        OR UPPER(REGEXP_REPLACE(COALESCE(inv.vevo_vat_id, ''), '[\s\-]', '', 'g')) = v_clean_rule_tax
                    )
                )
              )
              AND (
                v_rule.partner_name IS NULL OR TRIM(v_rule.partner_name) = ''
                OR inv.elado_nev ILIKE ('%' || v_rule.partner_name || '%')
                OR inv.vevo_nev ILIKE ('%' || v_rule.partner_name || '%')
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
              AND (
                ii.gl_classifications IS NULL
                OR ii.gl_classifications->p_preset_id::text IS NULL
                OR (ii.gl_classifications->p_preset_id::text->>'gl_number') IS DISTINCT FROM v_rule.target_gl_number
                OR (v_rule.target_vat_code IS NOT NULL AND ii.vat_code IS DISTINCT FROM v_rule.target_vat_code)
                OR (v_rule.target_vat_code_id IS NOT NULL AND ii.vat_code_id IS DISTINCT FROM v_rule.target_vat_code_id)
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
            JOIN public.nav_invoices ni ON ni.id = nii.nav_invoice_id
            WHERE ni.company_id = p_company_id
              AND nii.company_id = p_company_id
              AND (p_date_from IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) >= p_date_from)
              AND (p_date_to IS NULL OR COALESCE(ni.invoice_delivery_date, ni.invoice_issue_date) <= p_date_to)
              AND (
                v_rule.direction = 'ALL' 
                OR (v_rule.direction = 'INBOUND' AND COALESCE(ni.invoice_direction, 'INBOUND') = 'INBOUND')
                OR (v_rule.direction = 'OUTBOUND' AND COALESCE(ni.invoice_direction, 'INBOUND') = 'OUTBOUND')
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
                v_rule.partner_name IS NULL OR TRIM(v_rule.partner_name) = ''
                OR ni.supplier_name ILIKE ('%' || v_rule.partner_name || '%')
                OR ni.customer_name ILIKE ('%' || v_rule.partner_name || '%')
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
              AND (
                nii.gl_classifications IS NULL
                OR nii.gl_classifications->p_preset_id::text IS NULL
                OR (nii.gl_classifications->p_preset_id::text->>'gl_number') IS DISTINCT FROM v_rule.target_gl_number
                OR (v_rule.target_vat_code IS NOT NULL AND nii.vat_code IS DISTINCT FROM v_rule.target_vat_code)
                OR (v_rule.target_vat_code_id IS NOT NULL AND nii.vat_code_id IS DISTINCT FROM v_rule.target_vat_code_id)
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

-- 5. Permissions
REVOKE ALL ON FUNCTION public.apply_invoice_item_rules(UUID, UUID, UUID, BOOLEAN, DATE, DATE) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.apply_invoice_item_rules(UUID, UUID, UUID, BOOLEAN, DATE, DATE) TO authenticated, service_role;

COMMENT ON FUNCTION public.apply_invoice_item_rules IS 'Batch applies active invoice item classification rules with date-range filtering, idempotency guards and 60s statement timeout.';
