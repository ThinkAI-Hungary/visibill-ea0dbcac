-- Migration: Add company_id and indexes to nav_invoice_items, add get_unclassified_gl_items RPC
-- Description: Optimizes nav_invoice_items multi-tenancy and resolves PostgREST statement timeout in GL classification

-- 1. Add company_id column with foreign key cascade
ALTER TABLE public.nav_invoice_items 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 2. Backfill existing records from parent nav_invoices
UPDATE public.nav_invoice_items nii
SET company_id = ni.company_id
FROM public.nav_invoices ni
WHERE nii.nav_invoice_id = ni.id 
  AND nii.company_id IS NULL;

-- 3. Automatic company_id inheritance trigger for future inserts
CREATE OR REPLACE FUNCTION public.set_nav_invoice_items_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.nav_invoice_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id 
    FROM public.nav_invoices 
    WHERE id = NEW.nav_invoice_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

DROP TRIGGER IF EXISTS trg_set_nav_invoice_items_company_id ON public.nav_invoice_items;
CREATE TRIGGER trg_set_nav_invoice_items_company_id
  BEFORE INSERT ON public.nav_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_nav_invoice_items_company_id();

-- 4. Indexes for rapid tenant filtering and unclassified item resolution
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_company_id 
  ON public.nav_invoice_items(company_id);

CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_company_unclassified 
  ON public.nav_invoice_items(company_id) 
  WHERE (gl_classifications IS NULL);

-- 5. High-performance RPC to fetch unclassified GL items for a company & preset (ADR A-016)
CREATE OR REPLACE FUNCTION public.get_unclassified_gl_items(
  p_company_id uuid,
  p_preset_id text
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
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
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
      AND (t.gl_classifications IS NULL OR NOT (t.gl_classifications ? p_preset_id));
END;
$$;

-- 6. Permissions following DB checklist (F-4, F-5)
REVOKE EXECUTE ON FUNCTION public.get_unclassified_gl_items(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_unclassified_gl_items(uuid, text) TO authenticated, service_role;

-- 7. Document column & RPC
COMMENT ON COLUMN public.nav_invoice_items.company_id IS 'Cég azonosító multi-tenant szűréshez és közvetlen indexeléshez';
COMMENT ON FUNCTION public.get_unclassified_gl_items(uuid, text) IS 'Optimalizált lekérdezés a még nem osztályozott főkönyvi tételekhez a worker számára';
