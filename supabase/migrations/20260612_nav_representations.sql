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
