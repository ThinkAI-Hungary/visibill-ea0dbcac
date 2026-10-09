-- Migration: 20261009120000_add_import_customs_vat_declarations_and_codes.sql
-- Description: Statutory Import VAT (Termékimport) support according to Áfa tv. 24. §, 74-75. §, 81. §, 93. §, 95. §, 120. §, 127. §, 154-156. §
--              and Szt. 47. §, 60. §.
--              Includes import_customs_declarations table, 8 statutory vat_codes, and seed_default_vat_codes update.

-- 1. Create table import_customs_declarations
CREATE TABLE IF NOT EXISTS public.import_customs_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Határozat adatai
  declaration_number TEXT NOT NULL,                          -- Vámhatározat / eVám referenciaszám
  customs_office_code TEXT,                                  -- Eljáró vámhivatal kódja
  decision_date DATE NOT NULL,                               -- Határozat kelte
  tax_period_date DATE NOT NULL,                             -- Adómegállapítás / elszámolás napja
  
  -- Ügylet típusa
  procedure_type TEXT NOT NULL DEFAULT 'LEVY'                -- 'LEVY' (Kivetés) | 'SELF_ASSESSMENT' (Önadózás)
    CHECK (procedure_type IN ('LEVY', 'SELF_ASSESSMENT')),
  status TEXT NOT NULL DEFAULT 'CONFIRMED'                   -- 'DRAFT' | 'CONFIRMED' | 'PAID' | 'CANCELLED'
    CHECK (status IN ('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED')),
  
  -- Szállítói számla kapcsolat (opcionális)
  foreign_supplier_invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  foreign_supplier_name TEXT,
  foreign_currency TEXT NOT NULL DEFAULT 'EUR',
  foreign_invoice_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  
  -- Vámérték és adóalap kalkuláció
  customs_exchange_rate NUMERIC(12, 4) NOT NULL DEFAULT 1.0, -- Vámárfolyam (Áfa tv. 81. §)
  customs_value_huf NUMERIC(14, 2) NOT NULL DEFAULT 0,       -- Vámérték forintban
  customs_duty_huf NUMERIC(14, 2) NOT NULL DEFAULT 0,        -- Kiszabott vám összege
  other_import_costs_huf NUMERIC(14, 2) NOT NULL DEFAULT 0,  -- Fuvar, vámügynök (Áfa tv. 74. §)
  vat_base_huf NUMERIC(14, 2) NOT NULL DEFAULT 0,            -- Vámérték + Vám + Járulékos költségek
  
  -- ÁFA adatok
  vat_code TEXT NOT NULL,                                    -- Pl. IMP_KIV_27, IMP_ON_27
  vat_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 27.00,
  vat_amount_huf NUMERIC(14, 2) NOT NULL DEFAULT 0,          -- Kiszabott / önadózott áfa
  is_deductible BOOLEAN NOT NULL DEFAULT true,               -- Levonható-e
  
  -- Megfizetés követése (Kivetés esetén kritikus a 70. sorhoz)
  payment_status TEXT NOT NULL DEFAULT 'PENDING'             -- 'PENDING' | 'PAID'
    CHECK (payment_status IN ('PENDING', 'PAID')),
  payment_date DATE,                                         -- Tényleges megfizetés napja
  bank_transaction_ref TEXT,                                 -- Banki bizonylatszám / hivatkozás
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  
  -- Közvetett vámjogi képviselő (ha van)
  indirect_customs_rep_name TEXT,
  indirect_customs_rep_tax_number TEXT,
  
  -- Könyvelési hivatkozás
  gl_journal_header_id UUID,
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexek a gyors időszaki lekérdezésekhez
CREATE INDEX IF NOT EXISTS idx_import_customs_company_period ON public.import_customs_declarations(company_id, tax_period_date);
CREATE INDEX IF NOT EXISTS idx_import_customs_company_payment ON public.import_customs_declarations(company_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_import_customs_status ON public.import_customs_declarations(company_id, status, payment_status);

-- RLS védelem (Multi-tenancy ADR A-003)
ALTER TABLE public.import_customs_declarations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'import_customs_declarations' 
      AND policyname = 'Users view import declarations for their company'
  ) THEN
    CREATE POLICY "Users view import declarations for their company"
      ON public.import_customs_declarations FOR SELECT
      USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'import_customs_declarations' 
      AND policyname = 'Users modify import declarations for their company'
  ) THEN
    CREATE POLICY "Users modify import declarations for their company"
      ON public.import_customs_declarations FOR ALL
      USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
  END IF;
END $$;

