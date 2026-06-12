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
