-- ============================================================
-- FORDÍTOTT ADÓZÁS (FAD / Reverse Charge) MODUL — DB Séma
-- ============================================================
-- Áfa tv. 142.§ szerinti belföldi fordított adózás kezelése.
-- - nav_invoices + invoices bővítés (kategória, confidence, 60.§ dátum)
-- - reverse_charge_entries tábla (kettős könyvelési tételek)
-- - vat_codes seed bővítés (ügylettípus-specifikus FAD kódok)
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. nav_invoices BŐVÍTÉS
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN DEFAULT false;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS reverse_charge_category TEXT;

-- Constraint külön, mert ADD COLUMN IF NOT EXISTS + CHECK egy utasításban
-- nem idempotens ha az oszlop már létezik de constraint nem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nav_invoices_rc_category_check'
  ) THEN
    ALTER TABLE public.nav_invoices
      ADD CONSTRAINT nav_invoices_rc_category_check
      CHECK (reverse_charge_category IS NULL OR reverse_charge_category IN (
        'construction',
        'scrap_metal',
        'agriculture',
        'steel',
        'emission_quota',
        'natural_gas',
        'labor_hire',
        'eu_service_import',
        'third_country'
      ));
  END IF;
END $$;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS rc_confidence TEXT DEFAULT 'auto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nav_invoices_rc_confidence_check'
  ) THEN
    ALTER TABLE public.nav_invoices
      ADD CONSTRAINT nav_invoices_rc_confidence_check
      CHECK (rc_confidence IN ('auto', 'confirmed', 'uncertain', 'override'));
  END IF;
END $$;

-- 60.§ szerinti fizetendő adó keletkezésének dátuma
ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS rc_vat_date DATE;

-- Index a FAD-os számlák gyors szűréséhez
CREATE INDEX IF NOT EXISTS idx_nav_invoices_reverse_charge
  ON public.nav_invoices(company_id, is_reverse_charge)
  WHERE is_reverse_charge = true;


-- ──────────────────────────────────────────────────────────────
-- 2. invoices BŐVÍTÉS (feltöltött / OCR-ezett számlák)
-- ──────────────────────────────────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS reverse_charge_category TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invoices_rc_category_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_rc_category_check
      CHECK (reverse_charge_category IS NULL OR reverse_charge_category IN (
        'construction',
        'scrap_metal',
        'agriculture',
        'steel',
        'emission_quota',
        'natural_gas',
        'labor_hire',
        'eu_service_import',
        'third_country'
      ));
  END IF;
END $$;


-- ──────────────────────────────────────────────────────────────
-- 3. reverse_charge_entries TÁBLA
-- Kettős könyvelési tételek: fizetendő + levonható ÁFA
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reverse_charge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Számla hivatkozás (pontosan az egyiket kell kitölteni)
  nav_invoice_id UUID REFERENCES public.nav_invoices(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,

  -- FAD tétel adatai
  category TEXT NOT NULL CHECK (category IN (
    'construction', 'scrap_metal', 'agriculture', 'steel',
    'emission_quota', 'natural_gas', 'labor_hire',
    'eu_service_import', 'third_country'
  )),
  net_amount NUMERIC NOT NULL,
  vat_rate NUMERIC NOT NULL DEFAULT 0.27,
  vat_amount NUMERIC NOT NULL,

  -- Könyvelési dátumok (Áfa tv. 60.§)
  invoice_received_date DATE,
  payment_date DATE,
  deadline_date DATE,              -- teljesítés + 1 hó 15.
  effective_vat_date DATE NOT NULL, -- a legkorábbi a 3-ból

  -- Bevallási időszak (ebből számítja a rendszer, melyik 2665-be kerül)
  vat_period_year INT NOT NULL,
  vat_period_month INT NOT NULL,

  -- Könyvelési státusz
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'booked', 'submitted', 'error'
  )),

  -- Tételes adatszolgáltatás (mezőgazdaság / acél / hulladék)
  -- Pl.: {"vtsz": "1001", "weight_kg": 5000, "partner_tax_number": "12345678-2-42"}
  detail_data JSONB DEFAULT '{}'::jsonb,

  -- Levonási jog
  is_deductible BOOLEAN NOT NULL DEFAULT true,
  deduction_ratio NUMERIC NOT NULL DEFAULT 1.0
    CHECK (deduction_ratio >= 0 AND deduction_ratio <= 1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Legalább az egyik számla-hivatkozás kötelező
  CONSTRAINT rce_invoice_ref_check CHECK (
    nav_invoice_id IS NOT NULL OR invoice_id IS NOT NULL
  )
);

-- RLS
ALTER TABLE public.reverse_charge_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rce_company_policy" ON public.reverse_charge_entries
  USING (company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid()));

