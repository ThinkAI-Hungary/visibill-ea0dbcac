-- =============================================================================
-- Egyszeres könyvvitel & EV modul – Supabase migráció
-- =============================================================================
-- Szja tv. 5. sz. melléklet + KATA tv. + 479/2016. Korm. rendelet szerinti
-- adatmodell egyéni vállalkozók és egyszeres könyvvitelt vezető szervezetek
-- könyvvezetéséhez.
--
-- NAMING: Minden eAisyBooks-specifikus tábla az "accounty_" prefixet kapja.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUM TÍPUSOK
-- ─────────────────────────────────────────────────────────────────────────────

-- Adózási forma (EV)
CREATE TYPE accounty_ev_taxpayer_form AS ENUM (
  'atalany',       -- Átalányadózó
  'vszja',         -- Vállalkozói SZJA
  'kata'           -- Kisadózó tételes adó
);

-- Foglalkoztatottsági státusz
CREATE TYPE accounty_ev_employment_status AS ENUM (
  'foallasu',      -- Főfoglalkozású
  'mellekallasu',  -- Mellékállású (heti 36+ órás munkaviszony)
  'kiegeszito'     -- Kiegészítő (nyugdíjas)
);

-- ÁFA státusz
CREATE TYPE accounty_ev_vat_status AS ENUM (
  'alanyi_mentes', -- Alanyi adómentesség (Áfa tv. 188. §)
  'afas',          -- Általános ÁFA-alany
  'penzforgalmi'   -- Pénzforgalmi ÁFA
);

-- Költséghányad kategória (átalányadózónál)
CREATE TYPE accounty_ev_cost_ratio_category AS ENUM (
  'general',       -- 45% (2026, általános)
  'high_80',       -- 80%
  'retail_90'      -- 90% (kiskereskedő)
);

-- Pénztárkönyvi oszlop (Szja tv. 5. sz. melléklet I. rész)
CREATE TYPE accounty_penztarkonyv_category AS ENUM (
  -- Bevételek
  'bevetel_adokoteles',
  'bevetel_fizetendo_afa',
  'bevetel_be_nem_szamito',
  -- Kiadások – költségként elszámolható
  'kiadas_anyag_arubeszerzes',
  'kiadas_kozvetitett_szolgaltatas',
  'kiadas_alkalmazott_ber_kozteher',
  'kiadas_vallalkozoi_kivet',
  'kiadas_egyeb_koltseg',
  -- Kiadások – költségként el nem számolható
  'kiadas_beruhazasi_koltseg',
  'kiadas_levonhato_afa',
  'kiadas_egyeb_nem_koltseg'
);

-- Pénztárkönyv tétel iránya
CREATE TYPE accounty_penztarkonyv_direction AS ENUM (
  'bevetel',       -- Bevétel
  'kiadas'         -- Kiadás
);

-- Időszak típusa (záráshoz)
CREATE TYPE accounty_ev_period_type AS ENUM (
  'monthly',       -- Havi
  'quarterly',     -- Negyedéves
  'annual'         -- Éves
);

-- Életciklus esemény típusa
CREATE TYPE accounty_ev_lifecycle_event_type AS ENUM (
  'start',         -- Tevékenység kezdése
  'pause',         -- Szüneteltetés
  'restart',       -- Újraindítás
  'end',           -- Megszűnés
  'form_change'    -- Adózási forma váltás
);

-- Egyéb szervezet típusa (479/2016. Korm. rendelet)
CREATE TYPE accounty_ev_org_type AS ENUM (
  'egyesulet',     -- Egyesület
  'alapitvany',    -- Alapítvány
  'egyhaz',        -- Egyházi jogi személy
  'tarsashaz',     -- Társasház
  'lakasszov',     -- Lakásszövetkezet
  'mrp',           -- MRP szervezet
  'egyeb'          -- Egyéb
);

-- Könyvvezetési mód (szervezeteknél)
CREATE TYPE accounty_ev_bookkeeping_mode AS ENUM (
  'egyszeres',     -- Egyszeres könyvvitel
  'kettos'         -- Kettős könyvvitel (kötelező pl. közhasznúnál)
);

