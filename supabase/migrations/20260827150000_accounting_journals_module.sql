-- Migration: Accounting Journals Module
-- Date: 2026-08-27

-- 1. acc_journals table
CREATE TABLE IF NOT EXISTS public.acc_journals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  code VARCHAR(8) NOT NULL,
  name TEXT NOT NULL,
  type VARCHAR(32) NOT NULL,
  connected_gl_account VARCHAR(10),
  currency CHAR(3) DEFAULT 'HUF' NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT acc_journals_company_code_unique UNIQUE (company_id, code)
);

-- 2. acc_journal_headers table
CREATE TABLE IF NOT EXISTS public.acc_journal_headers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  journal_id UUID REFERENCES public.acc_journals(id) ON DELETE RESTRICT NOT NULL,
  accounting_year SMALLINT NOT NULL,
  journal_number INTEGER,
  status VARCHAR(32) DEFAULT 'KEZI_PISZKOZAT' NOT NULL,
  entry_type VARCHAR(32) DEFAULT 'NORMAL' NOT NULL,
  source VARCHAR(32) DEFAULT 'KEZI' NOT NULL,
  posting_date DATE NOT NULL,
  document_date DATE NOT NULL,
  posting_timestamp TIMESTAMPTZ,
  document_id VARCHAR(64) NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  description VARCHAR(255) NOT NULL,
  justification TEXT,
  currency CHAR(3) DEFAULT 'HUF' NOT NULL,
  exchange_rate NUMERIC(12,6),
  exchange_rate_date DATE,
  stornoed_entry_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE SET NULL,
  original_entry_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE SET NULL,
  ai_recommendation JSONB,
  confidence NUMERIC(4,3),
  import_key VARCHAR(128),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  posted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  CONSTRAINT acc_journal_headers_num_unique UNIQUE (journal_id, accounting_year, journal_number)
);

-- 3. acc_journal_lines table
CREATE TABLE IF NOT EXISTS public.acc_journal_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  header_id UUID REFERENCES public.acc_journal_headers(id) ON DELETE CASCADE NOT NULL,
  sequence_number SMALLINT NOT NULL,
  gl_account_id UUID REFERENCES public.gl_accounts(id) ON DELETE RESTRICT,
  dc_type CHAR(1) NOT NULL CHECK (dc_type IN ('T', 'K')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  foreign_amount NUMERIC(18,2),
  vat_code VARCHAR(16),
  vat_role VARCHAR(16) CHECK (vat_role IN ('ALAP', 'AFA', 'NONE')),
  parent_line_id UUID REFERENCES public.acc_journal_lines(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  cost_center_id UUID,
  confidence NUMERIC(4,3),
  description VARCHAR(255),
  CONSTRAINT acc_journal_lines_unique UNIQUE (header_id, sequence_number)
);

-- 4. acc_journal_counters table
CREATE TABLE IF NOT EXISTS public.acc_journal_counters (
  journal_id UUID REFERENCES public.acc_journals(id) ON DELETE CASCADE NOT NULL,
  accounting_year SMALLINT NOT NULL,
  last_number INTEGER DEFAULT 0 NOT NULL,
  PRIMARY KEY (journal_id, accounting_year)
);

-- 5. acc_journal_audit_logs table
CREATE TABLE IF NOT EXISTS public.acc_journal_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id UUID NOT NULL,
  event VARCHAR(32) NOT NULL,
  old_status VARCHAR(32),
  new_status VARCHAR(32),
  changes JSONB,
  reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  process_name VARCHAR(64),
  timestamp TIMESTAMPTZ DEFAULT now() NOT NULL,
  transaction_id UUID
);

-- 6. acc_accounting_periods table
CREATE TABLE IF NOT EXISTS public.acc_accounting_periods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  year SMALLINT NOT NULL,
  month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  is_closed BOOLEAN DEFAULT FALSE NOT NULL,
  closed_at TIMESTAMPTZ,
  closed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT acc_accounting_period_unique UNIQUE (company_id, year, month)
);

-- Enable RLS on all new tables
ALTER TABLE public.acc_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_journal_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_journal_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_journal_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acc_accounting_periods ENABLE ROW LEVEL SECURITY;

-- Drop any legacy RLS policies to prevent errors
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journals;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journals;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "Allow insert access for company members" ON public.acc_journal_audit_logs;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "Allow write access for company members" ON public.acc_accounting_periods;

