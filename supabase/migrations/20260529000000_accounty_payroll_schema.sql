-- ==================================================
-- MERGED FROM: 20260529_accounty_payroll_schema.sql
-- ==================================================
-- ============================================================================
-- ACCOUNTY PAYROLL MODULE - CORE DATABASE SCHEMA
-- ============================================================================
-- Migráció: Bérszámfejtési modul táblák
-- Dátum: 2026-05-29
-- Prefix: accounty_
--
-- ÚJRAHASZNOSÍTÁS:
-- - companies (FK) — cégadatok
-- - accounty_assignments (RLS) — könyvelő ↔ cég hozzárendelés
-- - accounty_audit_log — művelettörténet
-- - accounty_communication_preferences — csatorna-beállítások
-- - accounty_set_updated_at() — trigger function
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. accounty_employees                                            ║
-- ║  Foglalkoztatottak törzstáblája                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Személyes adatok
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_name TEXT,
  birth_place TEXT,
  birth_date DATE,
  mothers_name TEXT,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  nationality TEXT DEFAULT 'HU',

  -- Azonosítók
  taj_number TEXT,                -- 000-000-000 formátum, CDV validáció frontend oldalon
  tax_id TEXT,                    -- 10 jegyű adóazonosító jel
  id_card_number TEXT,

  -- Címek
  address JSONB,                  -- {zip, city, street, house_number}
  temp_address JSONB,             -- tartózkodási hely

  -- Elérhetőség
  email TEXT,
  phone TEXT,

  -- Bankszámla
  bank_account TEXT,              -- 3x8 jegyű GIRO formátum
  iban TEXT,                      -- IBAN konverzió

  -- Státusz
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'pending', 'suspended')),
  avatar_url TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_employees IS 'Bérszámfejtési modul foglalkoztatottak törzstáblája. Egy céghez (companies) N foglalkoztatott tartozik.';
COMMENT ON COLUMN public.accounty_employees.taj_number IS 'TAJ-szám 000-000-000 formátumban, CDV validáció a frontend oldalon';
COMMENT ON COLUMN public.accounty_employees.tax_id IS '10 jegyű adóazonosító jel, ellenőrző számjegy validációval';
COMMENT ON COLUMN public.accounty_employees.status IS 'active=Aktív, terminated=Kilépett, pending=Bejelentésre vár, suspended=Szünetelő';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. accounty_employments                                          ║
-- ║  Jogviszonyok (egy emberhez több párhuzamos jogviszony)            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_employments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Jogviszony azonosítás
  job_code TEXT NOT NULL,                 -- 1101, 1115, 1131, 1300, 1452, stb.
  job_serial_number INTEGER DEFAULT 1,    -- Jogviszonysorszám (max 4 jegy, 2026.01.01-től kötelező)
  employment_type TEXT NOT NULL,          -- munkaviszony, megbizas, tartos_megbizas, efo_alkalmi, efo_mezo, efo_tur, efo_film, tarsas_vallalkozo, ev, kata, ekho, szakkep, kozfogl, kulfoldi

  -- Időszak
  start_date DATE NOT NULL,
  end_date DATE,
  probation_end DATE,
  is_fixed_term BOOLEAN DEFAULT FALSE,

  -- Munkaidő
  weekly_hours NUMERIC DEFAULT 40,

  -- Munkakör
  feor_code TEXT,                         -- 4 jegyű KSH FEOR kód
  job_title TEXT,

  -- Beosztás
  location_id UUID,                       -- telephely (külön táblából, opcionális)
  cost_center TEXT,
  department TEXT,

  -- Bérezés
  base_salary NUMERIC,
  salary_type TEXT DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'hourly', 'daily', 'weekly', 'project', 'performance')),

  -- Távmunka
  remote_work_type TEXT CHECK (remote_work_type IN ('full', 'hybrid', 'occasional')),
  remote_work_days_per_week INTEGER,

  -- Biztosítás
  is_insured BOOLEAN DEFAULT TRUE,

  -- Státusz
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'terminated', 'suspended', 'pending')),

  -- Flexible metadata (EFO napok, KSZ pótlékok, stb.)
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_employments IS 'Jogviszonyok. Egy foglalkoztatotthoz (accounty_employees) N jogviszony tartozhat párhuzamosan (pl. munkaviszony + társas vállalkozó).';
COMMENT ON COLUMN public.accounty_employments.job_code IS 'NAV jogviszonykód: 1101 (munkaviszony), 1115 (tartós megbízás, ÚJ 2026), 1131 (szakképzési), 1300 (megbízás), 1452 (társas vállalkozó), stb.';
COMMENT ON COLUMN public.accounty_employments.job_serial_number IS 'Jogviszonysorszám: 4 jegyű mező, 2026.01.01 utáni jogviszonynál kötelező';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  3. accounty_payroll_cycles                                       ║
-- ║  Havi bérszámfejtési ciklus                                        ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_payroll_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Tervezet
    'data_collection', -- Adatbekérés
    'review',          -- Ellenőrzés
    'calculating',     -- Számfejtés folyamatban
    'calculated',      -- Számfejtve
    'approved',        -- Jóváhagyva
    'documents',       -- Dokumentumok generálása
    'submitted',       -- Bevallás beküldve
    'closed'           -- Lezárva
  )),
  current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 8),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, year, month)
);