-- Bevallás típusa
CREATE TYPE accounty_ev_return_type AS ENUM (
  'szja',          -- Éves SZJA (25SZJA / 2553)
  'jarulekbevallas', -- Negyedéves járulék (2658)
  'kata',          -- KATA nyilatkozat + különadó
  'hipa',          -- HIPA (25HIPAK)
  'afa',           -- Áfa ('65)
  'cegautado'      -- Cégautóadó ('01)
);

-- Bevallás státusza
CREATE TYPE accounty_ev_return_status AS ENUM (
  'draft',         -- Vázlat
  'ready',         -- Elkészült (ellenőrzésre vár)
  'submitted',     -- Benyújtva
  'accepted',      -- Befogadva
  'rejected',      -- Elutasítva / hibás
  'amended'        -- Javított / módosított
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÜGYFÉL EV BEÁLLÍTÁSOK
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_client_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL DEFAULT 2026,

  -- Adózási forma (Szja tv. 50-56. §, 49/B-49/C. §, KATA tv.)
  taxpayer_form accounty_ev_taxpayer_form NOT NULL DEFAULT 'atalany',
  employment_status accounty_ev_employment_status NOT NULL DEFAULT 'foallasu',
  vat_status accounty_ev_vat_status NOT NULL DEFAULT 'alanyi_mentes',
  cost_ratio_category accounty_ev_cost_ratio_category DEFAULT 'general',

  -- Törzsadatok
  registration_number TEXT, -- Evectv. nyilvántartási szám
  activity_codes TEXT[] DEFAULT '{}', -- ÖVTJ/TEÁOR kódok
  main_activity_code TEXT,
  skilled_main_activity BOOLEAN DEFAULT FALSE, -- Szakképzettséghez kötött → garantált bérminimum

  -- Könyvvezetési mód (szervezeteknél)
  bookkeeping_mode accounty_ev_bookkeeping_mode DEFAULT 'egyszeres',

  -- Egyéb szervezet (ha releváns)
  org_type accounty_ev_org_type,
  is_public_benefit BOOLEAN DEFAULT FALSE, -- Közhasznú jogállás → kötelező kettős

  -- Metaadatok
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(company_id, tax_year)
);

-- KATA validáció: csak főfoglalkozásúnál engedélyezett
ALTER TABLE accounty_ev_client_settings
  ADD CONSTRAINT chk_accounty_kata_foallasu
  CHECK (taxpayer_form != 'kata' OR employment_status = 'foallasu');

-- Költséghányad csak átalányadónál releváns
ALTER TABLE accounty_ev_client_settings
  ADD CONSTRAINT chk_accounty_cost_ratio_only_atalany
  CHECK (taxpayer_form = 'atalany' OR cost_ratio_category IS NULL);

-- Közhasznú szervezet → kötelező kettős könyvvitel
ALTER TABLE accounty_ev_client_settings
  ADD CONSTRAINT chk_accounty_public_benefit_kettos
  CHECK (is_public_benefit = FALSE OR bookkeeping_mode = 'kettos');

CREATE INDEX idx_accounty_ev_client_settings_company ON accounty_ev_client_settings(company_id);
CREATE INDEX idx_accounty_ev_client_settings_year ON accounty_ev_client_settings(tax_year);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ÉLETCIKLUS ESEMÉNYEK
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_lifecycle_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_type accounty_ev_lifecycle_event_type NOT NULL,
  event_date DATE NOT NULL,
  from_form accounty_ev_taxpayer_form, -- Forma-váltásnál: eredeti
  to_form accounty_ev_taxpayer_form,   -- Forma-váltásnál: új
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_lifecycle_company ON accounty_ev_lifecycle_events(company_id, event_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PÉNZTÁRKÖNYV (Szja tv. 5. sz. melléklet I. rész)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_penztarkonyv_tetel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  serial_number INT NOT NULL, -- Sorszám (adóéven belül)

  -- Tétel alapadatai
  entry_date DATE NOT NULL,
  document_number TEXT, -- Bizonylatszám
  description TEXT NOT NULL,
  entry_direction accounty_penztarkonyv_direction NOT NULL,

  -- Besorolás (pontosan 1 fő kategória + opcionális ÁFA-bontás)
  main_category accounty_penztarkonyv_category NOT NULL,
  amount BIGINT NOT NULL, -- Összeg (forintban, fillér nélkül)
  vat_amount BIGINT DEFAULT 0, -- ÁFA összeg (ha ÁFA-alany)

  -- Kapcsolódó bizonylat
  document_url TEXT, -- Csatolt bizonylat (kép/PDF) URL
  document_ocr_data JSONB, -- OCR feldolgozás eredménye

  -- Zárolás
  period_closed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Storno kezelés (lezárt időszak módosításához)
  storno_of_id UUID REFERENCES accounty_penztarkonyv_tetel(id),
  is_storno BOOLEAN NOT NULL DEFAULT FALSE,

  -- Kapcsolat részletező nyilvántartásokhoz
  linked_record_type TEXT, -- pl. 'receivables', 'fixed_assets'
  linked_record_id UUID,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  CONSTRAINT chk_accounty_serial_positive CHECK (serial_number > 0),
  CONSTRAINT chk_accounty_amount_nonzero CHECK (amount != 0)
);

CREATE INDEX idx_accounty_penztarkonyv_company_year ON accounty_penztarkonyv_tetel(company_id, tax_year);
CREATE INDEX idx_accounty_penztarkonyv_date ON accounty_penztarkonyv_tetel(entry_date);
CREATE INDEX idx_accounty_penztarkonyv_storno ON accounty_penztarkonyv_tetel(storno_of_id) WHERE storno_of_id IS NOT NULL;
CREATE UNIQUE INDEX idx_accounty_penztarkonyv_serial ON accounty_penztarkonyv_tetel(company_id, tax_year, serial_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PÉNZTÁRKÖNYV IDŐSZAKI ZÁRÁS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_penztarkonyv_period_close (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  period_type accounty_ev_period_type NOT NULL,
  period_key TEXT NOT NULL, -- pl. '2026-01', '2026-Q1', '2026'

  -- Oszloponkénti összesítők
  column_totals JSONB NOT NULL DEFAULT '{}',
  opening_balance BIGINT DEFAULT 0,
  closing_balance BIGINT DEFAULT 0,

  -- Audit
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by UUID REFERENCES auth.users(id),
  notes TEXT,

  UNIQUE(company_id, tax_year, period_type, period_key)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RÉSZLETEZŐ NYILVÁNTARTÁSOK (Szja tv. 5. sz. melléklet II. rész)
-- ─────────────────────────────────────────────────────────────────────────────

-- 6.2 Vevői (megrendelői) követelések
CREATE TABLE IF NOT EXISTS accounty_ev_records_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  customer_name TEXT NOT NULL,
  invoice_number TEXT,
  completion_date DATE, -- Teljesítés dátuma
  amount BIGINT NOT NULL,
  settlement_date DATE, -- Pénzügyi rendezés dátuma
  cashbook_entry_id UUID REFERENCES accounty_penztarkonyv_tetel(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_receivables_company ON accounty_ev_records_receivables(company_id, tax_year);

-- 6.3 Szállítói tartozások
CREATE TABLE IF NOT EXISTS accounty_ev_records_payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT,
  receipt_date DATE, -- Befogadás dátuma
  amount BIGINT NOT NULL,
  payment_date DATE, -- Kifizetés dátuma
  cashbook_entry_id UUID REFERENCES accounty_penztarkonyv_tetel(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_payables_company ON accounty_ev_records_payables(company_id, tax_year);

-- 6.4 Tárgyi eszközök, nem anyagi javak
CREATE TABLE IF NOT EXISTS accounty_ev_records_fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  asset_name TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  acquisition_cost BIGINT NOT NULL, -- Beszerzési ár
  depreciation_rate NUMERIC(5,2), -- Écs-kulcs (%)
  accumulated_depreciation BIGINT DEFAULT 0, -- Elszámolt écs
  net_value BIGINT, -- Nettó érték
  disposal_date DATE, -- Elidegenítés/selejtezés
  disposal_type TEXT, -- 'sold', 'scrapped'
  is_below_threshold BOOLEAN DEFAULT FALSE, -- < 200.000 Ft → egyösszegű
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_fixed_assets_company ON accounty_ev_records_fixed_assets(company_id, tax_year);

-- 6.5 Beruházási és felújítási költségek
CREATE TABLE IF NOT EXISTS accounty_ev_records_investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  investment_name TEXT NOT NULL,
  cost_elements JSONB DEFAULT '[]', -- Költségelemek
  activation_date DATE, -- Aktiválás dátuma
  depreciation_base BIGINT, -- Écs-alap
  fixed_asset_id UUID REFERENCES accounty_ev_records_fixed_assets(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.6 Értékpapírok
CREATE TABLE IF NOT EXISTS accounty_ev_records_securities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  security_type TEXT NOT NULL,
  nominal_value BIGINT,
  acquisition_cost BIGINT NOT NULL,
  yield_amount BIGINT DEFAULT 0,
  disposal_date DATE,
  disposal_proceeds BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.7 Munkabérek és vállalkozói kivét
CREATE TABLE IF NOT EXISTS accounty_ev_records_wages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  record_type TEXT NOT NULL, -- 'wage', 'kivet', 'contribution'
  period_month INT, -- 1-12
  gross_amount BIGINT NOT NULL,
  net_amount BIGINT,
  tax_amount BIGINT DEFAULT 0,
  contribution_amount BIGINT DEFAULT 0,
  cashbook_entry_id UUID REFERENCES accounty_penztarkonyv_tetel(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.8 Gépjármű-használati nyilvántartás (útnyilvántartás)
CREATE TABLE IF NOT EXISTS accounty_ev_records_vehicle_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  entry_date DATE NOT NULL,
  departure_location TEXT,
  arrival_location TEXT,
  distance_km NUMERIC(10,1) NOT NULL,
  purpose TEXT NOT NULL, -- 'business' vagy 'private'
  is_business BOOLEAN NOT NULL DEFAULT TRUE,
  fuel_cost BIGINT DEFAULT 0,
  vehicle_plate TEXT,
  odometer_start INT,
  odometer_end INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_vehicle_company ON accounty_ev_records_vehicle_log(company_id, tax_year);

-- 6.9 Hitelbe / bizományba átadott-átvett áruk
CREATE TABLE IF NOT EXISTS accounty_ev_records_consignment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2),
  direction TEXT NOT NULL, -- 'given' vagy 'received'
  transfer_date DATE NOT NULL,
  settlement_date DATE,
  amount BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.10 Egyéb követelések / kötelezettségek (előlegek)
CREATE TABLE IF NOT EXISTS accounty_ev_records_other_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  claim_type TEXT NOT NULL, -- 'advance_given', 'advance_received', 'loan_given', 'tax_obligation'
  counterparty TEXT,
  amount BIGINT NOT NULL,
  date_incurred DATE NOT NULL,
  date_settled DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.11 Selejtezési nyilvántartás
CREATE TABLE IF NOT EXISTS accounty_ev_records_scrapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  asset_name TEXT NOT NULL,
  scrapping_reason TEXT,
  scrapping_date DATE NOT NULL,
  original_value BIGINT,
  residual_value BIGINT DEFAULT 0,
  protocol_url TEXT, -- Selejtezési jegyzőkönyv
  fixed_asset_id UUID REFERENCES accounty_ev_records_fixed_assets(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.12 Leltár
CREATE TABLE IF NOT EXISTS accounty_ev_records_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  item_name TEXT NOT NULL,
  quantity NUMERIC(10,2),
  unit_price BIGINT,
  total_value BIGINT NOT NULL,
  inventory_date DATE NOT NULL, -- Fordulónap
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.13 Alvállalkozói nyilvántartás
CREATE TABLE IF NOT EXISTS accounty_ev_records_subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  subcontractor_name TEXT NOT NULL,
  invoice_number TEXT,
  completion_date DATE,
  paid_amount BIGINT NOT NULL,
  payment_date DATE,
  cashbook_entry_id UUID REFERENCES accounty_penztarkonyv_tetel(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 6.14 Szigorú számadású nyomtatványok
CREATE TABLE IF NOT EXISTS accounty_ev_records_strict_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  form_type TEXT NOT NULL,
  serial_range_from TEXT,
  serial_range_to TEXT,
  usage_description TEXT,
  scrapped_count INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. KÖZTEHER-MODUL TÁBLÁK
-- ─────────────────────────────────────────────────────────────────────────────

-- 7.1 TB-járulék és szocho göngyölítés (negyedéves)
CREATE TABLE IF NOT EXISTS accounty_ev_contribution_calc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  quarter INT NOT NULL CHECK (quarter BETWEEN 1 AND 4),

  -- Járulékalap számítás (göngyölítéses)
  ytd_income BIGINT DEFAULT 0, -- Év elejétől göngyölített jövedelem
  prev_quarters_base BIGINT DEFAULT 0, -- Korábbi negyedévek járulékalapja
  current_quarter_base BIGINT DEFAULT 0, -- Tárgynegyedév járulékalapja
  insurance_months INT DEFAULT 3, -- Biztosítási hónapok a negyedévben

  -- Számított közterhelek (havi bontásban, JSONB)
  monthly_breakdown JSONB DEFAULT '[]',

  -- Összesítők
  tb_amount BIGINT DEFAULT 0, -- TB-járulék (18,5%)
  szocho_amount BIGINT DEFAULT 0, -- Szocho (13%)
  total_amount BIGINT DEFAULT 0,

  -- Minimum-alap alkalmazása
  minimum_base_applied BOOLEAN DEFAULT FALSE,
  minimum_base_amount BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  UNIQUE(company_id, tax_year, quarter)
);

-- 7.2 HIPA számítás
CREATE TABLE IF NOT EXISTS accounty_ev_hipa_calc (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,

  assessment_mode TEXT NOT NULL DEFAULT 'simplified', -- 'general' vagy 'simplified' (sávos)
  revenue BIGINT DEFAULT 0,
  tax_base BIGINT DEFAULT 0,
  municipality_rate NUMERIC(5,4) DEFAULT 0.02, -- Önkormányzati kulcs (0-2%)
  tax_amount BIGINT DEFAULT 0,
  advance_paid BIGINT DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(company_id, tax_year)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. BEVALLÁSOK
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_tax_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  tax_year INT NOT NULL,
  return_type accounty_ev_return_type NOT NULL,
  form_code TEXT, -- pl. '2653', '2658', '25SZJA'
  period_key TEXT, -- pl. 'Q1', 'Q2', 'annual'
  status accounty_ev_return_status NOT NULL DEFAULT 'draft',

  -- Bevallás adatok
  data JSONB DEFAULT '{}', -- Bevallás mezők
  calculated_tax BIGINT DEFAULT 0,
  paid_amount BIGINT DEFAULT 0,

  -- Határidők
  deadline DATE,
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,

  -- NAV integráció (per-company, egyelőre mock)
  nav_submission_id TEXT,
  nav_status TEXT,

  -- XML export
  xml_data TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_accounty_ev_returns_company ON accounty_ev_tax_returns(company_id, tax_year);
CREATE INDEX idx_accounty_ev_returns_deadline ON accounty_ev_tax_returns(deadline) WHERE status IN ('draft', 'ready');

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AUDIT NAPLÓ (EV-specifikus)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS accounty_ev_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'penztarkonyv', 'ev_settings', 'period_close', stb.
  entity_id UUID,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'storno', 'close_period'
  old_data JSONB,
  new_data JSONB,
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT
);

CREATE INDEX idx_accounty_ev_audit_company ON accounty_ev_audit_log(company_id, performed_at DESC);
CREATE INDEX idx_accounty_ev_audit_entity ON accounty_ev_audit_log(entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. TRIGGER: Lezárt időszak védelme
-- ─────────────────────────────────────────────────────────────────────────────

-- Megakadályozza a lezárt időszakba tartozó pénztárkönyvi tétel módosítását
CREATE OR REPLACE FUNCTION fn_accounty_check_period_closed()
RETURNS TRIGGER AS $$
BEGIN
  -- Storno tétel esetén engedélyezzük (lezárt időszak módosítása storno + új tétellel)
  IF NEW.is_storno = TRUE THEN
    RETURN NEW;
  END IF;

  -- Ellenőrizzük, hogy a tétel időszaka le van-e zárva
  IF EXISTS (
    SELECT 1 FROM accounty_penztarkonyv_period_close pc
    WHERE pc.company_id = NEW.company_id
      AND pc.tax_year = NEW.tax_year
      AND (
        (pc.period_type = 'monthly' AND pc.period_key = TO_CHAR(NEW.entry_date, 'YYYY-MM'))
        OR (pc.period_type = 'quarterly' AND pc.period_key = TO_CHAR(NEW.entry_date, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM NEW.entry_date))
        OR (pc.period_type = 'annual' AND pc.period_key = TO_CHAR(NEW.entry_date, 'YYYY'))
      )
  ) THEN
    RAISE EXCEPTION 'Lezárt időszakba nem szúrható be tétel. Használjon storno + új tételt.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounty_penztarkonyv_period_check
  BEFORE INSERT ON accounty_penztarkonyv_tetel
  FOR EACH ROW
  EXECUTE FUNCTION fn_accounty_check_period_closed();

-- Megakadályozza lezárt időszak tételeinek UPDATE-jét
CREATE OR REPLACE FUNCTION fn_accounty_prevent_closed_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.period_closed = TRUE AND NEW.period_closed = TRUE THEN
    RAISE EXCEPTION 'Lezárt időszak tétele nem módosítható.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_accounty_penztarkonyv_no_update_closed
  BEFORE UPDATE ON accounty_penztarkonyv_tetel
  FOR EACH ROW
  EXECUTE FUNCTION fn_accounty_prevent_closed_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. RLS POLICIES
-- ─────────────────────────────────────────────────────────────────────────────
-- A has_accounty_company_access(company_id) SECURITY DEFINER funkciót
-- használjuk (20260618204000_fix_accounty_module_rls.sql).
--
-- Ez biztosítja:
--   ✅ közvetlen hozzárendelés (könyvelő, senior_könyvelő, asszisztens)
--   ✅ iroda_admin teljes rálátás az iroda összes cégére
--
-- Szenzitív műveletek (időszak-zárás) → is_iroda_admin_for_firm()
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all EV tables
ALTER TABLE accounty_ev_client_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_lifecycle_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_penztarkonyv_tetel ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_penztarkonyv_period_close ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_fixed_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_securities ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_wages ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_vehicle_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_consignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_other_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_scrapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_records_strict_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_contribution_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_hipa_calc ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_tax_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounty_ev_audit_log ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════
-- Adattáblák — SELECT + MODIFY via has_accounty_company_access()
-- (közvetlen hozzárendelés VAGY iroda_admin az irodánál)
-- ══════════════════════════════════════════════════════════════════════

-- accounty_ev_client_settings
CREATE POLICY "accounty_ev_client_settings_select"
  ON accounty_ev_client_settings FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_client_settings_modify"
  ON accounty_ev_client_settings FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- accounty_ev_lifecycle_events
CREATE POLICY "accounty_ev_lifecycle_events_select"
  ON accounty_ev_lifecycle_events FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_lifecycle_events_modify"
  ON accounty_ev_lifecycle_events FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- accounty_penztarkonyv_tetel
CREATE POLICY "accounty_penztarkonyv_tetel_select"
  ON accounty_penztarkonyv_tetel FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_penztarkonyv_tetel_modify"
  ON accounty_penztarkonyv_tetel FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- ══════════════════════════════════════════════════════════════════════
-- accounty_penztarkonyv_period_close
-- SELECT: bármelyik hozzárendelt könyvelő
-- INSERT/UPDATE: csak iroda_admin (szenzitív: időszak-zárás)
-- ══════════════════════════════════════════════════════════════════════

CREATE POLICY "accounty_penztarkonyv_period_close_select"
  ON accounty_penztarkonyv_period_close FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_penztarkonyv_period_close_insert"
  ON accounty_penztarkonyv_period_close FOR INSERT TO authenticated
  WITH CHECK (
    has_accounty_company_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'iroda_admin'
    )
  );

CREATE POLICY "accounty_penztarkonyv_period_close_update"
  ON accounty_penztarkonyv_period_close FOR UPDATE TO authenticated
  USING (
    has_accounty_company_access(company_id)
    AND EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.role = 'iroda_admin'
    )
  );

-- ══════════════════════════════════════════════════════════════════════
-- Részletező nyilvántartások (12 tábla)
-- SELECT + MODIFY via has_accounty_company_access()
-- ══════════════════════════════════════════════════════════════════════

-- receivables
CREATE POLICY "accounty_ev_records_receivables_select"
  ON accounty_ev_records_receivables FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_receivables_modify"
  ON accounty_ev_records_receivables FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- payables
CREATE POLICY "accounty_ev_records_payables_select"
  ON accounty_ev_records_payables FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_payables_modify"
  ON accounty_ev_records_payables FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- fixed_assets
CREATE POLICY "accounty_ev_records_fixed_assets_select"
  ON accounty_ev_records_fixed_assets FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_fixed_assets_modify"
  ON accounty_ev_records_fixed_assets FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- investments
CREATE POLICY "accounty_ev_records_investments_select"
  ON accounty_ev_records_investments FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_investments_modify"
  ON accounty_ev_records_investments FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- securities
CREATE POLICY "accounty_ev_records_securities_select"
  ON accounty_ev_records_securities FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_securities_modify"
  ON accounty_ev_records_securities FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- wages
CREATE POLICY "accounty_ev_records_wages_select"
  ON accounty_ev_records_wages FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_wages_modify"
  ON accounty_ev_records_wages FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- vehicle_log
CREATE POLICY "accounty_ev_records_vehicle_log_select"
  ON accounty_ev_records_vehicle_log FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_vehicle_log_modify"
  ON accounty_ev_records_vehicle_log FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- consignment
CREATE POLICY "accounty_ev_records_consignment_select"
  ON accounty_ev_records_consignment FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_consignment_modify"
  ON accounty_ev_records_consignment FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- other_claims
CREATE POLICY "accounty_ev_records_other_claims_select"
  ON accounty_ev_records_other_claims FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_other_claims_modify"
  ON accounty_ev_records_other_claims FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- scrapping
CREATE POLICY "accounty_ev_records_scrapping_select"
  ON accounty_ev_records_scrapping FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_scrapping_modify"
  ON accounty_ev_records_scrapping FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- inventory
CREATE POLICY "accounty_ev_records_inventory_select"
  ON accounty_ev_records_inventory FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_inventory_modify"
  ON accounty_ev_records_inventory FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- subcontractors
CREATE POLICY "accounty_ev_records_subcontractors_select"
  ON accounty_ev_records_subcontractors FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_subcontractors_modify"
  ON accounty_ev_records_subcontractors FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- strict_forms
CREATE POLICY "accounty_ev_records_strict_forms_select"
  ON accounty_ev_records_strict_forms FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_records_strict_forms_modify"
  ON accounty_ev_records_strict_forms FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- ══════════════════════════════════════════════════════════════════════
-- Közteher-modul
-- ══════════════════════════════════════════════════════════════════════

CREATE POLICY "accounty_ev_contribution_calc_select"
  ON accounty_ev_contribution_calc FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_contribution_calc_modify"
  ON accounty_ev_contribution_calc FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_ev_hipa_calc_select"
  ON accounty_ev_hipa_calc FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));
CREATE POLICY "accounty_ev_hipa_calc_modify"
  ON accounty_ev_hipa_calc FOR ALL TO authenticated
  USING (has_accounty_company_access(company_id));

-- ══════════════════════════════════════════════════════════════════════
-- accounty_ev_tax_returns — SELECT + INSERT/UPDATE via company access
-- ══════════════════════════════════════════════════════════════════════

CREATE POLICY "accounty_ev_tax_returns_select"
  ON accounty_ev_tax_returns FOR SELECT TO authenticated
  USING (has_accounty_company_access(company_id));

CREATE POLICY "accounty_ev_tax_returns_insert"
  ON accounty_ev_tax_returns FOR INSERT TO authenticated
  WITH CHECK (has_accounty_company_access(company_id));

CREATE POLICY "accounty_ev_tax_returns_update"
  ON accounty_ev_tax_returns FOR UPDATE TO authenticated
  USING (has_accounty_company_access(company_id));

-- ══════════════════════════════════════════════════════════════════════
-- accounty_ev_audit_log — SELECT by company access or own entries,
-- INSERT only own entries
-- ══════════════════════════════════════════════════════════════════════

CREATE POLICY "accounty_ev_audit_log_select"
  ON accounty_ev_audit_log FOR SELECT TO authenticated
  USING (
    performed_by = auth.uid()
    OR has_accounty_company_access(company_id)
  );

CREATE POLICY "accounty_ev_audit_log_insert"
  ON accounty_ev_audit_log FOR INSERT TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. UPDATED_AT TRIGGER (reuses existing accounty_set_updated_at())
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_accounty_ev_client_settings_updated_at
  BEFORE UPDATE ON accounty_ev_client_settings
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_penztarkonyv_tetel_updated_at
  BEFORE UPDATE ON accounty_penztarkonyv_tetel
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_ev_contribution_calc_updated_at
  BEFORE UPDATE ON accounty_ev_contribution_calc
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_ev_hipa_calc_updated_at
  BEFORE UPDATE ON accounty_ev_hipa_calc
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_ev_tax_returns_updated_at
  BEFORE UPDATE ON accounty_ev_tax_returns
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();
