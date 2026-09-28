-- Migration: 20260928160000_subledger_and_open_items_schema.sql
-- Description:
--   1. Expands gl_accounts with subledger_type ('none', 'partner', 'detail') and is_open_item_managed (boolean).
--   2. Adds due_date to acc_journal_headers for aging reports.
--   3. Seeds default subledger settings for standard Hungarian accounts (311*, 454*, 361*, 4521*, 161*).
--   4. Creates acc_open_item_matches table for tracking open/closed settled items in double-entry journals.
--   5. Updates acc_post_journal_entry to enforce partner presence when posting to partner-managed accounts.
--   6. Implements RPCs:
--      - get_subledger_items: queries open, closed, or all items for an account/partner
--      - get_subledger_item_matches: queries detailed matches for a specific line
--      - settle_open_items: matches an open line with a settling line
--      - unsettle_open_items: unlinks a matched pair
--      - write_off_subledger_difference: automatically books rounding or FX difference in VE journal

-- 1. Alter acc_journal_headers table
ALTER TABLE public.acc_journal_headers
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- 2. Alter gl_accounts table
ALTER TABLE public.gl_accounts
  ADD COLUMN IF NOT EXISTS subledger_type VARCHAR(16) DEFAULT 'none' CHECK (subledger_type IN ('none', 'partner', 'detail')),
  ADD COLUMN IF NOT EXISTS is_open_item_managed BOOLEAN DEFAULT false;

-- 3. Seed standard chart of accounts subledger settings
UPDATE public.gl_accounts
SET subledger_type = 'partner', is_open_item_managed = true
WHERE (
  gl_number LIKE '311%' OR gl_number LIKE '312%' OR gl_number LIKE '315%' OR gl_number LIKE '316%' OR gl_number LIKE '317%' OR
  gl_number LIKE '454%' OR gl_number LIKE '455%'
);

UPDATE public.gl_accounts
SET subledger_type = 'detail', is_open_item_managed = true
WHERE (
  gl_number LIKE '361%' OR gl_number LIKE '4521%' OR gl_number LIKE '452%'
);

UPDATE public.gl_accounts
SET subledger_type = 'none', is_open_item_managed = true
WHERE (
  gl_number LIKE '161%'
);

-- 4. Create acc_open_item_matches table
CREATE TABLE IF NOT EXISTS public.acc_open_item_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_line_id UUID NOT NULL REFERENCES public.acc_journal_lines(id) ON DELETE CASCADE,
  settling_line_id UUID NOT NULL REFERENCES public.acc_journal_lines(id) ON DELETE CASCADE,
  settled_amount_huf NUMERIC(18,2) NOT NULL,
  settled_amount_foreign NUMERIC(18,2) DEFAULT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'HUF',
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_by UUID REFERENCES auth.users(id),
  match_type VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- 'AUTO_REF', 'MANUAL', 'COMPENSATION', 'WRITE_OFF', 'ROUNDING', 'FX_DIFFERENCE'
  notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.acc_open_item_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acc_open_item_matches_company_member" ON public.acc_open_item_matches;
CREATE POLICY "acc_open_item_matches_company_member"
  ON public.acc_open_item_matches
  FOR ALL
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "acc_open_item_matches_service_role" ON public.acc_open_item_matches;
CREATE POLICY "acc_open_item_matches_service_role"
  ON public.acc_open_item_matches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_company ON public.acc_open_item_matches(company_id);
CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_inv ON public.acc_open_item_matches(company_id, invoice_line_id);
CREATE INDEX IF NOT EXISTS idx_acc_open_item_matches_set ON public.acc_open_item_matches(company_id, settling_line_id);

