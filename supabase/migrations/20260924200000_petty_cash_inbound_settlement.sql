-- Migration: 20260924200000_petty_cash_inbound_settlement.sql
-- Description: Support settling both inbound (supplier, negative amount) and outbound (customer, positive amount) invoices via petty cash

CREATE OR REPLACE FUNCTION public.settle_invoices_via_petty_cash(
  p_company_id uuid,
  p_register_id uuid,
  p_entry_date date,
  p_invoice_ids uuid[],
  p_description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reg_name text;
  v_total_amount numeric := 0;
  v_biz_sorszamok text;
  v_entry_id uuid := gen_random_uuid();
  v_desc text;
  v_inv_count integer := 0;
  v_first_inv_id uuid;
  v_first_partner_id uuid;
BEGIN
  -- 1. Authorization check
  IF v_user_id IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = v_user_id)
      OR is_support_admin()
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég pénztári tételeinek módosítására';
    END IF;
  END IF;

  -- 2. Input validations
  IF p_invoice_ids IS NULL OR array_length(p_invoice_ids, 1) IS NULL OR array_length(p_invoice_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Legalább egy számla kiválasztása kötelező!';
  END IF;

  -- Verify register belongs to company
  SELECT r.name INTO v_reg_name
  FROM petty_cash_registers r
  WHERE r.id = p_register_id AND r.company_id = p_company_id;

  IF v_reg_name IS NULL THEN
    RAISE EXCEPTION 'A kiválasztott pénztár nem található ennél a cégnél!';
  END IF;

  -- Verify all invoices exist and belong to company
  -- Outbound invoices increase cash (positive), Inbound invoices decrease cash (negative)
  SELECT 
    COUNT(*),
    COALESCE(SUM(
      CASE 
        WHEN invoice_direction ILIKE '%outbound%' THEN brutto_vegosszeg 
        ELSE -brutto_vegosszeg 
      END
    ), 0),
    string_agg(bizonylatsorszam, ', ' ORDER BY kibocsatas_datuma, bizonylatsorszam),
    MIN(id::text)::uuid,
    MIN(partner_id::text)::uuid
  INTO v_inv_count, v_total_amount, v_biz_sorszamok, v_first_inv_id, v_first_partner_id
  FROM invoices
  WHERE id = ANY(p_invoice_ids) AND company_id = p_company_id;

  IF v_inv_count != array_length(p_invoice_ids, 1) THEN
    RAISE EXCEPTION 'Egy vagy több számla nem található, vagy nem tartozik ehhez a céghez!';
  END IF;

  -- Format description
  IF p_description IS NOT NULL AND TRIM(p_description) != '' THEN
    v_desc := TRIM(p_description);
  ELSE
    v_desc := 'Utalásos számla KP-ban rendezve: ' || v_biz_sorszamok;
  END IF;

  -- 3. Atomic Insert into petty_cash_entries
  INSERT INTO petty_cash_entries (
    id,
    company_id,
    register_id,
    entry_date,
    description,
    amount,
    currency,
    source_type,
    source_id,
    source_table,
    routed_by,
    created_by,
    partner_id
  ) VALUES (
    v_entry_id,
    p_company_id,
    p_register_id,
    p_entry_date,
    v_desc,
    ROUND(v_total_amount),
    'HUF',
    'invoice_settlement',
    CASE WHEN v_inv_count = 1 THEN v_first_inv_id ELSE NULL END,
    CASE WHEN v_inv_count = 1 THEN 'invoices' ELSE NULL END,
    'manual',
    v_user_id,
    CASE WHEN v_inv_count = 1 THEN v_first_partner_id ELSE NULL END
  );

  -- 4. Atomic Update of invoices
  UPDATE invoices
  SET 
    fizetve = true,
    fizetes_napja = COALESCE(fizetes_napja, p_entry_date)
  WHERE id = ANY(p_invoice_ids) AND company_id = p_company_id;

  -- 5. Return summary payload
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', v_entry_id,
    'settled_count', v_inv_count,
    'total_amount', ROUND(v_total_amount),
    'bizonylatsorszamok', v_biz_sorszamok
  );
END;
$$;

-- Secure function permissions
REVOKE ALL ON FUNCTION public.settle_invoices_via_petty_cash(uuid, uuid, date, uuid[], text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.settle_invoices_via_petty_cash(uuid, uuid, date, uuid[], text) TO authenticated, service_role;
