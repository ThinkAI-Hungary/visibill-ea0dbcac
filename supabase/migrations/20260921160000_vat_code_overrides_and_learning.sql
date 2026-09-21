-- Migration: 20260921160000_vat_code_overrides_and_learning.sql
-- Description: Add vat_code_id, vat_code, is_vat_code_manual to invoice items tables,
-- create vat_code_overrides_log for few-shot ML learning, and override_vat_code_batch RPC.

-- 1. Add columns to nav_invoice_items
ALTER TABLE public.nav_invoice_items
    ADD COLUMN IF NOT EXISTS vat_code_id uuid REFERENCES public.vat_codes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vat_code text,
    ADD COLUMN IF NOT EXISTS is_vat_code_manual boolean DEFAULT false;

-- 2. Add columns to invoice_items
ALTER TABLE public.invoice_items
    ADD COLUMN IF NOT EXISTS vat_code_id uuid REFERENCES public.vat_codes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vat_code text,
    ADD COLUMN IF NOT EXISTS is_vat_code_manual boolean DEFAULT false;

-- Indexes on invoice item tables
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_vat_code_id
    ON public.nav_invoice_items(vat_code_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_vat_code_id
    ON public.invoice_items(vat_code_id);

-- 3. Create public.vat_code_overrides_log for Machine Learning pattern recognition
CREATE TABLE IF NOT EXISTS public.vat_code_overrides_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    item_id uuid NOT NULL,
    source_table text NOT NULL, -- 'nav_invoice_items' or 'invoice_items'
    partner_tax_number text,    -- 8-digit or full tax number
    partner_name text,
    item_description text NOT NULL,
    original_vat_rate text,
    original_vat_code text,
    new_vat_code_id uuid REFERENCES public.vat_codes(id) ON DELETE CASCADE,
    new_vat_code text NOT NULL,
    direction text,             -- 'INBOUND' or 'OUTBOUND'
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

-- Indexes for lightning fast learning rule lookups
CREATE INDEX IF NOT EXISTS idx_vat_overrides_company_partner
    ON public.vat_code_overrides_log(company_id, partner_tax_number);

CREATE INDEX IF NOT EXISTS idx_vat_overrides_company_desc
    ON public.vat_code_overrides_log(company_id, item_description);

CREATE INDEX IF NOT EXISTS idx_vat_overrides_created_at
    ON public.vat_code_overrides_log(company_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.vat_code_overrides_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own company vat code overrides" ON public.vat_code_overrides_log;
CREATE POLICY "Users can view own company vat code overrides"
    ON public.vat_code_overrides_log FOR SELECT
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert vat code overrides for own company" ON public.vat_code_overrides_log;
CREATE POLICY "Users can insert vat code overrides for own company"
    ON public.vat_code_overrides_log FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete vat code overrides for own company" ON public.vat_code_overrides_log;
CREATE POLICY "Users can delete vat code overrides for own company"
    ON public.vat_code_overrides_log FOR DELETE
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

-- 4. Batch RPC for updating VAT codes and logging learning data
CREATE OR REPLACE FUNCTION public.override_vat_code_batch(
    p_items jsonb,
    p_new_vat_code_id uuid,
    p_company_id uuid,
    p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item jsonb;
    v_item_id uuid;
    v_source_table text;
    v_partner_tax_number text;
    v_partner_name text;
    v_item_description text;
    v_original_vat_rate text;
    v_original_vat_code text;
    v_new_vat_code text;
    v_direction text;
BEGIN
    IF jsonb_typeof(p_items) != 'array' THEN
        RAISE EXCEPTION 'p_items must be a JSON array';
    END IF;

    -- Look up new VAT code string if ID is provided
    IF p_new_vat_code_id IS NOT NULL THEN
        SELECT code INTO v_new_vat_code
        FROM public.vat_codes
        WHERE id = p_new_vat_code_id AND company_id = p_company_id;

        IF v_new_vat_code IS NULL THEN
            RAISE EXCEPTION 'VAT code not found for this company';
        END IF;
    ELSE
        v_new_vat_code := NULL;
    END IF;

    -- Process each item in the batch
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_id := (v_item->>'item_id')::uuid;
        v_source_table := v_item->>'source_table';
        v_partner_tax_number := v_item->>'partner_tax_number';
        v_partner_name := v_item->>'partner_name';
        v_item_description := v_item->>'item_description';
        v_original_vat_rate := v_item->>'original_vat_rate';
        v_original_vat_code := v_item->>'original_vat_code';
        v_direction := v_item->>'direction';

        -- Update the specific item table
        IF v_source_table = 'nav_invoice_items' THEN
            UPDATE public.nav_invoice_items
            SET vat_code_id = p_new_vat_code_id,
                vat_code = v_new_vat_code,
                is_vat_code_manual = (p_new_vat_code_id IS NOT NULL)
            WHERE id = v_item_id;
        ELSIF v_source_table = 'invoice_items' THEN
            UPDATE public.invoice_items
            SET vat_code_id = p_new_vat_code_id,
                vat_code = v_new_vat_code,
                is_vat_code_manual = (p_new_vat_code_id IS NOT NULL)
            WHERE id = v_item_id;
        END IF;

        -- Record in learning log if a new code was assigned and description is present
        IF p_new_vat_code_id IS NOT NULL AND v_item_description IS NOT NULL AND trim(v_item_description) != '' THEN
            INSERT INTO public.vat_code_overrides_log (
                company_id,
                item_id,
                source_table,
                partner_tax_number,
                partner_name,
                item_description,
                original_vat_rate,
                original_vat_code,
                new_vat_code_id,
                new_vat_code,
                direction,
                user_id,
                created_at
            ) VALUES (
                p_company_id,
                v_item_id,
                v_source_table,
                v_partner_tax_number,
                v_partner_name,
                trim(v_item_description),
                v_original_vat_rate,
                v_original_vat_code,
                p_new_vat_code_id,
                v_new_vat_code,
                v_direction,
                p_user_id,
                now()
            );
        END IF;
    END LOOP;

    RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.override_vat_code_batch(jsonb, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.override_vat_code_batch(jsonb, uuid, uuid, uuid) TO service_role;
