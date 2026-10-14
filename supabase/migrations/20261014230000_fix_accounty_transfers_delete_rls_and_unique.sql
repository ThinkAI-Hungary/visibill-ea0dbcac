-- ==============================================================================
-- Fix accounty_transfers: Add missing DELETE policy and unique constraint
-- ==============================================================================

delete from public.accounty_transfers a
where a.id not in (
  select distinct on (b.company_id, coalesce(b.employee_id, '00000000-0000-0000-0000-000000000000'::uuid), b.period) b.id
  from public.accounty_transfers b
  order by b.company_id, coalesce(b.employee_id, '00000000-0000-0000-0000-000000000000'::uuid), b.period, b.created_at asc
);

-- 2. Add unique constraint to prevent duplicate transfers per employee & period
alter table public.accounty_transfers
  drop constraint if exists accounty_transfers_company_employee_period_unique;

alter table public.accounty_transfers
  add constraint accounty_transfers_company_employee_period_unique
  unique (company_id, employee_id, period);

-- 3. Add missing DELETE policy so regeneration of document/transfers cleanly replaces records
drop policy if exists "tr_delete" on public.accounty_transfers;
create policy "tr_delete" on public.accounty_transfers for delete to authenticated
  using (company_id in (select company_id from public.accounty_assignments where accountant_user_id = auth.uid()));
