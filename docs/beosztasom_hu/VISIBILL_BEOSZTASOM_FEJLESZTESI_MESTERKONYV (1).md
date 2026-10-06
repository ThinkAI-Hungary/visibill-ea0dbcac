# Visibill & Beosztasom -- Teljes Fejlesztesi es Rendszerintegracios Mesterkonyv
**Dokumentum verzio:** `v6.0-CANONICAL-PRODUCTION-SPEC`  
**Datum:** 2026-10-06  
**Statusz:** Hivatalos megvalositasi specifikacio  
**Cel:** A Beosztasom havi beosztastervezo es hiteles jelenleti iv moduljanak azonnal lefejlesztheto, a Visibill elo architekturajahoz, adatbazisahoz (`time_entries`, `projects`, `leave_requests`, `employee_rates`, `accounty_employments`), munkajogi (Mt.) szabalyaihoz es jogosultsagkezelesehez (`user_company_access_cache`) 100%-ban illeszkedo muszaki kivitelezesi terve.

---

## 1. Rendszer-architektura es Meglevo Visibill Integracio

### 1.1 A modul rendeltetese es jogszabalyi hattere
A modul celja a magyar Munka Torvenykonyve (2012. evi I. torveny -- Mt. 93-145. par. es Mt. 134. par. munkaido-nyilvantartas) eloirasainak megfelelo, tobb telephelyes es tobb munkakoros, valos ideju havi beosztastervezo es hiteles jelenleti iv rendszer megvalositasa a Visibill ERP rendszerben.  
A modul ketretegu uzleti logikara epul:
1. **eaisyBill (Vallalkozoi es Dolgozoi felulet):** Munkatarsak beosztasanak heti/havi tervezese, munkaidokeret es pihenoidok kezelese, valamint a munkavallalok onallo feluleten torteno sajat beosztas-lekerdezese.
2. **eaisyBooks (Konyveloi es Berszamfejtoi felulet):** A teljesitett jelenletek konyveloi ellenorzese, a hovegi lezaras, a torvenyes potlekok aggregacioja es az adatok automatikus atadasa a berszamfejtesi folyamatnak (`accounty_payroll_cycles`).

### 1.2 Integracios alapelvek es Zero-Adatredundancia
1. **Cegkontextus, Multi-tenancy es RBAC:**  
   A berloi izolacio alapjat a `public.companies`, `public.company_members`, `public.accounty_assignments` es a `public.user_company_access_cache` tablak kepezik.  
   A jogosultsagokat a szerveroldali `check_user_worktime_access` fuggveny ellenorzi. Irasi joggal az `owner`, `admin`, `support_admin`, valamint a konyveloi oldalrol a `senior` es `junior` konyvelok rendelkeznek. A munkavallalok (`employee`) kizarolag olvasasi joggal ferhetnek hozza a sajat jovahagyott muszakaikhoz. Az `assistant` szerepkor ki van zarva a HR- es munkaido-adatokbol.
2. **Dual-Worker Modell (eaisyBill es eaisyBooks Parhuzamos Tamogatasa):**  
   - **eaisyBooks kornyezetben:** A dolgozok a `public.accounty_employees` tablaban, jogviszonyaik a `public.accounty_employments` tablaban szerepelnek (`employment_id`).  
   - **eaisyBill kornyezetben:** A vallalkozo altal felvett dolgozok es alvallalkozok a `public.employee_rates` tablaban szerepelnek (`employee_rate_id`).  
   - A `shifts` es `attendances` tablak mindket azonosito kulcsot tamogatjak, garantalva a teljeskoru kompatibilitast.
3. **Projekt-elszamolas es Munkaerokoltseg (Labor Cost):**  
   Minden muszakhoz es jelenlethez hozzarendelheto a konkret vallalati projekt (`project_id REFERENCES public.projects(id)`). A jelenletek jovahagyasakor a rendszer automatikusan kepzi a munkalapokat a `time_entries` tablaban, lehetove teve a projekt jovedelmezoseg es a fedezeti mutatok kozvetlen szamitasat (`useProjectLaborDetails.ts`).
4. **Meglevo Munkaido Rendszer Folytonossaga (`time_entries` Hid):**  
   A beosztas zarolasakor az igazolt jelenletek bekerulnek a Visibill meglevo `public.time_entries` tablajaba (`time_entry_id` kulccsal, `status = 'approved'`). Igy a `WorkingTimePage.tsx` orarogzito naptara (`TimesheetTable.tsx`), a havi egyenlegkartya (`MonthlyBalanceCard.tsx`) es a vezeto altal jovahagyott munkalapok listaja azonnal, atalakitás nelkul megjeleniti a beosztasbol erkezo ledolgozott orakat.
5. **Telephelyek integracioja:**  
   A meglevo `public.accounty_sites` tabla hasznalando, amelyre a jogviszonyok (`accounty_employments.location_id`) hivatkoznak.
6. **Munkakorok es FEOR kodrendszer:**  
   A meglevo `public.accounty_employee_jobs` tabla es a Visibill standard FEOR szotara (`src/lib/payroll/feorCodes.ts`) hasznalando.
7. **Egyesitett Tavollet-Kezeles:**  
   A beosztasracs, a havi matrix es a szabalyellenorzo motor valos idoben konszolidalja az eaisyBooks `accounty_leaves` (28 Mt. jogcimu `absence_types` rogzitessel) es az eaisyBill `leave_requests` (dolgozoi szabadsagkerelmek) jovahagyott adatait.
8. **Berszamfejtesi Ciklus Integracio (PayrollStep3):**  
   A havi jelenlet zarolasakor a `payrollWorktimeBridge.ts` aggregalja a jelenleti adatokat az `accounty_timesheets` tablan keresztul az `ocr_data: { workDays, workedHours, overtime, sickDays, leaveDays }` formatumban a `PayrollStep3.tsx` reszere, es tovabblepteti a ciklust a 4. lepesre. A fuggveny szigoruan vedett: lezart (`status = 'closed'`) ciklust nem modosit.
9. **Hatosagi Exportmotor:**  
   A Visibill `src/lib/documents/` motorjanak (`SpreadsheetAdapter`, `PdfDocumentAdapter`, `hungarianEncoding.ts`) hasznalata a hatosagi (NAV es Kormanyhivatal Munkaügyi Felugyelet) szabvanyos jelenleti ivek eloallitasahoz.

