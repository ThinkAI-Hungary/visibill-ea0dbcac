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
