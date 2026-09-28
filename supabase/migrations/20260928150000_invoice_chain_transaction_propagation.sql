-- ============================================================================
-- Migration: 20260928150000_invoice_chain_transaction_propagation.sql
-- Description: Számlalánc (díjbekérő, előlegszámla, végszámla, sztornó) 
--              tranzakció-örökítés és automatikus párosítás.
-- ============================================================================

-- 1. Bővítjük a transaction_invoice_matches created_by CHECK constraintjét
ALTER TABLE public.transaction_invoice_matches 
  DROP CONSTRAINT IF EXISTS transaction_invoice_matches_created_by_check;

ALTER TABLE public.transaction_invoice_matches 
  ADD CONSTRAINT transaction_invoice_matches_created_by_check 
  CHECK (created_by = ANY (ARRAY['manual'::text, 'ai'::text, 'courier_auto'::text, 'chain_propagated'::text]));

-- 2. Teljesítmény optimalizáló indexek a számlalánc keresésekhez
CREATE INDEX IF NOT EXISTS idx_invoices_chain_lookup 
  ON public.invoices (company_id, invoice_direction, brutto_vegosszeg, kibocsatas_datuma)
  WHERE invoice_type IN ('dijbekero_proforma', 'dijbekero', 'elolegszamla', 'vegszamla');

CREATE INDEX IF NOT EXISTS idx_nav_invoices_chain_lookup 
  ON public.nav_invoices (company_id, invoice_direction, invoice_gross_amount, invoice_issue_date);

CREATE INDEX IF NOT EXISTS idx_nav_invoices_original_invoice_number
  ON public.nav_invoices (original_invoice_number)
  WHERE original_invoice_number IS NOT NULL;