COMMENT ON TABLE public.accounty_payroll_cycles IS 'Havi bérszámfejtési ciklus. Egy céghez havonta max. egy ciklus tartozik. 8 lépéses stepper.';
COMMENT ON COLUMN public.accounty_payroll_cycles.current_step IS '1=Adatbekérés, 2=Ellenőrzés, 3=Jelenléti ív, 4=Telefon+Cafeteria, 5=Bruttó+Pótlék, 6=Adó+Járulék, 7=Levonások, 8=Számfejtés';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  4. accounty_payroll_items                                        ║
-- ║  Bérelemek (havi, jogviszonyonként)                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_payroll_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.accounty_payroll_cycles(id) ON DELETE CASCADE,
  employment_id UUID NOT NULL REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,        -- base_salary, overtime, night_shift, holiday_premium, sunday_premium,
                                  -- holiday_pay, sick_leave, sick_pay, remote_allowance, phone_private, bonus, stb.
  description TEXT,
  amount NUMERIC NOT NULL,
  hours NUMERIC,
  days NUMERIC,
  rate_pct NUMERIC,               -- pótlék százalék (pl. 50% túlóra)
  is_deduction BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_payroll_items IS 'Bérelemek: a havi ciklus jogviszonyonkénti tételei (alapbér, pótlékok, juttatások, levonások).';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  5. accounty_payroll_calculations                                 ║
-- ║  Számfejtett eredmények                                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_payroll_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.accounty_payroll_cycles(id) ON DELETE CASCADE,
  employment_id UUID NOT NULL REFERENCES public.accounty_employments(id) ON DELETE CASCADE,

  -- Összegek
  gross_salary NUMERIC,
  szja_base NUMERIC,              -- adóalap (kedvezmények után)
  szja_amount NUMERIC,            -- SZJA (15%)
  tb_amount NUMERIC,              -- TB járulék (18.5%)
  szocho_amount NUMERIC,          -- SZOCHO (13%, munkáltatói)
  net_salary NUMERIC,

  -- Részletezés
  tax_credits JSONB DEFAULT '{}',    -- kedvezmények részletezése {netak, anyak, family, young, personal, first_marriage, ...}
  szocho_credits JSONB DEFAULT '{}', -- SZOCHO-kedvezmények {micro, disability, mothers, apprentice, ...}
  deductions JSONB DEFAULT '{}',     -- levonások {garnishment, pension_fund, advance, ...}
  cafeteria_tax JSONB DEFAULT '{}',  -- cafeteria közteher {szep_fringe, specified_benefit, ...}
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cycle_id, employment_id)
);

COMMENT ON TABLE public.accounty_payroll_calculations IS 'Számfejtett eredmények: a futtatott adómotor kimenete jogviszonyonként.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  6. accounty_declarations                                         ║
-- ║  Adóelőleg-nyilatkozatok                                           ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  declaration_type TEXT NOT NULL CHECK (declaration_type IN (
    'family',          -- Családi kedvezmény
    'netak',           -- 4+ anyák kedvezménye
    'anyak_3',         -- 3 gyermekes anyák
    'anyak_2',         -- 2 gyermekes anyák (40 év alatt, ÚJ 2026)
    'anyacska',        -- Összevont anyák+családi (ÚJ 2026)
    'young_25',        -- 25 év alattiak
    'young_mother_30', -- 30 év alatti anyák
    'first_marriage',  -- Első házasok
    'personal',        -- Személyi kedvezmény (fogyatékosság)
    'ekho'             -- EKHO nyilatkozat
  )),
  valid_from DATE NOT NULL,
  valid_until DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  parameters JSONB NOT NULL DEFAULT '{}',  -- típusfüggő: {children: [...], spouse: {...}, share_pct: 50, ...}
  document_url TEXT,                        -- feltöltött nyilatkozat PDF/kép
  nav_receipt_id TEXT,                      -- ONYA nyugtaszám
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_declarations IS 'Adóelőleg-nyilatkozatok: 9 különböző kedvezmény-típus, foglalkoztatottanként.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  7. accounty_tax_parameters                                       ║
-- ║  Központi jogszabályi paramétertábla (évente)                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_tax_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_year INTEGER NOT NULL,
  parameter_key TEXT NOT NULL,
  parameter_value NUMERIC NOT NULL,
  description TEXT,
  legal_reference TEXT,
  UNIQUE(tax_year, parameter_key)
);

COMMENT ON TABLE public.accounty_tax_parameters IS 'Központi adómérték és küszöb paraméterek: évente frissítendő, a taxEngine.ts innen olvassa a 2026-os értékeket.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  8. accounty_filings                                              ║
-- ║  NAV bevallások és bejelentések                                    ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_filings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  filing_type TEXT NOT NULL CHECK (filing_type IN (
    '08e', 't1042e', 't1041int', 't101e', 't34', 'ujegyke',
    '2608', '2658', 'm30', 'ny', 'atvut', 'autresz',
    'kiva', 'kata', 'rehab'
  )),
  period_year INTEGER,
  period_month INTEGER,
  period_quarter INTEGER,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft', 'generated', 'validated', 'signed', 'submitted', 'accepted', 'error'
  )),
  xml_data TEXT,                     -- generált XML tartalom
  channel TEXT CHECK (channel IN ('onya', 'anyk', 'm2m')),
  nav_receipt_id TEXT,
  nav_receipt_status TEXT,
  error_codes JSONB,                 -- PRN/FOG hibakódok
  submitted_at TIMESTAMPTZ,
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_filings IS 'NAV bevallások és bejelentések. filing_type a NAV űrlap típusa, channel a beküldési csatorna (ONYA/ÁNYK/M2M).';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  9. accounty_job_codes                                            ║
-- ║  Jogviszonykódok master tábla (NAV)                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_job_codes (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_insured BOOLEAN DEFAULT TRUE,
  min_contribution_base_rule TEXT,     -- szöveges képlet/szabály
  valid_from DATE,
  valid_until DATE,
  description TEXT
);

