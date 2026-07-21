-- Migration: 20260721_add_storno_group_settle_rpcs.sql
-- Feature: Sztornó lezárás / visszavonás toggle gomb
-- Érintett táblák: nav_invoices (is_manual_payment, original_invoice_number), invoices (is_manual_payment)
-- Nincs új tábla — meglévő mezőket állítjuk + 1 új oszlop

-- ============================================================
-- 0. Új oszlop: original_invoice_number (NAV XML invoiceReference)
--    Segítségével a sztornó számlán tároljuk az eredeti számla azonosítóját
--    Feltöltés: nav-auto-sync Edge Function → parseInvoiceDataFromXML
-- ============================================================
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS original_invoice_number TEXT;

-- ============================================================
-- RPC 1: mark_storno_group_settled
-- Lezárja a sztornó láncolatot két lehetséges úton:
--   RÉGI ÚT (ha van beküldött sztornó számlakép):
--     Storno NAV → invoices.bizonylatsorszam → invoices.reference_number → eredeti NAV + beküldött bizonylat
--   ÚJ FALLBACK (nincs beküldött számlakép):
--     Storno NAV.original_invoice_number → eredeti NAV közvetlen + beküldött bizonylat(ok)
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_storno_group_settled(
  p_storno_nav_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id          UUID;
  v_storno_number       TEXT;
  v_original_nav_id     UUID;
  v_submitted_id        UUID;
  v_original_nav_number TEXT;
BEGIN
  -- 1. Ellenőrzés: sztornó NAV számla létezik és a hívó cégéhez tartozik
  SELECT ni.company_id, ni.invoice_number
  INTO v_company_id, v_storno_number
  FROM nav_invoices ni
  WHERE ni.id = p_storno_nav_id
    AND ni.invoice_operation = 'STORNO'
    AND ni.company_id IN (
      SELECT cm.company_id
      FROM company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Storno invoice not found or access denied: %', p_storno_nav_id;
  END IF;

  -- 2. Lezárjuk a sztornó NAV számlát
  UPDATE nav_invoices
  SET
    is_manual_payment   = true,
    manual_payment_date = CURRENT_DATE,
    manual_payment_type = 'storno_settled',
    manual_payment_note = NULL
  WHERE id = p_storno_nav_id;

  -- 3. Megkeressük és lezárjuk a beküldött sztornó számlaképet
  UPDATE invoices
  SET
    is_manual_payment   = true,
    manual_payment_date = CURRENT_DATE,
    manual_payment_type = 'storno_settled'
  WHERE company_id = v_company_id
    AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
        = LOWER(REPLACE(v_storno_number, ' ', ''))
  RETURNING id INTO v_submitted_id;

  -- 4. RÉGI ÚT: van beküldött sztornó számlakép reference_number-rel
  IF v_submitted_id IS NOT NULL THEN
    SELECT ni.id, ni.invoice_number
    INTO v_original_nav_id, v_original_nav_number
    FROM invoices sub
    JOIN nav_invoices ni
      ON LOWER(REPLACE(ni.invoice_number, ' ', ''))
         = LOWER(REPLACE(sub.reference_number, ' ', ''))
     AND ni.company_id = sub.company_id
    WHERE sub.id = v_submitted_id
      AND sub.reference_number IS NOT NULL;

    IF v_original_nav_id IS NOT NULL THEN
      -- 4a. Lezárjuk az eredeti NAV számlát
      UPDATE nav_invoices
      SET is_manual_payment = true, manual_payment_date = CURRENT_DATE,
          manual_payment_type = 'storno_settled', manual_payment_note = NULL
      WHERE id = v_original_nav_id;

      -- 4b. Lezárjuk az eredeti NAV számlához tartozó beküldött bizonylat(oka)t is
      UPDATE invoices
      SET is_manual_payment = true, manual_payment_date = CURRENT_DATE,
          manual_payment_type = 'storno_settled'
      WHERE company_id = v_company_id
        AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
            = LOWER(REPLACE(v_original_nav_number, ' ', ''))
        AND id != v_submitted_id;
    END IF;

  -- 4c. ÚJ FALLBACK: nincs beküldött sztornó számlakép
  --     → direkt NAV-NAV párosítás: original_invoice_number mező alapján
  ELSE
    SELECT ni.id, ni.invoice_number
    INTO v_original_nav_id, v_original_nav_number
    FROM nav_invoices ni
    WHERE ni.company_id = v_company_id
      AND ni.invoice_operation != 'STORNO'
      AND LOWER(REPLACE(ni.invoice_number, ' ', ''))
          = LOWER(REPLACE(
              (SELECT original_invoice_number FROM nav_invoices WHERE id = p_storno_nav_id),
              ' ', ''
            ))
    LIMIT 1;

    IF v_original_nav_id IS NOT NULL THEN
      -- 4d. Lezárjuk az eredeti NAV számlát
      UPDATE nav_invoices
      SET is_manual_payment = true, manual_payment_date = CURRENT_DATE,
          manual_payment_type = 'storno_settled', manual_payment_note = NULL
      WHERE id = v_original_nav_id;

      -- 4e. Lezárjuk az eredeti számlához tartozó beküldött bizonylat(oka)t
      UPDATE invoices
      SET is_manual_payment = true, manual_payment_date = CURRENT_DATE,
          manual_payment_type = 'storno_settled'
      WHERE company_id = v_company_id
        AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
            = LOWER(REPLACE(v_original_nav_number, ' ', ''));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'storno_nav_id',      p_storno_nav_id,
    'submitted_id',       v_submitted_id,
    'original_nav_id',    v_original_nav_id
  );
END;
$$;

-- Security: anon nem hívhatja
REVOKE EXECUTE ON FUNCTION public.mark_storno_group_settled(UUID) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.mark_storno_group_settled(UUID) TO authenticated;


-- ============================================================
-- RPC 2: unmark_storno_group_settled
-- Visszavonja a lezárást — ugyanaz a két ág fordítva:
--   RÉGI ÚT: beküldött sztornó számlakép reference_number-rel
--   ÚJ FALLBACK: original_invoice_number mező alapján direkt NAV-NAV
--   BIZTONSÁGI ZÁROLÁS: csak 'storno_settled' típusú lezárást vonunk vissza
-- ============================================================
CREATE OR REPLACE FUNCTION public.unmark_storno_group_settled(
  p_storno_nav_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id          UUID;
  v_storno_number       TEXT;
  v_original_nav_id     UUID;
  v_submitted_id        UUID;
  v_original_nav_number TEXT;
BEGIN
  -- 1. Ellenőrzés
  SELECT ni.company_id, ni.invoice_number
  INTO v_company_id, v_storno_number
  FROM nav_invoices ni
  WHERE ni.id = p_storno_nav_id
    AND ni.invoice_operation = 'STORNO'
    AND ni.company_id IN (
      SELECT cm.company_id FROM company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    );

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Storno invoice not found or access denied: %', p_storno_nav_id;
  END IF;

  -- 2. Visszaállítjuk a sztornó NAV számlát
  UPDATE nav_invoices
  SET is_manual_payment = false, manual_payment_date = NULL,
      manual_payment_type = NULL, manual_payment_note = NULL
  WHERE id = p_storno_nav_id;

  -- 3. Visszaállítjuk a beküldött sztornó számlaképet
  UPDATE invoices
  SET is_manual_payment = false, manual_payment_date = NULL, manual_payment_type = NULL
  WHERE company_id = v_company_id
    AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
        = LOWER(REPLACE(v_storno_number, ' ', ''))
  RETURNING id INTO v_submitted_id;

  -- 4. RÉGI ÚT: van beküldött sztornó számlakép reference_number-rel
  IF v_submitted_id IS NOT NULL THEN
    SELECT ni.id, ni.invoice_number
    INTO v_original_nav_id, v_original_nav_number
    FROM invoices sub
    JOIN nav_invoices ni
      ON LOWER(REPLACE(ni.invoice_number, ' ', ''))
         = LOWER(REPLACE(sub.reference_number, ' ', ''))
     AND ni.company_id = sub.company_id
    WHERE sub.id = v_submitted_id
      AND sub.reference_number IS NOT NULL;

    IF v_original_nav_id IS NOT NULL THEN
      UPDATE nav_invoices
      SET is_manual_payment = false, manual_payment_date = NULL,
          manual_payment_type = NULL, manual_payment_note = NULL
      WHERE id = v_original_nav_id
        AND manual_payment_type = 'storno_settled';

      UPDATE invoices
      SET is_manual_payment = false, manual_payment_date = NULL, manual_payment_type = NULL
      WHERE company_id = v_company_id
        AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
            = LOWER(REPLACE(v_original_nav_number, ' ', ''))
        AND manual_payment_type = 'storno_settled'
        AND id != v_submitted_id;
    END IF;

  -- 4c. ÚJ FALLBACK: nincs beküldött sztornó számlakép
  ELSE
    SELECT ni.id, ni.invoice_number
    INTO v_original_nav_id, v_original_nav_number
    FROM nav_invoices ni
    WHERE ni.company_id = v_company_id
      AND ni.invoice_operation != 'STORNO'
      AND LOWER(REPLACE(ni.invoice_number, ' ', ''))
          = LOWER(REPLACE(
              (SELECT original_invoice_number FROM nav_invoices WHERE id = p_storno_nav_id),
              ' ', ''
            ))
    LIMIT 1;

    IF v_original_nav_id IS NOT NULL THEN
      UPDATE nav_invoices
      SET is_manual_payment = false, manual_payment_date = NULL,
          manual_payment_type = NULL, manual_payment_note = NULL
      WHERE id = v_original_nav_id
        AND manual_payment_type = 'storno_settled';

      UPDATE invoices
      SET is_manual_payment = false, manual_payment_date = NULL, manual_payment_type = NULL
      WHERE company_id = v_company_id
        AND LOWER(REPLACE(bizonylatsorszam, ' ', ''))
            = LOWER(REPLACE(v_original_nav_number, ' ', ''))
        AND manual_payment_type = 'storno_settled';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',         true,
    'storno_nav_id',   p_storno_nav_id,
    'submitted_id',    v_submitted_id,
    'original_nav_id', v_original_nav_id
  );
END;
$$;

-- Security: anon nem hívhatja
REVOKE EXECUTE ON FUNCTION public.unmark_storno_group_settled(UUID) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.unmark_storno_group_settled(UUID) TO authenticated;
