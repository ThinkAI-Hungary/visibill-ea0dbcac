-- ==================================================
-- MERGED FROM: 20260612_cegkapu_settings.sql
-- ==================================================
-- Cégkapu / KÜNY-tárhely beállítások — cégspecifikus
-- Egy cég → egy sor (upsert pattern)

create table if not exists public.accounty_cegkapu_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tarhely_type text not null default 'cegkapu' check (tarhely_type in ('cegkapu', 'kuny')),
  tarhely_id text default '',
  tarhely_status text not null default 'unknown' check (tarhely_status in ('active', 'error', 'unknown')),
  tarhely_company_name text default '',
  capacity_used integer default 0,
  capacity_total integer default 100,
  signer_name text default '',
  signer_kau_type text default 'ugyfelkapu_plus' check (signer_kau_type in ('ugyfelkapu_plus', 'dap', 'eszig')),
  signer_kau_id text default '',
  signer_verified boolean default false,
  polling_frequency text default '15' check (polling_frequency in ('15', '30', '60')),
  auto_receipt boolean default true,
  last_sync timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (company_id)
);

-- RLS
alter table public.accounty_cegkapu_settings enable row level security;

create policy "Users can view cegkapu settings for assigned companies"
  on public.accounty_cegkapu_settings for select
  using (
    company_id in (
      select company_id from public.accounty_assignments
      where accountant_user_id = auth.uid()
    )
  );

create policy "Users can insert cegkapu settings for assigned companies"
  on public.accounty_cegkapu_settings for insert
  with check (
    company_id in (
      select company_id from public.accounty_assignments
      where accountant_user_id = auth.uid()
    )
  );

create policy "Users can update cegkapu settings for assigned companies"
  on public.accounty_cegkapu_settings for update
  using (
    company_id in (
      select company_id from public.accounty_assignments
      where accountant_user_id = auth.uid()
    )
  );


-- ==================================================
-- MERGED FROM: 20260612_company_structure.sql
-- ==================================================
-- Bérezési struktúra — 3 tábla (telephelyek, költséghelyek, részlegek)

-- 1) Telephelyek
create table if not exists public.accounty_sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null default '',
  name text not null,
  address text default '',
  main_activity text default '',
  headcount integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_sites enable row level security;

create policy "sites_select" on public.accounty_sites for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "sites_insert" on public.accounty_sites for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "sites_update" on public.accounty_sites for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "sites_delete" on public.accounty_sites for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 2) Költséghelyek (hierarchikus — parent_id referencia)
create table if not exists public.accounty_cost_centers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  parent_id uuid references public.accounty_cost_centers(id) on delete set null,
  code text not null default '',
  name text not null,
  responsible text default '',
  headcount integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_cost_centers enable row level security;

create policy "cc_select" on public.accounty_cost_centers for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "cc_insert" on public.accounty_cost_centers for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "cc_update" on public.accounty_cost_centers for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "cc_delete" on public.accounty_cost_centers for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 3) Részlegek
create table if not exists public.accounty_departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  site_id uuid references public.accounty_sites(id) on delete set null,
  name text not null,
  manager text default '',
  headcount integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_departments enable row level security;

create policy "depts_select" on public.accounty_departments for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "depts_insert" on public.accounty_departments for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "depts_update" on public.accounty_departments for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "depts_delete" on public.accounty_departments for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));


-- ==================================================
-- MERGED FROM: 20260612_data_retention.sql
-- ==================================================
-- Iratkezelés és GDPR — 3 tábla

-- 1) Megőrzési szabályok (cégspecifikus dokumentumtípusok)
create table if not exists public.accounty_retention_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  doc_type text not null,
  retention_years integer not null default 3,
  legal_basis text default '',
  auto_delete boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (company_id, doc_type)
);

alter table public.accounty_retention_rules enable row level security;

create policy "ret_rules_select" on public.accounty_retention_rules for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ret_rules_insert" on public.accounty_retention_rules for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ret_rules_update" on public.accounty_retention_rules for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ret_rules_delete" on public.accounty_retention_rules for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 2) Adatfeldolgozói szerződések
create table if not exists public.accounty_data_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  partner_name text not null,
  file_name text default '',
  file_url text default '',
  upload_date date default current_date,
  valid_until date,
  status text not null default 'active' check (status in ('active', 'expired')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_data_contracts enable row level security;

create policy "data_contracts_select" on public.accounty_data_contracts for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "data_contracts_insert" on public.accounty_data_contracts for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "data_contracts_update" on public.accounty_data_contracts for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "data_contracts_delete" on public.accounty_data_contracts for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 3) Storage bucket for contract files
insert into storage.buckets (id, name, public) values ('accounty_contracts', 'accounty_contracts', true)
  on conflict (id) do nothing;