### 1.3 Forraskod- es Konyvtarstruktura
```
visibill-ea0dbcac/
├── supabase/
│   └── migrations/
│       ├── 20261007000001_worktime_fixed_schema.sql      -- Munkarendek, sablonok, dual-worker shifts, attendances, absence_types DDL
│       ├── 20261007000002_worktime_fixed_rls.sql         -- B-Tree kompozit indexek es O(1) user_id RLS szabalyok
│       ├── 20261007000003_worktime_fixed_triggers.sql    -- Zarolt idoszak immutabilitasi triggerek
│       └── 20261007000004_worktime_fixed_rpc.sql         -- Havi matrix, autogeneralas, helyettesito es time_entries szinkron RPC-k
├── src/
│   ├── features/
│   │   └── worktime/
│   │       ├── types/
│   │       │   └── worktime.types.ts                       -- DTO, entitas es UI tipusdefiniciok
│   │       ├── hooks/
│   │       │   ├── useMonthlySchedule.ts                   -- Havi beosztas es muszakok TanStack Query hook
│   │       │   ├── useShiftMutations.ts                    -- Muszak letrehozas, modosito es torlo mutaciok
│   │       │   ├── useGridClipboard.ts                     -- Vagolap (Ctrl+C / Ctrl+V, minta huzas)
│   │       │   ├── useScheduleAutoGenerator.ts             -- Het napjara illeszkedo autogenerator hook
│   │       │   ├── useSubstituteFinder.ts                  -- Intelligens helyettesito ajanlo hook valos 11h ellenorzessel
│   │       │   ├── useAttendanceVerification.ts            -- Jelenlet jovahagyasa es hovegi zarolasa
│   │       │   └── useRuleValidation.ts                    -- Valos ideju Mt. szabalyellenorzo hook
│   │       ├── engine/
│   │       │   ├── worktimeRuleEngine.ts                   -- Mt. szabaly motor (11h piheno, 18-06 muszakpotlek, 12h max, 48h limit)
│   │       │   ├── sickLeaveTransitionEngine.ts            -- Idoaranyos Betegszabadsag -> Tappenz atfordulas motor
│   │       │   ├── workingTimeFrameEngine.ts               -- Munkaidokeret elszamolo motor
│   │       │   └── payrollWorktimeBridge.ts                -- Hovedi berfeladas es PayrollStep3 leptetes
│   │       ├── components/
│   │       │   ├── grid/
│   │       │   │   ├── WorktimeScheduleGrid.tsx            -- Naptarracs kontener reszponziv CSS Grid megoldassal
│   │       │   │   ├── GridHeaderRow.tsx                   -- Napok es unnepnapok fejlece (A-192 workdayCalculator)
│   │       │   │   ├── GridEmployeeRow.tsx                 -- Dolgozo sora (React.memo optimalizalt)
│   │       │   │   ├── ShiftCell.tsx                       -- Egyetlen nap muszakcellaja (atomi React.memo)
│   │       │   │   ├── StaffingDemandSummary.tsx           -- Letszamigeny vs. fedezet sor
│   │       │   │   └── MyScheduleView.tsx                  -- Dolgozoi (employee) vedett sajat beosztas nezet
│   │       │   ├── dialogs/
│   │       │   │   ├── ShiftEditDialog.tsx                 -- Muszak szerkeszto tol-ig, pihenoido, projekt, telephely
│   │       │   │   ├── ScheduleTemplateDialog.tsx          -- Tobbehetes forgo beosztassablon szerkeszto
│   │       │   │   ├── StaffingRequirementDialog.tsx       -- Havi letszamigeny sablon
│   │       │   │   ├── AbsenceRecordDialog.tsx             -- 28 jogcimu tavollet rogzito modal
│   │       │   │   ├── SubstituteFinderDialog.tsx          -- Helyettesito kereso es athelyezo modal
│   │       │   │   └── MonthLockDialog.tsx                 -- Havi lezarasi, jelenlet- es time_entries generalasi modal
│   │       │   └── panels/
│   │       │       ├── WorktimeToolbar.tsx                 -- Honapvalto, szurok, autogeneralo gombok
│   │       │       ├── WorkingTimeFrameCard.tsx            -- Munkaidokeret egyenleg widget
│   │       │       └── RuleViolationsDrawer.tsx            -- Mt. szabaly-figyelmeztetesek oldalsavja
│   ├── lib/
│   │   ├── cache/
│   │   │   └── keys/
│   │   │       └── worktime.keys.ts                        -- TanStack Query kulcs-gyar
│   │   └── documents/
│   │       └── templates/
│   │           └── attendanceSheetTemplate.ts              -- ExcelJS es PDF hatosagi sablon
│   ├── pages/
│   │   ├── WorkingTimePage.tsx                             -- eaisyBill beosztas es jelenlet oldal (bovites 'schedule' tabbal)
│   │   └── Accounty/
│   │       └── WorktimeApprovalPage.tsx                    -- eaisyBooks konyveloi jelenlet-jovahagyo oldal
│   └── routes/
│       ├── eaisybillRoutes.tsx                             -- eaisyBill utvonal regisztracio
│       └── accountyRoutes.tsx                              -- eaisyBooks konyveloi utvonal regisztracio
```

---

## 2. Adatbazis Sema (DDL, RLS, Triggerek, RPC)

### 2.1 Adatbazis tablak letrehozasa (`20261007000001_worktime_fixed_schema.sql`)

