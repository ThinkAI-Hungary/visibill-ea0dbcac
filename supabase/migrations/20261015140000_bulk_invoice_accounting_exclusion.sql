-- ══════════════════════════════════════════════════════════════════
-- Migráció: 20261015140000_bulk_invoice_accounting_exclusion.sql
-- Cél: Csoportos számla-kizárás (Nem könyvelem) atomi RPC és
--      az egyedi set_invoice_accounting_exclusion helyreállítása
-- ══════════════════════════════════════════════════════════════════

-- 1. EGYEDI RPC JAVÍTÁSA: SET_INVOICE_ACCOUNTING_EXCLUSION
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_invoice_accounting_exclusion(
  p_company_id uuid,
  p_invoice_id uuid,
  p_is_submitted boolean,
  p_exclusion_type text, -- 'PERMANENT', 'DEFERRED_VAT', or NULL to restore
  p_reason text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_doc_number text;
  v_item_ids text[];
  v_hdr RECORD;
  v_user_id uuid;
  v_exclude boolean;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  v_user_id := COALESCE(auth.uid(), p_user_id);
  v_exclude := (p_exclusion_type IS NOT NULL);

  IF p_exclusion_type IS NOT NULL AND p_exclusion_type NOT IN ('PERMANENT', 'DEFERRED_VAT') THEN
    RAISE EXCEPTION 'Érvénytelen kizárási típus: %. Megengedett értékek: PERMANENT, DEFERRED_VAT', p_exclusion_type;
  END IF;

  -- Update invoice & line items
  IF p_is_submitted THEN
    SELECT bizonylatsorszam INTO v_doc_number
      FROM public.invoices
     WHERE id = p_invoice_id AND company_id = p_company_id;

    IF v_doc_number IS NULL THEN
      RAISE EXCEPTION 'A számla nem található a céghez: %', p_invoice_id;
    END IF;

    UPDATE public.invoices
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type,
           deferred_vat_reason = CASE WHEN v_exclude THEN p_reason ELSE NULL END,
           deferred_vat_since = CASE WHEN v_exclude THEN CURRENT_DATE ELSE NULL END,
           deferred_vat_target_period = NULL,
           updated_at = now()
     WHERE id = p_invoice_id AND company_id = p_company_id;

    UPDATE public.invoice_items
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type
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
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type,
           deferred_vat_reason = CASE WHEN v_exclude THEN p_reason ELSE NULL END,
           deferred_vat_since = CASE WHEN v_exclude THEN CURRENT_DATE ELSE NULL END,
           deferred_vat_target_period = NULL
     WHERE id = p_invoice_id AND company_id = p_company_id;

    UPDATE public.nav_invoice_items
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type
     WHERE nav_invoice_id = p_invoice_id;

    SELECT array_agg(id::text) INTO v_item_ids
      FROM public.nav_invoice_items
     WHERE nav_invoice_id = p_invoice_id;
  END IF;

  -- If excluding, clean up draft/posted journals
  IF v_exclude THEN
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

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.set_invoice_accounting_exclusion(uuid, uuid, boolean, text, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_invoice_accounting_exclusion(uuid, uuid, boolean, text, text, uuid) TO authenticated, service_role;


-- 2. ÚJ ATOMI CSOPORTOS RPC: BULK_SET_INVOICE_ACCOUNTING_EXCLUSION
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bulk_set_invoice_accounting_exclusion(
  p_company_id uuid,
  p_invoice_ids uuid[],
  p_is_submitted boolean,
  p_exclusion_type text, -- 'PERMANENT', 'DEFERRED_VAT', or NULL to restore
  p_reason text DEFAULT NULL::text,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS integer -- returns the count of affected invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_exclude boolean;
  v_doc_numbers text[];
  v_item_ids text[];
  v_hdr RECORD;
  v_count integer := 0;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  IF p_invoice_ids IS NULL OR array_length(p_invoice_ids, 1) = 0 THEN
    RETURN 0;
  END IF;

  v_user_id := COALESCE(auth.uid(), p_user_id);
  v_exclude := (p_exclusion_type IS NOT NULL);

  IF p_exclusion_type IS NOT NULL AND p_exclusion_type NOT IN ('PERMANENT', 'DEFERRED_VAT') THEN
    RAISE EXCEPTION 'Érvénytelen kizárási típus: %. Megengedett értékek: PERMANENT, DEFERRED_VAT', p_exclusion_type;
  END IF;

  -- Update invoices & line items in batch
  IF p_is_submitted THEN
    SELECT array_agg(bizonylatsorszam) INTO v_doc_numbers
      FROM public.invoices
     WHERE company_id = p_company_id AND id = ANY(p_invoice_ids);

    UPDATE public.invoices
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type,
           deferred_vat_reason = CASE WHEN v_exclude THEN p_reason ELSE NULL END,
           deferred_vat_since = CASE WHEN v_exclude THEN CURRENT_DATE ELSE NULL END,
           deferred_vat_target_period = NULL,
           updated_at = now()
     WHERE company_id = p_company_id AND id = ANY(p_invoice_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.invoice_items
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type
     WHERE invoice_id = ANY(p_invoice_ids);

    SELECT array_agg(id::text) INTO v_item_ids
      FROM public.invoice_items
     WHERE invoice_id = ANY(p_invoice_ids);
  ELSE
    SELECT array_agg(invoice_number) INTO v_doc_numbers
      FROM public.nav_invoices
     WHERE company_id = p_company_id AND id = ANY(p_invoice_ids);

    UPDATE public.nav_invoices
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type,
           deferred_vat_reason = CASE WHEN v_exclude THEN p_reason ELSE NULL END,
           deferred_vat_since = CASE WHEN v_exclude THEN CURRENT_DATE ELSE NULL END,
           deferred_vat_target_period = NULL
     WHERE company_id = p_company_id AND id = ANY(p_invoice_ids);

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.nav_invoice_items
       SET exclude_from_accounting = v_exclude,
           accounting_exclusion_type = p_exclusion_type
     WHERE nav_invoice_id = ANY(p_invoice_ids);

    SELECT array_agg(id::text) INTO v_item_ids
      FROM public.nav_invoice_items
     WHERE nav_invoice_id = ANY(p_invoice_ids);
  END IF;

  -- Clean up draft/posted journals for excluded invoices
  IF v_exclude THEN
    FOR v_hdr IN
      SELECT *
        FROM public.acc_journal_headers
       WHERE company_id = p_company_id
         AND (
           (v_item_ids IS NOT NULL AND import_key = ANY(v_item_ids))
           OR import_key = ANY(p_invoice_ids::text[])
           OR (v_doc_numbers IS NOT NULL AND document_id = ANY(v_doc_numbers))
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

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bulk_set_invoice_accounting_exclusion(uuid, uuid[], boolean, text, text, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_set_invoice_accounting_exclusion(uuid, uuid[], boolean, text, text, uuid) TO authenticated, service_role;


-- 3. TÉTEL-SZINTŰ EXCLUDE RPC HELYREÁLLÍTÁSA
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.toggle_invoice_item_exclude_from_accounting(
  p_company_id uuid,
  p_item_id uuid,
  p_is_submitted boolean,
  p_exclude boolean,
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  -- Authorization check: member_write tier required
  PERFORM public.assert_company_role_tier(p_company_id, 'member_write');

  v_user_id := COALESCE(auth.uid(), p_user_id);

  IF p_is_submitted THEN
    UPDATE public.invoice_items
       SET exclude_from_accounting = p_exclude,
           accounting_exclusion_type = CASE WHEN p_exclude THEN 'PERMANENT' ELSE NULL END
     WHERE id = p_item_id;
  ELSE
    UPDATE public.nav_invoice_items
       SET exclude_from_accounting = p_exclude,
           accounting_exclusion_type = CASE WHEN p_exclude THEN 'PERMANENT' ELSE NULL END
     WHERE id = p_item_id;
  END IF;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_invoice_item_exclude_from_accounting(uuid, uuid, boolean, boolean, uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
