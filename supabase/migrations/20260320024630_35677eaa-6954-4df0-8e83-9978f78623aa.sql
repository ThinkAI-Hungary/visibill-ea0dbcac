
CREATE OR REPLACE FUNCTION public.get_linked_invoices(
  p_company_id uuid,
  p_seed_bizonylat text[],
  p_seed_reference text[],
  p_exclude_ids uuid[]
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE chain AS (
    -- Seed: invoices linked to the known set
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
           1 AS depth
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.id != ALL(p_exclude_ids)
      AND (
        lower(i.reference_number) = ANY(SELECT lower(unnest(p_seed_bizonylat)))
        OR lower(i.bizonylatsorszam) = ANY(SELECT lower(unnest(p_seed_reference)))
      )
    UNION
    -- Recurse: follow links in both directions
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
           c.depth + 1
    FROM invoices i
    JOIN chain c ON (
      (i.reference_number IS NOT NULL AND lower(i.reference_number) = lower(c.bizonylatsorszam))
      OR (c.reference_number IS NOT NULL AND lower(i.bizonylatsorszam) = lower(c.reference_number))
    )
    WHERE i.company_id = p_company_id
      AND i.id != ALL(p_exclude_ids)
      AND c.depth < 20
  )
  SELECT DISTINCT ON (chain.id)
    chain.id, chain.bizonylatsorszam, chain.kibocsatas_datuma,
    chain.teljesites_datuma, chain.elado_nev, chain.vevo_nev, chain.adoalap_osszesen,
    chain.brutto_vegosszeg, chain.afa_osszeg_osszesen, chain.penznem, chain.category_id,
    chain.project_id, chain.image_url, chain.melleklet_url, chain.invoice_direction,
    chain.reference_number
  FROM chain;
$$;