-- Define RLS Policies for Journals
CREATE POLICY "Allow read access for company members" ON public.acc_journals
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Allow write access for company members" ON public.acc_journals
  FOR ALL WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- RLS for Headers
CREATE POLICY "Allow read access for company members" ON public.acc_journal_headers
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Allow write access for company members" ON public.acc_journal_headers
  FOR ALL WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- RLS for Lines
CREATE POLICY "Allow read access for company members" ON public.acc_journal_lines
  FOR SELECT USING (header_id IN (SELECT id FROM public.acc_journal_headers WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())));

CREATE POLICY "Allow write access for company members" ON public.acc_journal_lines
  FOR ALL WITH CHECK (header_id IN (SELECT id FROM public.acc_journal_headers WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())));

-- RLS for Counters
CREATE POLICY "Allow read access for company members" ON public.acc_journal_counters
  FOR SELECT USING (journal_id IN (SELECT id FROM public.acc_journals WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())));

CREATE POLICY "Allow write access for company members" ON public.acc_journal_counters
  FOR ALL WITH CHECK (journal_id IN (SELECT id FROM public.acc_journals WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())));

-- RLS for Audit Logs
CREATE POLICY "Allow read access for company members" ON public.acc_journal_audit_logs
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Allow insert access for company members" ON public.acc_journal_audit_logs
  FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- RLS for Periods
CREATE POLICY "Allow read access for company members" ON public.acc_accounting_periods
  FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE POLICY "Allow write access for company members" ON public.acc_accounting_periods
  FOR ALL WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- 7. Sequential Number Generator
CREATE OR REPLACE FUNCTION public.acc_get_next_journal_number(
  p_journal_id UUID,
  p_year SMALLINT
) RETURNS INTEGER AS $$
DECLARE
  v_next_num INTEGER;
BEGIN
  -- Row lock the counter for this journal and year
  INSERT INTO public.acc_journal_counters (journal_id, accounting_year, last_number)
  VALUES (p_journal_id, p_year, 0)
  ON CONFLICT (journal_id, accounting_year) DO NOTHING;

  SELECT last_number + 1 INTO v_next_num
  FROM public.acc_journal_counters
  WHERE journal_id = p_journal_id AND accounting_year = p_year
  FOR UPDATE;

  UPDATE public.acc_journal_counters
  SET last_number = v_next_num
  WHERE journal_id = p_journal_id AND accounting_year = p_year;

  RETURN v_next_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Post Entry RPC
CREATE OR REPLACE FUNCTION public.acc_post_journal_entry(
  p_header_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_header RECORD;
  v_next_num INTEGER;
  v_balance NUMERIC;
  v_period_closed BOOLEAN;
BEGIN
  -- Lock header for update
  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RAISE EXCEPTION 'Journal entry header not found: %', p_header_id;
  END IF;
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN TRUE; -- Already posted
  END IF;

  -- Check if period is closed
  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_header.company_id
       AND year = EXTRACT(YEAR FROM v_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RAISE EXCEPTION 'Cannot post to a closed period.';
  END IF;

  -- Verify balance (T = K)
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_balance
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF v_balance <> 0 THEN
    RAISE EXCEPTION 'Journal entry must be balanced to post. Current imbalance: %', v_balance;
  END IF;

  -- Ensure lines exist
  IF NOT EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE header_id = p_header_id) THEN
    RAISE EXCEPTION 'Journal entry must contain at least one line to post.';
  END IF;

  -- Get next sequential number
  v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);

  -- Update header
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = p_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Storno Entry RPC
CREATE OR REPLACE FUNCTION public.acc_storno_journal_entry(
  p_header_id UUID,
  p_user_id UUID,
  p_reason TEXT,
  p_create_correction BOOLEAN DEFAULT TRUE
) RETURNS UUID AS $$
DECLARE
  v_orig_header RECORD;
  v_storno_header_id UUID;
  v_corr_header_id UUID := NULL;
  v_next_num INTEGER;
  v_period_closed BOOLEAN;
  v_storno_date DATE;
  v_storno_year SMALLINT;
