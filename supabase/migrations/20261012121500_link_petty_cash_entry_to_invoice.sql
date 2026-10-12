-- Migration: 20261012121500_link_petty_cash_entry_to_invoice.sql
-- Description: Add atomic RPCs to link an existing petty cash entry to an unpaid invoice,
--              and to safely unlink/detach an invoice from a petty cash entry.

-- 1. Function: link_petty_cash_entry_to_invoice
CREATE OR REPLACE FUNCTION public.link_petty_cash_entry_to_invoice(
  p_company_id uuid,
  p_entry_id uuid,
  p_invoice_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry record;
  v_inv record;
  v_partner_id uuid := NULL;
  v_vat text;
  v_name text;
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

  -- 2. Fetch petty cash entry
  SELECT * INTO v_entry
  FROM petty_cash_entries
  WHERE id = p_entry_id AND company_id = p_company_id;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'A pénztári tétel nem található ennél a cégnél!';
  END IF;

  -- 3. Fetch invoice
  SELECT * INTO v_inv
  FROM invoices
  WHERE id = p_invoice_id AND company_id = p_company_id;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'A számla nem található ennél a cégnél!';
  END IF;

  -- 4. Resolve partner if entry has no partner_id
  IF v_entry.partner_id IS NULL THEN
    v_vat := CASE WHEN v_inv.invoice_direction ILIKE '%outbound%' THEN v_inv.vevo_vat_id ELSE v_inv.elado_vat_id END;
    v_name := CASE WHEN v_inv.invoice_direction ILIKE '%outbound%' THEN v_inv.vevo_nev ELSE v_inv.elado_nev END;

    IF v_vat IS NOT NULL AND TRIM(v_vat) <> '' THEN
      SELECT p.id INTO v_partner_id
      FROM public.partners p
      WHERE p.company_id = p_company_id
        AND (
          p.tax_number = v_vat
          OR (
            length(regexp_replace(v_vat, '[^0-9]', '', 'g')) >= 8
            AND length(regexp_replace(p.tax_number, '[^0-9]', '', 'g')) >= 8
            AND SUBSTRING(regexp_replace(p.tax_number, '[^0-9]', '', 'g') FROM 1 FOR 8) = SUBSTRING(regexp_replace(v_vat, '[^0-9]', '', 'g') FROM 1 FOR 8)
          )
        )
      LIMIT 1;
    END IF;

    IF v_partner_id IS NULL AND v_name IS NOT NULL AND TRIM(v_name) <> '' THEN
      SELECT p.id INTO v_partner_id
      FROM public.partners p
      WHERE p.company_id = p_company_id
        AND LOWER(TRIM(p.name)) = LOWER(TRIM(v_name))
      LIMIT 1;
    END IF;
  ELSE
    v_partner_id := v_entry.partner_id;
  END IF;

  -- 5. Atomic Update of petty_cash_entries
  UPDATE petty_cash_entries
  SET
    source_table = 'invoices',
    source_id = p_invoice_id,
    source_type = 'invoice_settlement',
    partner_id = COALESCE(v_partner_id, partner_id)
  WHERE id = p_entry_id;

  -- 6. Atomic Update of invoices
  UPDATE invoices
  SET
    fizetve = true,
    is_manual_payment = true,
    manual_payment_date = v_entry.entry_date,
    manual_payment_type = 'cash',
    manual_payment_note = COALESCE(manual_payment_note, 'Házipénztár bizonylathoz kapcsolva')
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'invoice_id', p_invoice_id,
    'invoice_number', v_inv.bizonylatsorszam
  );
END;
$$;

-- 2. Function: unlink_petty_cash_entry
CREATE OR REPLACE FUNCTION public.unlink_petty_cash_entry(
  p_company_id uuid,
  p_entry_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_entry record;
  v_old_source_id uuid;
  v_old_source_table text;
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

  -- 2. Fetch petty cash entry
  SELECT * INTO v_entry
  FROM petty_cash_entries
  WHERE id = p_entry_id AND company_id = p_company_id;

  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'A pénztári tétel nem található ennél a cégnél!';
  END IF;

  v_old_source_id := v_entry.source_id;
  v_old_source_table := v_entry.source_table;

  -- 3. Reset entry link
  UPDATE petty_cash_entries
  SET
    source_table = NULL,
    source_id = NULL
  WHERE id = p_entry_id;

  -- 4. Re-open invoice if it was linked to an invoice and settled by cash
  IF v_old_source_table = 'invoices' AND v_old_source_id IS NOT NULL THEN
    UPDATE invoices
    SET
      fizetve = false,
      is_manual_payment = false,
      manual_payment_date = NULL,
      manual_payment_type = NULL,
      manual_payment_note = NULL
    WHERE id = v_old_source_id AND company_id = p_company_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'unlinked_invoice_id', v_old_source_id
  );
END;
$$;

-- Permissions & Grants
REVOKE ALL ON FUNCTION public.link_petty_cash_entry_to_invoice(uuid, uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.link_petty_cash_entry_to_invoice(uuid, uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.unlink_petty_cash_entry(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_petty_cash_entry(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.link_petty_cash_entry_to_invoice(uuid, uuid, uuid) IS 
  'Atomi számla-hozzárendelés meglévő házipénztári bizonylathoz, számla lezárásával készpénzes rendezésként.';

COMMENT ON FUNCTION public.unlink_petty_cash_entry(uuid, uuid) IS 
  'Számla-hozzárendelés biztonságos feloldása házipénztári bizonylatról, számla újranyitásával.';