```sql
-- 1. Munkarendek (Altalanos munkarendek heti ciklussal)
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_type TEXT DEFAULT 'shift_work' CHECK (schedule_type IN ('standard_5_days', 'shift_work', 'continuous', 'flexible')),
  work_days INTEGER[] DEFAULT '{1,2,3,4,5}'::integer[],
  default_start_time TIME DEFAULT '08:00',
  default_end_time TIME DEFAULT '16:30',
  default_rest_minutes INTEGER DEFAULT 30 CHECK (default_rest_minutes >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Napi muszaksablonok (Fix tol-ig muszakok projekt-kapcsolattal)
CREATE TABLE IF NOT EXISTS public.shift_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 30 CHECK (break_minutes >= 0),
  crosses_midnight BOOLEAN DEFAULT FALSE,
  is_24h BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_shift_template_times CHECK (is_24h = TRUE OR start_time <> end_time)
);

-- 3. Tobbehetes forgo beosztassablonok
CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cycle_weeks INTEGER NOT NULL DEFAULT 2 CHECK (cycle_weeks BETWEEN 1 AND 12),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Forgo beosztassablon cellak (Dual-Worker tamogatassal)
CREATE TABLE IF NOT EXISTS public.schedule_template_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.schedule_templates(id) ON DELETE CASCADE,
  employment_id UUID REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  employee_rate_id UUID REFERENCES public.employee_rates(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  is_rest_day BOOLEAN DEFAULT FALSE,
  CONSTRAINT chk_template_cell_worker CHECK ((employment_id IS NOT NULL) OR (employee_rate_id IS NOT NULL)),
  CONSTRAINT uq_template_cell UNIQUE(template_id, week_number, day_of_week, COALESCE(employment_id, employee_rate_id))
);

-- 5. Beosztasi idoszakok
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'locked')),
  enable_employee_applications BOOLEAN DEFAULT FALSE,
  auto_generation_source TEXT CHECK (auto_generation_source IN ('work_schedule', 'template', 'previous_month', 'staffing')),
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_company_schedule_period UNIQUE(company_id, period_start, period_end),
  CONSTRAINT chk_schedule_period_dates CHECK (period_end >= period_start)
);

-- 6. Tervezett letszamigeny
CREATE TABLE IF NOT EXISTS public.staffing_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  site_id UUID REFERENCES public.accounty_sites(id) ON DELETE CASCADE,
  shift_template_id UUID REFERENCES public.shift_templates(id) ON DELETE SET NULL,
  target_date DATE NOT NULL,
  headcount INTEGER NOT NULL DEFAULT 1 CHECK (headcount >= 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Tervezett muszakok (Dual-Worker, Project-kotes, time_entries hid es O(1) user_id)
CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.schedules(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  employment_id UUID REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  employee_rate_id UUID REFERENCES public.employee_rates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.accounty_sites(id) ON DELETE SET NULL,
  job_code TEXT,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 30 CHECK (break_minutes >= 0),
  is_24h BOOLEAN DEFAULT FALSE,
  crosses_midnight BOOLEAN DEFAULT FALSE,
  total_hours NUMERIC GENERATED ALWAYS AS (
    GREATEST(
      0.0,
      ROUND(
        (
          (
            CASE
              WHEN is_24h = TRUE THEN 24.0
              WHEN end_time > start_time THEN EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0
              ELSE EXTRACT(EPOCH FROM (end_time - start_time + INTERVAL '24 hours')) / 3600.0
            END
          ) - (break_minutes / 60.0)
        )::numeric, 2
      )
    )
  ) STORED,
  shift_type TEXT DEFAULT 'normal' CHECK (shift_type IN ('normal', 'on_call', 'standby', 'home_office')),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_shift_worker CHECK ((employment_id IS NOT NULL) OR (employee_rate_id IS NOT NULL)),
  CONSTRAINT chk_shift_times CHECK (is_24h = TRUE OR start_time <> end_time),
  CONSTRAINT uq_shifts_company_worker_date_start UNIQUE(company_id, shift_date, start_time, COALESCE(employment_id, employee_rate_id))
);

-- 8. Tenyleges igazolt jelenletek (Dual-Worker, time_entries osszekotessel es project_id-val)
CREATE TABLE IF NOT EXISTS public.attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  employment_id UUID REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  employee_rate_id UUID REFERENCES public.employee_rates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.accounty_sites(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER DEFAULT 30 CHECK (break_minutes >= 0),
  is_24h BOOLEAN DEFAULT FALSE,
  crosses_midnight BOOLEAN DEFAULT FALSE,
  worked_hours NUMERIC NOT NULL CHECK (worked_hours >= 0),
  source TEXT DEFAULT 'schedule' CHECK (source IN ('schedule', 'manual', 'terminal')),
  status TEXT DEFAULT 'verified' CHECK (status IN ('draft', 'verified', 'locked')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_attendance_worker CHECK ((employment_id IS NOT NULL) OR (employee_rate_id IS NOT NULL)),
  CONSTRAINT uq_attendances_company_worker_date_start UNIQUE(company_id, work_date, start_time, COALESCE(employment_id, employee_rate_id))
);

-- 9. Hivatalos Tavollet Torzstabla (28 Mt. jogcim)
CREATE TABLE IF NOT EXISTS public.absence_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  accounty_leave_type TEXT NOT NULL,
  is_lost_time BOOLEAN DEFAULT TRUE,
  reduces_vacation_pool BOOLEAN DEFAULT FALSE,
  payroll_export_code TEXT NOT NULL,
  description TEXT
);

INSERT INTO public.absence_types (code, name, accounty_leave_type, is_lost_time, reduces_vacation_pool, payroll_export_code, description) VALUES
('SZ', 'Fizetett szabadsag', 'annual', false, true, '001', 'Alapeset; csokkenti a szabadsagkeretet; napi szerzodeses oraval szamol'),
('BSZ', 'Betegszabadsag', 'sick_leave', false, false, '002', 'Elso 15 munkanap (munkaltato fizeti 70%)'),
('TP', 'Tappenz', 'sick_pay', true, false, '003', '15 nap feletti keresokeptelenseg (NEAK folyositja)'),
('BTP', 'Baleseti tappenz', 'sick_pay', true, false, '004', 'Uzemi baleset miatti keresokeptelenseg'),
('CSED', 'Csecsemogondozasi dij', 'csed', true, false, '005', 'Szulest koveto idoszak'),
('GYED', 'Gyermekgondozasi dij', 'gyed', true, false, '006', 'A gyermek 2 eves koraig'),
('GYES', 'Gyermekgondozasi segely', 'parental', true, false, '007', 'Gyermek gondozasa miatti tavollet'),
('GYET', 'Gyermeknevelesi tamogatas', 'parental', true, false, '008', 'Harom vagy tobb gyermek nevelese'),
('APOL', 'Apolasi dij', 'other', true, false, '009', 'Hozzátartozo apolasa'),
('KAT', 'Katonai szolgalat', 'other', true, false, '010', 'Tenyleges onkentes katonai szolgalat'),
('TART', 'Onkentes tartalekos szolgalat', 'other', true, false, '011', 'Tartalekos katonai szolgalat'),
('LETART', 'Elozetes letartoztatas', 'unpaid', true, false, '012', 'Buntetoeljarasi kenyszerintezkedes'),
('SZABVESZT', 'Szabadsagvesztes', 'unpaid', true, false, '013', 'Buntetes-vegrehajtas'),
('FELMENT', 'Munkavegzes aloli felmentes', 'other', false, false, '014', 'Felmondasi ido alatti mentesites'),
('UGYVED', 'Ugyvedi tevekenyseg szunetelese', 'other', true, false, '015', 'Kamarai tagsag szunetelese'),
('KAMARA', 'Ugyvivo / kamarai szuneteles', 'other', true, false, '016', 'Kamarai tevekenyseg szuneltetese'),
('ALLATORV', 'Allatorvosi tevekenyseg szunetelese', 'other', true, false, '017', 'Kamarai szuneteles'),
('TANULO', 'Tanuloszerzodes szuneltetese', 'study', true, false, '018', 'Dualis szakkepzes szunetelese'),
('FN_SZAB', 'Fizetes nelkuli szabadsag', 'unpaid', true, false, '019', 'Fizetes nelkuli tavollet'),
('FN_GYERMEK', 'Fizetes nelkuli - gyermekapolas', 'unpaid', true, false, '020', 'Gyermek otthoni gondozasa miatti fizetes nelkuli szabadsag'),
('IGAZOLT', 'Igazolt egyeb tavollet', 'other', false, false, '021', 'Veradas, birosagi idezes'),
('IGAZOLATLAN', 'Igazolatlan tavollet', 'unpaid', true, false, '022', 'Nem igazolt hianyzas, berlevonas alapja'),
('SZTRAJK', 'Jogszeru sztrajk', 'unpaid', true, false, '023', 'Mt. szerinti munkabeszuntetes'),
('GYOD', 'Gyermekek otthongondozasi dija', 'parental', true, false, '024', 'Tartosan beteg gyermek apolasa'),
('OROKBEFOG', 'Orokbefogadoi dij', 'parental', true, false, '025', 'Orokbefogadas miatti ellatas'),
('PENZNELKULI', 'Ellatas nelkuli keresokeptelenseg', 'unpaid', true, false, '026', 'Keresokeptelen, de nem jar ellatas'),
('EGYEB', 'Egyeb tavollet', 'other', false, false, '027', 'Szabad szoveges indoklassal'),
('APASAGI', 'Apasagi szabadsag', 'paternity', false, false, '028', 'Gyermek szuletésekor az apanak jaro szabadsag')
ON CONFLICT (code) DO NOTHING;

-- 10. Munkavallaloi Jogviszony-alapu Munkaügyi Szabalyok (Dual-Worker tamogatassal)
CREATE TABLE IF NOT EXISTS public.employee_worktime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employment_id UUID REFERENCES public.accounty_employments(id) ON DELETE CASCADE,
  employee_rate_id UUID REFERENCES public.employee_rates(id) ON DELETE CASCADE,
  work_schedule_id UUID REFERENCES public.work_schedules(id) ON DELETE SET NULL,
  worker_category TEXT DEFAULT 'standard' CHECK (worker_category IN ('standard', 'minor', 'pregnant', 'pensioner', 'casual')),
  workday_definition TEXT DEFAULT 'calendar_day' CHECK (workday_definition IN ('calendar_day', 'rolling_24h')),
  contracted_daily_hours NUMERIC DEFAULT 8.0 CHECK (contracted_daily_hours > 0),
  min_shift_hours NUMERIC DEFAULT 4.0,
  max_shift_hours NUMERIC DEFAULT 12.0,
  max_weekly_hours NUMERIC DEFAULT 48.0,
  min_daily_rest_hours NUMERIC DEFAULT 11.0,
  check_daily_hours BOOLEAN DEFAULT TRUE,
  check_weekly_hours BOOLEAN DEFAULT TRUE,
  check_daily_rest BOOLEAN DEFAULT TRUE,
  check_monthly_sunday_rest BOOLEAN DEFAULT TRUE,
  check_weekly_48h_rest BOOLEAN DEFAULT TRUE,
  check_consecutive_6d_rest BOOLEAN DEFAULT TRUE,
  check_category_rules BOOLEAN DEFAULT TRUE,
  is_time_framed BOOLEAN DEFAULT FALSE,
  time_frame_start_date DATE,
  time_frame_months INTEGER DEFAULT 3 CHECK (time_frame_months BETWEEN 1 AND 12),
  initial_accumulated_hours NUMERIC DEFAULT 0.0,
  can_work_holiday BOOLEAN DEFAULT FALSE,
  can_work_night BOOLEAN DEFAULT TRUE,
  forbidden_weekdays INTEGER[] DEFAULT '{}'::integer[],
  partner_employment_ids UUID[] DEFAULT '{}'::uuid[],
  auto_attendance_mode TEXT DEFAULT 'from_locked_schedule' CHECK (auto_attendance_mode IN ('none', 'from_locked_schedule', 'from_work_schedule')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_rules_worker CHECK ((employment_id IS NOT NULL) OR (employee_rate_id IS NOT NULL)),
  CONSTRAINT uq_rules_worker UNIQUE(company_id, COALESCE(employment_id, employee_rate_id))
);
```

### 2.2 Indexek es RLS Szabalyok (`20261007000002_worktime_fixed_rls.sql`)

