-- =============================================================================
-- Migration: 20260826_optimize_ev_record_counts.sql
-- Description: RPC function to batch fetch all EV register counts in a single query
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_ev_record_counts(
  p_company_id uuid,
  p_tax_year int
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receivables bigint;
  v_assets bigint;
  v_inventory bigint;
  v_log bigint;
  v_claims bigint;
  v_wages bigint;
  v_cashbook bigint;
  v_scrapping bigint;
  v_audit_log bigint;
BEGIN
  -- Access Control: Check if current user is a company member or assigned accountant
  IF NOT (
    public.user_is_company_member(p_company_id)
    OR EXISTS (
      SELECT 1 FROM public.accounty_assignments
      WHERE company_id = p_company_id
        AND accountant_user_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  SELECT count(*) INTO v_receivables FROM public.accounty_ev_records_receivables WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_assets FROM public.accounty_ev_records_fixed_assets WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_inventory FROM public.accounty_ev_records_inventory WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_log FROM public.accounty_ev_records_vehicle_log WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_claims FROM public.accounty_ev_records_other_claims WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_wages FROM public.accounty_ev_records_wages WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_cashbook FROM public.accounty_penztarkonyv_tetel WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_scrapping FROM public.accounty_ev_records_scrapping WHERE company_id = p_company_id AND tax_year = p_tax_year;
  SELECT count(*) INTO v_audit_log FROM public.accounty_ev_audit_log WHERE company_id = p_company_id;

  RETURN jsonb_build_object(
    'vevo-szallito', v_receivables,
    'tao-kesz', v_assets,
    'keszlet', v_inventory,
    'utnyilv', v_log,
    'berbeadas', round(v_claims / 2.0),
    'valuta', round(v_claims / 2.0),
    'munkaber', round(v_wages / 2.0),
    'penztarkonyv', v_cashbook,
    'selejtezes', v_scrapping,
    'lekerdezes', v_audit_log,
    'jog-bizt', round(v_wages / 2.0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ev_record_counts(uuid, int) TO anon, authenticated;