-- 5. Enforcement: Update acc_post_journal_entry to disallow posting to partner-managed accounts without partner_id
CREATE OR REPLACE FUNCTION public.acc_post_journal_entry(p_header_id uuid, p_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_header RECORD;
  v_next_num INTEGER;
  v_balance NUMERIC;
  v_period_closed BOOLEAN;
  v_valid_user_id UUID;
  v_invalid_line RECORD;
BEGIN
  -- 1. Lock header for update
  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = p_header_id FOR UPDATE;
  
  IF v_header IS NULL THEN
    RAISE EXCEPTION 'Journal entry header not found: %', p_header_id;
  END IF;
  
  IF v_header.status = 'KONYVELT' THEN
    RETURN TRUE; -- Already posted
  END IF;

  -- 2. Check if period is closed
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

  -- 3. Verify balance (T = K)
  SELECT COALESCE(SUM(CASE WHEN dc_type = 'T' THEN amount ELSE -amount END), 0)
    INTO v_balance
    FROM public.acc_journal_lines
   WHERE header_id = p_header_id;

  IF ABS(v_balance) > 0.01 THEN
    RAISE EXCEPTION 'Kettős könyvviteli egyensúlytalanság! Imbalance: %', v_balance;
  END IF;

  -- 4. Ensure lines exist
  IF NOT EXISTS (SELECT 1 FROM public.acc_journal_lines WHERE header_id = p_header_id) THEN
    RAISE EXCEPTION 'Journal entry must contain at least one line to post.';
  END IF;

  -- 5. Subledger Partner Enforcement (Zero Silent Discrepancy)
  -- If any line references a partner-managed account, header.partner_id MUST be set!
  SELECT l.id, g.gl_number, g.short_name INTO v_invalid_line
  FROM public.acc_journal_lines l
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE l.header_id = p_header_id
    AND g.subledger_type = 'partner'
  LIMIT 1;

  IF FOUND AND v_header.partner_id IS NULL THEN
    RAISE EXCEPTION 'Könyvelési hiba: A(z) % (%) főkönyvi szám partnerhez kötött folyószámla, rögzítéskor a partner megadása kötelező!',
      v_invalid_line.gl_number, v_invalid_line.short_name;
  END IF;

  -- 6. Allocate sequential journal number if not already present
  IF v_header.journal_number IS NOT NULL THEN
    v_next_num := v_header.journal_number;
  ELSE
    v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);
  END IF;

  -- 7. Validate user_id against auth.users
  SELECT id INTO v_valid_user_id 
    FROM auth.users 
   WHERE id = COALESCE(p_user_id, auth.uid());

  -- 8. Update header
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = v_valid_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN TRUE;
END;
$function$;