```sql
-- Lekerdezesi es O(1) User Indexek
CREATE INDEX IF NOT EXISTS idx_work_schedules_company ON public.work_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_company ON public.shift_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_shift_templates_project ON public.shift_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_company ON public.schedule_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_schedules_company_period ON public.schedules(company_id, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_shifts_company_date ON public.shifts(company_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_schedule_date ON public.shifts(schedule_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_employee ON public.shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employment ON public.shifts(employment_id);
CREATE INDEX IF NOT EXISTS idx_shifts_employee_rate ON public.shifts(employee_rate_id);
CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON public.shifts(user_id);
CREATE INDEX IF NOT EXISTS idx_shifts_project_id ON public.shifts(project_id);
CREATE INDEX IF NOT EXISTS idx_shifts_time_entry ON public.shifts(time_entry_id);

CREATE INDEX IF NOT EXISTS idx_attendances_company_date ON public.attendances(company_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendances_employee ON public.attendances(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendances_employment ON public.attendances(employment_id);
CREATE INDEX IF NOT EXISTS idx_attendances_employee_rate ON public.attendances(employee_rate_id);
CREATE INDEX IF NOT EXISTS idx_attendances_user_id ON public.attendances(user_id);
CREATE INDEX IF NOT EXISTS idx_attendances_project_id ON public.attendances(project_id);
CREATE INDEX IF NOT EXISTS idx_attendances_time_entry ON public.attendances(time_entry_id);

CREATE INDEX IF NOT EXISTS idx_worktime_rules_company ON public.employee_worktime_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_worktime_rules_employment ON public.employee_worktime_rules(employment_id);
CREATE INDEX IF NOT EXISTS idx_worktime_rules_rate ON public.employee_worktime_rules(employee_rate_id);

-- RLS Bekapcsolasa
ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_template_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staffing_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absence_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_worktime_rules ENABLE ROW LEVEL SECURITY;

-- 1. Helper fuggveny: Jogosultsag-ellenorzes a Visibill valos szerepkor-keszletevel
CREATE OR REPLACE FUNCTION public.check_user_worktime_access(p_company_id UUID, p_require_write BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_company_access_cache uac
    WHERE uac.company_id = p_company_id
      AND uac.user_id = (SELECT auth.uid())
      AND (
        -- Irasi jog: cégtulajdonos, cégadminisztrator, support_admin, vagy a hozarendelt konyvelo (senior vagy junior)
        (p_require_write = TRUE AND (
          (uac.access_source = 'eaisybill' AND uac.role IN ('owner', 'admin', 'support_admin'))
          OR
          (uac.access_source = 'accounty' AND uac.role IN ('senior', 'junior'))
        ))
        OR
        -- Olvasasi jog: vezetok, konyvelok, HR-joggal rendelkezo tagok, dolgozok (kiveve assistant)
        (p_require_write = FALSE AND (
          uac.can_read_hr = TRUE
          OR uac.access_source = 'accounty'
          OR (uac.access_source = 'eaisybill' AND uac.role IN ('owner', 'admin', 'member', 'employee', 'support_admin'))
        ))
      )
      -- Modul szintu felulbiralat figyelembevetele eaisybill_module_permissions tablabol
      AND NOT EXISTS (
        SELECT 1 FROM public.eaisybill_module_permissions emp
        WHERE emp.company_id = p_company_id
          AND emp.user_id = (SELECT auth.uid())
          AND emp.module_name = 'working_time'
          AND (
            (p_require_write = TRUE AND emp.can_write = FALSE)
            OR
            (p_require_write = FALSE AND emp.can_read = FALSE)
          )
      )
  );
$$;

-- 2. Absence types olvasasa
CREATE POLICY "absence_types_read_all" ON public.absence_types FOR SELECT TO authenticated USING (true);

-- 3. Beosztasi idoszakok (schedules)
CREATE POLICY "schedules_select" ON public.schedules
FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, FALSE));

CREATE POLICY "schedules_insert" ON public.schedules
FOR INSERT TO authenticated
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "schedules_update" ON public.schedules
FOR UPDATE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "schedules_delete" ON public.schedules
FOR DELETE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE));

-- 4. Muszakok (shifts) -- Szigoru szerepkor-elkulonites kozvetlen O(1) user_id-val
CREATE POLICY "shifts_manager_select" ON public.shifts
FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "shifts_employee_select" ON public.shifts
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.schedules s
    WHERE s.id = shifts.schedule_id AND s.status IN ('published', 'locked')
  )
);

CREATE POLICY "shifts_insert" ON public.shifts
FOR INSERT TO authenticated
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "shifts_update" ON public.shifts
FOR UPDATE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "shifts_delete" ON public.shifts
FOR DELETE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE));

-- 5. Jelenletek (attendances) -- O(1) user_id alapu ellenorzessel
CREATE POLICY "attendances_manager_select" ON public.attendances
FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "attendances_employee_select" ON public.attendances
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()));

CREATE POLICY "attendances_insert" ON public.attendances
FOR INSERT TO authenticated
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "attendances_update" ON public.attendances
FOR UPDATE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "attendances_delete" ON public.attendances
FOR DELETE TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE));

-- 6. Munkarendek es sablonok RLS
CREATE POLICY "work_schedules_select" ON public.work_schedules FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, FALSE));
CREATE POLICY "work_schedules_modify" ON public.work_schedules FOR ALL TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "shift_templates_select" ON public.shift_templates FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, FALSE));
CREATE POLICY "shift_templates_modify" ON public.shift_templates FOR ALL TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "schedule_templates_select" ON public.schedule_templates FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, FALSE));
CREATE POLICY "schedule_templates_modify" ON public.schedule_templates FOR ALL TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));

CREATE POLICY "schedule_template_cells_select" ON public.schedule_template_cells FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.schedule_templates st WHERE st.id = schedule_template_cells.template_id AND public.check_user_worktime_access(st.company_id, FALSE)));
CREATE POLICY "schedule_template_cells_modify" ON public.schedule_template_cells FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.schedule_templates st WHERE st.id = schedule_template_cells.template_id AND public.check_user_worktime_access(st.company_id, TRUE)))
WITH CHECK (EXISTS (SELECT 1 FROM public.schedule_templates st WHERE st.id = schedule_template_cells.template_id AND public.check_user_worktime_access(st.company_id, TRUE)));

CREATE POLICY "staffing_requirements_select" ON public.staffing_requirements FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = staffing_requirements.schedule_id AND public.check_user_worktime_access(s.company_id, FALSE)));
CREATE POLICY "staffing_requirements_modify" ON public.staffing_requirements FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = staffing_requirements.schedule_id AND public.check_user_worktime_access(s.company_id, TRUE)))
WITH CHECK (EXISTS (SELECT 1 FROM public.schedules s WHERE s.id = staffing_requirements.schedule_id AND public.check_user_worktime_access(s.company_id, TRUE)));

CREATE POLICY "employee_worktime_rules_select" ON public.employee_worktime_rules FOR SELECT TO authenticated
USING (public.check_user_worktime_access(company_id, FALSE));
CREATE POLICY "employee_worktime_rules_modify" ON public.employee_worktime_rules FOR ALL TO authenticated
USING (public.check_user_worktime_access(company_id, TRUE))
WITH CHECK (public.check_user_worktime_access(company_id, TRUE));
```

### 2.3 Immutabilitasi Triggerek (`20261007000003_worktime_fixed_triggers.sql`)

```sql
CREATE OR REPLACE FUNCTION public.check_schedule_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_schedule_id UUID;
  v_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_schedule_id := OLD.schedule_id;
  ELSE
    v_schedule_id := NEW.schedule_id;
  END IF;

  SELECT status INTO v_status FROM public.schedules WHERE id = v_schedule_id;

  IF v_status = 'locked' THEN
    RAISE EXCEPTION 'A lezart beosztasi idoszak muszakai nem modosithatok, nem torolhetok es uj muszak sem szurhato be!';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_shifts_immutability ON public.shifts;
CREATE TRIGGER trg_enforce_shifts_immutability
BEFORE INSERT OR UPDATE OR DELETE ON public.shifts
FOR EACH ROW EXECUTE FUNCTION public.check_schedule_immutability();


CREATE OR REPLACE FUNCTION public.check_attendance_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_is_authorized BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'locked' THEN
      RAISE EXCEPTION 'A lezart jelenleti rekord nem torolheto!';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'locked' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.user_company_access_cache uac
        WHERE uac.company_id = OLD.company_id
          AND uac.user_id = auth.uid()
          AND (
            (uac.access_source = 'eaisybill' AND uac.role IN ('owner', 'admin', 'support_admin'))
            OR
            (uac.access_source = 'accounty' AND uac.role = 'senior')
          )
      ) INTO v_is_authorized;

      IF NOT v_is_authorized THEN
        RAISE EXCEPTION 'Lezart jelenleti rekordot kizarolag adminisztrator vagy senior konyvelo oldhat fel!';
      END IF;

      IF NEW.status <> 'locked' AND (NEW.worked_hours <> OLD.worked_hours OR NEW.start_time <> OLD.start_time OR NEW.end_time <> OLD.end_time) THEN
        RAISE EXCEPTION 'A feloldas es az adatmodositas nem hajthato vegre egyetlen muveletben!';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_attendance_immutability ON public.attendances;
CREATE TRIGGER trg_enforce_attendance_immutability
BEFORE UPDATE OR DELETE ON public.attendances
FOR EACH ROW EXECUTE FUNCTION public.check_attendance_immutability();
```

### 2.4 Szerveroldali RPC Fuggvenyek (`20261007000004_worktime_fixed_rpc.sql`)