COMMENT ON TABLE public.accounty_job_codes IS 'NAV jogviszonykódok master táblája. Az 1115-ös kód 2026.01.01-től automatikusan aktív.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  10. accounty_leaves                                              ║
-- ║  Szabadság és távollét nyilvántartás                                ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_leaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id UUID NOT NULL REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES public.accounty_payroll_cycles(id) ON DELETE SET NULL,
  leave_type TEXT NOT NULL CHECK (leave_type IN (
    'annual',               -- éves rendes szabadság
    'additional_age',       -- életkori pótszabadság
    'additional_child',     -- gyermek utáni pótszabadság
    'additional_disability',-- fogyatékos pótszabadság
    'paternity',            -- apasági szabadság (10 nap)
    'parental',             -- szülői szabadság
    'sick_leave',           -- betegszabadság (15 nap/év, 70%)
    'sick_pay',             -- táppénz
    'csed',                 -- CSED
    'gyed',                 -- GYED
    'ofd',                  -- ÖFD
    'unpaid',               -- fizetés nélküli szabadság
    'study',                -- tanulmányi szabadság
    'other'
  )),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days NUMERIC NOT NULL,
  daily_rate NUMERIC,                -- távolléti díj / nap
  status TEXT DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  metadata JSONB DEFAULT '{}',       -- kiegészítő adatok (orvosi igazolás, stb.)
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_leaves IS 'Szabadság/távollét nyilvántartás foglalkoztatottanként. Támogatja a betegszabadságot, anyasági ellátásokat és pótszabadságokat.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  11. accounty_cafeteria                                           ║
-- ║  Cafeteria-elszámolás (SZÉP, lakhatás, stb.)                      ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_cafeteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employment_id UUID NOT NULL REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES public.accounty_payroll_cycles(id) ON DELETE SET NULL,
  benefit_type TEXT NOT NULL CHECK (benefit_type IN (
    'szep_recreation',     -- SZÉP-kártya rekreáció (450k/év)
    'szep_active',         -- SZÉP-kártya Aktív Magyarok (120k/év)
    'housing',             -- lakhatási támogatás 35 év alatt (150k/hó)
    'small_gift',          -- csekély értékű ajándék (3x/év, 32.280 Ft)
    'pension_fund',        -- önkéntes pénztári hozzájárulás
    'bicycle',             -- kerékpár-juttatás
    'commuting',           -- munkába járás térítés (30 Ft/km)
    'remote_allowance',    -- távmunka átalány (32.280 Ft/hó)
    'other'
  )),
  amount NUMERIC NOT NULL,
  provider TEXT,                      -- OTP / KH / MBH (SZÉP-kártyánál)
  card_number TEXT,
  tax_rate NUMERIC,                   -- 0.28 (béren kívüli) / 0.3304 (egyes meghatározott) / 0 (adómentes)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_cafeteria IS 'Cafeteria-elszámolás: SZÉP-kártya, lakhatás, csekély értékű ajándék. A közteher-kulcs a tax_rate oszlopban.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  12. accounty_garnishments                                        ║
-- ║  Bér-letiltások és végrehajtások                                   ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_garnishments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  garnishment_type TEXT NOT NULL CHECK (garnishment_type IN (
    'child_support',  -- tartásdíj (max 50%)
    'public_debt',    -- egyéb közjogi (max 33%)
    'private_debt'    -- magánjogi (max 33%)
  )),
  creditor_name TEXT,
  creditor_account TEXT,              -- jogosult bankszámlaszáma
  decree_number TEXT,                 -- határozat azonosító
  original_amount NUMERIC,
  remaining_amount NUMERIC,
  monthly_deduction NUMERIC,
  max_deduction_pct NUMERIC DEFAULT 0.33,  -- Vht. 65.§: 33% vagy 50%
  priority INTEGER DEFAULT 1,         -- Vht. sorrend (tartásdíj > közjogi > magánjogi)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_garnishments IS 'Bér-letiltások (Vht. 65.§): tartásdíj, közjogi, magánjogi. A sorrend és maximum korlátok a taxEngine-ben érvényesülnek.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  13. accounty_timesheets                                          ║
-- ║  Jelenléti ívek (OCR/AI feldolgozás)                               ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id UUID NOT NULL REFERENCES public.accounty_payroll_cycles(id) ON DELETE CASCADE,
  employment_id UUID NOT NULL REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  document_url TEXT,                    -- feltöltött jelenléti ív (PDF/kép)
  ocr_data JSONB,                       -- kinyert adatok: [{day: 1, hours: 8, overtime: 0, absence: null}, ...]
  ocr_confidence NUMERIC,              -- AI megbízhatóság (0-1)
  is_verified BOOLEAN DEFAULT FALSE,    -- könyvelő ellenőrizte
  verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_timesheets IS 'Jelenléti ívek feldolgozása OCR/AI-val. A kinyert adatok a payroll_items-be kerülnek validáció után.';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  INDEXES                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- accounty_employees
