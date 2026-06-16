-- ══════════════════════════════════════════════════════════════
-- Audit XML Import — General Ledger Journal Entries
-- ══════════════════════════════════════════════════════════════
-- Stores imported data from RELAX (or compatible) könyvelőprogram
-- audit XML exports. Read-only data for reporting/viewing.

-- 0. Storage bucket for audit XML files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gl_uploads', 'gl_uploads', false, 104857600, ARRAY['text/xml', 'application/xml'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to gl_uploads"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'gl_uploads');

CREATE POLICY "Authenticated users can read gl_uploads"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'gl_uploads');

CREATE POLICY "Service role full access to gl_uploads"
    ON storage.objects FOR ALL TO service_role
    USING (bucket_id = 'gl_uploads');

-- 1. Import metadata (one row per uploaded XML file)
CREATE TABLE IF NOT EXISTS public.gl_audit_imports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    storage_path text,               -- sanitized path in gl_uploads bucket
    source_program text,             -- e.g. "RELAX könyvelőprogram"
    source_version text,             -- e.g. "2026.06.01."
    period_start date NOT NULL,
    period_end date NOT NULL,
    currency text DEFAULT 'HUF',
    account_count int DEFAULT 0,
    partner_count int DEFAULT 0,
    voucher_count int DEFAULT 0,
    entry_count int DEFAULT 0,
    processing_status text DEFAULT 'pending',  -- pending, processing, completed, error
    error_message text,
    preset_id uuid REFERENCES public.chart_of_accounts_presets(id),  -- linked preset (auto or user-selected)
    imported_at timestamptz DEFAULT now(),
    imported_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_gl_audit_imports_company
    ON public.gl_audit_imports(company_id);

-- 2. Journal entries (the actual GL data — one row per Tartozik/Követel entry)
CREATE TABLE IF NOT EXISTS public.gl_journal_entries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    import_id uuid NOT NULL REFERENCES public.gl_audit_imports(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

    -- Voucher (bizonylat)
    voucher_id int,
    voucher_number text,
    voucher_date date,
    entry_index int,

    -- Accounting data
    description text,
    debit_account text NOT NULL,
    credit_account text NOT NULL,
    amount numeric NOT NULL,

    -- Foreign currency
    foreign_amount numeric,
    foreign_currency text,
    exchange_rate numeric,

    -- VAT
    vat_base numeric,
    vat_rate text,

    -- Partner (denormalized from XML Partnerek section)
    partner_code text,
    partner_name text,

    -- Dates
    service_date date,
    payment_due_date date,

    -- Extra
    cost_center text,
    work_number text
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_gl_journal_company
    ON public.gl_journal_entries(company_id, voucher_date);
CREATE INDEX IF NOT EXISTS idx_gl_journal_import
    ON public.gl_journal_entries(import_id);
CREATE INDEX IF NOT EXISTS idx_gl_journal_debit
    ON public.gl_journal_entries(company_id, debit_account);
CREATE INDEX IF NOT EXISTS idx_gl_journal_credit
    ON public.gl_journal_entries(company_id, credit_account);

-- 3. Imported chart of accounts from XML (Szamlaszamok section)
CREATE TABLE IF NOT EXISTS public.gl_audit_accounts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    import_id uuid NOT NULL REFERENCES public.gl_audit_imports(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    account_code text NOT NULL,
    account_name text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_gl_audit_accounts_import
    ON public.gl_audit_accounts(import_id);

-- 4. Imported partners from XML (Partnerek section)
CREATE TABLE IF NOT EXISTS public.gl_audit_partners (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    import_id uuid NOT NULL REFERENCES public.gl_audit_imports(id) ON DELETE CASCADE,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    partner_code text NOT NULL,
    partner_name text NOT NULL,
    tax_number text,
    eu_tax_number text
);

CREATE INDEX IF NOT EXISTS idx_gl_audit_partners_import
    ON public.gl_audit_partners(import_id);

-- RLS policies
ALTER TABLE public.gl_audit_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_audit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gl_audit_partners ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Users can view own company audit imports"
    ON public.gl_audit_imports FOR SELECT
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert audit imports for own company"
    ON public.gl_audit_imports FOR INSERT
    WITH CHECK (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can update own company audit imports"
    ON public.gl_audit_imports FOR UPDATE
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete own company audit imports"
    ON public.gl_audit_imports FOR DELETE
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can view own company journal entries"
    ON public.gl_journal_entries FOR SELECT
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can view own company audit accounts"
    ON public.gl_audit_accounts FOR SELECT
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

CREATE POLICY "Users can view own company audit partners"
    ON public.gl_audit_partners FOR SELECT
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gl_audit_imports TO authenticated;
GRANT SELECT, INSERT ON public.gl_journal_entries TO authenticated;
GRANT SELECT, INSERT ON public.gl_audit_accounts TO authenticated;
GRANT SELECT, INSERT ON public.gl_audit_partners TO authenticated;

-- Service role needs full access for the worker
GRANT ALL ON public.gl_audit_imports TO service_role;
GRANT ALL ON public.gl_journal_entries TO service_role;
GRANT ALL ON public.gl_audit_accounts TO service_role;
GRANT ALL ON public.gl_audit_partners TO service_role;

-- ══════════════════════════════════════════════════════════════
-- RPC: Aggregated audit GL balances per account code
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_audit_gl_balances(
    p_import_id uuid,
    p_date_from date DEFAULT NULL,
    p_date_to date DEFAULT NULL
)
RETURNS TABLE(
    account_code text,
    account_name text,
    debit_total numeric,
    credit_total numeric,
    balance numeric
)
LANGUAGE sql STABLE
AS $$
    WITH debit_sums AS (
        SELECT je.debit_account AS acct, SUM(je.amount) AS total
        FROM public.gl_journal_entries je
        WHERE je.import_id = p_import_id
          AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
          AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
        GROUP BY je.debit_account
    ),
    credit_sums AS (
        SELECT je.credit_account AS acct, SUM(je.amount) AS total
        FROM public.gl_journal_entries je
        WHERE je.import_id = p_import_id
          AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
          AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
        GROUP BY je.credit_account
    ),
    all_accounts AS (
        SELECT acct FROM debit_sums
        UNION
        SELECT acct FROM credit_sums
    )
    SELECT
        aa.acct AS account_code,
        COALESCE(ga.account_name, aa.acct) AS account_name,
        COALESCE(d.total, 0) AS debit_total,
        COALESCE(c.total, 0) AS credit_total,
        COALESCE(d.total, 0) - COALESCE(c.total, 0) AS balance
    FROM all_accounts aa
    LEFT JOIN debit_sums d ON d.acct = aa.acct
    LEFT JOIN credit_sums c ON c.acct = aa.acct
    LEFT JOIN public.gl_audit_accounts ga
        ON ga.account_code = aa.acct AND ga.import_id = p_import_id
    ORDER BY aa.acct;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_gl_balances TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_gl_balances TO service_role;