```sql
-- 1. Havi Matrix O(1) szerveroldali aggregacioja
CREATE OR REPLACE FUNCTION public.get_monthly_schedule_matrix(
  p_company_id UUID,
  p_schedule_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_result JSONB;
  v_sched RECORD;
BEGIN
  IF NOT public.check_user_worktime_access(p_company_id, FALSE) THEN
    RAISE EXCEPTION 'Hozzaferes megtagadva ehhez a ceghez!';
  END IF;

  SELECT * INTO v_sched FROM public.schedules WHERE id = p_schedule_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beosztasi idoszak nem talalhato!';
  END IF;

  SELECT jsonb_build_object(
    'schedule', to_jsonb(v_sched),
    'employees', COALESCE((
      WITH unified_workers AS (
        SELECT 
          ae.id AS employee_id,
          aem.id AS employment_id,
          NULL::uuid AS employee_rate_id,
          ae.user_id AS user_id,
          trim(ae.last_name || ' ' || ae.first_name) AS name,
          aem.feor_code AS feor_code,
          aem.job_title AS job_title,
          aem.location_id AS site_id
        FROM public.accounty_employees ae
        JOIN public.accounty_employments aem ON aem.employee_id = ae.id AND aem.status = 'active'
        WHERE ae.company_id = p_company_id AND ae.status = 'active'
        
        UNION ALL
        
        SELECT
          NULL::uuid AS employee_id,
          NULL::uuid AS employment_id,
          er.id AS employee_rate_id,
          er.user_id AS user_id,
          er.employee_name AS name,
          NULL::text AS feor_code,
          er.role_title AS job_title,
          NULL::uuid AS site_id
        FROM public.employee_rates er
        WHERE er.company_id = p_company_id
          AND NOT EXISTS (
            SELECT 1 FROM public.accounty_employees ae2
            WHERE ae2.company_id = p_company_id 
              AND trim(ae2.last_name || ' ' || ae2.first_name) = er.employee_name
          )
      )
      SELECT jsonb_agg(jsonb_build_object(
        'id', COALESCE(employment_id, employee_rate_id),
        'employee_id', employee_id,
        'employment_id', employment_id,
        'employee_rate_id', employee_rate_id,
        'user_id', user_id,
        'name', name,
        'feor_code', feor_code,
        'job_title', job_title,
        'site_id', site_id
      ) ORDER BY name)
      FROM unified_workers
    ), '[]'::jsonb),
    'shifts', COALESCE((
      SELECT jsonb_agg(to_jsonb(sh))
      FROM public.shifts sh
      WHERE sh.schedule_id = p_schedule_id
    ), '[]'::jsonb),
    'leaves', COALESCE((
      WITH unified_leaves AS (
        SELECT 
          al.id,
          al.employment_id,
          NULL::uuid AS employee_rate_id,
          NULL::uuid AS user_id,
          al.leave_type,
          COALESCE(al.metadata->>'absence_code', 'SZ') AS absence_code,
          COALESCE(at.name, al.leave_type) AS absence_name,
          at.payroll_export_code,
          COALESCE(at.is_lost_time, true) AS is_lost_time,
          al.start_date,
          al.end_date,
          al.days
        FROM public.accounty_leaves al
        JOIN public.accounty_employments aem ON aem.id = al.employment_id
        LEFT JOIN public.absence_types at ON at.code = COALESCE(al.metadata->>'absence_code', '')
        WHERE aem.company_id = p_company_id
          AND al.status = 'approved'
          AND al.start_date <= v_sched.period_end
          AND al.end_date >= v_sched.period_start

        UNION ALL

        SELECT
          lr.id,
          NULL::uuid AS employment_id,
          er.id AS employee_rate_id,
          lr.user_id,
          lr.leave_type,
          CASE 
            WHEN lr.leave_type = 'vacation' THEN 'SZ'
            WHEN lr.leave_type = 'sick' THEN 'BSZ'
            ELSE 'EGYEB'
          END AS absence_code,
          CASE 
            WHEN lr.leave_type = 'vacation' THEN 'Fizetett szabadsag'
            WHEN lr.leave_type = 'sick' THEN 'Betegszabadsag'
            ELSE 'Egyeb tavollet'
          END AS absence_name,
          '001' AS payroll_export_code,
          true AS is_lost_time,
          lr.start_date,
          lr.end_date,
          (lr.end_date - lr.start_date + 1)::numeric AS days
        FROM public.leave_requests lr
        LEFT JOIN public.employee_rates er ON er.user_id = lr.user_id AND er.company_id = lr.company_id
        WHERE lr.company_id = p_company_id
          AND lr.status = 'approved'
          AND lr.start_date <= v_sched.period_end
          AND lr.end_date >= v_sched.period_start
      )
      SELECT jsonb_agg(to_jsonb(ul)) FROM unified_leaves ul
    ), '[]'::jsonb),
    'staffing', COALESCE((
      SELECT jsonb_agg(to_jsonb(st))
      FROM public.staffing_requirements st
      WHERE st.schedule_id = p_schedule_id
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total_shifts', (SELECT COUNT(*) FROM public.shifts WHERE schedule_id = p_schedule_id),
      'total_hours', (SELECT COALESCE(SUM(total_hours), 0) FROM public.shifts WHERE schedule_id = p_schedule_id)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Automatikus Beosztasgeneralo
CREATE OR REPLACE FUNCTION public.auto_generate_monthly_schedule(
  p_company_id UUID,
  p_schedule_id UUID,
  p_source TEXT,
  p_template_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_sched RECORD;
  v_inserted_count INTEGER := 0;
  v_prev_sched RECORD;
  v_cycle_weeks INTEGER;
BEGIN
  IF NOT public.check_user_worktime_access(p_company_id, TRUE) THEN
    RAISE EXCEPTION 'Nincs jogosultsaga beosztas generalasara ennel a cegnel!';
  END IF;

  SELECT * INTO v_sched FROM public.schedules WHERE id = p_schedule_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Beosztasi idoszak nem talalhato!';
  END IF;
  IF v_sched.status = 'locked' THEN
    RAISE EXCEPTION 'Lezart beosztas nem irhato felul!';
  END IF;

  DELETE FROM public.shifts WHERE schedule_id = p_schedule_id;

  -- 1. ELOZO HONAP MASOLASA
  IF p_source = 'previous_month' THEN
    SELECT * INTO v_prev_sched FROM public.schedules
    WHERE company_id = p_company_id
      AND period_end = (v_sched.period_start - INTERVAL '1 day')::date;

    IF v_prev_sched.id IS NOT NULL THEN
      INSERT INTO public.shifts (
        schedule_id, company_id, employee_id, employment_id, employee_rate_id, user_id, project_id, site_id, job_code,
        shift_date, start_time, end_time, break_minutes, is_24h, crosses_midnight, shift_type
      )
      SELECT
        p_schedule_id, p_company_id, sh.employee_id, sh.employment_id, sh.employee_rate_id, sh.user_id, sh.project_id, sh.site_id, sh.job_code,
        target_dates.day_date::date, sh.start_time, sh.end_time, sh.break_minutes, sh.is_24h, sh.crosses_midnight, sh.shift_type
      FROM (
        SELECT day_date, EXTRACT(ISODOW FROM day_date)::integer AS dow,
               ((day_date::date - v_sched.period_start) / 7) AS week_idx
        FROM generate_series(v_sched.period_start, v_sched.period_end, INTERVAL '1 day') AS day_date
      ) target_dates
      JOIN (
        SELECT sh_sub.*, EXTRACT(ISODOW FROM sh_sub.shift_date)::integer AS dow,
               ((sh_sub.shift_date - v_prev_sched.period_start) / 7) AS week_idx
        FROM public.shifts sh_sub
        WHERE sh_sub.schedule_id = v_prev_sched.id
      ) sh ON sh.dow = target_dates.dow AND sh.week_idx = target_dates.week_idx
      WHERE NOT EXISTS (
        SELECT 1 FROM public.accounty_leaves al
        WHERE al.employment_id = sh.employment_id
          AND al.status = 'approved'
          AND target_dates.day_date::date BETWEEN al.start_date AND al.end_date
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.company_id = p_company_id
          AND lr.user_id = sh.user_id
          AND lr.status = 'approved'
          AND target_dates.day_date::date BETWEEN lr.start_date AND lr.end_date
      );

      GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    END IF;

  -- 2. FORGOSABLON RAHUZASA
  ELSIF p_source = 'template' AND p_template_id IS NOT NULL THEN
    SELECT cycle_weeks INTO v_cycle_weeks FROM public.schedule_templates WHERE id = p_template_id AND company_id = p_company_id;
    IF v_cycle_weeks IS NOT NULL AND v_cycle_weeks > 0 THEN
      INSERT INTO public.shifts (
        schedule_id, company_id, employee_id, employment_id, employee_rate_id, user_id, project_id,
        shift_date, start_time, end_time, break_minutes, is_24h, crosses_midnight, shift_type
      )
      SELECT
        p_schedule_id, p_company_id, aem.employee_id, stc.employment_id, stc.employee_rate_id,
        COALESCE(ae.user_id, er.user_id), st.project_id,
        target_dates.day_date::date, st.start_time, st.end_time, st.break_minutes, st.is_24h, st.crosses_midnight, 'normal'
      FROM (
        SELECT day_date, EXTRACT(ISODOW FROM day_date)::integer AS dow,
               (((day_date::date - v_sched.period_start) / 7) % v_cycle_weeks) + 1 AS template_week
        FROM generate_series(v_sched.period_start, v_sched.period_end, INTERVAL '1 day') AS day_date
      ) target_dates
      JOIN public.schedule_template_cells stc 
        ON stc.template_id = p_template_id 
       AND stc.week_number = target_dates.template_week 
       AND stc.day_of_week = target_dates.dow
       AND stc.is_rest_day = FALSE
      JOIN public.shift_templates st ON st.id = stc.shift_template_id
      LEFT JOIN public.accounty_employments aem ON aem.id = stc.employment_id
      LEFT JOIN public.accounty_employees ae ON ae.id = aem.employee_id
      LEFT JOIN public.employee_rates er ON er.id = stc.employee_rate_id
      WHERE (stc.employment_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.accounty_leaves al
        WHERE al.employment_id = stc.employment_id AND al.status = 'approved' AND target_dates.day_date::date BETWEEN al.start_date AND al.end_date
      ))
      AND (COALESCE(ae.user_id, er.user_id) IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.company_id = p_company_id AND lr.user_id = COALESCE(ae.user_id, er.user_id) AND lr.status = 'approved' AND target_dates.day_date::date BETWEEN lr.start_date AND lr.end_date
      ));

      GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'inserted_shifts', v_inserted_count);
END;
$$;

-- 3. Intelligens Helyettesito Ajanlo
CREATE OR REPLACE FUNCTION public.find_intelligent_substitutes(
  p_company_id UUID,
  p_shift_id UUID
)
RETURNS TABLE (
  substitute_worker_id UUID,
  employee_name TEXT,
  is_same_position BOOLEAN,
  is_on_leave BOOLEAN,
  has_rest_conflict BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_shift RECORD;
  v_shift_start_ts TIMESTAMPTZ;
  v_shift_end_ts TIMESTAMPTZ;
BEGIN
  IF NOT public.check_user_worktime_access(p_company_id, FALSE) THEN
    RAISE EXCEPTION 'Hozzaferes megtagadva!';
  END IF;

  SELECT * INTO v_shift FROM public.shifts WHERE id = p_shift_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Muszak nem talalhato!';
  END IF;

  v_shift_start_ts := (v_shift.shift_date + v_shift.start_time)::timestamptz;
  v_shift_end_ts := CASE
    WHEN v_shift.is_24h = TRUE THEN (v_shift.shift_date + INTERVAL '24 hours')::timestamptz
    WHEN v_shift.end_time > v_shift.start_time THEN (v_shift.shift_date + v_shift.end_time)::timestamptz
    ELSE ((v_shift.shift_date + INTERVAL '1 day')::date + v_shift.end_time)::timestamptz
  END;

  RETURN QUERY
  WITH candidates AS (
    SELECT 
      aem.id AS worker_id,
      ae.user_id AS c_user_id,
      trim(ae.last_name || ' ' || ae.first_name) AS c_name,
      (v_shift.job_code IS NULL OR aem.job_code = v_shift.job_code OR aem.feor_code = v_shift.job_code) AS c_pos
    FROM public.accounty_employees ae
    JOIN public.accounty_employments aem ON aem.employee_id = ae.id AND aem.status = 'active'
    WHERE ae.company_id = p_company_id AND ae.status = 'active' AND aem.id <> COALESCE(v_shift.employment_id, '00000000-0000-0000-0000-000000000000'::uuid)

    UNION ALL

    SELECT
      er.id AS worker_id,
      er.user_id AS c_user_id,
      er.employee_name AS c_name,
      true AS c_pos
    FROM public.employee_rates er
    WHERE er.company_id = p_company_id AND er.id <> COALESCE(v_shift.employee_rate_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT EXISTS (
        SELECT 1 FROM public.accounty_employees ae2
        WHERE ae2.company_id = p_company_id AND trim(ae2.last_name || ' ' || ae2.first_name) = er.employee_name
      )
  )
  SELECT
    c.worker_id AS substitute_worker_id,
    c.c_name AS employee_name,
    c.c_pos AS is_same_position,
    (
      EXISTS (
        SELECT 1 FROM public.accounty_leaves al
        WHERE al.employment_id = c.worker_id AND al.status = 'approved' AND v_shift.shift_date BETWEEN al.start_date AND al.end_date
      )
      OR
      (c.c_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.leave_requests lr
        WHERE lr.company_id = p_company_id AND lr.user_id = c.c_user_id AND lr.status = 'approved' AND v_shift.shift_date BETWEEN lr.start_date AND lr.end_date
      ))
    ) AS is_on_leave,
    EXISTS (
      SELECT 1 FROM public.shifts s2
      WHERE (s2.employment_id = c.worker_id OR s2.employee_rate_id = c.worker_id)
        AND (
          s2.shift_date = v_shift.shift_date
          OR
          (
            s2.shift_date BETWEEN v_shift.shift_date - INTERVAL '1 day' AND v_shift.shift_date
            AND (
              v_shift_start_ts - (
                CASE
                  WHEN s2.is_24h = TRUE THEN (s2.shift_date + INTERVAL '24 hours')::timestamptz
                  WHEN s2.end_time > s2.start_time THEN (s2.shift_date + s2.end_time)::timestamptz
                  ELSE ((s2.shift_date + INTERVAL '1 day')::date + s2.end_time)::timestamptz
                END
              )
            ) < INTERVAL '11 hours'
          )
        )
    ) AS has_rest_conflict
  FROM candidates c
  ORDER BY
    is_on_leave ASC,
    has_rest_conflict ASC,
    is_same_position DESC;
END;
$$;

-- 4. Beosztas Zarolasa es Automatizalt Szinkronizacio a time_entries Tablaba
CREATE OR REPLACE FUNCTION public.sync_shifts_to_time_entries(
  p_schedule_id UUID,
  p_company_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_catalog'
AS $$
DECLARE
  v_sched RECORD;
  v_synced_count INTEGER := 0;
  v_shift RECORD;
  v_time_entry_id UUID;
BEGIN
  IF NOT public.check_user_worktime_access(p_company_id, TRUE) THEN
    RAISE EXCEPTION 'Hozzaferes megtagadva!';
  END IF;

  SELECT * INTO v_sched FROM public.schedules WHERE id = p_schedule_id AND company_id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A beosztasi idoszak nem talalhato!';
  END IF;

  FOR v_shift IN
    SELECT * FROM public.shifts
    WHERE schedule_id = p_schedule_id AND company_id = p_company_id
  LOOP
    IF v_shift.user_id IS NOT NULL THEN
      IF v_shift.time_entry_id IS NOT NULL THEN
        UPDATE public.time_entries
        SET 
          hours = v_shift.total_hours,
          project_id = v_shift.project_id,
          date = v_shift.shift_date,
          status = 'approved',
          description = COALESCE(v_shift.note, 'Beosztas szerinti muszak'),
          updated_at = now()
        WHERE id = v_shift.time_entry_id;
      ELSE
        INSERT INTO public.time_entries (
          company_id, user_id, project_id, date, hours, description, status, created_at, updated_at
        ) VALUES (
          p_company_id, v_shift.user_id, v_shift.project_id, v_shift.shift_date, v_shift.total_hours,
          COALESCE(v_shift.note, 'Beosztas szerinti muszak'), 'approved', now(), now()
        ) RETURNING id INTO v_time_entry_id;

        UPDATE public.shifts SET time_entry_id = v_time_entry_id WHERE id = v_shift.id;
      END IF;

      v_synced_count := v_synced_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'synced_time_entries', v_synced_count);
END;
$$;
```

