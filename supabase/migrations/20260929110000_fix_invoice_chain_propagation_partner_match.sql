-- ============================================================================
-- Migration: 20260929110000_fix_invoice_chain_propagation_partner_match.sql
-- Description: Javítás: Irányfüggő partnerazonosítás (szállító vs vevő) a
--              számlalánc-örökítésben (LÁNC 1, LÁNC 2) és a match_nav_invoice_on_insert
--              triggerben, megelőzve az azonos összegű különböző partnerek téves összekötését.
-- ============================================================================

-- 1. Frissítjük a propagate_transaction_to_invoice_chain eljárást
CREATE OR REPLACE FUNCTION public.propagate_transaction_to_invoice_chain(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id uuid;
  v_tx_amount numeric;
  v_match_created_by text;
  v_primary_invoice_id uuid;
  r_nav RECORD;
  r_sub RECORD;
  r_ref RECORD;
BEGIN
  -- Végtelen rekurzió elleni védelem
  IF pg_trigger_depth() > 2 THEN
    RETURN;
  END IF;

  -- Tranzakció alapadatok lekérése
  SELECT company_id, ABS(amount), 
         CASE WHEN match_type = 'manual' THEN 'manual' ELSE 'ai' END,
         matched_invoice_id
  INTO v_company_id, v_tx_amount, v_match_created_by, v_primary_invoice_id
  FROM public.transactions
  WHERE id = p_transaction_id;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Biztosítjuk a primary_invoice_id bejegyzését a transaction_invoice_matches táblában
  IF v_primary_invoice_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.invoices WHERE id = v_primary_invoice_id) THEN
      INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
      VALUES (p_transaction_id, v_primary_invoice_id, 'submitted', v_match_created_by)
      ON CONFLICT (transaction_id, invoice_id) DO NOTHING;
    ELSIF EXISTS (SELECT 1 FROM public.nav_invoices WHERE id = v_primary_invoice_id) THEN
      INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
      VALUES (p_transaction_id, v_primary_invoice_id, 'nav', v_match_created_by)
      ON CONFLICT (transaction_id, invoice_id) DO NOTHING;
    END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- LÁNC 1: Kapcsolt Submitted Díjbekérő/Előleg -> NAV Számlára örökítés
  -- Szigorúan irányfüggő partner azonosítás:
  -- - OUTBOUND: vevo_vat_id == customer_tax_number (vagy vevo_nev == customer_name)
  -- - INBOUND:  elado_vat_id == supplier_tax_number (vagy elado_nev == supplier_name)
  -- --------------------------------------------------------------------------
  FOR r_nav IN (
    SELECT DISTINCT ni.id as nav_id
    FROM public.invoices i
    JOIN public.nav_invoices ni ON ni.company_id = i.company_id
      AND ni.invoice_direction = i.invoice_direction
      AND (
        (i.invoice_direction = 'OUTBOUND' AND (
          (i.vevo_vat_id IS NOT NULL AND ni.customer_tax_number IS NOT NULL
           AND SUBSTRING(REPLACE(i.vevo_vat_id, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(ni.customer_tax_number, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(i.vevo_vat_id, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(i.vevo_nev, ''))) = LOWER(TRIM(COALESCE(ni.customer_name, '')))
           AND i.vevo_nev IS NOT NULL AND TRIM(i.vevo_nev) <> '')
        ))
        OR
        (i.invoice_direction = 'INBOUND' AND (
          (i.elado_vat_id IS NOT NULL AND ni.supplier_tax_number IS NOT NULL
           AND SUBSTRING(REPLACE(i.elado_vat_id, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(ni.supplier_tax_number, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(i.elado_vat_id, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(i.elado_nev, ''))) = LOWER(TRIM(COALESCE(ni.supplier_name, '')))
           AND i.elado_nev IS NOT NULL AND TRIM(i.elado_nev) <> '')
        ))
      )
      AND ABS(COALESCE(i.brutto_vegosszeg, 0) - COALESCE(ni.invoice_gross_amount, 0)) < 1.0
      AND ni.invoice_issue_date >= i.kibocsatas_datuma - INTERVAL '5 days'
      AND ni.invoice_issue_date <= i.kibocsatas_datuma + INTERVAL '90 days'
    WHERE i.company_id = v_company_id
      AND i.invoice_type IN ('dijbekero_proforma', 'dijbekero', 'elolegszamla', 'vegszamla')
      AND (
        i.id = v_primary_invoice_id 
        OR i.transaction_id = p_transaction_id
        OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = p_transaction_id AND tim.invoice_id = i.id)
      )
  ) LOOP
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (p_transaction_id, r_nav.nav_id, 'nav', 'chain_propagated')
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    UPDATE public.nav_invoices
    SET paid = true,
        transaction_id = COALESCE(transaction_id, p_transaction_id),
        submitted = true
    WHERE id = r_nav.nav_id;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- LÁNC 2: Kapcsolt NAV Számla -> Submitted Díjbekérőre/Előlegre örökítés
  -- Szigorúan irányfüggő partner azonosítás + kizárólag díjbekérő/előleg típusokra!
  -- --------------------------------------------------------------------------
  FOR r_sub IN (
    SELECT DISTINCT i.id as sub_id
    FROM public.nav_invoices ni
    JOIN public.invoices i ON i.company_id = ni.company_id
      AND i.invoice_direction = ni.invoice_direction
      AND i.invoice_type IN ('dijbekero_proforma', 'dijbekero', 'elolegszamla', 'vegszamla')
      AND (
        (i.invoice_direction = 'OUTBOUND' AND (
          (ni.customer_tax_number IS NOT NULL AND i.vevo_vat_id IS NOT NULL
           AND SUBSTRING(REPLACE(ni.customer_tax_number, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(i.vevo_vat_id, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(ni.customer_tax_number, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(ni.customer_name, ''))) = LOWER(TRIM(COALESCE(i.vevo_nev, '')))
           AND ni.customer_name IS NOT NULL AND TRIM(ni.customer_name) <> '')
        ))
        OR
        (i.invoice_direction = 'INBOUND' AND (
          (ni.supplier_tax_number IS NOT NULL AND i.elado_vat_id IS NOT NULL
           AND SUBSTRING(REPLACE(ni.supplier_tax_number, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(i.elado_vat_id, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(ni.supplier_tax_number, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(ni.supplier_name, ''))) = LOWER(TRIM(COALESCE(i.elado_nev, '')))
           AND ni.supplier_name IS NOT NULL AND TRIM(ni.supplier_name) <> '')
        ))
      )
      AND ABS(COALESCE(i.brutto_vegosszeg, 0) - COALESCE(ni.invoice_gross_amount, 0)) < 1.0
      AND ni.invoice_issue_date >= i.kibocsatas_datuma - INTERVAL '5 days'
      AND ni.invoice_issue_date <= i.kibocsatas_datuma + INTERVAL '90 days'
    WHERE ni.company_id = v_company_id
      AND (
        ni.id = v_primary_invoice_id 
        OR ni.transaction_id = p_transaction_id
        OR EXISTS (SELECT 1 FROM public.transaction_invoice_matches tim WHERE tim.transaction_id = p_transaction_id AND tim.invoice_id = ni.id)
      )
  ) LOOP
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (p_transaction_id, r_sub.sub_id, 'submitted', 'chain_propagated')
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    UPDATE public.invoices
    SET fizetve = true,
        transaction_id = COALESCE(transaction_id, p_transaction_id)
    WHERE id = r_sub.sub_id;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- LÁNC 3: Explicit hivatkozások (reference_number, elolegszamla_hivatkozas, original_invoice_number)
  -- --------------------------------------------------------------------------
  FOR r_ref IN (
    WITH linked_numbers AS (
      SELECT bizonylatsorszam as num FROM public.invoices WHERE id = v_primary_invoice_id OR transaction_id = p_transaction_id
      UNION
      SELECT invoice_number as num FROM public.nav_invoices WHERE id = v_primary_invoice_id OR transaction_id = p_transaction_id
      UNION
      SELECT trim(elem) as num
      FROM public.invoices i,
           LATERAL unnest(string_to_array(regexp_replace(COALESCE(i.reference_number, '') || ',' || COALESCE(i.elolegszamla_hivatkozas, ''), E'[,;\\n]+', ',', 'g'), ',')) elem
      WHERE (i.id = v_primary_invoice_id OR i.transaction_id = p_transaction_id) AND trim(elem) <> ''
      UNION
      SELECT original_invoice_number as num
      FROM public.nav_invoices ni
      WHERE (ni.id = v_primary_invoice_id OR ni.transaction_id = p_transaction_id) AND ni.original_invoice_number IS NOT NULL
    )
    SELECT 'submitted' as source, inv.id as invoice_id
    FROM public.invoices inv
    WHERE inv.company_id = v_company_id
      AND (
        inv.bizonylatsorszam IN (SELECT num FROM linked_numbers)
        OR EXISTS (
          SELECT 1 FROM linked_numbers ln
          WHERE ln.num <> '' AND (
            COALESCE(inv.reference_number, '') ILIKE '%' || ln.num || '%'
            OR COALESCE(inv.elolegszamla_hivatkozas, '') ILIKE '%' || ln.num || '%'
          )
        )
      )
    UNION
    SELECT 'nav' as source, nav.id as invoice_id
    FROM public.nav_invoices nav
    WHERE nav.company_id = v_company_id
      AND (
        nav.invoice_number IN (SELECT num FROM linked_numbers)
        OR nav.original_invoice_number IN (SELECT num FROM linked_numbers)
      )
  ) LOOP
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (p_transaction_id, r_ref.invoice_id, r_ref.source, 'chain_propagated')
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    IF r_ref.source = 'submitted' THEN
      UPDATE public.invoices
      SET fizetve = true,
          transaction_id = COALESCE(transaction_id, p_transaction_id)
      WHERE id = r_ref.invoice_id;
    ELSE
      UPDATE public.nav_invoices
      SET paid = true,
          transaction_id = COALESCE(transaction_id, p_transaction_id),
          submitted = true
      WHERE id = r_ref.invoice_id;
    END IF;
  END LOOP;
END;
$$;

-- 2. Frissítjük a match_nav_invoice_on_insert eljárást is
CREATE OR REPLACE FUNCTION public.match_nav_invoice_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice_id UUID;
  v_tx_id UUID;
  v_has_transaction BOOLEAN;
BEGIN
  -- 1. Pontos számlaszám egyezés keresése submitted számlák között
  SELECT id, transaction_id INTO v_invoice_id, v_tx_id
  FROM public.invoices
  WHERE REPLACE(LOWER(bizonylatsorszam), ' ', '') = REPLACE(LOWER(NEW.invoice_number), ' ', '')
    AND (
      (company_id = NEW.company_id)
      OR (company_id IS NULL AND NEW.company_id IS NULL)
    )
  LIMIT 1;

  -- 2. Ha nincs pontos számlaszám, díjbekérő / előleg lánc feloldása irányfüggő partner egyezéssel
  IF v_invoice_id IS NULL THEN
    SELECT i.id, i.transaction_id INTO v_invoice_id, v_tx_id
    FROM public.invoices i
    WHERE i.company_id = NEW.company_id
      AND i.invoice_direction = NEW.invoice_direction
      AND i.invoice_type IN ('dijbekero_proforma', 'dijbekero', 'elolegszamla')
      AND (
        (NEW.invoice_direction = 'OUTBOUND' AND (
          (i.vevo_vat_id IS NOT NULL AND NEW.customer_tax_number IS NOT NULL
           AND SUBSTRING(REPLACE(i.vevo_vat_id, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(NEW.customer_tax_number, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(i.vevo_vat_id, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(i.vevo_nev, ''))) = LOWER(TRIM(COALESCE(NEW.customer_name, '')))
           AND i.vevo_nev IS NOT NULL AND TRIM(i.vevo_nev) <> '')
        ))
        OR
        (NEW.invoice_direction = 'INBOUND' AND (
          (i.elado_vat_id IS NOT NULL AND NEW.supplier_tax_number IS NOT NULL
           AND SUBSTRING(REPLACE(i.elado_vat_id, 'HU', '') FROM 1 FOR 8) = 
               SUBSTRING(REPLACE(NEW.supplier_tax_number, 'HU', '') FROM 1 FOR 8)
           AND SUBSTRING(REPLACE(i.elado_vat_id, 'HU', '') FROM 1 FOR 8) <> '')
          OR
          (LOWER(TRIM(COALESCE(i.elado_nev, ''))) = LOWER(TRIM(COALESCE(NEW.supplier_name, '')))
           AND i.elado_nev IS NOT NULL AND TRIM(i.elado_nev) <> '')
        ))
      )
      AND ABS(COALESCE(i.brutto_vegosszeg, 0) - COALESCE(NEW.invoice_gross_amount, 0)) < 1.0
      AND NEW.invoice_issue_date >= i.kibocsatas_datuma - INTERVAL '5 days'
      AND NEW.invoice_issue_date <= i.kibocsatas_datuma + INTERVAL '90 days'
    ORDER BY ABS(NEW.invoice_issue_date - i.kibocsatas_datuma) ASC
    LIMIT 1;
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    NEW.submitted := true;

    IF v_tx_id IS NOT NULL THEN
      NEW.paid := true;
      NEW.transaction_id := v_tx_id;
    ELSE
      SELECT id INTO v_tx_id
      FROM public.transactions
      WHERE matched_invoice_id = v_invoice_id
      LIMIT 1;

      IF v_tx_id IS NOT NULL THEN
        NEW.paid := true;
        NEW.transaction_id := v_tx_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
