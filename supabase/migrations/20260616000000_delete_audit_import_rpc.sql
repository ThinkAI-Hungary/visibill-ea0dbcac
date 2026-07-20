-- ==================================================
-- MERGED FROM: 20260616_delete_audit_import_rpc.sql
-- ==================================================
-- RPC to delete an audit import and all its journal entries
-- SECURITY DEFINER allows us to override statement_timeout
CREATE OR REPLACE FUNCTION public.delete_audit_import(p_import_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '120s'
AS $$
BEGIN
  -- Delete journal entries first (bulk, can be 70k+ rows)
  DELETE FROM public.gl_journal_entries WHERE import_id = p_import_id;
  
  -- Delete the import record
  DELETE FROM public.gl_audit_imports WHERE id = p_import_id;
END;
$$;


-- ==================================================
-- MERGED FROM: 20260616_gl_audit_import.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260616_match_overrides_log.sql
-- ==================================================
-- ══════════════════════════════════════════════════════════════
-- Match Overrides Log — Few-shot learning for transaction matching
-- ══════════════════════════════════════════════════════════════
-- Stores manual corrections to AI/heuristic matching decisions.
-- The worker loads these at matching time and injects them into the
-- AI prompt as "company-specific knowledge" (few-shot examples).

CREATE TABLE IF NOT EXISTS public.match_transaction_overrides_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,

    -- What the AI/heuristic originally decided
    original_invoice_id uuid,            -- NULL if there was no match
    original_match_type text,            -- 'ai_match', 'heuristic', etc.

    -- What the user corrected it to
    corrected_invoice_id uuid,           -- NULL if "no invoice needed"
    corrected_match_type text NOT NULL,  -- 'manual', 'no_invoice', 'invoice_missing'

    -- Context for learning (denormalized for fast loading)
    transaction_description text NOT NULL,   -- The transaction description
    transaction_amount numeric NOT NULL,     -- Transaction amount
    original_partner_name text,              -- Partner name from original match
    corrected_partner_name text,             -- Partner name from corrected match

    created_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES auth.users(id)
);

-- Index for company-scoped queries
CREATE INDEX IF NOT EXISTS idx_match_overrides_company
    ON public.match_transaction_overrides_log(company_id, created_at DESC);

-- RLS
ALTER TABLE public.match_transaction_overrides_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company match overrides"
    ON public.match_transaction_overrides_log FOR SELECT
    USING (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert match overrides for own company"
    ON public.match_transaction_overrides_log FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT cm.company_id FROM public.company_members cm
            WHERE cm.user_id = auth.uid()
        )
    );

-- Grant to authenticated users
GRANT SELECT, INSERT ON public.match_transaction_overrides_log TO authenticated;


-- ==================================================
-- MERGED FROM: 20260616_petty_cash_multi.sql
-- ==================================================
-- ============================================================
-- Multi-Register Petty Cash System
-- ============================================================
-- Replaces the single hp_settings table with a full multi-register,
-- multi-currency petty cash system including routing rules.
-- ============================================================

-- ─── 1. petty_cash_registers ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_registers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  location    text,
  currencies  text[] NOT NULL DEFAULT '{HUF}',
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

-- Only one default register per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcr_one_default
  ON public.petty_cash_registers(company_id) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_pcr_company
  ON public.petty_cash_registers(company_id);

-- RLS
ALTER TABLE public.petty_cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_registers"
  ON public.petty_cash_registers FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_registers"
  ON public.petty_cash_registers FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_registers"
  ON public.petty_cash_registers FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_registers"
  ON public.petty_cash_registers FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 2. petty_cash_opening_balances ────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_opening_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id  uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  currency     text NOT NULL DEFAULT 'HUF',
  amount       numeric NOT NULL DEFAULT 0,
  start_date   date,
  UNIQUE(register_id, currency)
);

ALTER TABLE public.petty_cash_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR SELECT TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR INSERT TO authenticated
  WITH CHECK (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR UPDATE TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR DELETE TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));


