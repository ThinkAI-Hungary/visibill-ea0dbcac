-- ==============================================================================
-- Migration: 20260924120000_create_invoice_item_rules.sql
-- Description:
--   1. Create public.invoice_item_rules table for deterministic line item rules
--      (matching line_description to target GL number and VAT code).
--   2. Support company-level and accountant/tenant-wide rules with full RLS.
--   3. Create apply_invoice_item_rules RPC for bulk rule execution.
-- ==============================================================================

-- 1. Create invoice_item_rules table
CREATE TABLE IF NOT EXISTS public.invoice_item_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description_pattern TEXT NOT NULL,
    pattern_type TEXT DEFAULT 'contains' CHECK (pattern_type IN ('contains', 'exact', 'regex')),
    direction TEXT DEFAULT 'ALL' CHECK (direction IN ('INBOUND', 'OUTBOUND', 'ALL')),
    partner_tax_number VARCHAR(32),
    partner_name TEXT,
    target_gl_number VARCHAR(16) NOT NULL,
    target_gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE SET NULL,
    target_vat_code_id UUID REFERENCES public.vat_codes(id) ON DELETE SET NULL,
    target_vat_code VARCHAR(32),
    scope TEXT DEFAULT 'company' CHECK (scope IN ('company', 'tenant', 'global')),
    is_active BOOLEAN DEFAULT true NOT NULL,
    priority INTEGER DEFAULT 100 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Indexes for high performance
CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_company 
  ON public.invoice_item_rules(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_scope_user 
  ON public.invoice_item_rules(scope, user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_gl_num 
  ON public.invoice_item_rules(target_gl_number);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_gl_acc 
  ON public.invoice_item_rules(target_gl_account_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_vat_code 
  ON public.invoice_item_rules(target_vat_code_id);

CREATE INDEX IF NOT EXISTS idx_invoice_item_rules_partner_tax 
  ON public.invoice_item_rules(partner_tax_number);

-- 3. Enable RLS
ALTER TABLE public.invoice_item_rules ENABLE ROW LEVEL SECURITY;

-- Drop any previous policies
DROP POLICY IF EXISTS "Enable read access for invoice item rules" ON public.invoice_item_rules;
DROP POLICY IF EXISTS "Enable insert for invoice item rules" ON public.invoice_item_rules;
DROP POLICY IF EXISTS "Enable update for invoice item rules" ON public.invoice_item_rules;
DROP POLICY IF EXISTS "Enable delete for invoice item rules" ON public.invoice_item_rules;
DROP POLICY IF EXISTS "invoice_item_rules_service_role_all" ON public.invoice_item_rules;

-- RLS Policies
CREATE POLICY "Enable read access for invoice item rules"
  ON public.invoice_item_rules
  FOR SELECT
  TO authenticated
  USING (
    scope = 'global'
    OR (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = invoice_item_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable insert for invoice item rules"
  ON public.invoice_item_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      (scope = 'company' OR scope IS NULL) AND company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = invoice_item_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable update for invoice item rules"
  ON public.invoice_item_rules
  FOR UPDATE
  TO authenticated
  USING (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = invoice_item_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = invoice_item_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "Enable delete for invoice item rules"
  ON public.invoice_item_rules
  FOR DELETE
  TO authenticated
  USING (
    (scope = 'tenant' AND user_id = (SELECT auth.uid()))
    OR (
      company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_members cm
        WHERE cm.company_id = invoice_item_rules.company_id
          AND cm.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "invoice_item_rules_service_role_all"
  ON public.invoice_item_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.invoice_item_rules FROM anon;

-- 4. RPC to batch apply invoice item rules to company invoices
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

        -- 1. Apply to submitted invoice_items
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
                v_rule.partner_tax_number IS NULL 
                OR TRIM(v_rule.partner_tax_number) = ''
                OR inv.partner_tax_number LIKE (v_rule.partner_tax_number || '%')
              )
              AND (
                (v_rule.pattern_type = 'contains' AND ii.line_description ILIKE ('%' || v_rule.description_pattern || '%'))
                OR (v_rule.pattern_type = 'exact' AND ii.line_description ILIKE v_rule.description_pattern)
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

        -- 2. Apply to nav_invoice_items
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
                v_rule.partner_tax_number IS NULL 
                OR TRIM(v_rule.partner_tax_number) = ''
                OR ni.supplier_tax_number LIKE (v_rule.partner_tax_number || '%')
                OR ni.customer_tax_number LIKE (v_rule.partner_tax_number || '%')
              )
              AND (
                (v_rule.pattern_type = 'contains' AND nii.line_description ILIKE ('%' || v_rule.description_pattern || '%'))
                OR (v_rule.pattern_type = 'exact' AND nii.line_description ILIKE v_rule.description_pattern)
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