---

## 3. Munkajogi Szabalyozasi Motorok (Mt. 2012. evi I. torveny)

### 3.1 Muszakpotlek es Ejszakai Potlek Szamitas (Mt. 141. es 142. par.)
A hatályos magyar Munka Torvenykonyve szerinti elszamolas:
- **Muszakpotlek (Mt. 141. par.):** Merteke **15%**. KIZAROLAG **18:00 es 06:00 kozott** jar, feltéve, hogy a munkavallalo beosztas szerinti napi munkaidejenek kezdete rendszeresen (a munkanapok legalabb egyharmadaban) valtozik (legalabb 4 ora elteressel tobbmuszakos vagy folyamatos munkarendben).
- **Ejszakai potlek (Mt. 142. par.):** Merteke **15%**. A **22:00 es 06:00 kozotti** idoszakban vegzett munkara jar, feltéve, hogy a dolgozo nem jogosult muszakpotlekra, es a munkavegzes idotartama az 1 orat meghaladja.
- **Vasarnapi potlek (Mt. 140. par.):** Merteke **50%**.
- **Munkaszuneti napi potlek (Mt. 140. par. (2)):** Merteke **100%**.

### 3.2 Idoaranyos Betegszabadsag es Tappenz Atfordulas (Mt. 126. par., `sickLeaveTransitionEngine.ts`)
A munkaltato naptari evenkent legfeljebb 15 munkanap betegszabadsagot fizet (tavolleti dij 70%-a).  
Az **Mt. 126. par. (2)** bekezdese szerint az ev kozben kezdodo VAGY megszuno jogviszony eseten a munkavallalo a 15 nap **idoaranyos reszere** jogosult.  
A torvenyes alapkeret dinamikusan az `accounty_tax_parameters` tablabol kerul felolvasasra:

