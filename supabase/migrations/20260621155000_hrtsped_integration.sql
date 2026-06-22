-- ============================================================================
-- Migration: HRTSPED Integration - shipments, matches, cmr and queue
-- ============================================================================

-- 1. Create PGMQ queue 'shipment_matching_jobs' if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.list_queues() WHERE queue_name = 'shipment_matching_jobs') THEN
    PERFORM pgmq.create('shipment_matching_jobs');
  END IF;
END $$;

-- 2. Create public.shipment_import_batches
CREATE TABLE IF NOT EXISTS public.shipment_import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create public.shipments (Selectsped import data)
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position_number TEXT NOT NULL,
  pickup_date TIMESTAMPTZ,
  delivery_date TIMESTAMPTZ,
  carrier_name TEXT,
  calculated_amount_huf NUMERIC(15, 2),
  calculated_amount_eur NUMERIC(15, 2),
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  matched_invoice_id UUID, -- FK set later to avoid cycle dependencies on delete rules
  import_batch_id UUID REFERENCES public.shipment_import_batches(id) ON DELETE SET NULL,
  source_row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, position_number)
);

-- 4. Create public.cmr_documents
CREATE TABLE IF NOT EXISTS public.cmr_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position_number TEXT,
  document_type TEXT NOT NULL DEFAULT 'cmr',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  linked_invoice_id UUID, -- FK to invoices.id
  linked_shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  match_confidence NUMERIC(5, 2),
  source_email_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'unprocessed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create public.shipment_matches (audit trail)
CREATE TABLE IF NOT EXISTS public.shipment_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL, -- FK to invoices
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL, -- 'auto', 'manual', 'ai'
  confidence_score NUMERIC(5, 2) NOT NULL,
  match_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  discrepancies JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Add columns to public.invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS position_numbers TEXT[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shipment_match_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS planned_payment_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS selexped_registry_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intermediary_service BOOLEAN NOT NULL DEFAULT false;

-- Add FK references that couldn't be added immediately
ALTER TABLE public.shipments
  ADD CONSTRAINT fk_shipments_matched_invoice_id
  FOREIGN KEY (matched_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.cmr_documents
  ADD CONSTRAINT fk_cmr_documents_linked_invoice_id
  FOREIGN KEY (linked_invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

ALTER TABLE public.shipment_matches
  ADD CONSTRAINT fk_shipment_matches_invoice_id
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

-- 7. Add Foreign Key indexes (Performance & Scale)
CREATE INDEX IF NOT EXISTS idx_shipment_import_batches_company ON public.shipment_import_batches (company_id);
CREATE INDEX IF NOT EXISTS idx_shipments_company_pos ON public.shipments (company_id, position_number);
CREATE INDEX IF NOT EXISTS idx_shipments_carrier ON public.shipments (company_id, carrier_name);
CREATE INDEX IF NOT EXISTS idx_shipments_match_status ON public.shipments (company_id, match_status);
CREATE INDEX IF NOT EXISTS idx_shipments_matched_invoice ON public.shipments (matched_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cmr_docs_company_pos ON public.cmr_documents (company_id, position_number);
CREATE INDEX IF NOT EXISTS idx_cmr_docs_linked_invoice ON public.cmr_documents (linked_invoice_id);
CREATE INDEX IF NOT EXISTS idx_cmr_docs_linked_shipment ON public.cmr_documents (linked_shipment_id);
CREATE INDEX IF NOT EXISTS idx_cmr_docs_status ON public.cmr_documents (company_id, status);
CREATE INDEX IF NOT EXISTS idx_shipment_matches_invoice ON public.shipment_matches (invoice_id);
CREATE INDEX IF NOT EXISTS idx_shipment_matches_shipment ON public.shipment_matches (shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_matches_status ON public.shipment_matches (company_id, status);

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.shipment_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_matches ENABLE ROW LEVEL SECURITY;

-- 9. Create optimized InitPlan RLS policies (A-003 Multi-tenancy RLS)
-- shipment_import_batches
DROP POLICY IF EXISTS "shipment_import_batches_company_isolation" ON public.shipment_import_batches;
CREATE POLICY "shipment_import_batches_company_isolation" ON public.shipment_import_batches
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ));

-- shipments
DROP POLICY IF EXISTS "shipments_company_isolation" ON public.shipments;
CREATE POLICY "shipments_company_isolation" ON public.shipments
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ));

-- cmr_documents
DROP POLICY IF EXISTS "cmr_documents_company_isolation" ON public.cmr_documents;
CREATE POLICY "cmr_documents_company_isolation" ON public.cmr_documents
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ));

-- shipment_matches
DROP POLICY IF EXISTS "shipment_matches_company_isolation" ON public.shipment_matches;
CREATE POLICY "shipment_matches_company_isolation" ON public.shipment_matches
  FOR ALL TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ));

-- 10. Grant privileges explicitly (security best practice)
REVOKE ALL ON public.shipment_import_batches FROM anon;
REVOKE ALL ON public.shipments FROM anon;
REVOKE ALL ON public.cmr_documents FROM anon;
REVOKE ALL ON public.shipment_matches FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_matches TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_import_batches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cmr_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_matches TO service_role;
