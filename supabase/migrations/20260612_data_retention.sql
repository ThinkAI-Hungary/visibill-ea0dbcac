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
