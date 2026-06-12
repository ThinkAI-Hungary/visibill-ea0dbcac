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
