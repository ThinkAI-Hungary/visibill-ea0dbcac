-- ============================================================================
-- MIGRATION: 20260928120000_auto_assign_croatian_vat_codes.sql
-- Description: Automatic Croatian VAT code assignment for HR companies
-- Rules followed: visibill-db-checklist, A-156, P-116
-- ============================================================================

-- 1. Create or replace the assignment function
CREATE OR REPLACE FUNCTION public.assign_croatian_vat_codes(
  p_company_id uuid,
  p_overwrite boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT;
  v_company_name TEXT;
  
  -- Cached Croatian VAT code IDs
  v_id_izl_25 UUID;
  v_id_izl_13 UUID;
  v_id_izl_5 UUID;
  v_id_izl_0 UUID;
  v_id_izl_tuz_prij UUID;
  v_id_izl_eu_dob UUID;
  v_id_izl_eu_usl UUID;
  v_id_izl_izvoz UUID;
  v_id_izl_tuz_osl UUID;
  
  v_id_ul_25_odb UUID;
  v_id_ul_13_odb UUID;
  v_id_ul_5_odb UUID;
  v_id_ul_tuz_prij UUID;
  v_id_ul_eu_dob_25 UUID;
  v_id_ul_eu_usl_25 UUID;
  v_id_ul_eu_usl_13 UUID;
  v_id_ul_eu_usl_5 UUID;
  v_id_ul_neodb UUID;
  
  v_items_updated INTEGER := 0;
  v_invoices_updated INTEGER := 0;
BEGIN
  -- Verify company exists and is Croatian
  SELECT country_code, name INTO v_country_code, v_company_name
  FROM public.companies
  WHERE id = p_company_id;

  IF v_country_code IS NULL THEN
    RAISE EXCEPTION 'Company with ID % not found', p_company_id;
  END IF;

  IF v_country_code <> 'HR' THEN
    RAISE EXCEPTION 'Company % (%) is not under Croatian jurisdiction (country_code = %)', 
      v_company_name, p_company_id, v_country_code;
  END IF;

  -- Ensure Croatian VAT codes exist for this company
  IF NOT EXISTS (SELECT 1 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_25') THEN
    PERFORM public.seed_default_vat_codes(p_company_id);
  END IF;

  -- Cache code IDs
  SELECT id INTO v_id_izl_25 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_25' LIMIT 1;
  SELECT id INTO v_id_izl_13 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_13' LIMIT 1;
  SELECT id INTO v_id_izl_5 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_5' LIMIT 1;
  SELECT id INTO v_id_izl_0 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_0' LIMIT 1;
  SELECT id INTO v_id_izl_tuz_prij FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_TUZ_PRIJ' LIMIT 1;
  SELECT id INTO v_id_izl_eu_dob FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_EU_DOB' LIMIT 1;
  SELECT id INTO v_id_izl_eu_usl FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_EU_USL' LIMIT 1;
  SELECT id INTO v_id_izl_izvoz FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_IZVOZ' LIMIT 1;
  SELECT id INTO v_id_izl_tuz_osl FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_IZL_TUZ_OSL' LIMIT 1;

  SELECT id INTO v_id_ul_25_odb FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_25_ODB' LIMIT 1;
  SELECT id INTO v_id_ul_13_odb FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_13_ODB' LIMIT 1;
  SELECT id INTO v_id_ul_5_odb FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_5_ODB' LIMIT 1;
  SELECT id INTO v_id_ul_tuz_prij FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_TUZ_PRIJ' LIMIT 1;
  SELECT id INTO v_id_ul_eu_dob_25 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_EU_DOB_25' LIMIT 1;
  SELECT id INTO v_id_ul_eu_usl_25 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_EU_USL_25' LIMIT 1;
  SELECT id INTO v_id_ul_eu_usl_13 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_EU_USL_13' LIMIT 1;
  SELECT id INTO v_id_ul_eu_usl_5 FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_EU_USL_5' LIMIT 1;
  SELECT id INTO v_id_ul_neodb FROM public.vat_codes WHERE company_id = p_company_id AND code = 'HR_UL_NEODB' LIMIT 1;

  -- 1. Update invoice_items
  WITH target_items AS (
    SELECT
      ii.id AS item_id,
      CASE
        -- OUTBOUND (Kimenő számla)
        WHEN UPPER(COALESCE(i.invoice_direction, 'OUTBOUND')) = 'OUTBOUND' THEN
          CASE
            WHEN COALESCE(ii.vat_rate, '') IN ('13%') 
                 OR (COALESCE(ii.net_amount, 0) > 0 AND ROUND(COALESCE(ii.vat_amount, 0) / ii.net_amount, 2) = 0.13) THEN v_id_izl_13
            WHEN COALESCE(ii.vat_rate, '') IN ('5%') 
                 OR (COALESCE(ii.net_amount, 0) > 0 AND ROUND(COALESCE(ii.vat_amount, 0) / ii.net_amount, 2) = 0.05) THEN v_id_izl_5
            WHEN COALESCE(ii.vat_rate, '') IN ('25%', '27%') 
                 OR COALESCE(ii.vat_amount, 0) > 0 THEN v_id_izl_25
            -- 0% / Adómentes
            WHEN COALESCE(i.forditott_adozas, false) THEN v_id_izl_tuz_prij
            WHEN UPPER(TRIM(COALESCE(i.vevo_vat_id, ''))) ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)' THEN 
              CASE
                WHEN COALESCE(i.termek_szolgaltatas_tipusa, '') = 'szolgaltatas'
                     OR COALESCE(ii.line_description, '') ~* '(uslug|poslov|najam|plać|plac|upravlj|savjet|održ|odrz|licenc|software|szoftver|djelatnik|dozvol|szolgáltatás|szolgaltatas|bérleti|berleti|ügyvédi|ugyvedi|tanácsadás|tanacsadas)'
                  THEN COALESCE(v_id_izl_eu_usl, v_id_izl_eu_dob, v_id_izl_0)
                ELSE COALESCE(v_id_izl_eu_dob, v_id_izl_0)
              END
            WHEN UPPER(TRIM(COALESCE(i.vevo_vat_id, ''))) <> '' 
                 AND NOT UPPER(TRIM(COALESCE(i.vevo_vat_id, ''))) ~ '^(HR)?[0-9]{11}$' THEN 
              COALESCE(v_id_izl_izvoz, v_id_izl_0)
            ELSE v_id_izl_0
          END

        -- INBOUND (Bejövő számla)
        ELSE
          CASE
            WHEN COALESCE(i.forditott_adozas, false) THEN v_id_ul_tuz_prij
            -- EU partner
            WHEN UPPER(TRIM(COALESCE(i.elado_vat_id, ''))) ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)' THEN
              CASE
                WHEN COALESCE(ii.vat_rate, '') IN ('13%') THEN COALESCE(v_id_ul_eu_usl_13, v_id_ul_13_odb)
                WHEN COALESCE(ii.vat_rate, '') IN ('5%') THEN COALESCE(v_id_ul_eu_usl_5, v_id_ul_5_odb)
                WHEN COALESCE(ii.vat_rate, '') IN ('0%') THEN COALESCE(v_id_ul_eu_dob_25, v_id_ul_neodb)
                ELSE COALESCE(v_id_ul_eu_usl_25, v_id_ul_25_odb)
              END
            -- Belföldi
            WHEN COALESCE(ii.vat_rate, '') IN ('13%') 
                 OR (COALESCE(ii.net_amount, 0) > 0 AND ROUND(COALESCE(ii.vat_amount, 0) / ii.net_amount, 2) = 0.13) THEN v_id_ul_13_odb
            WHEN COALESCE(ii.vat_rate, '') IN ('5%') 
                 OR (COALESCE(ii.net_amount, 0) > 0 AND ROUND(COALESCE(ii.vat_amount, 0) / ii.net_amount, 2) = 0.05) THEN v_id_ul_5_odb
            WHEN COALESCE(ii.vat_rate, '') IN ('25%', '27%') 
                 OR COALESCE(ii.vat_amount, 0) > 0 THEN v_id_ul_25_odb
            ELSE v_id_ul_neodb
          END
      END AS assigned_vat_code_id
    FROM public.invoice_items ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.company_id = p_company_id
      AND (p_overwrite = true OR ii.vat_code_id IS NULL)
      AND COALESCE(ii.is_vat_code_manual, false) = false
  ),
  updated_items AS (
    UPDATE public.invoice_items ii
    SET
      vat_code_id = ti.assigned_vat_code_id,
      vat_code = vc.code
    FROM target_items ti
    JOIN public.vat_codes vc ON vc.id = ti.assigned_vat_code_id
    WHERE ii.id = ti.item_id
      AND ti.assigned_vat_code_id IS NOT NULL
    RETURNING ii.id
  )
  SELECT count(*) INTO v_items_updated FROM updated_items;

  -- 2. Update invoices header vat_code_id from invoice_items or direct fallback
  WITH invoice_primary_codes AS (
    SELECT 
      i.id AS invoice_id,
      COALESCE(
        (SELECT ii.vat_code_id FROM public.invoice_items ii WHERE ii.invoice_id = i.id AND ii.vat_code_id IS NOT NULL LIMIT 1),
        CASE
          WHEN UPPER(COALESCE(i.invoice_direction, 'OUTBOUND')) = 'OUTBOUND' THEN
            CASE
              WHEN COALESCE(i.afa_osszeg_osszesen, 0) > 0 THEN v_id_izl_25
              WHEN COALESCE(i.forditott_adozas, false) THEN v_id_izl_tuz_prij
              ELSE v_id_izl_0
            END
          ELSE
            CASE
              WHEN COALESCE(i.forditott_adozas, false) THEN v_id_ul_tuz_prij
              WHEN COALESCE(i.afa_osszeg_osszesen, 0) > 0 THEN v_id_ul_25_odb
              ELSE v_id_ul_neodb
            END
        END
      ) AS target_code_id
    FROM public.invoices i
    WHERE i.company_id = p_company_id
      AND (p_overwrite = true OR i.vat_code_id IS NULL)
  ),
  updated_invoices AS (
    UPDATE public.invoices i
    SET vat_code_id = ipc.target_code_id
    FROM invoice_primary_codes ipc
    WHERE i.id = ipc.invoice_id
      AND ipc.target_code_id IS NOT NULL
    RETURNING i.id
  )
  SELECT count(*) INTO v_invoices_updated FROM updated_invoices;

  RETURN jsonb_build_object(
    'success', true,
    'company_id', p_company_id,
    'company_name', v_company_name,
    'items_updated', v_items_updated,
    'invoices_updated', v_invoices_updated
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.assign_croatian_vat_codes(uuid, boolean) TO authenticated, service_role;

-- 2. Auto-assignment trigger for new/updated invoice_items on Croatian companies
CREATE OR REPLACE FUNCTION public.trg_auto_assign_croatian_vat_code_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT;
  v_direction TEXT;
  v_forditott BOOLEAN;
  v_partner_vat TEXT;
  v_assigned_code_id UUID;
  v_code_name TEXT;
BEGIN
  -- Only trigger if vat_code_id is not manually specified
  IF NEW.vat_code_id IS NOT NULL AND COALESCE(NEW.is_vat_code_manual, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT 
    c.country_code, 
    i.invoice_direction,
    i.forditott_adozas,
    CASE WHEN UPPER(COALESCE(i.invoice_direction, 'OUTBOUND')) = 'OUTBOUND' THEN i.vevo_vat_id ELSE i.elado_vat_id END
  INTO 
    v_country_code, 
    v_direction,
    v_forditott,
    v_partner_vat
  FROM public.invoices i
  JOIN public.companies c ON c.id = i.company_id
  WHERE i.id = NEW.invoice_id;

  -- Only apply for Croatian jurisdiction
  IF v_country_code <> 'HR' THEN
    RETURN NEW;
  END IF;

  v_partner_vat := UPPER(TRIM(COALESCE(v_partner_vat, '')));

  IF UPPER(COALESCE(v_direction, 'OUTBOUND')) = 'OUTBOUND' THEN
    IF COALESCE(NEW.vat_rate, '') = '13%' OR (COALESCE(NEW.net_amount, 0) > 0 AND ROUND(COALESCE(NEW.vat_amount, 0) / NEW.net_amount, 2) = 0.13) THEN
      v_code_name := 'HR_IZL_13';
    ELSIF COALESCE(NEW.vat_rate, '') = '5%' OR (COALESCE(NEW.net_amount, 0) > 0 AND ROUND(COALESCE(NEW.vat_amount, 0) / NEW.net_amount, 2) = 0.05) THEN
      v_code_name := 'HR_IZL_5';
    ELSIF COALESCE(NEW.vat_rate, '') IN ('25%', '27%') OR COALESCE(NEW.vat_amount, 0) > 0 THEN
      v_code_name := 'HR_IZL_25';
    ELSIF COALESCE(v_forditott, false) THEN
      v_code_name := 'HR_IZL_TUZ_PRIJ';
    ELSIF v_partner_vat ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)' THEN
      IF COALESCE(NEW.line_description, '') ~* '(uslug|poslov|najam|plać|plac|upravlj|savjet|održ|odrz|licenc|software|szoftver|djelatnik|dozvol|szolgáltatás|szolgaltatas|bérleti|berleti|ügyvédi|ugyvedi|tanácsadás|tanacsadas)' THEN
        v_code_name := 'HR_IZL_EU_USL';
      ELSE
        v_code_name := 'HR_IZL_EU_DOB';
      END IF;
    ELSIF v_partner_vat <> '' AND NOT v_partner_vat ~ '^(HR)?[0-9]{11}$' THEN
      v_code_name := 'HR_IZL_IZVOZ';
    ELSE
      v_code_name := 'HR_IZL_0';
    END IF;
  ELSE
    -- INBOUND
    IF COALESCE(v_forditott, false) THEN
      v_code_name := 'HR_UL_TUZ_PRIJ';
    ELSIF v_partner_vat ~ '^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)' THEN
      IF COALESCE(NEW.vat_rate, '') = '13%' THEN v_code_name := 'HR_UL_EU_USL_13';
      ELSIF COALESCE(NEW.vat_rate, '') = '5%' THEN v_code_name := 'HR_UL_EU_USL_5';
      ELSIF COALESCE(NEW.vat_rate, '') = '0%' THEN v_code_name := 'HR_UL_EU_DOB_25';
      ELSE v_code_name := 'HR_UL_EU_USL_25';
      END IF;
    ELSIF COALESCE(NEW.vat_rate, '') = '13%' OR (COALESCE(NEW.net_amount, 0) > 0 AND ROUND(COALESCE(NEW.vat_amount, 0) / NEW.net_amount, 2) = 0.13) THEN
      v_code_name := 'HR_UL_13_ODB';
    ELSIF COALESCE(NEW.vat_rate, '') = '5%' OR (COALESCE(NEW.net_amount, 0) > 0 AND ROUND(COALESCE(NEW.vat_amount, 0) / NEW.net_amount, 2) = 0.05) THEN
      v_code_name := 'HR_UL_5_ODB';
    ELSIF COALESCE(NEW.vat_rate, '') IN ('25%', '27%') OR COALESCE(NEW.vat_amount, 0) > 0 THEN
      v_code_name := 'HR_UL_25_ODB';
    ELSE
      v_code_name := 'HR_UL_NEODB';
    END IF;
  END IF;

  SELECT id INTO v_assigned_code_id
  FROM public.vat_codes
  WHERE company_id = (SELECT company_id FROM public.invoices WHERE id = NEW.invoice_id)
    AND code = v_code_name
  LIMIT 1;

  IF v_assigned_code_id IS NOT NULL THEN
    NEW.vat_code_id := v_assigned_code_id;
    NEW.vat_code := v_code_name;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_assign_croatian_vat_code ON public.invoice_items;
CREATE TRIGGER trg_auto_assign_croatian_vat_code
  BEFORE INSERT ON public.invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_assign_croatian_vat_code_item();

-- 3. Execute immediately for all existing Croatian companies
DO $$
DECLARE
  r RECORD;
  v_res JSONB;
BEGIN
  FOR r IN SELECT id, name FROM public.companies WHERE country_code = 'HR' LOOP
    v_res := public.assign_croatian_vat_codes(r.id, false);
    RAISE NOTICE 'Croatian VAT codes assigned: % -> %', r.name, v_res;
  END LOOP;
END $$;