-- Allow authenticated users to upload
create policy "contracts_upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'accounty_contracts');

-- Allow authenticated users to read
create policy "contracts_read" on storage.objects for select to authenticated
  using (bucket_id = 'accounty_contracts');

-- Allow authenticated users to delete their uploads
create policy "contracts_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'accounty_contracts');


-- ==================================================
-- MERGED FROM: 20260612_fix_comm_prefs_rls.sql
-- ==================================================
-- =====================================================
-- Fix: add missing INSERT/UPDATE/DELETE policies for
-- accounty_communication_preferences
-- The RLS optimization migration only created a SELECT
-- policy, breaking upserts from the client.
-- =====================================================

-- INSERT policy (for new rows via upsert)
DROP POLICY IF EXISTS "comm_prefs_insert" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_insert" ON public.accounty_communication_preferences
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- UPDATE policy (for existing rows via upsert)
DROP POLICY IF EXISTS "comm_prefs_update" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_update" ON public.accounty_communication_preferences
  FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));

-- DELETE policy (for completeness)
DROP POLICY IF EXISTS "comm_prefs_delete" ON public.accounty_communication_preferences;
CREATE POLICY "comm_prefs_delete" ON public.accounty_communication_preferences
  FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT accounty_assignments.company_id FROM accounty_assignments
    WHERE accounty_assignments.accountant_user_id = (SELECT auth.uid())
  ));


-- ==================================================
-- MERGED FROM: 20260612_nav_representations.sql
-- ==================================================
-- NAV meghatalmazások — 1 cég → N meghatalmazás
create table if not exists public.accounty_nav_representations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rep_type text not null default 'organization' check (rep_type in ('person', 'organization')),
  name text not null default '',
  tax_id text not null default '',
  scope text not null default 'all' check (scope in ('all', 'payroll', 'custom')),
  scope_details text,
  start_date date not null default current_date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  registration_number text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_nav_representations enable row level security;

create policy "nav_rep_select" on public.accounty_nav_representations for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

create policy "nav_rep_insert" on public.accounty_nav_representations for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

create policy "nav_rep_update" on public.accounty_nav_representations for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

create policy "nav_rep_delete" on public.accounty_nav_representations for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));


-- ==================================================
-- MERGED FROM: 20260612_remove_all_mocks.sql
-- ==================================================
-- Kiegészítő táblák a mock adatok kiváltásához
-- IDEMPOTENS: korábbi sikertelen futás utáni cleanup
do $$ begin
  -- year_end_tasks
  drop policy if exists "yet_select" on public.accounty_year_end_tasks;
  drop policy if exists "yet_insert" on public.accounty_year_end_tasks;
  drop policy if exists "yet_update" on public.accounty_year_end_tasks;
  drop policy if exists "yet_delete" on public.accounty_year_end_tasks;
  -- office_settings
  drop policy if exists "office_select" on public.accounty_office_settings;
  drop policy if exists "office_insert" on public.accounty_office_settings;
  drop policy if exists "office_update" on public.accounty_office_settings;
  -- employee_jobs
  drop policy if exists "ej_select" on public.accounty_employee_jobs;
  drop policy if exists "ej_insert" on public.accounty_employee_jobs;
  drop policy if exists "ej_update" on public.accounty_employee_jobs;
  drop policy if exists "ej_delete" on public.accounty_employee_jobs;
  -- job_modifications
  drop policy if exists "jm_select" on public.accounty_job_modifications;
  drop policy if exists "jm_insert" on public.accounty_job_modifications;
  -- documents
  drop policy if exists "doc_select" on public.accounty_documents;
  drop policy if exists "doc_insert" on public.accounty_documents;
  drop policy if exists "doc_update" on public.accounty_documents;
  drop policy if exists "doc_delete" on public.accounty_documents;
  -- transfers
  drop policy if exists "tr_select" on public.accounty_transfers;
  drop policy if exists "tr_insert" on public.accounty_transfers;
  drop policy if exists "tr_update" on public.accounty_transfers;
