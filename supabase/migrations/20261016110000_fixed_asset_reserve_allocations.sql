-- Migration: fixed_asset_reserve_allocations table and backfill
-- Allows a single fixed asset to utilize development reserves from multiple years (FIFO)

CREATE TABLE IF NOT EXISTS public.fixed_asset_reserve_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  reserve_id UUID NOT NULL REFERENCES public.development_reserves(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(15, 2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performant lookups
CREATE INDEX IF NOT EXISTS idx_fara_company_id ON public.fixed_asset_reserve_allocations(company_id);
CREATE INDEX IF NOT EXISTS idx_fara_asset_id ON public.fixed_asset_reserve_allocations(asset_id);
CREATE INDEX IF NOT EXISTS idx_fara_reserve_id ON public.fixed_asset_reserve_allocations(reserve_id);

-- RLS policies matching company isolation
ALTER TABLE public.fixed_asset_reserve_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fixed_asset_reserve_allocations_select"
  ON public.fixed_asset_reserve_allocations
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "fixed_asset_reserve_allocations_insert"
  ON public.fixed_asset_reserve_allocations
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "fixed_asset_reserve_allocations_update"
  ON public.fixed_asset_reserve_allocations
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

CREATE POLICY "fixed_asset_reserve_allocations_delete"
  ON public.fixed_asset_reserve_allocations
  FOR DELETE
  USING (
    company_id IN (
      SELECT company_members.company_id
      FROM public.company_members
      WHERE company_members.user_id = (SELECT auth.uid() AS uid)
    )
  );

-- Idempotent Backfill: copy existing legacy allocations from fixed_assets
INSERT INTO public.fixed_asset_reserve_allocations (company_id, asset_id, reserve_id, allocated_amount, created_at)
SELECT 
  fa.company_id,
  fa.id AS asset_id,
  fa.development_reserve_id AS reserve_id,
  fa.development_reserve_amount AS allocated_amount,
  fa.created_at
FROM public.fixed_assets fa
WHERE fa.development_reserve_id IS NOT NULL 
  AND fa.development_reserve_amount > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.fixed_asset_reserve_allocations fara 
    WHERE fara.asset_id = fa.id AND fara.reserve_id = fa.development_reserve_id
  );