BEGIN
  -- Fetch original header
  SELECT * INTO v_orig_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_orig_header IS NULL THEN
    RAISE EXCEPTION 'Original journal entry header not found: %', p_header_id;
  END IF;

  IF v_orig_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Only posted (KONYVELT) entries can be stornoed.';
  END IF;

  -- Check closed periods
  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_orig_header.company_id
       AND year = EXTRACT(YEAR FROM v_orig_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_orig_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    v_storno_date := CURRENT_DATE;
    v_storno_year := EXTRACT(YEAR FROM v_storno_date)::SMALLINT;
  ELSE
    v_storno_date := v_orig_header.posting_date;
    v_storno_year := v_orig_header.accounting_year;
  END IF;

  -- 1. Mark original as SZTORNOZOTT
  UPDATE public.acc_journal_headers
     SET status = 'SZTORNOZOTT'
   WHERE id = p_header_id;

  -- 2. Create storno header (posted immediately)
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id, partner_id,
    description, justification, currency, exchange_rate, exchange_rate_date,
    stornoed_entry_id, original_entry_id, created_by, posted_by, posted_at
  ) VALUES (
    v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_storno_date, v_orig_header.document_date, now(), v_orig_header.document_id, v_orig_header.partner_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
    p_header_id, p_header_id, p_user_id, p_user_id, now()
  ) RETURNING id INTO v_storno_header_id;

  -- 3. Number the storno
  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);
  UPDATE public.acc_journal_headers
     SET journal_number = v_next_num
   WHERE id = v_storno_header_id;

  -- 4. Copy lines with inverted Debits/Credits
  INSERT INTO public.acc_journal_lines (
    header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
    vat_code, vat_role, project_id, cost_center_id, description
  )
  SELECT
    v_storno_header_id, sequence_number, gl_account_id,
    CASE WHEN dc_type = 'T' THEN 'K' ELSE 'T' END,
    amount, foreign_amount, vat_code, vat_role, project_id, cost_center_id,
    'Sztornó: ' || COALESCE(description, '')
  FROM public.acc_journal_lines
  WHERE header_id = p_header_id;

  -- 5. Create correction copy in draft state
  IF p_create_correction THEN
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, status, entry_type, source,
      posting_date, document_date, document_id, partner_id,
      description, justification, currency, exchange_rate, exchange_rate_date,
      original_entry_id, created_by
    ) VALUES (
      v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
      v_storno_date, v_orig_header.document_date, v_orig_header.document_id, v_orig_header.partner_id,
      v_orig_header.description || ' (Javítás)', 'Helyesbítés az eredeti ' || COALESCE(v_orig_header.description, '') || ' tétel helyett.',
      v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
      p_header_id, p_user_id
    ) RETURNING id INTO v_corr_header_id;

    -- Copy lines exactly
    INSERT INTO public.acc_journal_lines (
      header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    )
    SELECT
      v_corr_header_id, sequence_number, gl_account_id, dc_type, amount, foreign_amount,
      vat_code, vat_role, project_id, cost_center_id, description
    FROM public.acc_journal_lines
    WHERE header_id = p_header_id;
  END IF;

  RETURN COALESCE(v_corr_header_id, v_storno_header_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Seed default journals for a company
CREATE OR REPLACE FUNCTION public.acc_seed_default_journals(
  p_company_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.acc_journals (company_id, code, name, type, connected_gl_account, currency)
  VALUES
    (p_company_id, 'NY', 'Nyitó tételek', 'OPENING', '491', 'HUF'),
    (p_company_id, 'B1', 'K&H bank HUF', 'BANK', '3841', 'HUF'),
    (p_company_id, 'B2', 'K&H bank EUR', 'BANK', '3861', 'EUR'),
    (p_company_id, 'P1', 'Házipénztár HUF', 'PETTY_CASH', '3811', 'HUF'),
    (p_company_id, 'V', 'Vevő számlák', 'CUSTOMER', '311', 'HUF'),
    (p_company_id, 'SZ', 'Szállító számlák', 'SUPPLIER', '454', 'HUF'),
    (p_company_id, 'VE', 'Vegyes tételek', 'MIXED', NULL, 'HUF'),
    (p_company_id, 'BÉR', 'Bérfeladás', 'SYSTEM', NULL, 'HUF'),
    (p_company_id, 'Z', 'Záró tételek', 'CLOSING', '492', 'HUF')
  ON CONFLICT (company_id, code) DO NOTHING;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Balance Checking Trigger (Deferred Commit check)
CREATE OR REPLACE FUNCTION public.acc_check_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_header_id UUID;
  v_status VARCHAR;
  v_balance NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_header_id := OLD.header_id;
  ELSE
    v_header_id := NEW.header_id;
  END IF;

  SELECT status INTO v_status FROM public.acc_journal_headers WHERE id = v_header_id;
  
  IF v_status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
      INTO v_balance
      FROM public.acc_journal_lines
     WHERE header_id = v_header_id;
     
    IF v_balance <> 0 THEN
      RAISE EXCEPTION 'Journal entry lines must be balanced. Debit - Credit = % (Header ID: %)', v_balance, v_header_id;
    END IF;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_journal_balance ON public.acc_journal_lines;
CREATE CONSTRAINT TRIGGER trg_check_journal_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.acc_journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.acc_check_journal_balance();

-- 12. Immutability trigger for posted headers
CREATE OR REPLACE FUNCTION public.acc_enforce_header_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    IF NOT (OLD.status = 'KONYVELT' AND NEW.status = 'SZTORNOZOTT'
            AND NEW.journal_number = OLD.journal_number
            AND NEW.posting_date = OLD.posting_date
            AND NEW.accounting_year = OLD.accounting_year) THEN
      RAISE EXCEPTION 'Posted journal entry (Header ID: %) is immutable.', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acc_enforce_header_immutability ON public.acc_journal_headers;
CREATE TRIGGER trg_acc_enforce_header_immutability
  BEFORE UPDATE OR DELETE ON public.acc_journal_headers
  FOR EACH ROW EXECUTE FUNCTION public.acc_enforce_header_immutability();

-- 13. Immutability trigger for lines
CREATE OR REPLACE FUNCTION public.acc_enforce_line_immutability()
RETURNS TRIGGER AS $$
DECLARE
  v_header_status VARCHAR;
BEGIN
  SELECT status INTO v_header_status 
    FROM public.acc_journal_headers 
   WHERE id = COALESCE(NEW.header_id, OLD.header_id);
   
  IF v_header_status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    RAISE EXCEPTION 'Cannot modify or delete lines belonging to a posted/stornoed journal entry.';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_acc_enforce_line_immutability ON public.acc_journal_lines;
CREATE TRIGGER trg_acc_enforce_line_immutability
  BEFORE UPDATE OR DELETE ON public.acc_journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.acc_enforce_line_immutability();

-- 14. Audit Log Trigger
CREATE OR REPLACE FUNCTION public.acc_log_journal_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_company_id UUID;
  v_event VARCHAR;
  v_old_status VARCHAR := NULL;
  v_new_status VARCHAR := NULL;
  v_changes JSONB := '{}'::jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_company_id := OLD.company_id;
    v_event := 'DELETE';
    v_old_status := OLD.status;
  ELSIF TG_OP = 'INSERT' THEN
    v_company_id := NEW.company_id;
    v_event := 'INSERT';
    v_new_status := NEW.status;
  ELSE
    v_company_id := NEW.company_id;
    v_event := 'UPDATE';
    v_old_status := OLD.status;
    v_new_status := NEW.status;
    
    IF OLD.status <> NEW.status THEN
      v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
    END IF;
    IF OLD.description <> NEW.description THEN
      v_changes := v_changes || jsonb_build_object('description', jsonb_build_object('old', OLD.description, 'new', NEW.description));
    END IF;
    IF OLD.posting_date <> NEW.posting_date THEN
      v_changes := v_changes || jsonb_build_object('posting_date', jsonb_build_object('old', OLD.posting_date, 'new', NEW.posting_date));
    END IF;
    IF OLD.document_id <> NEW.document_id THEN
      v_changes := v_changes || jsonb_build_object('document_id', jsonb_build_object('old', OLD.document_id, 'new', NEW.document_id));
    END IF;
  END IF;

  INSERT INTO public.acc_journal_audit_logs (
    company_id, entity_type, entity_id, event, old_status, new_status, changes, user_id, timestamp
  ) VALUES (
    v_company_id, 'TETEL_FEJ', COALESCE(NEW.id, OLD.id), v_event, v_old_status, v_new_status, v_changes, auth.uid(), now()
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_acc_journal_audit ON public.acc_journal_headers;
CREATE TRIGGER trg_acc_journal_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.acc_journal_headers
  FOR EACH ROW EXECUTE FUNCTION public.acc_log_journal_audit();