exception when others then null;
end $$;


-- 1) Év végi feladatok (YearEndDashboardPage)
create table if not exists public.accounty_year_end_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null default extract(year from current_date),
  title text not null,
  subtitle text default '',
  category text default 'general',
  icon_name text default 'FileText',
  color text default 'from-blue-500 to-indigo-500',
  deadline date,
  status text not null default 'pending' check (status in ('done','in_progress','pending','blocked')),
  legal_ref text default '',
  checklist jsonb default '[]'::jsonb,
  output_label text default '',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_year_end_tasks enable row level security;

create policy "yet_select" on public.accounty_year_end_tasks for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "yet_insert" on public.accounty_year_end_tasks for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "yet_update" on public.accounty_year_end_tasks for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "yet_delete" on public.accounty_year_end_tasks for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 2) Iroda beállítások (OfficeSettingsPage) — singleton per user
create table if not exists public.accounty_office_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_office_settings enable row level security;

create policy "office_select" on public.accounty_office_settings for select to authenticated
  using (user_id = auth.uid());
create policy "office_insert" on public.accounty_office_settings for insert to authenticated
  with check (user_id = auth.uid());
create policy "office_update" on public.accounty_office_settings for update to authenticated
  using (user_id = auth.uid());

-- 3) Nyilatkozatok — SKIP: accounty_declarations tábla már létezik
--    (20260529_accounty_payroll_schema.sql hozta létre)
--    RLS policy-k is már léteznek ott.

-- 4) Jogviszonyok / Munkaviszonyok (MultiJobPage, JobModificationPage)
create table if not exists public.accounty_employee_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.accounty_employees(id) on delete cascade,
  job_code text not null default '1101',
  job_code_label text default 'Munkaviszony (általános)',
  seq_num integer default 1,
  position text default '',
  feor text default '',
  weekly_hours integer default 40,
  start_date date not null,
  end_date date,
  base_salary integer default 0,
  status text not null default 'active' check (status in ('active','terminated','suspended')),
  insured boolean default true,
  minimum_base boolean default false,
  employer text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_employee_jobs enable row level security;

create policy "ej_select" on public.accounty_employee_jobs for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ej_insert" on public.accounty_employee_jobs for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ej_update" on public.accounty_employee_jobs for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "ej_delete" on public.accounty_employee_jobs for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 5) Jogviszony módosítások history (JobModificationPage)
create table if not exists public.accounty_job_modifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.accounty_employees(id) on delete cascade,
  job_id uuid references public.accounty_employee_jobs(id) on delete set null,
  change_type text not null,
  effective_date date not null,
  old_value text default '',
  new_value text default '',
  reason text default '',
  generate_08e boolean default false,
  created_at timestamptz default now()
);

alter table public.accounty_job_modifications enable row level security;

create policy "jm_select" on public.accounty_job_modifications for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "jm_insert" on public.accounty_job_modifications for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 6) Dokumentumok (DocumentCenterPage, PayslipGeneratorPage, ExitDocumentsPage)
create table if not exists public.accounty_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.accounty_employees(id) on delete cascade,
  title text not null,
  doc_type text not null default 'other',
  status text not null default 'pending' check (status in ('pending','generated','sent','archived')),
  file_url text default '',
  period text default '',
  generated_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.accounty_documents enable row level security;

create policy "doc_select" on public.accounty_documents for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "doc_insert" on public.accounty_documents for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "doc_update" on public.accounty_documents for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "doc_delete" on public.accounty_documents for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 7) Átutalási lista (TransferListPage)
create table if not exists public.accounty_transfers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid references public.accounty_employees(id) on delete cascade,
  employee_name text default '',
  bank_account text default '',
  net_salary integer default 0,
  period text not null,
  status text not null default 'pending' check (status in ('pending','approved','sent')),
  created_at timestamptz default now()
);

alter table public.accounty_transfers enable row level security;

create policy "tr_select" on public.accounty_transfers for select to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "tr_insert" on public.accounty_transfers for insert to authenticated
  with check (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
create policy "tr_update" on public.accounty_transfers for update to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));

-- 8) Bevallások — SKIP: accounty_filings tábla már létezik
--    (20260529_accounty_payroll_schema.sql hozta létre)
--    RLS policy-k is már léteznek ott.