-- ─── 3. petty_cash_entries ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  register_id   uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  entry_date    date NOT NULL,
  description   text,
  amount        numeric NOT NULL,      -- positive = income, negative = expense
  currency      text NOT NULL DEFAULT 'HUF',
  source_type   text NOT NULL,         -- 'withdrawal','cash_deposit','cash_sale','cash_expense','manual','transfer'
  source_id     uuid,                  -- FK to source row (nullable for manual entries)
  source_table  text,                  -- 'transactions','nav_invoices','invoices'
  routed_by     text NOT NULL DEFAULT 'default', -- 'default','rule','manual','ml'
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pce_register_date
  ON public.petty_cash_entries(register_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_pce_company_date
  ON public.petty_cash_entries(company_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_pce_source
  ON public.petty_cash_entries(source_table, source_id);

ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_entries"
  ON public.petty_cash_entries FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_entries"
  ON public.petty_cash_entries FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_entries"
  ON public.petty_cash_entries FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_entries"
  ON public.petty_cash_entries FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 4. petty_cash_routing_rules ───────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_routing_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_register_id  uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  priority            integer NOT NULL DEFAULT 0,
  match_currency      text,             -- e.g. 'EUR'
  match_source_type   text,             -- e.g. 'cash_sale'
  match_description_pattern text,       -- ILIKE pattern
  match_partner_pattern text,           -- ILIKE pattern
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcrr_company
  ON public.petty_cash_routing_rules(company_id);

ALTER TABLE public.petty_cash_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 5. Migrate hp_settings → petty_cash_registers ────────
INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
SELECT hp.company_id, 'Központi pénztár', true, '{HUF}', hp.created_by
FROM public.hp_settings hp
ON CONFLICT DO NOTHING;

INSERT INTO public.petty_cash_opening_balances (register_id, currency, amount, start_date)
SELECT pcr.id, 'HUF', COALESCE(hp.opening_balance, 0), hp.start_date
FROM public.hp_settings hp
JOIN public.petty_cash_registers pcr ON pcr.company_id = hp.company_id AND pcr.is_default = true
ON CONFLICT (register_id, currency) DO NOTHING;


-- ─── 6. get_petty_cash_summary RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.get_petty_cash_summary(p_company_id uuid)
RETURNS TABLE (
  register_id uuid,
  register_name text,
  is_default boolean,
  currency text,
  opening_balance numeric,
  start_date date,
  total_income numeric,
  total_expense numeric,
  current_balance numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH registers AS (
    SELECT r.id, r.name, r.is_default
    FROM petty_cash_registers r
    WHERE r.company_id = p_company_id
  ),
  -- Get all currencies in use per register (from opening balances + entries)
  register_currencies AS (
    SELECT r.id AS reg_id, r.name AS reg_name, r.is_default AS reg_default, ob.currency AS cur,
           COALESCE(ob.amount, 0) AS ob_amount, ob.start_date AS ob_start_date
    FROM registers r
    LEFT JOIN petty_cash_opening_balances ob ON ob.register_id = r.id
    
    UNION
    
    SELECT r.id, r.name, r.is_default, e.currency, 0, NULL
    FROM registers r
    JOIN petty_cash_entries e ON e.register_id = r.id
    WHERE e.company_id = p_company_id
  ),
  -- Deduplicated register+currency combos
  combos AS (
    SELECT DISTINCT ON (reg_id, cur)
      reg_id, reg_name, reg_default, cur,
      FIRST_VALUE(ob_amount) OVER (PARTITION BY reg_id, cur ORDER BY ob_amount DESC) AS ob_amount,
      FIRST_VALUE(ob_start_date) OVER (PARTITION BY reg_id, cur ORDER BY ob_start_date NULLS LAST) AS ob_start_date
    FROM register_currencies
    WHERE cur IS NOT NULL
  ),
  -- Aggregate entries per register+currency
  entry_sums AS (
    SELECT
      e.register_id AS reg_id,
      e.currency AS cur,
      COALESCE(SUM(CASE WHEN e.amount > 0 THEN e.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN e.amount < 0 THEN e.amount ELSE 0 END), 0) AS expense
    FROM petty_cash_entries e
    WHERE e.company_id = p_company_id
    GROUP BY e.register_id, e.currency
  )
  SELECT
    c.reg_id,
    c.reg_name::text,
    c.reg_default,
    c.cur::text,
    c.ob_amount,
    c.ob_start_date,
    COALESCE(es.income, 0),
    COALESCE(es.expense, 0),
    CASE
      WHEN c.cur = 'HUF' THEN ROUND((c.ob_amount + COALESCE(es.income, 0) + COALESCE(es.expense, 0)) / 5.0) * 5
      ELSE c.ob_amount + COALESCE(es.income, 0) + COALESCE(es.expense, 0)
    END
  FROM combos c
  LEFT JOIN entry_sums es ON es.reg_id = c.reg_id AND es.cur = c.cur
  ORDER BY c.reg_default DESC, c.reg_name, c.cur;
END;
$$;

-- Grant access
REVOKE EXECUTE ON FUNCTION public.get_petty_cash_summary(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_petty_cash_summary(uuid) TO authenticated;


-- ==================================================
-- MERGED FROM: 20260616_petty_cash_sync.sql
-- ==================================================
-- ============================================================
-- Sync petty cash entries from legacy data sources
-- ============================================================
-- Pulls entries from transactions, nav_invoices, invoices into
-- petty_cash_entries for a given company. Idempotent via source_table+source_id.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_petty_cash_entries(p_company_id uuid)
RETURNS TABLE (inserted_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_register_id uuid;
  v_start_date date;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_total_before integer;
  v_total_after integer;
BEGIN
  -- Find the default register for this company
  SELECT r.id INTO v_default_register_id
  FROM petty_cash_registers r
  WHERE r.company_id = p_company_id AND r.is_default = true
  LIMIT 1;

  IF v_default_register_id IS NULL THEN
    -- No default register found, cannot sync
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Get start_date from opening balance (if set)
  SELECT ob.start_date INTO v_start_date
  FROM petty_cash_opening_balances ob
  WHERE ob.register_id = v_default_register_id AND ob.currency = 'HUF'
  LIMIT 1;

  -- Count existing entries
  SELECT COUNT(*)::integer INTO v_total_before
  FROM petty_cash_entries e
  WHERE e.company_id = p_company_id;

  -- ① Withdrawals (ATM / counter cash withdrawals → positive, cash comes IN)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz felvétel'),
    ABS(t.amount),
    'HUF',
    'withdrawal',
    t.id,
    'transactions',
    'default'
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('atm készpénzfelvét', 'pénztári kp felvét')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ② Cash deposits (cash goes OUT from petty cash → negative)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    t.transaction_date,
    COALESCE(t.description, 'Készpénz befizetés'),
    -(ABS(t.amount)),
    'HUF',
    'cash_deposit',
    t.id,
    'transactions',
    'default'
  FROM transactions t
  WHERE t.company_id = p_company_id
    AND t.type IN ('pénztári kp befizetés', 'kp befizetés atm-en keresztül')
    AND (v_start_date IS NULL OR t.transaction_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'transactions' AND e.source_id = t.id
    );

  -- ③ Cash sales (OUTBOUND NAV invoices paid in cash → positive)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    ni.invoice_issue_date,
    'Készpénzes értékesítés - ' || COALESCE(ni.customer_name, 'Ismeretlen'),
    ni.invoice_gross_amount,
    COALESCE(ni.currency, 'HUF'),
    'cash_sale',
    ni.id,
    'nav_invoices',
    'default'
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'OUTBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    );

  -- ④ Cash expenses from submitted invoices (reference_number IS NULL → not linked)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    i.kibocsatas_datuma,
    'Készpénzes kiadás - ' || COALESCE(i.elado_nev, 'Ismeretlen'),
    -(i.brutto_vegosszeg),
    COALESCE(i.penznem, 'HUF'),
    'cash_expense',
    i.id,
    'invoices',
    'default'
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND i.fizetesi_mod ILIKE '%készpénz%'
    AND i.reference_number IS NULL
    AND (v_start_date IS NULL OR i.kibocsatas_datuma >= v_start_date)
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'invoices' AND e.source_id = i.id
    );

  -- ⑤ NAV cash expenses (INBOUND, excluding duplicates already in invoices table)
  INSERT INTO petty_cash_entries (company_id, register_id, entry_date, description, amount, currency, source_type, source_id, source_table, routed_by)
  SELECT
    p_company_id,
    v_default_register_id,
    ni.invoice_issue_date,
    'Készpénzes kiadás (NAV) - ' || COALESCE(ni.supplier_name, 'Ismeretlen'),
    -(ni.invoice_gross_amount),
    COALESCE(ni.currency, 'HUF'),
    'cash_expense',
    ni.id,
    'nav_invoices',
    'default'
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = 'INBOUND'
    AND ni.payment_method IN ('CASH', 'KÉSZPÉNZ')
    AND (v_start_date IS NULL OR ni.invoice_issue_date >= v_start_date)
    -- Exclude if already synced
    AND NOT EXISTS (
      SELECT 1 FROM petty_cash_entries e
      WHERE e.source_table = 'nav_invoices' AND e.source_id = ni.id
    )
    -- Exclude duplicates that exist in invoices table
    AND NOT EXISTS (
      SELECT 1 FROM invoices i2
      WHERE i2.company_id = p_company_id
        AND i2.bizonylatsorszam = ni.invoice_number
        AND i2.fizetesi_mod ILIKE '%készpénz%'
        AND i2.reference_number IS NULL
    );

  -- Count after
  SELECT COUNT(*)::integer INTO v_total_after
  FROM petty_cash_entries e
  WHERE e.company_id = p_company_id;

  v_inserted := v_total_after - v_total_before;

  RETURN QUERY SELECT v_inserted, v_skipped;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_petty_cash_entries(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_petty_cash_entries(uuid) TO authenticated;


-- ==================================================
-- MERGED FROM: 20260616_unified_gl_rpcs.sql
-- ==================================================
-- ══════════════════════════════════════════════════════════════
-- Unify GL RPCs: include audit XML journal entries alongside
-- AI-classified transactions/invoices
-- ══════════════════════════════════════════════════════════════
-- Journal entries are double-entry: each has debit_account + credit_account.
-- Debit side → positive balance for that account
-- Credit side → negative balance for that account
-- We JOIN on gl_accounts.gl_number to resolve the UUID for the preset.

DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date);
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb);

-- ══════════════════════════════════════════════════════════════
-- 1. get_gl_balances — now includes journal entries
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- ② invoice_items (számla tételek)
    SELECT
      ii.id as item_id,
      (CASE WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0)) ELSE COALESCE(ii.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id as item_id,
      (CASE WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0)) ELSE COALESCE(ni.net_amount, 0) END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
    -- gl_accounts uses dotted format (e.g. '466.') while journal entries use raw codes ('466000')
    -- We prefix-match: strip dots from gl_number and find the longest matching prefix
    SELECT
      je.id AS item_id,
      je.amount AS amount,
      best_debit.id AS mapped_id
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (Követel = negative)
    SELECT
      je.id AS item_id,
      -je.amount AS amount,
      best_credit.id AS mapped_id
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
  ),
  aggregated_by_mapped_id AS (
    SELECT r.mapped_id, SUM(r.amount) AS total_balance
    FROM raw_items r
    GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT SUM(a.total_balance) AS orphan_balance
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g 
           ON a.mapped_id = check_g.id 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT m.gl_account_id, m.gl_number, m.short_name, m.total_balance 
  FROM mapped_to_active m

  UNION ALL

  SELECT
    '00000000-0000-0000-0000-000000000000'::uuid AS gl_account_id,
    'ORPHAN' AS gl_number,
    'Besorolatlan tételek (Eltérő sablonból)' AS short_name,
    COALESCE((SELECT orphan_balance FROM orphan_sum), 0) AS total_balance
  WHERE COALESCE((SELECT orphan_balance FROM orphan_sum), 0) <> 0

  ORDER BY gl_number;
END;
$$;


-- ══════════════════════════════════════════════════════════════
-- 2. get_gl_categorized_items — now includes journal entries
-- ══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid, 
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  original_amount numeric,
  original_currency text,
  item_date text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions
    SELECT
      t.id AS item_id,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'transactions'::text AS source_table,
      'Banki tranzakció'::text AS item_type,
      NULL::text AS partner,
      t.description::text AS description,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      t.amount::numeric AS original_amount,
      COALESCE(t.currency, 'HUF')::text AS original_currency,
      t.transaction_date::text AS item_date
    FROM public.transactions t
    WHERE t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)

    UNION ALL

    -- ② invoice_items
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      i.kibocsatas_datuma::text AS item_date
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE i.company_id = p_company_id
      AND (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
      AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)

    UNION ALL

    -- ③ nav_invoice_items
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
    SELECT
      je.id AS item_id,
      best_debit.id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (Követel = negative)
    SELECT
      je.id AS item_id,
      best_credit.id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      -je.amount AS amount,
      -je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date
    FROM public.gl_journal_entries je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
  )
  SELECT
    r.item_id,
    COALESCE(active_g.id, '00000000-0000-0000-0000-000000000000'::uuid) AS gl_account_id,
    r.source_table,
    r.item_type,
    r.partner,
    r.description,
    r.amount,
    r.original_amount,
    r.original_currency,
    r.item_date
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;

-- RLS for gl_audit_imports: allow authenticated users to delete their imports
DROP POLICY IF EXISTS "Users can delete own audit imports" ON public.gl_audit_imports;
CREATE POLICY "Users can delete own audit imports"
    ON public.gl_audit_imports FOR DELETE
    USING (company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
    ));