-- 6. RPC get_subledger_items: queries open, closed, or all items for an account/partner
CREATE OR REPLACE FUNCTION public.get_subledger_items(
  p_company_id UUID,
  p_gl_account_id UUID DEFAULT NULL,
  p_partner_id UUID DEFAULT NULL,
  p_mode TEXT DEFAULT 'OPEN', -- 'OPEN', 'CLOSED', 'ALL'
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS TABLE(
  line_id UUID,
  header_id UUID,
  posting_date DATE,
  document_date DATE,
  due_date DATE,
  document_id VARCHAR(64),
  partner_id UUID,
  partner_name TEXT,
  gl_account_id UUID,
  gl_number VARCHAR(16),
  gl_short_name TEXT,
  dc_type CHAR(1),
  amount NUMERIC(18,2),
  foreign_amount NUMERIC(18,2),
  currency CHAR(3),
  settled_amount NUMERIC(18,2),
  remaining_amount NUMERIC(18,2),
  is_settled BOOLEAN,
  match_count INTEGER,
  description VARCHAR(255),
  status VARCHAR(32),
  journal_code VARCHAR(8),
  journal_number INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH line_settlements AS (
    SELECT 
      l_id,
      SUM(s_amt) as total_settled,
      COUNT(*)::INTEGER as match_cnt
    FROM (
      SELECT invoice_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches WHERE company_id = p_company_id
      UNION ALL
      SELECT settling_line_id as l_id, settled_amount_huf as s_amt FROM public.acc_open_item_matches WHERE company_id = p_company_id
    ) raw_s
    GROUP BY l_id
  )
  SELECT
    l.id as line_id,
    h.id as header_id,
    h.posting_date,
    h.document_date,
    COALESCE(h.due_date, h.document_date + INTERVAL '8 days')::DATE as due_date,
    h.document_id,
    h.partner_id,
    COALESCE(p.name, '') as partner_name,
    l.gl_account_id,
    g.gl_number,
    g.short_name as gl_short_name,
    l.dc_type,
    l.amount,
    l.foreign_amount,
    COALESCE(h.currency, 'HUF') as currency,
    COALESCE(ls.total_settled, 0) as settled_amount,
    GREATEST(0, l.amount - COALESCE(ls.total_settled, 0)) as remaining_amount,
    (COALESCE(ls.total_settled, 0) >= (l.amount - 0.01)) as is_settled,
    COALESCE(ls.match_cnt, 0) as match_count,
    l.description,
    h.status,
    j.code as journal_code,
    h.journal_number
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.acc_journals j ON j.id = h.journal_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  LEFT JOIN public.partners p ON p.id = h.partner_id
  LEFT JOIN line_settlements ls ON ls.l_id = l.id
  WHERE h.company_id = p_company_id
    AND h.status = 'KONYVELT'
    AND (g.is_open_item_managed = true OR g.subledger_type IN ('partner', 'detail'))
    AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
    AND (p_partner_id IS NULL OR h.partner_id = p_partner_id)
    AND (p_date_from IS NULL OR h.posting_date >= p_date_from)
    AND (p_date_to IS NULL OR h.posting_date <= p_date_to)
    AND (
      p_mode = 'ALL'
      OR (p_mode = 'OPEN' AND (COALESCE(ls.total_settled, 0) < (l.amount - 0.01)))
      OR (p_mode = 'CLOSED' AND (COALESCE(ls.total_settled, 0) >= (l.amount - 0.01)))
    )
  ORDER BY h.posting_date ASC, h.document_id ASC, l.sequence_number ASC;
END;
$$;

-- 7. RPC get_subledger_item_matches: queries detailed matches for a specific line
CREATE OR REPLACE FUNCTION public.get_subledger_item_matches(
  p_company_id UUID,
  p_line_id UUID
)
RETURNS TABLE(
  match_id UUID,
  settled_amount_huf NUMERIC(18,2),
  settled_amount_foreign NUMERIC(18,2),
  currency CHAR(3),
  settled_at TIMESTAMPTZ,
  match_type VARCHAR(32),
  notes TEXT,
  other_line_id UUID,
  other_header_id UUID,
  other_document_id VARCHAR(64),
  other_posting_date DATE,
  other_dc_type CHAR(1),
  other_amount NUMERIC(18,2),
  other_journal_code VARCHAR(8),
  other_description VARCHAR(255)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id as match_id,
    m.settled_amount_huf,
    m.settled_amount_foreign,
    m.currency,
    m.settled_at,
    m.match_type,
    m.notes,
    other_l.id as other_line_id,
    other_h.id as other_header_id,
    other_h.document_id as other_document_id,
    other_h.posting_date as other_posting_date,
    other_l.dc_type as other_dc_type,
    other_l.amount as other_amount,
    other_j.code as other_journal_code,
    other_l.description as other_description
  FROM public.acc_open_item_matches m
  JOIN public.acc_journal_lines other_l 
    ON other_l.id = (CASE WHEN m.invoice_line_id = p_line_id THEN m.settling_line_id ELSE m.invoice_line_id END)
  JOIN public.acc_journal_headers other_h ON other_h.id = other_l.header_id
  JOIN public.acc_journals other_j ON other_j.id = other_h.journal_id
  WHERE m.company_id = p_company_id
    AND (m.invoice_line_id = p_line_id OR m.settling_line_id = p_line_id)
  ORDER BY m.settled_at DESC;
END;
$$;

-- 8. RPC settle_open_items: matches an open line with a settling line
CREATE OR REPLACE FUNCTION public.settle_open_items(
  p_company_id UUID,
  p_invoice_line_id UUID,
  p_settling_line_id UUID,
  p_amount_huf NUMERIC(18,2),
  p_amount_foreign NUMERIC(18,2) DEFAULT NULL,
  p_match_type VARCHAR(32) DEFAULT 'MANUAL',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match_id UUID;
BEGIN
  IF p_amount_huf <= 0 THEN
    RAISE EXCEPTION 'A rendezett összegnek pozitívnak kell lennie!';
  END IF;

  INSERT INTO public.acc_open_item_matches (
    company_id,
    invoice_line_id,
    settling_line_id,
    settled_amount_huf,
    settled_amount_foreign,
    settled_by,
    match_type,
    notes
  ) VALUES (
    p_company_id,
    p_invoice_line_id,
    p_settling_line_id,
    p_amount_huf,
    p_amount_foreign,
    auth.uid(),
    p_match_type,
    p_notes
  ) RETURNING id INTO v_match_id;

  RETURN v_match_id;
END;
$$;

-- 9. RPC unsettle_open_items: removes a settlement match
CREATE OR REPLACE FUNCTION public.unsettle_open_items(
  p_company_id UUID,
  p_match_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.acc_open_item_matches
  WHERE id = p_match_id AND company_id = p_company_id;

  RETURN true;
END;
$$;

-- 10. RPC write_off_subledger_difference:
-- Automatically creates a journal entry in VE (Vegyes) journal for rounding or FX difference, and settles the line
CREATE OR REPLACE FUNCTION public.write_off_subledger_difference(
  p_company_id UUID,
  p_line_id UUID,
  p_type VARCHAR(32), -- 'ROUNDING' or 'FX_DIFFERENCE'
  p_amount_huf NUMERIC(18,2), -- positive = write-off amount
  p_target_gl_id UUID DEFAULT NULL, -- custom expense/income GL account
  p_description TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line RECORD;
  v_header RECORD;
  v_journal_ve RECORD;
  v_diff_gl_id UUID;
  v_new_header_id UUID;
  v_line1_id UUID;
  v_line2_id UUID;
  v_dc1 CHAR(1);
  v_dc2 CHAR(1);
BEGIN
  -- 1. Fetch line and header
  SELECT * INTO v_line FROM public.acc_journal_lines WHERE id = p_line_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A könyvelési sor nem található!';
  END IF;

  SELECT * INTO v_header FROM public.acc_journal_headers WHERE id = v_line.header_id;
  IF v_header.company_id <> p_company_id THEN
    RAISE EXCEPTION 'Jogosulatlan hozzáférés!';
  END IF;

  -- 2. Find Vegyes (VE) journal
  SELECT * INTO v_journal_ve FROM public.acc_journals
  WHERE company_id = p_company_id AND (code = 'VE' OR type = 'MIXED')
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A Vegyes (VE) napló nem található a cégnél!';
  END IF;

  -- 3. Determine difference GL account
  IF p_target_gl_id IS NOT NULL THEN
    v_diff_gl_id := p_target_gl_id;
  ELSE
    IF p_type = 'ROUNDING' THEN
      -- Default rounding: 8755 or 9779 or 869
      SELECT id INTO v_diff_gl_id FROM public.gl_accounts
      WHERE (company_id = p_company_id OR preset_id IS NOT NULL)
        AND (gl_number LIKE '8755%' OR gl_number LIKE '869%' OR gl_number LIKE '9779%')
      LIMIT 1;
    ELSE
      -- Default FX difference: 8762 (Veszteség) / 9762 (Nyereség)
      SELECT id INTO v_diff_gl_id FROM public.gl_accounts
      WHERE (company_id = p_company_id OR preset_id IS NOT NULL)
        AND (gl_number LIKE '876%' OR gl_number LIKE '976%')
      LIMIT 1;
    END IF;
  END IF;

  IF v_diff_gl_id IS NULL THEN
    RAISE EXCEPTION 'Nem található megfelelő különbözeti főkönyvi számla!';
  END IF;

  -- Determine T / K directions to offset the open line
  -- If open line was T, the offset line must be K
  IF v_line.dc_type = 'T' THEN
    v_dc1 := 'K'; -- Offset to original GL account
    v_dc2 := 'T'; -- Difference account
  ELSE
    v_dc1 := 'T'; -- Offset to original GL account
    v_dc2 := 'K'; -- Difference account
  END IF;

  -- 4. Create new journal header
  INSERT INTO public.acc_journal_headers (
    company_id,
    journal_id,
    accounting_year,
    status,
    entry_type,
    source,
    posting_date,
    document_date,
    document_id,
    partner_id,
    description,
    currency,
    created_by
  ) VALUES (
    p_company_id,
    v_journal_ve.id,
    v_header.accounting_year,
    'KEZI_PISZKOZAT',
    'NORMAL',
    'KEZI',
    current_date,
    current_date,
    COALESCE(v_header.document_id, 'LEIRAS'),
    v_header.partner_id,
    COALESCE(p_description, CASE WHEN p_type = 'ROUNDING' THEN 'Kerekítési különbözet leírása' ELSE 'Realizált árfolyamkülönbözet' END),
    'HUF',
    auth.uid()
  ) RETURNING id INTO v_new_header_id;

  -- 5. Insert lines
  -- Line 1: Offsetting line on original GL account
  INSERT INTO public.acc_journal_lines (
    header_id,
    sequence_number,
    gl_account_id,
    dc_type,
    amount,
    description
  ) VALUES (
    v_new_header_id,
    1,
    v_line.gl_account_id,
    v_dc1,
    ABS(p_amount_huf),
    COALESCE(p_description, 'Különbözet leírása')
  ) RETURNING id INTO v_line1_id;

  -- Line 2: Difference expense / income account
  INSERT INTO public.acc_journal_lines (
    header_id,
    sequence_number,
    gl_account_id,
    dc_type,
    amount,
    description
  ) VALUES (
    v_new_header_id,
    2,
    v_diff_gl_id,
    v_dc2,
    ABS(p_amount_huf),
    COALESCE(p_description, 'Különbözet ellenszámla')
  ) RETURNING id INTO v_line2_id;

  -- Automatically post the write-off entry
  PERFORM public.acc_post_journal_entry(v_new_header_id, auth.uid());

  -- Settle the open line with the newly created offset line
  PERFORM public.settle_open_items(
    p_company_id,
    p_line_id,
    v_line1_id,
    ABS(p_amount_huf),
    NULL,
    p_type,
    'Automatikus különbözet leírás'
  );

  RETURN jsonb_build_object(
    'success', true,
    'header_id', v_new_header_id,
    'settling_line_id', v_line1_id,
    'amount', ABS(p_amount_huf)
  );
END;
$$;
