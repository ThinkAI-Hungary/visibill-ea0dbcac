-- Migration: 20261010220000_vat_snapshots_and_steel_schema.sql
-- Description: Schema, RLS, and columns for VAT Return Snapshots, Revision Pool, and Steel Product AI Anomalies (SPEC-2026-VAT-RETURN-20, P-179, A-242)

-- 1. Create accounty_vat_snapshots
CREATE TABLE IF NOT EXISTS public.accounty_vat_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL, -- 1-12 for monthly, 1-4 for quarterly, 1 for annual
  frequency VARCHAR(8) DEFAULT 'H' NOT NULL, -- 'H' (havi), 'N' (negyedéves), 'E' (éves)
  version_number INTEGER DEFAULT 1 NOT NULL, -- 1 = original, 2 = 1. revision, 3 = 2. revision
  version_type VARCHAR(32) DEFAULT 'ORIGINAL' NOT NULL, -- 'ORIGINAL', 'SELF_REVISION'
  version_label VARCHAR(64) NOT NULL, -- pl. 'v1.0 (Eredeti beadás)'
  status VARCHAR(32) DEFAULT 'DRAFT' NOT NULL, -- 'DRAFT', 'SUBMITTED', 'REVISION_PENDING'
  tax_base_payable NUMERIC(18,2) DEFAULT 0 NOT NULL,
  tax_payable NUMERIC(18,2) DEFAULT 0 NOT NULL,
  tax_base_deductible NUMERIC(18,2) DEFAULT 0 NOT NULL,
  tax_deductible NUMERIC(18,2) DEFAULT 0 NOT NULL,
  net_vat_position NUMERIC(18,2) DEFAULT 0 NOT NULL, -- tax_payable - tax_deductible
  snapshot_hash_sha256 VARCHAR(64) NOT NULL,
  snapshot_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  submitted_at TIMESTAMPTZ,
  submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Create accounty_vat_revision_pool
CREATE TABLE IF NOT EXISTS public.accounty_vat_revision_pool (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  snapshot_id UUID REFERENCES public.accounty_vat_snapshots(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID,
  invoice_item_id UUID,
  invoice_number VARCHAR(128) NOT NULL,
  partner_name TEXT,
  partner_tax_number VARCHAR(64),
  change_type VARCHAR(32) NOT NULL, -- 'LATE_ENTRY', 'MODIFIED', 'DELETED', 'STORNO'
  tax_base_diff NUMERIC(18,2) DEFAULT 0 NOT NULL,
  tax_amount_diff NUMERIC(18,2) DEFAULT 0 NOT NULL,
  penalty_amount NUMERIC(18,2) DEFAULT 0 NOT NULL,
  is_cleared BOOLEAN DEFAULT false NOT NULL,
  cleared_in_snapshot_id UUID REFERENCES public.accounty_vat_snapshots(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Extend invoice_items with steel product fields (6/B melléklet & AI anomália detektor)
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS vtsz_code VARCHAR(16);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS steel_weight_net_kg NUMERIC(14,4);
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS is_fad_steel BOOLEAN DEFAULT false;
ALTER TABLE public.invoice_items ADD COLUMN IF NOT EXISTS ai_price_anomaly_flag BOOLEAN DEFAULT false;

-- Also extend nav_invoice_items if present for consistent querying
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nav_invoice_items') THEN
    ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS vtsz_code VARCHAR(16);
    ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS steel_weight_net_kg NUMERIC(14,4);
    ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS is_fad_steel BOOLEAN DEFAULT false;
    ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS ai_price_anomaly_flag BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 4. Performance & Multi-tenancy Indexes
CREATE INDEX IF NOT EXISTS idx_accounty_vat_snapshots_company 
  ON public.accounty_vat_snapshots(company_id);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_snapshots_period 
  ON public.accounty_vat_snapshots(company_id, period_year, period_month, frequency);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_snapshots_status 
  ON public.accounty_vat_snapshots(company_id, status);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_snapshots_created 
  ON public.accounty_vat_snapshots(company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_revision_pool_snapshot 
  ON public.accounty_vat_revision_pool(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_revision_pool_company 
  ON public.accounty_vat_revision_pool(company_id);

CREATE INDEX IF NOT EXISTS idx_accounty_vat_revision_pool_cleared 
  ON public.accounty_vat_revision_pool(company_id, is_cleared);

CREATE INDEX IF NOT EXISTS idx_invoice_items_vtsz 
  ON public.invoice_items(vtsz_code) WHERE vtsz_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_items_fad_steel 
  ON public.invoice_items(is_fad_steel) WHERE is_fad_steel = true;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.accounty_vat_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_vat_revision_pool ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies: accounty_vat_snapshots
DROP POLICY IF EXISTS "accounty_vat_snapshots_select" ON public.accounty_vat_snapshots;
CREATE POLICY "accounty_vat_snapshots_select"
  ON public.accounty_vat_snapshots
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_vat_snapshots_modify" ON public.accounty_vat_snapshots;
CREATE POLICY "accounty_vat_snapshots_modify"
  ON public.accounty_vat_snapshots
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

-- 7. RLS Policies: accounty_vat_revision_pool
DROP POLICY IF EXISTS "accounty_vat_revision_pool_select" ON public.accounty_vat_revision_pool;
CREATE POLICY "accounty_vat_revision_pool_select"
  ON public.accounty_vat_revision_pool
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "accounty_vat_revision_pool_modify" ON public.accounty_vat_revision_pool;
CREATE POLICY "accounty_vat_revision_pool_modify"
  ON public.accounty_vat_revision_pool
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
      UNION
      SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
    )
  );