-- Indexek
CREATE INDEX IF NOT EXISTS idx_rce_company
  ON public.reverse_charge_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_rce_nav_invoice
  ON public.reverse_charge_entries(nav_invoice_id)
  WHERE nav_invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rce_invoice
  ON public.reverse_charge_entries(invoice_id)
  WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rce_period
  ON public.reverse_charge_entries(company_id, vat_period_year, vat_period_month);

CREATE INDEX IF NOT EXISTS idx_rce_status
  ON public.reverse_charge_entries(status)
  WHERE status = 'pending';

-- Updated_at trigger
CREATE TRIGGER trg_rce_updated
  BEFORE UPDATE ON public.reverse_charge_entries
  FOR EACH ROW EXECUTE FUNCTION update_vat_updated_at();


-- ──────────────────────────────────────────────────────────────
-- 4. vat_codes SEED BŐVÍTÉS
-- Ügylettípus-specifikus FAD kódok hozzáadása
-- ──────────────────────────────────────────────────────────────
-- A meglévő seed_default_vat_codes() függvényt bővítjük.
-- ON CONFLICT DO NOTHING → idempotens, nem duplikálja a meglévőket.

CREATE OR REPLACE FUNCTION seed_fad_vat_codes(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO vat_codes (company_id, code, label, vat_percent, direction, is_deductible, is_reverse_charge, is_eu, target_rows, sort_order)
  VALUES
    -- Építőipari FAD (142.§ (1) a-b)
    (p_company_id, 'FAD_EPIT_27', 'FAD Építőipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 201),
    (p_company_id, 'FAD_EPIT_5',  'FAD Építőipari 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 202),

    -- Hulladék FAD (6. melléklet)
    (p_company_id, 'FAD_HULL_27', 'FAD Hulladék 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"30","col":"base"},{"row":"30","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 211),

    -- Mezőgazdasági FAD (6/A melléklet) — tételes adatszolgáltatás kötelező
    (p_company_id, 'FAD_MEZO_27', 'FAD Mezőgazdaság 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 221),
    (p_company_id, 'FAD_MEZO_5',  'FAD Mezőgazdaság 5%',   5.00, 'INBOUND', true, true, false,
     '[{"row":"31","col":"base"},{"row":"31","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 222),

    -- Acélipari FAD (6/B melléklet) — tételes adatszolgáltatás kötelező
    (p_company_id, 'FAD_ACEL_27', 'FAD Acélipari 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"32","col":"base"},{"row":"32","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 231),

    -- Földgáz FAD (átmeneti szabály)
    (p_company_id, 'FAD_GAZ_27',  'FAD Földgáz 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"33","col":"base"},{"row":"33","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 241),

    -- Munkaerő-kölcsönzés (építőipari)
    (p_company_id, 'FAD_MUNKA_27','FAD Munkaerő-kölcsönzés 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 251),

    -- Üvegházhatású gáz kvóta
    (p_company_id, 'FAD_KVOTA_27','FAD Kibocsátási kvóta 27%', 27.00, 'INBOUND', true, true, false,
     '[{"row":"29","col":"base"},{"row":"29","col":"tax"},{"row":"67","col":"base"},{"row":"67","col":"tax"}]'::jsonb, 261)

  ON CONFLICT (company_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Jogosultság: csak authenticated user hívhatja
REVOKE EXECUTE ON FUNCTION public.seed_fad_vat_codes FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_fad_vat_codes TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- 5. AUTO-DETECT: nav_invoices trigger
-- Ha nav_invoice_items-ben van DOMESTIC_REVERSE_CHARGE vat_rate,
-- automatikusan beállítja az is_reverse_charge = true mezőt.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_detect_reverse_charge()
RETURNS TRIGGER AS $$
BEGIN
  -- Ha a beszúrt tétel vat_rate-je DOMESTIC_REVERSE_CHARGE,
  -- jelöljük a szülő nav_invoices rekordot
  IF NEW.vat_rate = 'DOMESTIC_REVERSE_CHARGE' THEN
    UPDATE public.nav_invoices
    SET is_reverse_charge = true,
        rc_confidence = COALESCE(rc_confidence, 'auto')
    WHERE id = NEW.nav_invoice_id
      AND is_reverse_charge = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: nav_invoice_items INSERT-re
DROP TRIGGER IF EXISTS trg_auto_detect_rc ON public.nav_invoice_items;

CREATE TRIGGER trg_auto_detect_rc
  AFTER INSERT ON public.nav_invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_detect_reverse_charge();


-- ──────────────────────────────────────────────────────────────
-- 6. Backfill: meglévő nav_invoice_items alapján jelölés
-- Egyszeri futtatás a meglévő adatokra
-- ──────────────────────────────────────────────────────────────

UPDATE public.nav_invoices ni
SET is_reverse_charge = true,
    rc_confidence = 'auto'
WHERE is_reverse_charge = false
  AND EXISTS (
    SELECT 1 FROM public.nav_invoice_items nii
    WHERE nii.nav_invoice_id = ni.id
      AND nii.vat_rate = 'DOMESTIC_REVERSE_CHARGE'
  );
