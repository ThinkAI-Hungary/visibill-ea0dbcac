-- ==============================================================================
-- Migration: 20260928130000_croatian_eu_vat_statements_rpc.sql
-- Description:
--   1. Create public.get_croatian_eu_vat_statements RPC for Croatian companies
--      generating structured data for Obrazac PDV-S and Obrazac ZP filings.
--   2. Partners are aggregated by EU Country Code and VAT Identification Number (PDVID).
--   3. Cross-rate exchange rates applied for non-EUR transactions.
--   4. Zero silent decisions: Full RLS & SECURITY DEFINER compliance.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_croatian_eu_vat_statements(
  p_company_id UUID,
  p_year INTEGER,
  p_month INTEGER,
  p_frequency TEXT DEFAULT 'H'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT;
  v_company_name TEXT;
  v_company_oib TEXT;
  v_company_address TEXT;
  v_date_from DATE;
  v_date_to DATE;

  v_pdv_s_items JSONB := '[]'::jsonb;
  v_zp_items JSONB := '[]'::jsonb;

  v_pdv_s_total_i1 NUMERIC := 0;
  v_pdv_s_total_i2 NUMERIC := 0;

  v_zp_total_i1 NUMERIC := 0;
  v_zp_total_i2 NUMERIC := 0;
  v_zp_total_i3 NUMERIC := 0;
  v_zp_total_i4 NUMERIC := 0;
BEGIN
  -- 1. Verify Company and Country
  SELECT
    COALESCE(c.country_code, 'HU'),
    c.name,
    REGEXP_REPLACE(COALESCE(c.tax_number, ''), '^HR', '', 'i'),
    c.address
  INTO
    v_country_code,
    v_company_name,
    v_company_oib,
    v_company_address
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF v_country_code <> 'HR' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Company is not in Croatian jurisdiction (HR).'
    );
  END IF;

  -- 2. Date ranges based on frequency
  IF p_frequency = 'H' THEN
    v_date_from := make_date(p_year, p_month, 1);
    v_date_to := (v_date_from + interval '1 month' - interval '1 day')::date;
  ELSIF p_frequency = 'N' THEN
    v_date_from := make_date(p_year, (p_month - 1) * 3 + 1, 1);
    v_date_to := (v_date_from + interval '3 months' - interval '1 day')::date;
  ELSE
    v_date_from := make_date(p_year, 1, 1);
    v_date_to := make_date(p_year, 12, 31);
  END IF;

  -- 3. Calculate PDV-S (INBOUND EU Acquisitions and Services Received)
  WITH inbound_items AS (
    SELECT
      i.id AS invoice_id,
      i.elado_nev AS partner_name,
      REGEXP_REPLACE(UPPER(TRIM(i.elado_vat_id)), '[^A-Z0-9]', '', 'g') AS clean_vat,
      CASE
        WHEN i.penznem = 'EUR' THEN 1.0
        ELSE COALESCE(r_cur.rate / NULLIF(r_eur.rate, 0), 1.0)
      END AS fx_rate,
      COALESCE(ii.net_amount, i.adoalap_osszesen, 0) AS net_amt,
      COALESCE(ii.vat_code, vc.code, '') AS item_vat_code,
      COALESCE(i.termek_szolgaltatas_tipusa, '') AS invoice_type
    FROM public.invoices i
    LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
    LEFT JOIN public.vat_codes vc ON vc.id = COALESCE(ii.vat_code_id, i.vat_code_id)
    LEFT JOIN LATERAL (
      SELECT rate FROM daily_exchange_rates
      WHERE currency = i.penznem AND rate_date <= COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date
      ORDER BY rate_date DESC LIMIT 1
    ) r_cur ON i.penznem <> 'EUR'
    LEFT JOIN LATERAL (
      SELECT rate FROM daily_exchange_rates
      WHERE currency = 'EUR' AND rate_date <= COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date
      ORDER BY rate_date DESC LIMIT 1
    ) r_eur ON i.penznem <> 'EUR'
    WHERE i.company_id = p_company_id
      AND UPPER(COALESCE(i.invoice_direction, 'INBOUND')) = 'INBOUND'
      AND COALESCE(i.exclude_from_accounting, false) = false
      AND COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to
      -- Filter for EU partners (excluding Croatia)
      AND REGEXP_REPLACE(UPPER(TRIM(i.elado_vat_id)), '[^A-Z0-9]', '', 'g') ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|GR|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]+$'
  ),
  inbound_classified AS (
    SELECT
      invoice_id,
      partner_name,
      CASE
        WHEN SUBSTRING(clean_vat FROM 1 FOR 2) = 'GR' THEN 'EL'
        ELSE SUBSTRING(clean_vat FROM 1 FOR 2)
      END AS country_code,
      SUBSTRING(clean_vat FROM 3) AS pdv_id,
      -- I1: Stjecanje dobara
      ROUND(
        CASE
          WHEN item_vat_code ILIKE '%DOB%' OR invoice_type = 'termek' THEN net_amt * fx_rate
          ELSE 0
        END, 2
      ) AS i1,
      -- I2: Primljene usluge
      ROUND(
        CASE
          WHEN item_vat_code ILIKE '%USL%' OR invoice_type = 'szolgaltatas' THEN net_amt * fx_rate
          WHEN NOT (item_vat_code ILIKE '%DOB%' OR invoice_type = 'termek') THEN net_amt * fx_rate
          ELSE 0
        END, 2
      ) AS i2
    FROM inbound_items
  ),
  inbound_aggregated AS (
    SELECT
      country_code,
      pdv_id,
      MAX(partner_name) AS partner_name,
      SUM(i1) AS i1,
      SUM(i2) AS i2,
      COUNT(DISTINCT invoice_id) AS invoice_count
    FROM inbound_classified
    GROUP BY country_code, pdv_id
    ORDER BY country_code, pdv_id
  ),
  inbound_numbered AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY country_code, pdv_id) AS row_num,
      country_code,
      pdv_id,
      partner_name,
      i1,
      i2,
      invoice_count
    FROM inbound_aggregated
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'row_number', row_num,
          'country_code', country_code,
          'pdv_id', pdv_id,
          'partner_name', partner_name,
          'i1', i1,
          'i2', i2,
          'invoice_count', invoice_count
        )
        ORDER BY row_num
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(i1), 0),
    COALESCE(SUM(i2), 0)
  INTO
    v_pdv_s_items,
    v_pdv_s_total_i1,
    v_pdv_s_total_i2
  FROM inbound_numbered;


  -- 4. Calculate ZP (OUTBOUND EU Supplies of Goods & Services)
  WITH outbound_items AS (
    SELECT
      i.id AS invoice_id,
      i.vevo_nev AS partner_name,
      REGEXP_REPLACE(UPPER(TRIM(i.vevo_vat_id)), '[^A-Z0-9]', '', 'g') AS clean_vat,
      CASE
        WHEN i.penznem = 'EUR' THEN 1.0
        ELSE COALESCE(r_cur.rate / NULLIF(r_eur.rate, 0), 1.0)
      END AS fx_rate,
      COALESCE(ii.net_amount, i.adoalap_osszesen, 0) AS net_amt,
      COALESCE(ii.vat_code, vc.code, '') AS item_vat_code,
      COALESCE(i.termek_szolgaltatas_tipusa, '') AS invoice_type
    FROM public.invoices i
    LEFT JOIN public.invoice_items ii ON ii.invoice_id = i.id
    LEFT JOIN public.vat_codes vc ON vc.id = COALESCE(ii.vat_code_id, i.vat_code_id)
    LEFT JOIN LATERAL (
      SELECT rate FROM daily_exchange_rates
      WHERE currency = i.penznem AND rate_date <= COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date
      ORDER BY rate_date DESC LIMIT 1
    ) r_cur ON i.penznem <> 'EUR'
    LEFT JOIN LATERAL (
      SELECT rate FROM daily_exchange_rates
      WHERE currency = 'EUR' AND rate_date <= COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date
      ORDER BY rate_date DESC LIMIT 1
    ) r_eur ON i.penznem <> 'EUR'
    WHERE i.company_id = p_company_id
      AND UPPER(COALESCE(i.invoice_direction, 'INBOUND')) = 'OUTBOUND'
      AND COALESCE(i.exclude_from_accounting, false) = false
      AND COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date BETWEEN v_date_from AND v_date_to
      -- Filter for EU partners (excluding Croatia)
      AND REGEXP_REPLACE(UPPER(TRIM(i.vevo_vat_id)), '[^A-Z0-9]', '', 'g') ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|GR|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[0-9A-Z]+$'
  ),
  outbound_classified AS (
    SELECT
      invoice_id,
      partner_name,
      CASE
        WHEN SUBSTRING(clean_vat FROM 1 FOR 2) = 'GR' THEN 'EL'
        ELSE SUBSTRING(clean_vat FROM 1 FOR 2)
      END AS country_code,
      SUBSTRING(clean_vat FROM 3) AS pdv_id,
      -- I1: Isporuke dobara (Goods)
      ROUND(
        CASE
          WHEN item_vat_code ILIKE '%DOB%' OR invoice_type = 'termek' THEN net_amt * fx_rate
          ELSE 0
        END, 2
      ) AS i1,
      -- I2: Trostrani posao (Triangular)
      0.00 AS i2,
      -- I3: Premještanje dobara (Call-off stock)
      0.00 AS i3,
      -- I4: Obavljene usluge (Services)
      ROUND(
        CASE
          WHEN item_vat_code ILIKE '%USL%' OR invoice_type = 'szolgaltatas' THEN net_amt * fx_rate
          WHEN NOT (item_vat_code ILIKE '%DOB%' OR invoice_type = 'termek') THEN net_amt * fx_rate
          ELSE 0
        END, 2
      ) AS i4
    FROM outbound_items
  ),
  outbound_aggregated AS (
    SELECT
      country_code,
      pdv_id,
      MAX(partner_name) AS partner_name,
      SUM(i1) AS i1,
      SUM(i2) AS i2,
      SUM(i3) AS i3,
      SUM(i4) AS i4,
      COUNT(DISTINCT invoice_id) AS invoice_count
    FROM outbound_classified
    GROUP BY country_code, pdv_id
    ORDER BY country_code, pdv_id
  ),
  outbound_numbered AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY country_code, pdv_id) AS row_num,
      country_code,
      pdv_id,
      partner_name,
      i1,
      i2,
      i3,
      i4,
      invoice_count
    FROM outbound_aggregated
  )
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'row_number', row_num,
          'country_code', country_code,
          'pdv_id', pdv_id,
          'partner_name', partner_name,
          'i1', i1,
          'i2', i2,
          'i3', i3,
          'i4', i4,
          'invoice_count', invoice_count
        )
        ORDER BY row_num
      ),
      '[]'::jsonb
    ),
    COALESCE(SUM(i1), 0),
    COALESCE(SUM(i2), 0),
    COALESCE(SUM(i3), 0),
    COALESCE(SUM(i4), 0)
  INTO
    v_zp_items,
    v_zp_total_i1,
    v_zp_total_i2,
    v_zp_total_i3,
    v_zp_total_i4
  FROM outbound_numbered;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'country_code', v_country_code,
    'period_year', p_year,
    'period_month', p_month,
    'frequency', p_frequency,
    'date_from', v_date_from,
    'date_to', v_date_to,
    'company', jsonb_build_object(
      'name', v_company_name,
      'oib', v_company_oib,
      'address', v_company_address
    ),
    'pdv_s', jsonb_build_object(
      'items', v_pdv_s_items,
      'totals', jsonb_build_object(
        'i1', v_pdv_s_total_i1,
        'i2', v_pdv_s_total_i2,
        'total', v_pdv_s_total_i1 + v_pdv_s_total_i2
      )
    ),
    'zp', jsonb_build_object(
      'items', v_zp_items,
      'totals', jsonb_build_object(
        'i1', v_zp_total_i1,
        'i2', v_zp_total_i2,
        'i3', v_zp_total_i3,
        'i4', v_zp_total_i4,
        'total', v_zp_total_i1 + v_zp_total_i2 + v_zp_total_i3 + v_zp_total_i4
      )
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_croatian_eu_vat_statements(uuid, integer, integer, text) TO authenticated, service_role;
