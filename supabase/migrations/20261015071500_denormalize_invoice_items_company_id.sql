-- Migration: Denormalize company_id onto invoice_items, add indexes, triggers, and update RLS
-- Eliminates PostgREST Lateral Join sequential scans and statement timeouts (57014)
-- ADR Reference: A-097 Extension / Error Hunter 2026-10-15

-- 1. Add company_id column with foreign key
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Backfill existing items from parent invoices
UPDATE public.invoice_items ii
SET company_id = i.company_id
FROM public.invoices i
WHERE ii.invoice_id = i.id 
  AND ii.company_id IS NULL;

-- 3. Create high-performance multi-tenant indexes
CREATE INDEX IF NOT EXISTS idx_invoice_items_company_id 
ON public.invoice_items(company_id);

CREATE INDEX IF NOT EXISTS idx_invoice_items_comp_inv 
ON public.invoice_items(company_id, invoice_id);

-- 4. Triggers to ensure company_id consistency (Defense in Depth)
CREATE OR REPLACE FUNCTION public.set_invoice_items_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (NEW.company_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id)) 
     AND NEW.invoice_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id 
    FROM public.invoices 
    WHERE id = NEW.invoice_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_invoice_items_company_id ON public.invoice_items;
CREATE TRIGGER trg_set_invoice_items_company_id
BEFORE INSERT OR UPDATE OF invoice_id, company_id ON public.invoice_items
FOR EACH ROW EXECUTE FUNCTION public.set_invoice_items_company_id();

CREATE OR REPLACE FUNCTION public.sync_invoice_items_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    UPDATE public.invoice_items
    SET company_id = NEW.company_id
    WHERE invoice_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_items_company_id ON public.invoices;
CREATE TRIGGER trg_sync_invoice_items_company_id
AFTER UPDATE OF company_id ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_items_company_id();

-- 5. Optimize RLS Policy on invoice_items (direct company_members check without invoices join)
DROP POLICY IF EXISTS "Members can manage invoice items" ON public.invoice_items;
CREATE POLICY "Members can manage invoice items" ON public.invoice_items
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = invoice_items.company_id
      AND cm.user_id = (SELECT auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = invoice_items.company_id
      AND cm.user_id = (SELECT auth.uid())
  )
);

-- 6. Update get_unclassified_gl_items to filter invoice_items directly on company_id
CREATE OR REPLACE FUNCTION public.get_unclassified_gl_items(
  p_company_id uuid,
  p_preset_id text,
  p_limit integer DEFAULT 1000
)
RETURNS TABLE (
  id uuid,
  source_table text,
  direction text,
  partner_name text,
  document_number text,
  document_date text,
  description text,
  product_code text,
  amount numeric,
  quantity numeric,
  unit text,
  vat_rate text,
  is_reverse_charge boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_effective_limit integer;
BEGIN
  v_effective_limit := LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000);

  RETURN QUERY
    (
      -- 1. NAV invoice items (unclassified for preset_id, excluding excluded_from_accounting)
      SELECT 
        nii.id,
        'nav_invoice_items'::text AS source_table,
        ni.invoice_direction::text AS direction,
        (CASE WHEN ni.invoice_direction = 'OUTBOUND' THEN ni.customer_name ELSE ni.supplier_name END)::text AS partner_name,
        ni.invoice_number::text AS document_number,
        ni.invoice_issue_date::text AS document_date,
        nii.line_description::text AS description,
        nii.product_code::text AS product_code,
        nii.net_amount::numeric AS amount,
        nii.quantity::numeric AS quantity,
        nii.unit_of_measure::text AS unit,
        nii.vat_rate::text AS vat_rate,
        COALESCE(ni.is_reverse_charge, false)::boolean AS is_reverse_charge
      FROM public.nav_invoices ni
      JOIN public.nav_invoice_items nii ON nii.nav_invoice_id = ni.id
      WHERE ni.company_id = p_company_id
        AND nii.company_id = p_company_id
        AND COALESCE(ni.exclude_from_accounting, false) = false
        AND COALESCE(nii.exclude_from_accounting, false) = false
        AND (nii.gl_classifications IS NULL OR NOT (nii.gl_classifications ? p_preset_id))

      UNION ALL

      -- 2. Manual invoice items (unclassified for preset_id, excluding excluded_from_accounting)
      SELECT 
        ii.id,
        'invoice_items'::text AS source_table,
        i.invoice_direction::text AS direction,
        (CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END)::text AS partner_name,
        i.bizonylatsorszam::text AS document_number,
        i.kibocsatas_datuma::text AS document_date,
        ii.line_description::text AS description,
        ii.product_code::text AS product_code,
        ii.net_amount::numeric AS amount,
        ii.quantity::numeric AS quantity,
        ii.unit_of_measure::text AS unit,
        ii.vat_rate::text AS vat_rate,
        COALESCE(i.forditott_adozas, false)::boolean AS is_reverse_charge
      FROM public.invoices i
      JOIN public.invoice_items ii ON ii.invoice_id = i.id
      WHERE i.company_id = p_company_id
        AND ii.company_id = p_company_id
        AND COALESCE(i.exclude_from_accounting, false) = false
        AND COALESCE(ii.exclude_from_accounting, false) = false
        AND (ii.gl_classifications IS NULL OR NOT (ii.gl_classifications ? p_preset_id))

      UNION ALL

      -- 3. Transactions (unmatched and unclassified for preset_id)
      SELECT 
        t.id,
        'transactions'::text AS source_table,
        t.type::text AS direction,
        NULL::text AS partner_name,
        NULL::text AS document_number,
        t.transaction_date::text AS document_date,
        t.description::text AS description,
        NULL::text AS product_code,
        t.amount::numeric AS amount,
        NULL::numeric AS quantity,
        NULL::text AS unit,
        NULL::text AS vat_rate,
        false::boolean AS is_reverse_charge
      FROM public.transactions t
      WHERE t.company_id = p_company_id
        AND t.matched_invoice_id IS NULL
        AND (t.gl_classifications IS NULL OR NOT (t.gl_classifications ? p_preset_id))
    )
    LIMIT v_effective_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_unclassified_gl_items(uuid, text, integer) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_unclassified_gl_items(uuid, text, integer) TO authenticated, service_role;

COMMENT ON COLUMN public.invoice_items.company_id IS 'Cég azonosító multi-tenant közvetlen szűréshez és indexeléshez (ADR A-097 mintájára)';