-- 2. Update seed_default_vat_codes to include the 8 new import vat codes
CREATE OR REPLACE FUNCTION public.seed_default_vat_codes(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_country_code TEXT := 'HU';
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(country_code, 'HU') INTO v_country_code
  FROM public.companies
  WHERE id = p_company_id;

  IF v_country_code = 'HR' THEN
    -- Seed Croatian VAT (PDV) codes according to Obrazac PDV
    INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, sort_order, target_rows)
    VALUES
      -- Izlazni računi (OUTBOUND)
      (p_company_id, 'HR_IZL_25',       'Isporuke dobara i usluga po stopi 25%', 25.00, 'OUTBOUND', false, false, false, 10,
       '[{"row": "II.3", "col": "base"}, {"row": "II.3", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_13',       'Isporuke dobara i usluga po stopi 13%', 13.00, 'OUTBOUND', false, false, false, 20,
       '[{"row": "II.2", "col": "base"}, {"row": "II.2", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_5',        'Isporuke dobara i usluga po stopi 5%', 5.00, 'OUTBOUND', false, false, false, 30,
       '[{"row": "II.1", "col": "base"}, {"row": "II.1", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_IZL_0',        'Isporuke po stopi 0%', 0.00, 'OUTBOUND', false, false, false, 40,
       '[{"row": "I.11", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_TUZ_PRIJ', 'Tuzemni prijenos porezne obveze (isporuka)', 0.00, 'OUTBOUND', false, true, false, 50,
       '[{"row": "I.1", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_EU_DOB',   'Isporuke dobara unutar EU', 0.00, 'OUTBOUND', false, false, true, 60,
       '[{"row": "I.3", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_EU_USL',   'Obavljene usluge unutar EU', 0.00, 'OUTBOUND', false, false, true, 70,
       '[{"row": "I.4", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_INO_USL',  'Obavljene usluge osobama bez sjedišta u RH', 0.00, 'OUTBOUND', false, false, false, 80,
       '[{"row": "I.5", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_IZVOZ',    'Izvozne isporuke (treće zemlje)', 0.00, 'OUTBOUND', false, false, false, 90,
       '[{"row": "I.9", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_TUZ_OSL',  'Tuzemne isporuke oslobođene PDV-a', 0.00, 'OUTBOUND', false, false, false, 100,
       '[{"row": "I.8", "col": "base"}]'::jsonb),
      (p_company_id, 'HR_IZL_OST_OSL',  'Ostala oslobođenja', 0.00, 'OUTBOUND', false, false, false, 110,
       '[{"row": "I.10", "col": "base"}]'::jsonb),

      -- Ulazni računi (INBOUND)
      (p_company_id, 'HR_UL_25_ODB',     'Pretporez od primljenih isporuka u tuzemstvu 25%', 25.00, 'INBOUND', true, false, false, 200,
       '[{"row": "III.3", "col": "base"}, {"row": "III.3", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_13_ODB',     'Pretporez od primljenih isporuka u tuzemstvu 13%', 13.00, 'INBOUND', true, false, false, 210,
       '[{"row": "III.2", "col": "base"}, {"row": "III.2", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_5_ODB',      'Pretporez od primljenih isporuka u tuzemstvu 5%', 5.00, 'INBOUND', true, false, false, 220,
       '[{"row": "III.1", "col": "base"}, {"row": "III.1", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_TUZ_PRIJ',   'Tuzemni prijenos porezne obveze (primljeno)', 25.00, 'INBOUND', true, true, false, 230,
       '[{"row": "II.4", "col": "base"}, {"row": "II.4", "col": "tax"}, {"row": "III.4", "col": "base"}, {"row": "III.4", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_25',  'Stjecanje dobara unutar EU 25%', 25.00, 'INBOUND', true, false, true, 240,
       '[{"row": "II.7", "col": "base"}, {"row": "II.7", "col": "tax"}, {"row": "III.7", "col": "base"}, {"row": "III.7", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_13',  'Stjecanje dobara unutar EU 13%', 13.00, 'INBOUND', true, false, true, 250,
       '[{"row": "II.6", "col": "base"}, {"row": "II.6", "col": "tax"}, {"row": "III.6", "col": "base"}, {"row": "III.6", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_DOB_5',   'Stjecanje dobara unutar EU 5%', 5.00, 'INBOUND', true, false, true, 260,
       '[{"row": "II.5", "col": "base"}, {"row": "II.5", "col": "tax"}, {"row": "III.5", "col": "base"}, {"row": "III.5", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_25',  'Primljene usluge iz EU 25%', 25.00, 'INBOUND', true, false, true, 270,
       '[{"row": "II.10", "col": "base"}, {"row": "II.10", "col": "tax"}, {"row": "III.10", "col": "base"}, {"row": "III.10", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_13',  'Primljene usluge iz EU 13%', 13.00, 'INBOUND', true, false, true, 280,
       '[{"row": "II.9", "col": "base"}, {"row": "II.9", "col": "tax"}, {"row": "III.9", "col": "base"}, {"row": "III.9", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_EU_USL_5',   'Primljene usluge iz EU 5%', 5.00, 'INBOUND', true, false, true, 290,
       '[{"row": "II.8", "col": "base"}, {"row": "II.8", "col": "tax"}, {"row": "III.8", "col": "base"}, {"row": "III.8", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_INO_USL_25', 'Primljene isporuke od inozemnih obveznika 25%', 25.00, 'INBOUND', true, false, false, 300,
       '[{"row": "II.13", "col": "base"}, {"row": "II.13", "col": "tax"}, {"row": "III.13", "col": "base"}, {"row": "III.13", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_UVOZ_25',    'Pretporez pri uvozu 25%', 25.00, 'INBOUND', true, false, false, 310,
       '[{"row": "III.14", "col": "base"}, {"row": "III.14", "col": "tax"}]'::jsonb),
      (p_company_id, 'HR_UL_NEODB',      'Primljene isporuke bez prava na odbitak', 25.00, 'INBOUND', false, false, false, 320,
       '[]'::jsonb),
      (p_company_id, 'HR_UL_IMOVINA',    'Nabava dugotrajne imovine 25%', 25.00, 'INBOUND', true, false, false, 330,
       '[{"row": "III.3", "col": "base"}, {"row": "III.3", "col": "tax"}, {"row": "VI.1.4", "col": "base"}]'::jsonb)
    ON CONFLICT (company_id, code) DO UPDATE SET
      label = EXCLUDED.label,
      target_rows = EXCLUDED.target_rows,
      vat_percent = EXCLUDED.vat_percent,
      direction = EXCLUDED.direction,
      is_deductible = EXCLUDED.is_deductible,
      is_reverse_charge = EXCLUDED.is_reverse_charge,
      is_eu = EXCLUDED.is_eu,
      sort_order = EXCLUDED.sort_order;

  ELSE
    -- Seed Hungarian (HU) NAV 2665 default codes
    INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, sort_order, target_rows)
    VALUES
      (p_company_id, 'KIM_27',       'Belföldi 27% ÁFA', 27, 'OUTBOUND', false, false, false, 10,
       '[{"row": "07", "col": "tax"}, {"row": "07", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_18',       'Belföldi 18% ÁFA', 18, 'OUTBOUND', false, false, false, 20,
       '[{"row": "06", "col": "tax"}, {"row": "06", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_5',        'Belföldi 5% ÁFA', 5, 'OUTBOUND', false, false, false, 30,
       '[{"row": "05", "col": "tax"}, {"row": "05", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_FORD',     'Belföldi fordított értékesítés (mentes)', 0, 'OUTBOUND', false, true, false, 35,
       '[{"row": "04", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EXPORT',   'Termékexport 3. országba (mentes)', 0, 'OUTBOUND', false, false, false, 40,
       '[{"row": "01", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EU',       'Közösségen belüli adómentes termékértékesítés', 0, 'OUTBOUND', false, false, true, 42,
       '[{"row": "02", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_TAM',      'Közérdekű vagy speciális adómentes (TAM)', 0, 'OUTBOUND', false, false, false, 44,
       '[{"row": "08", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_ATHK',     'ÁFA területi hatályán kívüli SZOLGÁLTATÁSOK (3. ország)', 0, 'OUTBOUND', false, false, false, 48,
       '[{"row": "91", "col": "base"}]'::jsonb),
      (p_company_id, 'KIM_EU_SZOLG', 'ÁFA területi hatályán kívüli EU SZOLGÁLTATÁSOK (Áfa tv. 37.§)', 0, 'OUTBOUND', false, false, true, 50,
       '[{"row": "92", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_27_LEV',    'Levonható 27% ÁFA', 27, 'INBOUND', true, false, false, 100,
       '[{"row": "66", "col": "tax"}, {"row": "66", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_18_LEV',    'Levonható 18% ÁFA', 18, 'INBOUND', true, false, false, 110,
       '[{"row": "65", "col": "tax"}, {"row": "65", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_5_LEV',     'Levonható 5% ÁFA', 5, 'INBOUND', true, false, false, 120,
       '[{"row": "64", "col": "tax"}, {"row": "64", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_0_LEV',     'Adómentes belföldi beszerzés (mentes)', 0, 'INBOUND', true, false, false, 130,
       '[{"row": "63", "col": "base"}]'::jsonb),
      (p_company_id, 'BE_FORD_27',   'FAD Építőipari / fordított adózás 27%', 27, 'INBOUND', true, true, false, 200,
       '[{"row": "29", "col": "base"}, {"row": "29", "col": "tax"}, {"row": "66", "col": "base"}, {"row": "66", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_SZOLG_BE',  'EU szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, true, 300,
       '[{"row": "18", "col": "base"}, {"row": "18", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_27',   'EU termékbeszerzés 27%', 27, 'INBOUND', true, false, true, 310,
       '[{"row": "14", "col": "base"}, {"row": "14", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_18',   'EU termékbeszerzés 18%', 18, 'INBOUND', true, false, true, 320,
       '[{"row": "13", "col": "base"}, {"row": "13", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'EU_TERM_5',    'EU termékbeszerzés 5%', 5, 'INBOUND', true, false, true, 330,
       '[{"row": "12", "col": "base"}, {"row": "12", "col": "tax"}, {"row": "69", "col": "base"}, {"row": "69", "col": "tax"}]'::jsonb),
      (p_company_id, 'HARM_SZOLG',   '3. ország szolgáltatás igénybevétel 27%', 27, 'INBOUND', true, false, false, 400,
       '[{"row": "27", "col": "base"}, {"row": "27", "col": "tax"}, {"row": "67", "col": "base"}, {"row": "67", "col": "tax"}]'::jsonb),

      -- 8 Új Import ÁFA kód (Áfa tv. 24., 74-75., 81., 95., 120., 154-156. §)
      (p_company_id, 'IMP_KIV_27',   'Termékimport kivetéssel 27% (megfizetéskor levonható)', 27, 'INBOUND', true, false, false, 500,
       '[{"row": "70", "col": "base"}, {"row": "70", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_KIV_18',   'Termékimport kivetéssel 18% (megfizetéskor levonható)', 18, 'INBOUND', true, false, false, 510,
       '[{"row": "70", "col": "base"}, {"row": "70", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_KIV_5',    'Termékimport kivetéssel 5% (megfizetéskor levonható)', 5, 'INBOUND', true, false, false, 520,
       '[{"row": "70", "col": "base"}, {"row": "70", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_ON_27',    'Termékimport önadózással 27% (fizetendő + levonható)', 27, 'INBOUND', true, false, false, 530,
       '[{"row": "26", "col": "base"}, {"row": "26", "col": "tax"}, {"row": "71", "col": "base"}, {"row": "71", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_ON_18',    'Termékimport önadózással 18% (fizetendő + levonható)', 18, 'INBOUND', true, false, false, 540,
       '[{"row": "25", "col": "base"}, {"row": "25", "col": "tax"}, {"row": "71", "col": "base"}, {"row": "71", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_ON_5',     'Termékimport önadózással 5% (fizetendő + levonható)', 5, 'INBOUND', true, false, false, 550,
       '[{"row": "24", "col": "base"}, {"row": "24", "col": "tax"}, {"row": "71", "col": "base"}, {"row": "71", "col": "tax"}]'::jsonb),
      (p_company_id, 'IMP_MENTES',   'Adómentes termékimport (Áfa tv. 95. § / 42-es eljárás)', 0, 'INBOUND', false, false, false, 560,
       '[{"row": "23", "col": "base"}]'::jsonb),
      (p_company_id, 'IMP_NEM_LEV',  'Nem levonható termékimport áfa (bekerülési értékbe)', 27, 'INBOUND', false, false, false, 570,
       '[]'::jsonb)
    ON CONFLICT (company_id, code) DO UPDATE SET
      label = EXCLUDED.label,
      target_rows = EXCLUDED.target_rows,
      vat_percent = EXCLUDED.vat_percent,
      direction = EXCLUDED.direction,
      is_deductible = EXCLUDED.is_deductible,
      is_reverse_charge = EXCLUDED.is_reverse_charge,
      is_eu = EXCLUDED.is_eu,
      sort_order = EXCLUDED.sort_order;
  END IF;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.seed_default_vat_codes(uuid) TO authenticated, service_role;

-- 3. Seed the new import codes for all existing Hungarian companies
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies WHERE country_code = 'HU' OR country_code IS NULL LOOP
    PERFORM public.seed_default_vat_codes(r.id);
  END LOOP;
END $$;
