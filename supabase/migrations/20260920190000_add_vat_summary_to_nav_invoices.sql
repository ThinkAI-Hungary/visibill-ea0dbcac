-- =============================================================================
-- Migration: 20260920190000_add_vat_summary_to_nav_invoices.sql
-- Description: Add official NAV invoiceSummary (summaryByVatRate) JSONB column
--              to public.nav_invoices with GIN index for rapid retrieval.
-- Architecture: ADR A-132, PRD P-099
-- =============================================================================

ALTER TABLE public.nav_invoices 
ADD COLUMN IF NOT EXISTS vat_summary jsonb DEFAULT NULL;

COMMENT ON COLUMN public.nav_invoices.vat_summary IS 
'NAV Online Számla v3.0 hivatalos adóhatósági ÁFA összesítő (invoiceSummary / summaryByVatRate) adatok kulcsonként bontva devizában és HUF-ban, valamint különleges jogcímekkel (AAM, TAM, FAD, stb.).';

-- GIN index a gyors jsonb keresésekhez és szűrésekhez
CREATE INDEX IF NOT EXISTS idx_nav_invoices_vat_summary 
ON public.nav_invoices USING gin (vat_summary);
