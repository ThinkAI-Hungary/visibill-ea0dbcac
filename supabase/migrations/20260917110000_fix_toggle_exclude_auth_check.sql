-- Migration: 20260917110000_fix_toggle_exclude_auth_check.sql
-- Description: Fix column "email" does not exist in toggle_invoice_exclude_from_accounting
--              and toggle_invoice_item_exclude_from_accounting RPC functions.
--              Table public.profiles has no "email" column (email is in auth.users, and user id is user_id).

-- ══════════════════════════════════════════════════════════════════
-- 1. UPDATE TOGGLE_INVOICE_EXCLUDE_FROM_ACCOUNTING RPC
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_invoice_exclude_from_accounting(
  p_company_id uuid,
  p_invoice_id uuid,
  p_is_submitted boolean,
  p_exclude boolean,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_doc_number text;
  v_item_ids text[];
  v_hdr RECORD;
  v_user_id uuid;
BEGIN
  -- 1. Authorization check
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
       WHERE company_id = p_company_id
         AND user_id = auth.uid()
    ) AND NOT public.is_support_admin()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND (role IN ('management', 'thinkai', 'support_admin') OR is_support_admin = true)
      ) AND NOT EXISTS (
        SELECT 1 FROM auth.users
         WHERE id = auth.uid() AND email LIKE '%@thinkai.hu'
      ) THEN
      RAISE EXCEPTION 'Nincs jogosultsága a könyvelésből való kizárás módosításához.';
    END IF;
  END IF;

  v_user_id := COALESCE(p_user_id, auth.uid());

  -- 2. Update parent invoice & collect line item IDs
  IF p_is_submitted THEN
    SELECT bizonylatsorszam INTO v_doc_number
      FROM public.invoices
     WHERE id = p_invoice_id AND company_id = p_company_id;

    IF v_doc_number IS NULL THEN
      RAISE EXCEPTION 'A számla nem található a céghez: %', p_invoice_id;
    END IF;

    UPDATE public.invoices
       SET exclude_from_accounting = p_exclude,
           updated_at = now()
     WHERE id = p_invoice_id AND company_id = p_company_id;

    UPDATE public.invoice_items
       SET exclude_from_accounting = p_exclude
     WHERE invoice_id = p_invoice_id;

    SELECT array_agg(id::text) INTO v_item_ids
      FROM public.invoice_items
     WHERE invoice_id = p_invoice_id;
  ELSE
    SELECT invoice_number INTO v_doc_number
      FROM public.nav_invoices
     WHERE id = p_invoice_id AND company_id = p_company_id;

    IF v_doc_number IS NULL THEN
      RAISE EXCEPTION 'A NAV számla nem található a céghez: %', p_invoice_id;
    END IF;

    UPDATE public.nav_invoices
       SET exclude_from_accounting = p_exclude,
           updated_at = now()
     WHERE id = p_invoice_id AND company_id = p_company_id;

    UPDATE public.nav_invoice_items
       SET exclude_from_accounting = p_exclude
     WHERE nav_invoice_id = p_invoice_id;

    SELECT array_agg(id::text) INTO v_item_ids
      FROM public.nav_invoice_items
     WHERE nav_invoice_id = p_invoice_id;
  END IF;

  -- 3. If excluding from accounting, clean up any drafts or posted journals
  IF p_exclude THEN
    FOR v_hdr IN
      SELECT *
        FROM public.acc_journal_headers
       WHERE company_id = p_company_id
         AND (
           (v_item_ids IS NOT NULL AND import_key = ANY(v_item_ids))
           OR import_key = p_invoice_id::text
           OR (v_doc_number IS NOT NULL AND v_doc_number <> '' AND document_id = v_doc_number)
         )
         AND status IN ('GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'KONYVELT')
       FOR UPDATE
    LOOP
      IF v_hdr.status = 'GEPI_JAVASLAT' THEN
        DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
        DELETE FROM public.acc_journal_headers WHERE id = v_hdr.id;
      ELSIF v_hdr.status = 'KEZI_PISZKOZAT' THEN
        IF v_hdr.journal_number IS NULL THEN
          DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
          DELETE FROM public.acc_journal_headers WHERE id = v_hdr.id;
        ELSE
          DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
          UPDATE public.acc_journal_headers
             SET status = 'SZTORNOZOTT',
                 justification = 'Számla kizárva a könyvelésből'
           WHERE id = v_hdr.id;
        END IF;
      ELSIF v_hdr.status = 'KONYVELT' THEN
        PERFORM public.acc_unpost_journal_entry(v_hdr.id, v_user_id, 'Számla kizárva a könyvelésből');
        DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
        UPDATE public.acc_journal_headers
           SET status = 'SZTORNOZOTT',
               justification = 'Számla kizárva a könyvelésből'
         WHERE id = v_hdr.id;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_invoice_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_invoice_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════
-- 2. UPDATE TOGGLE_INVOICE_ITEM_EXCLUDE_FROM_ACCOUNTING RPC
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.toggle_invoice_item_exclude_from_accounting(
  p_company_id uuid,
  p_item_id uuid,
  p_is_submitted boolean,
  p_exclude boolean,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hdr RECORD;
  v_user_id uuid;
BEGIN
  -- 1. Authorization check
  IF auth.role() <> 'service_role' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.company_members
       WHERE company_id = p_company_id
         AND user_id = auth.uid()
    ) AND NOT public.is_support_admin()
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE user_id = auth.uid()
           AND (role IN ('management', 'thinkai', 'support_admin') OR is_support_admin = true)
      ) AND NOT EXISTS (
        SELECT 1 FROM auth.users
         WHERE id = auth.uid() AND email LIKE '%@thinkai.hu'
      ) THEN
      RAISE EXCEPTION 'Nincs jogosultsága a tételszintű könyvelésből való kizárás módosításához.';
    END IF;
  END IF;

  v_user_id := COALESCE(p_user_id, auth.uid());

  -- 2. Update item
  IF p_is_submitted THEN
    UPDATE public.invoice_items
       SET exclude_from_accounting = p_exclude
     WHERE id = p_item_id;
  ELSE
    UPDATE public.nav_invoice_items
       SET exclude_from_accounting = p_exclude
     WHERE id = p_item_id;
  END IF;

  -- 3. If excluding, clean up draft or posted journal linked to this item
  IF p_exclude THEN
    FOR v_hdr IN
      SELECT *
        FROM public.acc_journal_headers
       WHERE company_id = p_company_id
         AND import_key = p_item_id::text
         AND status IN ('GEPI_JAVASLAT', 'KEZI_PISZKOZAT', 'KONYVELT')
       FOR UPDATE
    LOOP
      IF v_hdr.status = 'GEPI_JAVASLAT' THEN
        DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
        DELETE FROM public.acc_journal_headers WHERE id = v_hdr.id;
      ELSIF v_hdr.status = 'KEZI_PISZKOZAT' THEN
        IF v_hdr.journal_number IS NULL THEN
          DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
          DELETE FROM public.acc_journal_headers WHERE id = v_hdr.id;
        ELSE
          DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
          UPDATE public.acc_journal_headers
             SET status = 'SZTORNOZOTT',
                 justification = 'Számlatétel kizárva a könyvelésből'
           WHERE id = v_hdr.id;
        END IF;
      ELSIF v_hdr.status = 'KONYVELT' THEN
        PERFORM public.acc_unpost_journal_entry(v_hdr.id, v_user_id, 'Számlatétel kizárva a könyvelésből');
        DELETE FROM public.acc_journal_lines WHERE header_id = v_hdr.id;
        UPDATE public.acc_journal_headers
           SET status = 'SZTORNOZOTT',
               justification = 'Számlatétel kizárva a könyvelésből'
         WHERE id = v_hdr.id;
      END IF;
    END LOOP;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) TO authenticated, service_role;