```typescript
export interface SickLeaveAllocation {
  sickLeaveDays: number;
  sickPayDays: number;
  proportionalQuota: number;
}

export function calculateProportionalSickLeave(
  year: number,
  annualBaseQuota: number,
  startDate?: string,
  endDate?: string
): number {
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year, 11, 31).getTime();
  const totalDaysInYear = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365;

  const effectiveStart = startDate ? Math.max(yearStart, new Date(startDate).getTime()) : yearStart;
  const effectiveEnd = endDate ? Math.min(yearEnd, new Date(endDate).getTime()) : yearEnd;

  if (effectiveEnd < effectiveStart) return 0;

  const activeDays = Math.floor((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;
  return Math.round((annualBaseQuota * activeDays) / totalDaysInYear);
}
```

### 3.3 Munkaidokeret Torvenyes Elszamolas (Mt. 93-95. par., `workingTimeFrameEngine.ts`)
A munkaidokeretben teljesitendo munkaido meghatarozasakor:
1. Az **Mt. 93. par. (2)** szerint a munkaido-mennyisegbol le kell vonni a munkaszuneti napra eso orakat (ha az altalanos munkarend szerint munkanapra esne).
2. Le kell vonni az igazolt tavolletek (szabadsag, betegszabadsag) orait.
3. A rendkivuli munkaido (overtime) es az allasido megallapitasa kizarolag a munkaidokeret vegso honapjaban tortenik meg.

```typescript
export interface TimeFrameResult {
  isFinalMonth: boolean;
  targetHours: number;
  workedHours: number;
  balanceHours: number;
  overtimeHours: number; // Csak az utolso honapban!
  idleHours: number;     // Csak az utolso honapban!
}

export function computeTimeFrameSettlement(
  contractedDailyHours: number,
  statutoryWorkdaysCount: number, // A-192 workdayCalculator alapjan (munkaszuneti napok levonasaval)
  excusedAbsenceHours: number,    // Jovahagyott tavolletek
  workedHours: number,
  isFinalMonth: boolean
): TimeFrameResult {
  const targetHours = (statutoryWorkdaysCount * contractedDailyHours) - excusedAbsenceHours;
  const balance = workedHours - targetHours;

  return {
    isFinalMonth,
    targetHours,
    workedHours,
    balanceHours: balance,
    overtimeHours: isFinalMonth && balance > 0 ? balance : 0,
    idleHours: isFinalMonth && balance < 0 ? Math.abs(balance) : 0,
  };
}
```

---

## 4. Felhasznaloi Felulet es Rendszerintegraciok

### 4.1 WorkingTimePage.tsx Oldalintegracio es Szerepkor-Izolacio
A Visibillben mukodo `src/pages/WorkingTimePage.tsx` kezeli az oradijas munkalapokat (`timesheet`), a dolgozoi jelenleteket (`attendance`), a dolgozoi listat (`employees`), a leadott iveket (`submitted`) es az oradijakat (`rates`).  
A beosztas modul egy uj `schedule` tabbal epul be, mikozben az admin es dolgozoi szerepkorok szigoruan elkulonulnek:

```tsx
// src/pages/WorkingTimePage.tsx bovitese 'schedule' tabbal es szerepkor-vedelemmel:
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex mb-4">
    <TabsTrigger value="schedule" className="gap-2">
      <Calendar className="h-4 w-4" /> Beosztas
    </TabsTrigger>
    <TabsTrigger value="timesheet" className="gap-2">
      <Clock className="h-4 w-4" /> {t('hr:working_time.tabs.timesheet', 'Idorogzites')}
    </TabsTrigger>
    <TabsTrigger value="attendance" className="gap-2">
      <ClipboardList className="h-4 w-4" /> {t('hr:working_time.tabs.attendance', 'Jelenleti iv')}
    </TabsTrigger>
    {isAdmin && (
      <>
        <TabsTrigger value="employees" className="gap-2">
          <Users className="h-4 w-4" /> {t('hr:working_time.tabs.employees', 'Dolgozok')}
        </TabsTrigger>
        <TabsTrigger value="submitted" className="gap-2 relative">
          <ClipboardCheck className="h-4 w-4" /> {t('hr:working_time.tabs.submitted', 'Leadott')}
          {submittedCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
              {submittedCount}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="rates" className="gap-2">
          <Calculator className="h-4 w-4" /> {t('hr:working_time.tabs.rates', 'Oradijak')}
        </TabsTrigger>
      </>
    )}
  </TabsList>

  <TabsContent value="schedule" className="mt-4 space-y-4">
    {isAdmin ? (
      <WorktimeScheduleGrid companyId={selectedCompany?.id} dateRange={dateRange} />
    ) : (
      <MyScheduleView companyId={selectedCompany?.id} />
    )}
  </TabsContent>
  {/* A meglevo timesheet, attendance, employees, submitted es rates tabok erintetlenek! */}
</Tabs>
```

### 4.2 Konyveloirodoi Berszamfejtesi Hid (`payrollWorktimeBridge.ts`)
A targyhavi jelenlet lezarasakor az alabbi modul osszesiti a jelenleteket, feltolti az `accounty_timesheets` tablat a `PayrollStep3.tsx` altal elvart `ocr_data` formatumban, es tovabblepteti a ciklust a 4. lepesre. A fuggveny szigoruan vedett a lezart (`closed`) ciklusok modositásaval szemben:

