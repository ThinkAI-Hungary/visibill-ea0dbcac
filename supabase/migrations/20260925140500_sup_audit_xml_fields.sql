-- ==============================================================================
-- Migration: 20260925140000_sup_audit_xml_fields.sql
-- Description: Add SUP and enhanced AuditXML fields to gl_audit_partners, 
--              gl_journal_entries, and gl_audit_imports
-- ==============================================================================

-- 1. Add partner email and related party flag to gl_audit_partners
ALTER TABLE public.gl_audit_partners
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS is_related_party BOOLEAN DEFAULT FALSE;

-- 2. Add journal, period, and storno fields to gl_journal_entries
ALTER TABLE public.gl_journal_entries
    ADD COLUMN IF NOT EXISTS journal_code TEXT,
    ADD COLUMN IF NOT EXISTS journal_name TEXT,
    ADD COLUMN IF NOT EXISTS period_code TEXT,
    ADD COLUMN IF NOT EXISTS original_ref TEXT,
    ADD COLUMN IF NOT EXISTS is_storno BOOLEAN DEFAULT FALSE;

-- 3. Add journal_count to gl_audit_imports
ALTER TABLE public.gl_audit_imports
    ADD COLUMN IF NOT EXISTS journal_count INT DEFAULT 0;

-- 4. Create index on journal_code for faster journal view filtering
CREATE INDEX IF NOT EXISTS idx_gl_journal_journal
    ON public.gl_journal_entries(company_id, journal_code)
    WHERE journal_code IS NOT NULL;
