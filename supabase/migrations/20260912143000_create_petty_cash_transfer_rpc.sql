-- ============================================================
-- Migration: 20260912143000_create_petty_cash_transfer_rpc.sql
-- Description: Create atomic RPC functions for petty cash inter-register transfers
-- Author: Antigravity / Pair Programming
-- ============================================================

-- 1. Atomic create_petty_cash_transfer RPC
CREATE OR REPLACE FUNCTION public.create_petty_cash_transfer(
  p_company_id uuid,
  p_from_register_id uuid,
  p_to_register_id uuid,
  p_entry_date date,
  p_amount numeric,
  p_currency text DEFAULT 'HUF',
  p_description text DEFAULT NULL
)
RETURNS TABLE (out_entry_id uuid, in_entry_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_from_name text;
  v_to_name text;
  v_desc_out text;
  v_desc_in text;
  v_id_out uuid := gen_random_uuid();
  v_id_in uuid := gen_random_uuid();
  v_abs_amount numeric := ABS(p_amount);
BEGIN
  -- 1. Validation
  IF v_abs_amount <= 0 THEN
    RAISE EXCEPTION 'Az átvezetendő összegnek nagyobbnak kell lennie nullánál';
  END IF;

  IF p_from_register_id = p_to_register_id THEN
    RAISE EXCEPTION 'A forrás és cél pénztár nem lehet azonos';
  END IF;

  -- Verify from register belongs to company
  SELECT r.name INTO v_from_name
  FROM petty_cash_registers r
  WHERE r.id = p_from_register_id AND r.company_id = p_company_id;

  IF v_from_name IS NULL THEN
    RAISE EXCEPTION 'A forrás pénztár nem található ennél a cégnél';
  END IF;

  -- Verify to register belongs to company
  SELECT r.name INTO v_to_name
  FROM petty_cash_registers r
  WHERE r.id = p_to_register_id AND r.company_id = p_company_id;

  IF v_to_name IS NULL THEN
    RAISE EXCEPTION 'A cél pénztár nem található ennél a cégnél';
  END IF;

  -- Verify caller has access to this company (via company_members or support admin)
  IF v_user_id IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = p_company_id AND cm.user_id = v_user_id)
      OR is_support_admin()
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultságod a cég pénztári tételeinek módosítására';
    END IF;
  END IF;

  -- Prepare descriptions
  IF p_description IS NOT NULL AND TRIM(p_description) != '' THEN
    v_desc_out := p_description;
    v_desc_in := p_description;
  ELSE
    v_desc_out := 'Pénztárközi átvezetés: ' || v_from_name || ' ➔ ' || v_to_name;
    v_desc_in := 'Pénztárközi átvezetés: ' || v_from_name || ' ➔ ' || v_to_name;
  END IF;

  -- 2. Insert outgoing leg (negative amount, expense from source register)
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
    created_by
  ) VALUES (
    v_id_out,
    p_company_id,
    p_from_register_id,
    p_entry_date,
    v_desc_out,
    -v_abs_amount,
    COALESCE(p_currency, 'HUF'),
    'transfer',
    v_id_in,
    'petty_cash_entries',
    'manual',
    v_user_id
  );

  -- 3. Insert incoming leg (positive amount, income to destination register)
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
    created_by
  ) VALUES (
    v_id_in,
    p_company_id,
    p_to_register_id,
    p_entry_date,
    v_desc_in,
    v_abs_amount,
    COALESCE(p_currency, 'HUF'),
    'transfer',
    v_id_out,
    'petty_cash_entries',
    'manual',
    v_user_id
  );

  RETURN QUERY SELECT v_id_out, v_id_in;
END;
$$;

REVOKE ALL ON FUNCTION public.create_petty_cash_transfer(uuid, uuid, uuid, date, numeric, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_petty_cash_transfer(uuid, uuid, uuid, date, numeric, text, text) TO authenticated, service_role;


-- 2. Atomic delete_petty_cash_transfer RPC
CREATE OR REPLACE FUNCTION public.delete_petty_cash_transfer(p_entry_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_company_id uuid;
  v_linked_id uuid;
  v_source_type text;
BEGIN
  -- Check entry
  SELECT company_id, source_id, source_type
  INTO v_company_id, v_linked_id, v_source_type
  FROM petty_cash_entries
  WHERE id = p_entry_id;

  IF v_company_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check permissions
  IF v_user_id IS NOT NULL THEN
    IF NOT (
      EXISTS (SELECT 1 FROM company_members cm WHERE cm.company_id = v_company_id AND cm.user_id = v_user_id)
      OR is_support_admin()
    ) THEN
      RAISE EXCEPTION 'Nincs jogosultságod a tétel törlésére';
    END IF;
  END IF;

  -- If it's a transfer with a linked counter-entry, delete both
  IF v_source_type = 'transfer' AND v_linked_id IS NOT NULL THEN
    DELETE FROM petty_cash_entries
    WHERE id IN (p_entry_id, v_linked_id);
  ELSE
    DELETE FROM petty_cash_entries
    WHERE id = p_entry_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_petty_cash_transfer(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_petty_cash_transfer(uuid) TO authenticated, service_role;