-- 3. Számlalánc tranzakció-örökítő eljárás
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
  -- (Azonos cég, azonos irány, azonos partner adószám/név, azonos összeg, dátumablak)
  -- --------------------------------------------------------------------------
  FOR r_nav IN (
    SELECT DISTINCT ni.id as nav_id
    FROM public.invoices i
    JOIN public.nav_invoices ni ON ni.company_id = i.company_id
      AND ni.invoice_direction = i.invoice_direction
      AND (
        (COALESCE(i.vevo_vat_id, i.elado_vat_id) IS NOT NULL 
         AND SUBSTRING(REPLACE(COALESCE(i.vevo_vat_id, i.elado_vat_id), 'HU', '') FROM 1 FOR 8) = 
             SUBSTRING(REPLACE(COALESCE(ni.customer_tax_number, ni.supplier_tax_number), 'HU', '') FROM 1 FOR 8)
         AND SUBSTRING(REPLACE(COALESCE(i.vevo_vat_id, i.elado_vat_id), 'HU', '') FROM 1 FOR 8) <> '')
        OR 
        (LOWER(TRIM(COALESCE(i.vevo_nev, i.elado_nev, ''))) = LOWER(TRIM(COALESCE(ni.customer_name, ni.supplier_name, '')))
         AND COALESCE(i.vevo_nev, i.elado_nev) IS NOT NULL)
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
  -- --------------------------------------------------------------------------
  FOR r_sub IN (
    SELECT DISTINCT i.id as sub_id
    FROM public.nav_invoices ni
    JOIN public.invoices i ON i.company_id = ni.company_id
      AND i.invoice_direction = ni.invoice_direction
      AND (
        (COALESCE(ni.customer_tax_number, ni.supplier_tax_number) IS NOT NULL 
         AND SUBSTRING(REPLACE(COALESCE(ni.customer_tax_number, ni.supplier_tax_number), 'HU', '') FROM 1 FOR 8) = 
             SUBSTRING(REPLACE(COALESCE(i.vevo_vat_id, i.elado_vat_id), 'HU', '') FROM 1 FOR 8)
         AND SUBSTRING(REPLACE(COALESCE(ni.customer_tax_number, ni.supplier_tax_number), 'HU', '') FROM 1 FOR 8) <> '')
        OR 
        (LOWER(TRIM(COALESCE(ni.customer_name, ni.supplier_name, ''))) = LOWER(TRIM(COALESCE(i.vevo_nev, i.elado_nev, '')))
         AND COALESCE(ni.customer_name, ni.supplier_name) IS NOT NULL)
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
    IF r_ref.source = 'nav' THEN
      INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
      VALUES (p_transaction_id, r_ref.invoice_id, 'nav', 'chain_propagated')
      ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

      UPDATE public.nav_invoices
      SET paid = true,
          transaction_id = COALESCE(transaction_id, p_transaction_id),
          submitted = true
      WHERE id = r_ref.invoice_id;
    ELSE
      INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
      VALUES (p_transaction_id, r_ref.invoice_id, 'submitted', 'chain_propagated')
      ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

      UPDATE public.invoices
      SET fizetve = true,
          transaction_id = COALESCE(transaction_id, p_transaction_id)
      WHERE id = r_ref.invoice_id;
    END IF;
  END LOOP;

END;
$$;

-- 4. Frissítjük a mark_nav_invoice_paid_on_transaction_match triggert
CREATE OR REPLACE FUNCTION public.mark_nav_invoice_paid_on_transaction_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bizonylatsorszam TEXT;
  v_company_id UUID;
  v_gross NUMERIC;
  v_total_paid NUMERIC;
  v_is_full_paid BOOLEAN;
BEGIN
  IF NEW.matched_invoice_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD IS NOT NULL AND OLD.matched_invoice_id IS NOT DISTINCT FROM NEW.matched_invoice_id THEN
    RETURN NEW;
  END IF;

  -- Közvetlen submitted számla frissítése
  SELECT bizonylatsorszam, company_id, ABS(COALESCE(brutto_vegosszeg, 0)) 
  INTO v_bizonylatsorszam, v_company_id, v_gross
  FROM public.invoices WHERE id = NEW.matched_invoice_id;

  IF v_bizonylatsorszam IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM public.transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE public.invoices SET transaction_id = NEW.id, fizetve = v_is_full_paid
    WHERE id = NEW.matched_invoice_id;

    UPDATE public.nav_invoices
    SET paid = v_is_full_paid, submitted = true, transaction_id = NEW.id
    WHERE invoice_number = v_bizonylatsorszam
      AND company_id = v_company_id;

    -- Beszúrjuk a transaction_invoice_matches-be
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (NEW.id, NEW.matched_invoice_id, 'submitted', CASE WHEN NEW.match_type = 'manual' THEN 'manual' ELSE 'ai' END)
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- Láncolt továbbörökítés meghívása
    PERFORM public.propagate_transaction_to_invoice_chain(NEW.id);

    RETURN NEW;
  END IF;

  -- Közvetlen nav_invoices számla frissítése
  SELECT ABS(COALESCE(invoice_gross_amount, 0)), company_id
  INTO v_gross, v_company_id
  FROM public.nav_invoices WHERE id = NEW.matched_invoice_id;

  IF v_gross IS NOT NULL AND v_company_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_paid
    FROM public.transactions
    WHERE company_id = v_company_id
      AND (matched_invoice_id = NEW.matched_invoice_id OR id = NEW.id)
      AND (match_type = 'manual' OR is_verified = true OR (confidence_score IS NOT NULL AND confidence_score >= 0.9));

    v_is_full_paid := (v_gross = 0 OR v_total_paid >= v_gross - 0.5);

    UPDATE public.nav_invoices
    SET paid = v_is_full_paid, transaction_id = NEW.id
    WHERE id = NEW.matched_invoice_id;

    -- Beszúrjuk a transaction_invoice_matches-be
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (NEW.id, NEW.matched_invoice_id, 'nav', CASE WHEN NEW.match_type = 'manual' THEN 'manual' ELSE 'ai' END)
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- Láncolt továbbörökítés meghívása
    PERFORM public.propagate_transaction_to_invoice_chain(NEW.id);

    RETURN NEW;
  END IF;

  -- Salary tábla kezelése
  UPDATE public.salary SET transaction_id = NEW.id
  WHERE id = NEW.matched_invoice_id AND transaction_id IS DISTINCT FROM NEW.id;

  RETURN NEW;
END;
$$;

-- 5. Frissítjük a match_nav_invoice_on_insert triggert (Új NAV számla beszúrásakor számlalánc-ellenőrzés)
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

  -- 2. Ha nincs pontos számlaszám, díjbekérő / előleg lánc feloldása (azonos cég, irány, partner, összeg, dátumablak)
  IF v_invoice_id IS NULL THEN
    SELECT i.id, i.transaction_id INTO v_invoice_id, v_tx_id
    FROM public.invoices i
    WHERE i.company_id = NEW.company_id
      AND i.invoice_direction = NEW.invoice_direction
      AND i.invoice_type IN ('dijbekero_proforma', 'dijbekero', 'elolegszamla')
      AND (
        (COALESCE(i.vevo_vat_id, i.elado_vat_id) IS NOT NULL 
         AND SUBSTRING(REPLACE(COALESCE(i.vevo_vat_id, i.elado_vat_id), 'HU', '') FROM 1 FOR 8) = 
             SUBSTRING(REPLACE(COALESCE(NEW.customer_tax_number, NEW.supplier_tax_number), 'HU', '') FROM 1 FOR 8)
         AND SUBSTRING(REPLACE(COALESCE(i.vevo_vat_id, i.elado_vat_id), 'HU', '') FROM 1 FOR 8) <> '')
        OR 
        (LOWER(TRIM(COALESCE(i.vevo_nev, i.elado_nev, ''))) = LOWER(TRIM(COALESCE(NEW.customer_name, NEW.supplier_name, '')))
         AND COALESCE(i.vevo_nev, i.elado_nev) IS NOT NULL)
      )
      AND ABS(COALESCE(i.brutto_vegosszeg, 0) - COALESCE(NEW.invoice_gross_amount, 0)) < 1.0
      AND NEW.invoice_issue_date >= i.kibocsatas_datuma - INTERVAL '5 days'
      AND NEW.invoice_issue_date <= i.kibocsatas_datuma + INTERVAL '90 days'
    ORDER BY ABS(NEW.invoice_issue_date - i.kibocsatas_datuma) ASC
    LIMIT 1;
  END IF;

  IF v_invoice_id IS NOT NULL THEN
    -- Megjelöljük benyújtottnak
    NEW.submitted := true;

    -- Ha a díjbekérőnek / számlának közvetlenül van tranzakciója
    IF v_tx_id IS NOT NULL THEN
      NEW.paid := true;
      NEW.transaction_id := v_tx_id;
    ELSE
      -- Ellenőrizzük, hogy kapcsolódik-e tranzakció a díjbekérőhöz transactions-ből
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

-- 6. AFTER INSERT trigger nav_invoices-on a matches tábla automatikus perzisztálásához
CREATE OR REPLACE FUNCTION public.sync_nav_invoice_chain_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.transaction_id IS NOT NULL THEN
    INSERT INTO public.transaction_invoice_matches (transaction_id, invoice_id, invoice_source, created_by)
    VALUES (NEW.transaction_id, NEW.id, 'nav', 'chain_propagated')
    ON CONFLICT (transaction_id, invoice_id) DO NOTHING;

    -- Továbbörökítés lefutása az új számlára is
    PERFORM public.propagate_transaction_to_invoice_chain(NEW.transaction_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nav_invoice_chain_after_insert ON public.nav_invoices;
CREATE TRIGGER trg_sync_nav_invoice_chain_after_insert
  AFTER INSERT ON public.nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_nav_invoice_chain_after_insert();

-- 7. BACKFILL: A meglévő számlaláncok és tranzakciók összekötése az adatbázisban
DO $$
DECLARE
  r RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR r IN (
    SELECT DISTINCT id FROM public.transactions 
    WHERE matched_invoice_id IS NOT NULL 
       OR EXISTS (SELECT 1 FROM public.invoices WHERE transaction_id = transactions.id)
       OR EXISTS (SELECT 1 FROM public.nav_invoices WHERE transaction_id = transactions.id)
  ) LOOP
    PERFORM public.propagate_transaction_to_invoice_chain(r.id);
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'Backfill completed for % transactions', v_count;
END $$;