```typescript
import { supabase } from '@/integrations/supabase/client';

export interface TimesheetAggregate {
  workDays: number;
  workedHours: number;
  overtime: number;
  sickDays: number;
  leaveDays: number;
}

export async function pushWorktimeToPayrollCycle(
  companyId: string,
  scheduleId: string,
  cycleId: string
): Promise<{ success: boolean; updatedCount: number }> {
  // 1. Berszamfejtesi ciklus ellenorzese
  const { data: cycle, error: cycleErr } = await supabase
    .from('accounty_payroll_cycles')
    .select('id, status')
    .eq('id', cycleId)
    .single();

  if (cycleErr || !cycle) throw new Error('A berszamfejtesi ciklus nem talalhato');
  if (cycle.status === 'closed') {
    throw new Error('Lezart berszamfejtesi ciklus jelenleti adatai mar nem modosithatok!');
  }

  // 2. Beosztasi idoszak lekerese
  const { data: schedule, error: schedErr } = await supabase
    .from('schedules')
    .select('period_start, period_end, status')
    .eq('id', scheduleId)
    .single();

  if (schedErr || !schedule) throw new Error('A beosztasi idoszak nem talalhato');

  // 3. Igazolt jelenletek lekerese
  const { data: attendances, error: attErr } = await supabase
    .from('attendances')
    .select('employment_id, employee_rate_id, work_date, worked_hours')
    .eq('company_id', companyId)
    .gte('work_date', schedule.period_start)
    .lte('work_date', schedule.period_end);

  if (attErr) throw attErr;

  // 4. Jovahagyott tavolletek lekerese
  const { data: leaves, error: leaveErr } = await supabase
    .from('accounty_leaves')
    .select('employment_id, leave_type, days')
    .eq('status', 'approved')
    .gte('start_date', schedule.period_start)
    .lte('end_date', schedule.period_end);

  if (leaveErr) throw leaveErr;

  // 5. Aggregacio jogviszonyonkent
  const aggMap = new Map<string, TimesheetAggregate>();

  attendances?.forEach(att => {
    const key = att.employment_id || att.employee_rate_id;
    if (!key) return;

    const current = aggMap.get(key) || {
      workDays: 0,
      workedHours: 0,
      overtime: 0,
      sickDays: 0,
      leaveDays: 0
    };
    current.workDays += 1;
    current.workedHours += Number(att.worked_hours || 0);
    if (Number(att.worked_hours || 0) > 8) {
      current.overtime += Number(att.worked_hours) - 8;
    }
    aggMap.set(key, current);
  });

  leaves?.forEach(l => {
    if (!l.employment_id) return;
    const current = aggMap.get(l.employment_id) || {
      workDays: 0,
      workedHours: 0,
      overtime: 0,
      sickDays: 0,
      leaveDays: 0
    };
    if (l.leave_type === 'sick_leave' || l.leave_type === 'sick_pay') {
      current.sickDays += Number(l.days || 0);
    } else if (l.leave_type === 'annual') {
      current.leaveDays += Number(l.days || 0);
    }
    aggMap.set(l.employment_id, current);
  });

  // 6. Timesheet rekordok mentese a nyitott ciklusban
  await supabase
    .from('accounty_timesheets')
    .delete()
    .eq('cycle_id', cycleId);

  const recordsToInsert = Array.from(aggMap.entries()).map(([empId, agg]) => ({
    cycle_id: cycleId,
    employment_id: empId,
    ocr_data: {
      workDays: agg.workDays,
      workedHours: agg.workedHours,
      overtime: agg.overtime,
      sickDays: agg.sickDays,
      leaveDays: agg.leaveDays
    },
    is_verified: true
  }));

  if (recordsToInsert.length > 0) {
    const { error: insErr } = await supabase
      .from('accounty_timesheets')
      .insert(recordsToInsert);
    if (insErr) throw insErr;
  }

  // 7. Leptetes a 4. lepesre
  await supabase
    .from('accounty_payroll_cycles')
    .update({ current_step: 4, updated_at: new Date().toISOString() })
    .eq('id', cycleId)
    .neq('status', 'closed');

  return { success: true, updatedCount: recordsToInsert.length };
}
```

---

## 5. NAV- es Hatosagi Megfelelosegu Export Sablonok

### 5.1 Excel Munkafuzet Specifikacio (`attendanceSheetTemplate.ts`)
A `SpreadsheetAdapter` hasznalataval eloallitott tobb munkalapos munkafüzet:
1. **Osszesito lap:**
   - Fejlec: Vallalkozas neve, adoszama, statisztikai szamjele, konyvelesi idoszak.
   - Oszlopok: Sorszam, Munkavallalo neve, Adoazonosito, Jogviszony azonosito, FEOR kod, Szerzodeses napi munkaido, Ledolgozott napok, Ledolgozott orak, Muszakpotlekos orak (18:00-06:00, 15%), Ejszakai orak (22:00-06:00, 15%), Vasarnapi orak (50%), Munkaszuneti orak (100%), Rendkivuli munkaido (50% / 100%), 28 jogcimu tavolletek napokban es orakban bontva, Alairas.
2. **Egyeni havi dolgozoi lapok:**
   - 1-31. napokra lebontott sorok: Munkakezdes, Munka vege, Pihenoido, Netto munkaora, Potleksavok, Tavolleti jogcim, Dolgozoi szigno es Munkaltatoi ellenorzes.

### 5.2 PDF Nyomtatvany
A `PdfDocumentAdapter` es a `hungarianEncoding.ts` hasznalataval eloallitott A4 fekvo jelenleti iv, amely megfelel az Mt. 134. par. hatosagi ellenorzesi kovetelmenyeinek.

---

## 6. Lepesrol Lepesre Megvalositasi Terv (Sprint Roadmap)

```
[Sprint 1: DB, RLS & Bridge] ──► [Sprint 2: Motorok] ──► [Sprint 3: Naptarracs] ──► [Sprint 4: Generalo] ──► [Sprint 5: Export] ──► [Sprint 6: Berhid] ──► [Sprint 7: Build Guard]
```

### Sprint 1: Adatbazis Sema, Dual-Worker RLS es time_entries Hid
- [ ] `20261007000001_worktime_fixed_schema.sql` letrehozasa: munkarendek, sablonok (project_id-val), 28 jogcimu absence_types torzs, dual-worker shifts (project_id, user_id, time_entry_id), attendances es employee_worktime_rules.
- [ ] `20261007000002_worktime_fixed_rls.sql` futtatasa: O(1) user_id B-Tree indexelt shifts es attendances RLS szabalyok, szerepkorok ellenorzese (`user_company_access_cache`).
- [ ] `20261007000003_worktime_fixed_triggers.sql` aktivalasa: lezart idoszak es jelenlet immutabilitasi triggerek.
- [ ] `20261007000004_worktime_fixed_rpc.sql` beallitasa: havi matrix aggregacio egyesitett dolgozokkal es tavolletekkel; autogeneralas; helyettesitokereso; `sync_shifts_to_time_entries` eljaras.

### Sprint 2: Tipusok, Szabaly- es Szamolo Motorok
- [ ] `src/features/worktime/types/worktime.types.ts` elkeszitese (DTO-k, dual-worker entitasok, Mt. szabalyok).
- [ ] `src/features/worktime/engine/worktimeRuleEngine.ts` megirasa (11h piheno, 18-06 muszakpotlek, 12h max, 48h limit).
- [ ] `src/features/worktime/engine/sickLeaveTransitionEngine.ts` implementalasa (idoaranyos 15 napos betegszabadsag -> tappenz atfordulas).
- [ ] `src/features/worktime/engine/workingTimeFrameEngine.ts` elkeszitese (munkaidokeret elszamolas az A-192 unnepnap kalkulatorral).

### Sprint 3: Reszponziv Naptarracs UI es Dolgozoi Vedett Nezet
- [ ] `WorktimeScheduleGrid.tsx` naptarracs megepitese reszponziv CSS Grid technologiaval.
- [ ] `MyScheduleView.tsx` onallo dolgozoi (`isEmployee`) vedett sajat beosztas nezet elkeszitese.
- [ ] `ShiftCell.tsx` atomi React.memo cellakomponens kifejlesztese.
- [ ] `useGridClipboard.ts` billentyuzeti masolas (Ctrl+C / Ctrl+V) es heti minta masolas megirasa.

### Sprint 4: Generalo es Helyettesito Ajanlo
- [ ] `useScheduleAutoGenerator.ts` beosztas masolas es forgosablon alkalmazasa kettos tavolletvedelemmel.
- [ ] `useSubstituteFinder.ts` intelligens helyettesito kereso hook valos 11h pihenoido, tavollet es FEOR vizsgalattal.

### Sprint 5: Jelenlet, Zarolas es Hatosagi Export
- [ ] `MonthLockDialog.tsx` havi jelenlet zarolas es `time_entries` szinkron dialogus letrehozasa.
- [ ] `attendanceSheetTemplate.ts` ExcelJS osszesito es egyeni dolgozoi munkalapok generalasa.
- [ ] A4 fekvo PDF jelenleti iv eloallitasa a `PdfDocumentAdapter`-rel.

### Sprint 6: Berszamfejtesi Hid es Kethonapos UI
- [ ] `payrollWorktimeBridge.ts` osszekapcsolasa az `accounty_timesheets` tablaval es a `PayrollStep3.tsx` modullal lezart ciklus elleni vedelemmel.
- [ ] `WorkingTimePage.tsx` integracioja az uj `schedule` tabbal (isAdmin es isEmployee elkulonitesevel, rates tab megorzesevel).
- [ ] `src/routes/accountyRoutes.tsx` es `src/routes/eaisybillRoutes.tsx` utvonal-regisztracioja.

### Sprint 7: Rendszerteszt, GDPR es Build Guard
- [ ] GDPR 9. cikk orvosi adat szivargas vizsgalata.
- [ ] `npm run build` es linter ellenorzes lefutasa.
- [ ] 500 soros fajlmeret limit betartasa az uj forrasfajlokban.
