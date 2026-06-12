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