CREATE INDEX IF NOT EXISTS idx_accounty_employees_company ON public.accounty_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_employees_status ON public.accounty_employees(status);
CREATE INDEX IF NOT EXISTS idx_accounty_employees_taj ON public.accounty_employees(taj_number);
CREATE INDEX IF NOT EXISTS idx_accounty_employees_tax_id ON public.accounty_employees(tax_id);
CREATE INDEX IF NOT EXISTS idx_accounty_employees_name ON public.accounty_employees(last_name, first_name);

-- accounty_employments
CREATE INDEX IF NOT EXISTS idx_accounty_employments_employee ON public.accounty_employments(employee_id);
CREATE INDEX IF NOT EXISTS idx_accounty_employments_company ON public.accounty_employments(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_employments_job_code ON public.accounty_employments(job_code);
CREATE INDEX IF NOT EXISTS idx_accounty_employments_status ON public.accounty_employments(status);

-- accounty_payroll_cycles
CREATE INDEX IF NOT EXISTS idx_accounty_cycles_company ON public.accounty_payroll_cycles(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_cycles_period ON public.accounty_payroll_cycles(year, month);
CREATE INDEX IF NOT EXISTS idx_accounty_cycles_status ON public.accounty_payroll_cycles(status);

-- accounty_payroll_items
CREATE INDEX IF NOT EXISTS idx_accounty_items_cycle ON public.accounty_payroll_items(cycle_id);
CREATE INDEX IF NOT EXISTS idx_accounty_items_employment ON public.accounty_payroll_items(employment_id);

-- accounty_payroll_calculations
CREATE INDEX IF NOT EXISTS idx_accounty_calcs_cycle ON public.accounty_payroll_calculations(cycle_id);
CREATE INDEX IF NOT EXISTS idx_accounty_calcs_employment ON public.accounty_payroll_calculations(employment_id);

-- accounty_declarations
CREATE INDEX IF NOT EXISTS idx_accounty_decl_employee ON public.accounty_declarations(employee_id);
CREATE INDEX IF NOT EXISTS idx_accounty_decl_type ON public.accounty_declarations(declaration_type);
CREATE INDEX IF NOT EXISTS idx_accounty_decl_status ON public.accounty_declarations(status);

-- accounty_filings
CREATE INDEX IF NOT EXISTS idx_accounty_filings_company ON public.accounty_filings(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_filings_type ON public.accounty_filings(filing_type);
CREATE INDEX IF NOT EXISTS idx_accounty_filings_period ON public.accounty_filings(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_accounty_filings_status ON public.accounty_filings(status);

-- accounty_leaves
CREATE INDEX IF NOT EXISTS idx_accounty_leaves_employment ON public.accounty_leaves(employment_id);
CREATE INDEX IF NOT EXISTS idx_accounty_leaves_cycle ON public.accounty_leaves(cycle_id);
CREATE INDEX IF NOT EXISTS idx_accounty_leaves_type ON public.accounty_leaves(leave_type);

-- accounty_cafeteria
CREATE INDEX IF NOT EXISTS idx_accounty_cafeteria_employment ON public.accounty_cafeteria(employment_id);
CREATE INDEX IF NOT EXISTS idx_accounty_cafeteria_cycle ON public.accounty_cafeteria(cycle_id);

-- accounty_garnishments
CREATE INDEX IF NOT EXISTS idx_accounty_garnishments_employee ON public.accounty_garnishments(employee_id);
CREATE INDEX IF NOT EXISTS idx_accounty_garnishments_active ON public.accounty_garnishments(is_active) WHERE is_active = TRUE;

-- accounty_timesheets
CREATE INDEX IF NOT EXISTS idx_accounty_timesheets_cycle ON public.accounty_timesheets(cycle_id);
CREATE INDEX IF NOT EXISTS idx_accounty_timesheets_employment ON public.accounty_timesheets(employment_id);

-- accounty_tax_parameters
CREATE INDEX IF NOT EXISTS idx_accounty_tax_params_year ON public.accounty_tax_parameters(tax_year);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  ROW LEVEL SECURITY                                               ║
-- ║  Minta: accounty_assignments alapú (újrahasznosítás!)              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.accounty_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_employments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_payroll_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_tax_parameters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_filings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_job_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_cafeteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_garnishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_timesheets ENABLE ROW LEVEL SECURITY;

-- ── Helper: check if user is accountant for a company ──
-- Reuses accounty_assignments from existing schema!

-- Company-based tables: employees, employments, cycles, filings
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounty_employees', 'accounty_employments', 'accounty_payroll_cycles', 'accounty_filings'] LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON public.%s FOR SELECT
      USING (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa
        WHERE aa.accountant_user_id = auth.uid()
      ));
      CREATE POLICY "%s_modify" ON public.%s FOR ALL
      USING (company_id IN (
        SELECT aa.company_id FROM public.accounty_assignments aa
        WHERE aa.accountant_user_id = auth.uid()
      ));
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Employee-based tables (join through accounty_employees.company_id)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounty_declarations', 'accounty_garnishments'] LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON public.%s FOR SELECT
      USING (employee_id IN (
        SELECT e.id FROM public.accounty_employees e
        WHERE e.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
      CREATE POLICY "%s_modify" ON public.%s FOR ALL
      USING (employee_id IN (
        SELECT e.id FROM public.accounty_employees e
        WHERE e.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Cycle-based tables (join through accounty_payroll_cycles.company_id)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounty_payroll_items', 'accounty_payroll_calculations', 'accounty_timesheets'] LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON public.%s FOR SELECT
      USING (cycle_id IN (
        SELECT c.id FROM public.accounty_payroll_cycles c
        WHERE c.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
      CREATE POLICY "%s_modify" ON public.%s FOR ALL
      USING (cycle_id IN (
        SELECT c.id FROM public.accounty_payroll_cycles c
        WHERE c.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Employment-based tables (join through accounty_employments → accounty_employees)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['accounty_leaves', 'accounty_cafeteria'] LOOP
    EXECUTE format('
      CREATE POLICY "%s_select" ON public.%s FOR SELECT
      USING (employment_id IN (
        SELECT emp.id FROM public.accounty_employments emp
        WHERE emp.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
      CREATE POLICY "%s_modify" ON public.%s FOR ALL
      USING (employment_id IN (
        SELECT emp.id FROM public.accounty_employments emp
        WHERE emp.company_id IN (
          SELECT aa.company_id FROM public.accounty_assignments aa
          WHERE aa.accountant_user_id = auth.uid()
        )
      ));
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- Master tables: readable by all authenticated users
CREATE POLICY "accounty_tax_parameters_select" ON public.accounty_tax_parameters
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "accounty_tax_parameters_modify" ON public.accounty_tax_parameters
  FOR ALL TO authenticated USING (true);

CREATE POLICY "accounty_job_codes_select" ON public.accounty_job_codes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "accounty_job_codes_modify" ON public.accounty_job_codes
  FOR ALL TO authenticated USING (true);

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  UPDATED_AT TRIGGERS (reuses accounty_set_updated_at)              ║
-- ╚══════════════════════════════════════════════════════════════════════╝

CREATE TRIGGER trg_accounty_employees_updated_at
  BEFORE UPDATE ON public.accounty_employees
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_employments_updated_at
  BEFORE UPDATE ON public.accounty_employments
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_payroll_cycles_updated_at
  BEFORE UPDATE ON public.accounty_payroll_cycles
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_declarations_updated_at
  BEFORE UPDATE ON public.accounty_declarations
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_filings_updated_at
  BEFORE UPDATE ON public.accounty_filings
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_garnishments_updated_at
  BEFORE UPDATE ON public.accounty_garnishments
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

CREATE TRIGGER trg_accounty_timesheets_updated_at
  BEFORE UPDATE ON public.accounty_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.accounty_set_updated_at();

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  MEGLÉVŐ TÁBLÁK BŐVÍTÉSE                                          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- accounty_deadlines: bővítjük a deadline_type CHECK-et bérszámfejtési típusokkal
ALTER TABLE public.accounty_deadlines DROP CONSTRAINT IF EXISTS accounty_deadlines_deadline_type_check;
ALTER TABLE public.accounty_deadlines ADD CONSTRAINT accounty_deadlines_deadline_type_check
  CHECK (deadline_type IN (
    'afa', 'jarulek', 'kata', 'ber', 'tao', 'ipa', 'egyeb',
    'ber_08e', 'ber_2608', 'ber_m30', 'ber_kiva', 'ber_rehab', 'ber_kata', 'ber_2658'
  ));

-- accounty_tax_profiles: bővítjük bérszámfejtési beállításokkal
ALTER TABLE public.accounty_tax_profiles
  ADD COLUMN IF NOT EXISTS has_payroll BOOLEAN DEFAULT FALSE;
ALTER TABLE public.accounty_tax_profiles
  ADD COLUMN IF NOT EXISTS payroll_settings JSONB DEFAULT '{}';

COMMENT ON COLUMN public.accounty_tax_profiles.has_payroll IS 'Bérszámfejtési modul aktív-e ennél az ügyfélnél';
COMMENT ON COLUMN public.accounty_tax_profiles.payroll_settings IS 'Bérszámfejtési beállítások: {rounding: 1, work_days_source: "official", premium_rules: "mt", cost_center_enabled: false, ...}';

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝

-- Összesítés:
-- ✅ 13 új tábla (accounty_ prefix):
--    1.  accounty_employees                - Foglalkoztatottak
--    2.  accounty_employments              - Jogviszonyok (1:N)
--    3.  accounty_payroll_cycles           - Havi ciklus
--    4.  accounty_payroll_items            - Bérelemek
--    5.  accounty_payroll_calculations     - Számfejtett eredmények
--    6.  accounty_declarations             - Adóelőleg-nyilatkozatok
--    7.  accounty_tax_parameters           - Paramétertábla (2026)
--    8.  accounty_filings                  - NAV bevallások
--    9.  accounty_job_codes                - Jogviszonykódok master
--    10. accounty_leaves                   - Szabadság/távollét
--    11. accounty_cafeteria                - Cafeteria-elszámolás
--    12. accounty_garnishments             - Letiltások
--    13. accounty_timesheets               - Jelenléti ívek
-- ✅ RLS policy-k (accounty_assignments alapú, újrahasznosítva)
-- ✅ Indexek (30+ index a gyakori query-khez)
-- ✅ updated_at triggerek (accounty_set_updated_at újrahasznosítva)
-- ✅ Meglévő táblák bővítése (deadlines, tax_profiles)


-- ==================================================
-- MERGED FROM: 20260529_accounty_payroll_seed.sql
-- ==================================================
-- ============================================================================
-- ACCOUNTY PAYROLL MODULE - SEED DATA
-- ============================================================================
-- 2026-os jogszabályi paraméterek és jogviszonykódok
-- ============================================================================

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  1. Jogviszonykódok master tábla (NAV)                            ║
-- ╚══════════════════════════════════════════════════════════════════════╝

INSERT INTO public.accounty_job_codes (code, name, is_insured, min_contribution_base_rule, valid_from, description) VALUES
  -- Munkaviszony
  ('1101', 'Munkaviszony (Mt.)', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Teljes/részmunkaidős munkaviszony az Mt. alapján'),
  ('1102', 'Közszolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Ktv. szerinti jogviszony'),
  ('1103', 'Közalkalmazotti jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Kjt. szerinti jogviszony'),
  ('1104', 'Bírósági jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', 'Bírák jogviszonyáról szóló tv.'),
  ('1105', 'Ügyészségi szolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),
  ('1106', 'Igazságügyi alkalmazotti jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),
  ('1107', 'Hivatásos szolgálati jogviszony', TRUE, 'minimum_wage_or_guaranteed', '1997-01-01', NULL),

  -- ÚJ 2026: Tartós megbízás
  ('1115', 'Tartós megbízási jogviszony (ÚJ 2026)', TRUE, 'minimum_wage_30pct', '2026-01-01', '2026.01.01-től bevezetett jogviszony. Előzetes bejelentés kötelező, biztosítás a bejelentéstől, min. járulékalap: minimálbér 30%.'),

  -- Szakképzés
  ('1131', 'Szakképzési munkaszerződés', TRUE, 'none', '2020-01-01', 'Szkt. szerinti szakképzési jogviszony, 168.000 Ft-ig SZJA-mentes munkabér'),

  -- Megbízás
  ('1300', 'Megbízási jogviszony (biztosított)', TRUE, 'minimum_wage_30pct', '1997-01-01', 'Ptk. szerinti megbízás, biztosított ha a díj eléri a minimálbér 30%-át (96.840 Ft)'),
  ('1301', 'Megbízási jogviszony (nem biztosított)', FALSE, 'none', '1997-01-01', 'Nem éri el a 30%-os küszöböt, csak SZJA-előleg'),

  -- Társas vállalkozó
  ('1452', 'Társas vállalkozó (személyesen közreműködő tag)', TRUE, 'minimum_wage_full', '1997-01-01', 'Kkt./Bt./Kft. személyesen közreműködő tagja. Min. járulékalap: minimálbér (ill. garantált bérminimum).'),
  ('1453', 'Társas vállalkozó (választott tisztségviselő)', TRUE, 'minimum_wage_full', '1997-01-01', NULL),

  -- Egyéni vállalkozó
  ('1470', 'Egyéni vállalkozó (főállás)', TRUE, 'minimum_wage_full', '1997-01-01', 'Főállású EV. Min. járulékalap: minimálbér / garantált bérminimum.'),
  ('1471', 'Egyéni vállalkozó (melléktevékenység)', FALSE, 'none', '1997-01-01', 'Heti 36 órás munkaviszony melletti EV, csak EHO'),

  -- Saját jogú nyugdíjas
  ('1500', 'Nyugdíjas munkaviszony', FALSE, 'none', '1997-01-01', 'Csak 15% SZJA, nincs TB/SZOCHO (speciális szabály 2026: nyugdíjas anyák SZOCHO)'),

  -- Közfoglalkoztatás
  ('1600', 'Közfoglalkoztatási jogviszony', TRUE, 'kozfogl_rule', '2011-01-01', 'Közfoglalkoztatási bér: minimálbér 50%, SZOCHO-kedvezmény')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_insured = EXCLUDED.is_insured,
  min_contribution_base_rule = EXCLUDED.min_contribution_base_rule,
  valid_from = EXCLUDED.valid_from,
  description = EXCLUDED.description;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  2. 2026-os jogszabályi paramétertábla                            ║
-- ║  Forrás: 14. fejezet (Rendszerspecifikáció) + v2 Screens          ║
-- ╚══════════════════════════════════════════════════════════════════════╝

INSERT INTO public.accounty_tax_parameters (tax_year, parameter_key, parameter_value, description, legal_reference) VALUES
  -- Alapbérek
  (2026, 'minimum_wage', 322800, 'Minimálbér (Ft/hó)', '426/2025. Korm. rendelet'),
  (2026, 'guaranteed_minimum', 373200, 'Garantált bérminimum (Ft/hó)', '426/2025. Korm. rendelet'),
  (2026, 'minimum_wage_annual', 3873600, 'Minimálbér éves (Ft/év)', '426/2025. Korm. rendelet'),

  -- Adókulcsok
  (2026, 'szja_rate', 0.15, 'Személyi jövedelemadó kulcs (15%)', 'Szja tv.'),
  (2026, 'tb_rate', 0.185, 'Társadalombiztosítási járulék (18.5%)', 'Tbj.'),
  (2026, 'szocho_rate', 0.13, 'Szociális hozzájárulási adó (13%)', 'Szocho tv.'),

  -- Családi kedvezmény (2026 duplázás)
  (2026, 'family_1_child', 133340, 'Családi kedv. 1 gyermek: adóalap-csökkentés (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_1_child_saving', 20000, 'Családi kedv. 1 gyermek: megtakarítás (Ft/hó)', 'Szja tv.'),
  (2026, 'family_2_children', 266660, 'Családi kedv. 2 gyermek: adóalap-csökkentés/gyermek (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_2_children_saving', 40000, 'Családi kedv. 2 gyermek: megtakarítás/gyermek (Ft/hó)', 'Szja tv.'),
  (2026, 'family_3plus_children', 440000, 'Családi kedv. 3+ gyermek: adóalap-csökkentés/gyermek (Ft/hó)', 'Szja tv. (2026 duplázás)'),
  (2026, 'family_3plus_children_saving', 66000, 'Családi kedv. 3+ gyermek: megtakarítás/gyermek (Ft/hó)', 'Szja tv.'),
  (2026, 'family_disabled_extra', 10000, 'Tartósan beteg/fogyatékos gyermek extra (Ft/hó/gyermek)', 'Szja tv.'),

  -- 25 év alatti kedvezmény
  (2026, 'young_25_cap', 715765, '25 év alatti fiatalok havi adóalap-csökkentés plafon (Ft)', 'Szja tv. 29/F. §'),
  (2026, 'young_25_annual_cap', 8589180, '25 év alattiak éves plafon (Ft)', 'Szja tv. 29/F. §'),

  -- Személyi kedvezmény
  (2026, 'personal_disability', 107600, 'Személyi kedv. havi adóalap-csökkentés (Ft)', 'Szja tv. 29/E. §'),
  (2026, 'personal_disability_saving', 16140, 'Személyi kedv. havi megtakarítás (Ft)', 'Szja tv. 29/E. §'),

  -- Első házasok
  (2026, 'first_marriage', 33335, 'Első házasok havi adóalap-csökkentés (Ft)', 'Szja tv. 29/C. §'),
  (2026, 'first_marriage_saving', 5000, 'Első házasok havi megtakarítás (Ft)', 'Szja tv. 29/C. §'),
  (2026, 'first_marriage_months', 24, 'Első házasok kedvezmény időtartam (hónap)', 'Szja tv. 29/C. §'),

  -- Egészségügyi szolgáltatási járulék
  (2026, 'health_service_monthly', 12300, 'Egészségügyi szolgáltatási járulék (Ft/hó)', 'Tbj.'),
  (2026, 'health_service_daily', 410, 'Egészségügyi szolgáltatási járulék (Ft/nap)', 'Tbj.'),

  -- EFO
  (2026, 'efo_daily_tax', 4800, 'EFO napi munkáltatói közteher (Ft)', 'Efo tv.'),
  (2026, 'efo_min_hourly_unskilled', 1578, 'EFO min. órabér szakképzettség nélkül (Ft)', 'Efo tv.'),
  (2026, 'efo_min_hourly_skilled', 1866, 'EFO min. órabér szakképzett (Ft)', 'Efo tv.'),
  (2026, 'efo_max_daily_wage', 29700, 'EFO max. napi bér (Ft)', 'Efo tv.'),
  (2026, 'efo_exempt_daily_unskilled', 19305, 'EFO SZJA-mentes napi keret (Ft)', 'Efo tv.'),
  (2026, 'efo_exempt_daily_skilled', 22308, 'EFO SZJA-mentes napi keret szakképzett (Ft)', 'Efo tv.'),
  (2026, 'efo_max_days_same_parties', 120, 'EFO max. munkanapok azonos felek között (nap/év)', 'Efo tv.'),
  (2026, 'efo_mezo_sav1_days', 120, 'EFO mezőgazdasági 1. sáv napok (2400 Ft)', 'Efo tv.'),
  (2026, 'efo_mezo_sav1_rate', 2400, 'EFO mezőgazdasági 1. sáv közteher (Ft/nap)', 'Efo tv.'),
  (2026, 'efo_mezo_sav2_rate', 3600, 'EFO mezőgazdasági 2. sáv közteher (Ft/nap)', 'Efo tv.'),
  (2026, 'efo_mezo_max_days', 210, 'EFO mezőgazdasági max. napok (2026 bővítés)', 'Efo tv.'),
  (2026, 'efo_film_daily_tax', 9700, 'EFO filmipari statiszta napi közteher (Ft)', 'Efo tv.'),
  (2026, 'efo_film_max_daily_wage', 38700, 'EFO filmipari max. napi bér (Ft)', 'Efo tv.'),

  -- Távmunka
  (2026, 'remote_work_allowance', 32280, 'Távmunka adómentes átalány (Ft/hó, minimálbér 10%-a)', 'Szja tv. 3. sz. melléklet'),

  -- SZÉP-kártya & cafeteria
  (2026, 'szep_recreation_annual', 450000, 'SZÉP-kártya rekreációs éves keret (Ft)', 'Szja tv.'),
  (2026, 'szep_active_annual', 120000, 'SZÉP-kártya Aktív Magyarok éves keret (Ft)', 'Szja tv. 2025 kiegészítés'),
  (2026, 'szep_total_annual_max', 570000, 'SZÉP-kártya összesített éves max. (Ft)', 'Szja tv.'),
  (2026, 'szep_fringe_tax_rate', 0.28, 'Béren kívüli SZÉP-kártya közteher kulcs', 'Szja tv.'),
  (2026, 'specified_benefit_tax_rate', 0.3304, 'Egyes meghatározott juttatás közteher kulcs', 'Szja tv.'),

  -- Lakhatás
  (2026, 'housing_support_monthly', 150000, 'Lakhatási támogatás 35 év alatt max. (Ft/hó)', 'Szja tv.'),
  (2026, 'housing_support_annual', 1800000, 'Lakhatási támogatás 35 év alatt max. (Ft/év)', 'Szja tv.'),
  (2026, 'housing_support_tax_rate', 0.28, 'Lakhatási támogatás közteher kulcs', 'Szja tv.'),

  -- Csekély értékű ajándék
  (2026, 'small_gift_per_occasion', 32280, 'Csekély értékű ajándék alkalmanként max. (Ft)', 'Szja tv.'),
  (2026, 'small_gift_max_occasions', 3, 'Csekély értékű ajándék max. alkalom/év', 'Szja tv.'),

  -- Munkába járás
  (2026, 'commuting_per_km', 30, 'Munkába járás térítés (Ft/km)', '39/2010. Korm. r.'),
  (2026, 'commuting_monthly_max', 60886, 'Munkába járás havi max. (Ft)', '39/2010. Korm. r.'),

  -- Túlóra
  (2026, 'overtime_annual_limit_mt', 250, 'Túlóra éves keret Mt. (óra)', 'Mt.'),
  (2026, 'overtime_annual_limit_ksz', 400, 'Túlóra éves keret KSZ (óra)', 'KSZ'),

  -- Rehabilitáció
  (2026, 'rehab_penalty_per_person', 2905200, 'Rehabilitációs hozzájárulás büntetés (Ft/fő/év, minimálbér 9×)', 'Szocho és Rehab tv.'),
  (2026, 'rehab_threshold_employees', 25, 'Rehabilitáció kötelező felett (fő)', 'Rehab tv.'),
  (2026, 'rehab_quota_pct', 0.05, 'Rehabilitáció kvóta (5%)', 'Rehab tv.'),

  -- SZOCHO felső határ
  (2026, 'szocho_capital_cap', 7747200, 'SZOCHO felső határ tőkejövedelem (Ft/év, minimálbér 24×)', 'Szocho tv.'),

  -- Biztosítási küszöb
  (2026, 'insurance_threshold_pct', 0.30, 'Megbízás biztosítási küszöb (minimálbér 30%-a)', 'Tbj. 6. § (1) f)'),
  (2026, 'insurance_threshold_amount', 96840, 'Megbízás biztosítási küszöb (Ft/hó)', 'Tbj. 6. § (1) f)'),

  -- Nyugdíjas anya 2026
  (2026, 'netak_annual_avg_4x', 34356720, 'Nyugdíjas anya SZOCHO küszöb (éves átlagkereset 4×)', 'NAV közlemény'),

  -- Szakképzés
  (2026, 'szakkep_szja_exempt_limit', 168000, 'Szakképzési munkabér SZJA-mentes határ (Ft)', 'Szkt.'),
  (2026, 'szakkep_base_cost', 1200000, 'Szakképzési önköltség SZOCHO-kedv. alap (Ft)', 'Szkt.'),

  -- Közfoglalkoztatás
  (2026, 'kozfogl_wage', 161400, 'Közfoglalkoztatási bér (minimálbér 50%)', 'Közfogl. tv.'),

  -- EKHO
  (2026, 'ekho_upper_limit', 60000000, 'EKHO felső határ (Ft/év)', 'Ekho tv.'),
  (2026, 'ekho_rate_employee', 0.15, 'EKHO magánszemély kulcs', 'Ekho tv.'),
  (2026, 'ekho_rate_employer', 0.13, 'EKHO kifizető kulcs', 'Ekho tv.'),

  -- Betegszabadság
  (2026, 'sick_leave_days', 15, 'Betegszabadság napok (év)', 'Mt.'),
  (2026, 'sick_leave_pct', 0.70, 'Betegszabadság díj % (távolléti díj)', 'Mt.'),

  -- Kamarai hozzájárulás
  (2026, 'chamber_contribution', 5000, 'Iparkamarai kötelező hozzájárulás (Ft/év)', 'Kamarai tv.'),

  -- Vállalkozói minimumalap (2026: 112.5% megszűnt)
  (2026, 'ev_minimum_multiplier', 1.00, 'EV/társas vállalkozó minimumalap szorzó (112.5% megszűnt)', 'Szocho tv. 2026 módosítás'),

  -- Átalányadó
  (2026, 'atalanyadó_exempt_limit', 1936800, 'Átalányadó adómentes határ (éves minimálbér fele)', 'Szja tv.'),

  -- KATA
  (2026, 'kata_monthly_tax', 50000, 'KATA havi tételes adó (Ft)', 'KATA tv.'),
  (2026, 'kata_annual_revenue_cap', 18000000, 'KATA éves bevételi plafon (Ft)', 'KATA tv.'),
  (2026, 'kata_excess_tax_rate', 0.40, 'KATA túllépési különadó kulcs', 'KATA tv.'),

  -- KIVA
  (2026, 'kiva_rate', 0.10, 'KIVA adókulcs (10%)', 'KIVA tv.')

ON CONFLICT (tax_year, parameter_key) DO UPDATE SET
  parameter_value = EXCLUDED.parameter_value,
  description = EXCLUDED.description,
  legal_reference = EXCLUDED.legal_reference;

-- ╔══════════════════════════════════════════════════════════════════════╗
-- ║  DONE                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════╝
-- ✅ 17 jogviszonykód (1101, 1115 ÚJ, 1131, 1300, 1452, stb.)
-- ✅ 70+ paraméter a 2026-os jogszabályi állapot alapján
