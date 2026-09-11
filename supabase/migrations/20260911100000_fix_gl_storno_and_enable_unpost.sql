-- ==============================================================================
-- Migration: 20260911100000_fix_gl_storno_and_enable_unpost.sql
-- Description:
--   1. Fix General Ledger calculations in get_gl_balances, get_gl_categorized_items,
--      and get_gl_account_card_items: include both 'KONYVELT' and 'SZTORNOZOTT'
--      headers so that original entries and reversing storno entries properly
--      net out to 0 and maintain complete audit trails.
--   2. In acc_storno_journal_entry, carry forward import_key to the correction
--      draft so invoice item linkage and exclusion logic remain intact.
--   3. In acc_enforce_header_immutability, permit unposting transition
--      (KONYVELT -> KEZI_PISZKOZAT) when initiated via acc_unpost_journal_entry.
--   4. In acc_post_journal_entry, preserve existing journal_number on unposted
--      drafts to guarantee gapless journal numbering upon re-posting.
--   5. Create acc_unpost_journal_entry RPC to allow accountants to directly
--      reopen and edit journal entries in open (unlocked) accounting/VAT periods
--      without generating redundant storno vouchers.
-- ==============================================================================

-- ─── 1. UPDATE ACC_ENFORCE_HEADER_IMMUTABILITY ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.acc_enforce_header_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Allow administrative data migrations/fixes if explicitly enabled in session
    IF current_setting('visibill.allow_admin_fix', true) = 'true' THEN
      RETURN OLD;
    END IF;

    IF OLD.status IN ('KONYVELT', 'SZTORNOZOTT') THEN
      RAISE EXCEPTION 'Posted journal entry (Header ID: %) is immutable and cannot be deleted.', OLD.id;
    END IF;

    IF OLD.journal_number IS NOT NULL THEN
      RAISE EXCEPTION 'Journal entry with assigned journal number (%) cannot be deleted to prevent gaps in sequential numbering. Use storno or repost instead.', OLD.journal_number;
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    -- Allow administrative data migrations/fixes if explicitly enabled in session
    IF current_setting('visibill.allow_admin_fix', true) = 'true' THEN
      RETURN NEW;
    END IF;

    -- Allow unposting transition (KONYVELT -> KEZI_PISZKOZAT) if explicitly permitted via session config
    IF OLD.status = 'KONYVELT' AND NEW.status = 'KEZI_PISZKOZAT' AND current_setting('visibill.allow_unpost', true) = 'true' THEN
      RETURN NEW;
    END IF;

    -- Allow standard storno transition (KONYVELT -> SZTORNOZOTT with identical identity fields)
    IF NOT (OLD.status = 'KONYVELT' AND NEW.status = 'SZTORNOZOTT'
            AND NEW.journal_number = OLD.journal_number
            AND NEW.posting_date = OLD.posting_date
            AND NEW.accounting_year = OLD.accounting_year) THEN
      RAISE EXCEPTION 'Posted journal entry (Header ID: %) is immutable.', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ─── 2. UPDATE ACC_POST_JOURNAL_ENTRY ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.acc_post_journal_entry(p_header_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Get sequential number (preserve existing journal_number if previously unposted, else assign next)
  IF v_header.journal_number IS NOT NULL THEN
    v_next_num := v_header.journal_number;
  ELSE
    v_next_num := public.acc_get_next_journal_number(v_header.journal_id, v_header.accounting_year);
  END IF;

  -- Validate user_id against auth.users
  SELECT id INTO v_valid_user_id 
    FROM auth.users 
   WHERE id = COALESCE(p_user_id, auth.uid());

  -- Update header
  UPDATE public.acc_journal_headers
     SET status = 'KONYVELT',
         journal_number = v_next_num,
         posting_timestamp = now(),
         posted_by = v_valid_user_id,
         posted_at = now()
   WHERE id = p_header_id;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_post_journal_entry(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_post_journal_entry(uuid, uuid) TO authenticated, service_role;


-- ─── 3. CREATE ACC_UNPOST_JOURNAL_ENTRY RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.acc_unpost_journal_entry(
  p_header_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_header RECORD;
  v_period_closed BOOLEAN;
  v_vat_locked BOOLEAN;
  v_valid_user_id UUID;
BEGIN
  -- Lock header
  SELECT * INTO v_header 
    FROM public.acc_journal_headers 
   WHERE id = p_header_id 
     FOR UPDATE;

  IF v_header IS NULL THEN
    RAISE EXCEPTION 'A könyvelési tétel nem található: %', p_header_id;
  END IF;

  IF v_header.status <> 'KONYVELT' THEN
    RAISE EXCEPTION 'Csak lekönyvelt (KONYVELT) tételt lehet visszanyitni. Jelenlegi állapot: %', v_header.status;
  END IF;

  -- 1. Check accounting period lock
  SELECT EXISTS (
    SELECT 1 FROM public.acc_accounting_periods
     WHERE company_id = v_header.company_id
       AND year = EXTRACT(YEAR FROM v_header.posting_date)::SMALLINT
       AND month = EXTRACT(MONTH FROM v_header.posting_date)::SMALLINT
       AND is_closed = TRUE
  ) INTO v_period_closed;

  IF v_period_closed THEN
    RAISE EXCEPTION 'A könyvelési időszak le van zárva. Lezárt időszakban lévő tétel kizárólag számviteli sztornózással helyesbíthető!';
  END IF;

  -- 2. Check VAT lock
  SELECT EXISTS (
    SELECT 1 FROM public.vat_returns vr
     WHERE vr.company_id = v_header.company_id
       AND vr.period_year = EXTRACT(YEAR FROM v_header.posting_date)::INTEGER
       AND (
         (vr.frequency = 'monthly' AND vr.period_month = EXTRACT(MONTH FROM v_header.posting_date)::INTEGER)
         OR (vr.frequency = 'quarterly' AND vr.period_quarter = EXTRACT(QUARTER FROM v_header.posting_date)::INTEGER)
         OR (vr.frequency = 'annual')
       )
       AND vr.status = 'finalized'
  ) INTO v_vat_locked;

  IF v_vat_locked THEN
    RAISE EXCEPTION 'Az időszak ÁFA bevallása már véglegesítve van. Véglegesített ÁFA időszakban a tétel kizárólag számviteli sztornózással helyesbíthető!';
  END IF;

  -- Validate user_id against auth.users
  SELECT id INTO v_valid_user_id 
    FROM auth.users 
   WHERE id = COALESCE(p_user_id, auth.uid());

  -- Set session flag so immutability trigger allows transition to KEZI_PISZKOZAT
  PERFORM set_config('visibill.allow_unpost', 'true', true);

  -- Update header to KEZI_PISZKOZAT (retain journal_number so it stays unbroken upon repost)
  UPDATE public.acc_journal_headers
     SET status = 'KEZI_PISZKOZAT',
         justification = COALESCE(p_reason, justification),
         posted_at = NULL,
         posted_by = NULL
   WHERE id = p_header_id;

  -- Audit log
  INSERT INTO public.acc_journal_audit_logs (
    company_id, entity_type, entity_id, event, old_status, new_status, reason, user_id, timestamp
  ) VALUES (
    v_header.company_id, 'acc_journal_headers', p_header_id, 'UNPOST', 'KONYVELT', 'KEZI_PISZKOZAT', COALESCE(p_reason, 'Tétel visszanyitva piszkozattá módosítás céljából'), v_valid_user_id, now()
  );

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.acc_unpost_journal_entry(UUID, UUID, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_unpost_journal_entry(UUID, UUID, TEXT) TO authenticated, service_role;


-- ─── 4. UPDATE ACC_STORNO_JOURNAL_ENTRY (IMPORT_KEY PRESERVATION) ──────────────

CREATE OR REPLACE FUNCTION public.acc_storno_journal_entry(
  p_header_id uuid,
  p_user_id uuid,
  p_reason text,
  p_create_correction boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Get next sequential number BEFORE inserting to avoid updating posted entry afterward
  v_next_num := public.acc_get_next_journal_number(v_orig_header.journal_id, v_storno_year);

  -- 2. Create storno header (posted immediately with correct journal number)
  INSERT INTO public.acc_journal_headers (
    company_id, journal_id, accounting_year, status, entry_type, source,
    posting_date, document_date, posting_timestamp, document_id, partner_id,
    description, justification, currency, exchange_rate, exchange_rate_date,
    stornoed_entry_id, original_entry_id, journal_number, created_by, posted_by, posted_at
  ) VALUES (
    v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KONYVELT', 'SZTORNO', 'KEZI_MODOSITAS',
    v_storno_date, v_orig_header.document_date, now(), v_orig_header.document_id, v_orig_header.partner_id,
    'Sztornó: ' || v_orig_header.description, p_reason, v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
    p_header_id, p_header_id, v_next_num, p_user_id, p_user_id, now()
  ) RETURNING id INTO v_storno_header_id;

  -- 3. Copy lines with inverted Debits/Credits
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

  -- 4. Create correction copy in draft state (optional, carrying forward import_key)
  IF p_create_correction THEN
    INSERT INTO public.acc_journal_headers (
      company_id, journal_id, accounting_year, status, entry_type, source,
      posting_date, document_date, document_id, partner_id,
      description, justification, currency, exchange_rate, exchange_rate_date,
      original_entry_id, import_key, created_by
    ) VALUES (
      v_orig_header.company_id, v_orig_header.journal_id, v_storno_year, 'KEZI_PISZKOZAT', 'NORMAL', 'KEZI_MODOSITAS',
      v_storno_date, v_orig_header.document_date, v_orig_header.document_id, v_orig_header.partner_id,
      v_orig_header.description || ' (Javítás)', 'Helyesbítés az eredeti ' || COALESCE(v_orig_header.description, '') || ' tétel helyett.',
      v_orig_header.currency, v_orig_header.exchange_rate, v_orig_header.exchange_rate_date,
      p_header_id, v_orig_header.import_key, p_user_id
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
$$;

REVOKE EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_storno_journal_entry(uuid, uuid, text, boolean) TO authenticated, service_role;


-- ─── 5. UPDATE GET_GL_BALANCES (INCLUDE SZTORNOZOTT ENTRIES) ───────────────────

CREATE OR REPLACE FUNCTION public.get_gl_balances(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_posting_status text DEFAULT 'ALL'::text,
  p_date_basis text DEFAULT 'kibocsatas'::text
)
RETURNS TABLE(
  gl_account_id uuid,
  gl_number text,
  short_name text,
  total_balance numeric,
  final_balance numeric,
  temp_balance numeric,
  item_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH raw_items AS (
    -- ① transactions (banki tételek)
    SELECT
      t.id as item_id,
      t.amount * COALESCE((p_exchange_rates->>COALESCE(t.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id as item_id,
      (CASE 
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ii.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id as item_id,
      (CASE 
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        ELSE COALESCE(ni.net_amount, 0) 
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      true AS is_temporary,
      1::bigint AS sub_count
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      SUM(je.amount) AS amount,
      best_debit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.debit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.debit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.debit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit
    GROUP BY best_debit.id

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-AGGREGATED)
    SELECT
      NULL::uuid AS item_id,
      -SUM(je.amount) AS amount,
      best_credit.id AS mapped_id,
      false AS is_temporary,
      COUNT(*)::bigint AS sub_count
    FROM (
      SELECT je_inner.credit_account, SUM(je_inner.amount) as amount, COUNT(*) as cnt
      FROM public.gl_journal_entries je_inner
      WHERE je_inner.company_id = p_company_id
        AND (p_date_from IS NULL OR je_inner.voucher_date >= p_date_from)
        AND (p_date_to IS NULL OR je_inner.voucher_date <= p_date_to)
        AND je_inner.credit_account IS NOT NULL
        AND je_inner.amount > 0
      GROUP BY je_inner.credit_account
    ) je
    CROSS JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit
    GROUP BY best_credit.id

    UNION ALL

    -- ⑥ FX differences (Árfolyamkülönbözet)
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      best_fx.id AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.get_fx_differences(p_company_id, p_date_from, p_date_to) fd
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND REPLACE(split_part(g.gl_number, '-', 1), '.', '') LIKE
            (CASE WHEN fd.fx_difference >= 0
              THEN COALESCE((SELECT fxs.fx_gain_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '976')
              ELSE COALESCE((SELECT fxs.fx_loss_gl_number FROM public.company_fx_settings fxs WHERE fxs.company_id = p_company_id LIMIT 1), '876')
            END) || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_fx ON true
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'

    UNION ALL

    -- ⑦ Internal accounting journals (acc_journal_lines - KONYVELT & SZTORNOZOTT properly net out)
    SELECT
      l.id AS item_id,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      false AS is_temporary,
      1::bigint AS sub_count
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
  ),
  aggregated_by_mapped_id AS (
    SELECT 
      r.mapped_id, 
      SUM(r.amount) AS total_balance,
      SUM(CASE WHEN NOT r.is_temporary THEN r.amount ELSE 0 END) AS final_balance,
      SUM(CASE WHEN r.is_temporary THEN r.amount ELSE 0 END) AS temp_balance,
      SUM(r.sub_count)::bigint AS item_count
    FROM raw_items r
    GROUP BY r.mapped_id
  ),
  mapped_to_active AS (
    SELECT
      g.id AS gl_account_id,
      g.gl_number::text,
      g.short_name::text,
      COALESCE(a.total_balance, 0)::numeric AS total_balance,
      COALESCE(a.final_balance, 0)::numeric AS final_balance,
      COALESCE(a.temp_balance, 0)::numeric AS temp_balance,
      COALESCE(a.item_count, 0)::bigint AS item_count
    FROM public.gl_accounts g
    LEFT JOIN aggregated_by_mapped_id a ON g.id = a.mapped_id
    WHERE g.preset_id = p_preset_id
  ),
  orphan_sum AS (
    SELECT 
      SUM(a.total_balance) AS orphan_balance,
      SUM(a.final_balance) AS orphan_final_balance,
      SUM(a.temp_balance) AS orphan_temp_balance,
      SUM(a.item_count) AS orphan_item_count
    FROM aggregated_by_mapped_id a
    LEFT JOIN public.gl_accounts check_g 
           ON a.mapped_id = check_g.id 
          AND check_g.preset_id = p_preset_id
    WHERE check_g.id IS NULL OR a.mapped_id IS NULL
  )
  SELECT 
    res.gl_account_id, 
    res.gl_number, 
    res.short_name, 
    res.total_balance,
    res.final_balance,
    res.temp_balance,
    res.item_count
  FROM (
    SELECT 
      m.gl_account_id, 
      m.gl_number, 
      m.short_name, 
      m.total_balance,
      m.final_balance,
      m.temp_balance,
      m.item_count
    FROM mapped_to_active m

    UNION ALL

    SELECT
      NULL::uuid AS gl_account_id,
      'UNCLASSIFIED'::text AS gl_number,
      'Besorolatlan tételek'::text AS short_name,
      COALESCE((SELECT orphan_balance FROM orphan_sum), 0)::numeric AS total_balance,
      COALESCE((SELECT orphan_final_balance FROM orphan_sum), 0)::numeric AS final_balance,
      COALESCE((SELECT orphan_temp_balance FROM orphan_sum), 0)::numeric AS temp_balance,
      COALESCE((SELECT orphan_item_count FROM orphan_sum), 0)::bigint AS item_count
    WHERE COALESCE((SELECT orphan_item_count FROM orphan_sum), 0) > 0
  ) res
  ORDER BY 
    CASE WHEN res.gl_number = 'UNCLASSIFIED' THEN 1 ELSE 0 END,
    res.gl_number ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb, text, text) TO authenticated, service_role;


-- ─── 6. UPDATE GET_GL_CATEGORIZED_ITEMS (INCLUDE SZTORNOZOTT ENTRIES) ──────────

CREATE OR REPLACE FUNCTION public.get_gl_categorized_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL::date,
  p_date_to date DEFAULT NULL::date,
  p_exchange_rates jsonb DEFAULT '{}'::jsonb,
  p_date_basis text DEFAULT 'kibocsatas'::text,
  p_posting_status text DEFAULT 'ALL'::text,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT NULL::integer,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  item_id uuid,
  gl_account_id uuid,
  source_table text,
  item_type text,
  partner text,
  description text,
  amount numeric,
  original_amount numeric,
  original_currency text,
  item_date text,
  is_temporary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH debit_map AS MATERIALIZED (
    SELECT je_inner.debit_account, best_debit.id as mapped_id
    FROM (
      SELECT debit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND debit_account IS NOT NULL
      GROUP BY debit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.debit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_debit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_debit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_debit.id AND ga.preset_id = p_preset_id)))
      OR best_debit.id = p_gl_account_id
    )
  ),
  credit_map AS MATERIALIZED (
    SELECT je_inner.credit_account, best_credit.id as mapped_id
    FROM (
      SELECT credit_account 
      FROM public.gl_journal_entries 
      WHERE company_id = p_company_id 
        AND credit_account IS NOT NULL
      GROUP BY credit_account
    ) je_inner
    LEFT JOIN LATERAL (
      SELECT g.id
      FROM public.gl_accounts g
      WHERE g.preset_id = p_preset_id
        AND je_inner.credit_account LIKE REPLACE(split_part(g.gl_number, '-', 1), '.', '') || '%'
      ORDER BY LENGTH(REPLACE(split_part(g.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_credit ON true
    WHERE (
      p_gl_account_id IS NULL
      OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND (best_credit.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.gl_accounts ga WHERE ga.id = best_credit.id AND ga.preset_id = p_preset_id)))
      OR best_credit.id = p_gl_account_id
    )
  ),
  raw_items AS (
    -- ① transactions (banki tételek)
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
      t.transaction_date::text AS item_date,
      false AS is_temporary
    FROM public.transactions t
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND t.company_id = p_company_id
      AND t.matched_invoice_id IS NULL
      AND (p_date_from IS NULL OR t.transaction_date::date >= p_date_from)
      AND (p_date_to IS NULL OR t.transaction_date::date <= p_date_to)
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((t.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = t.company_id
          AND h.import_key = t.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ② invoice_items (számla tételek with non-deductible VAT in cost)
    SELECT
      ii.id AS item_id,
      CASE WHEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'invoice_items'::text AS source_table,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN 'Bejövő (Költség)' ELSE 'Kimenő (Bevétel)' END::text AS item_type,
      CASE WHEN i.invoice_direction = 'INBOUND' THEN i.elado_nev ELSE i.vevo_nev END::text AS partner,
      COALESCE(ii.line_description, i.bizonylatsorszam)::text AS description,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(i.penznem, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN i.invoice_direction = 'INBOUND' THEN -(COALESCE(ii.net_amount, 0) + ROUND(COALESCE(ii.vat_amount, 0) * (1.0 - (COALESCE(ii.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN i.invoice_direction = 'OUTBOUND' THEN COALESCE(ii.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(i.penznem, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::text
        ELSE i.kibocsatas_datuma::text
      END AS item_date,
      false AS is_temporary
    FROM public.invoice_items ii
    JOIN public.invoices i ON ii.invoice_id = i.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND i.company_id = p_company_id
      AND i.statusz != 'jovahagyasra_var'
      AND (i.nav_status IS NULL OR i.nav_status != 'missing_nav' OR i.approved_at IS NOT NULL)
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(i.teljesites_datuma, i.kibocsatas_datuma)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR i.kibocsatas_datuma::date >= p_date_from)
            AND (p_date_to IS NULL OR i.kibocsatas_datuma::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ii.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = i.company_id
          AND h.import_key = ii.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ③ nav_invoice_items (NAV számla tételek with non-deductible VAT in cost)
    SELECT
      ni.id AS item_id,
      CASE WHEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id')::uuid ELSE NULL END AS mapped_id,
      'nav_invoice_items'::text AS source_table,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN 'NAV Bejövő tétel' ELSE 'NAV Kimenő tétel' END::text AS item_type,
      CASE WHEN n.invoice_direction = 'INBOUND' THEN n.supplier_name ELSE n.customer_name END::text AS partner,
      COALESCE(ni.line_description, n.invoice_number)::text AS description,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END) * COALESCE((p_exchange_rates->>COALESCE(n.currency, 'HUF'))::numeric, 1) AS amount,
      (CASE
        WHEN n.invoice_direction = 'INBOUND' THEN -(COALESCE(ni.net_amount, 0) + ROUND(COALESCE(ni.vat_amount, 0) * (1.0 - (COALESCE(ni.deductible_percentage, 100.0) / 100.0)), 2))
        WHEN n.invoice_direction = 'OUTBOUND' THEN COALESCE(ni.net_amount, 0)
        ELSE 0
      END)::numeric AS original_amount,
      COALESCE(n.currency, 'HUF')::text AS original_currency,
      CASE 
        WHEN p_date_basis = 'teljesites' THEN COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::text
        ELSE COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text
      END AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE UPPER(COALESCE(p_posting_status, 'ALL')) != 'POSTED_ONLY'
      AND n.company_id = p_company_id
      AND (
        CASE 
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_delivery_date, n.invoice_issue_date, n.created_at)::date <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR (p_gl_account_id = '00000000-0000-0000-0000-000000000000'::uuid AND ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') IS NULL OR (ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = '00000000-0000-0000-0000-000000000000'))
        OR ((ni.gl_classifications -> (p_preset_id::text) ->> 'gl_account_id') = p_gl_account_id::text)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.acc_journal_headers h
        WHERE h.company_id = n.company_id
          AND h.import_key = ni.id::text
          AND h.status = 'KONYVELT'
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (T)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      je.amount AS amount,
      je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN debit_map dm ON je.debit_account = dm.debit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.debit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑤ Imported XML journal entries — CREDIT side (PRE-MAPPED)
    SELECT
      je.id AS item_id,
      dm.mapped_id AS mapped_id,
      'journal_entry'::text AS source_table,
      'XML Könyvelési tétel (K)'::text AS item_type,
      je.partner_name::text AS partner,
      COALESCE(je.description, je.voucher_number)::text AS description,
      -je.amount AS amount,
      -je.amount::numeric AS original_amount,
      'HUF'::text AS original_currency,
      je.voucher_date::text AS item_date,
      false AS is_temporary
    FROM public.gl_journal_entries je
    JOIN credit_map dm ON je.credit_account = dm.credit_account
    WHERE je.company_id = p_company_id
      AND (p_date_from IS NULL OR je.voucher_date >= p_date_from)
      AND (p_date_to IS NULL OR je.voucher_date <= p_date_to)
      AND je.credit_account IS NOT NULL
      AND je.amount > 0

    UNION ALL

    -- ⑥ Internal accounting journals (acc_journal_lines - KONYVELT & SZTORNOZOTT properly net out)
    SELECT
      l.id AS item_id,
      COALESCE(
        CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END,
        best_active.id,
        g.id
      ) AS mapped_id,
      'acc_journal_lines'::text AS source_table,
      CASE
        WHEN h.entry_type = 'OPENING' OR j.code = 'NY' THEN 'Nyitó tétel'
        WHEN h.entry_type = 'CLOSING' OR j.code = 'Z' THEN 'Záró tétel'
        WHEN j.code = 'VE' THEN 'Vegyes napló tétel'
        WHEN l.dc_type = 'T' THEN 'Könyvelt napló tétel (T)'
        ELSE 'Könyvelt napló tétel (K)'
      END::text AS item_type,
      p.name::text AS partner,
      COALESCE(l.description, h.description, h.document_id)::text AS description,
      (CASE WHEN l.dc_type = 'T' THEN l.amount ELSE -l.amount END) AS amount,
      (CASE WHEN l.dc_type = 'T' THEN COALESCE(l.foreign_amount, l.amount) ELSE -COALESCE(l.foreign_amount, l.amount) END)::numeric AS original_amount,
      COALESCE(h.currency, 'HUF')::text AS original_currency,
      CASE
        WHEN p_date_basis = 'teljesites' THEN COALESCE(h.posting_date, h.document_date)::text
        ELSE COALESCE(h.document_date, h.posting_date)::text
      END AS item_date,
      false AS is_temporary
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.acc_journals j ON h.journal_id = j.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
    LEFT JOIN public.partners p ON h.partner_id = p.id
    LEFT JOIN LATERAL (
      SELECT ga.id
      FROM public.gl_accounts ga
      WHERE ga.preset_id = p_preset_id
        AND REPLACE(split_part(ga.gl_number, '-', 1), '.', '') = REPLACE(split_part(g.gl_number, '-', 1), '.', '')
      ORDER BY LENGTH(REPLACE(split_part(ga.gl_number, '-', 1), '.', '')) DESC
      LIMIT 1
    ) best_active ON true
    WHERE h.company_id = p_company_id
      AND h.status IN ('KONYVELT', 'SZTORNOZOTT')
      AND (
        CASE
          WHEN p_date_basis = 'teljesites' THEN
            (p_date_from IS NULL OR COALESCE(h.posting_date, h.document_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.posting_date, h.document_date) <= p_date_to)
          ELSE
            (p_date_from IS NULL OR COALESCE(h.document_date, h.posting_date) >= p_date_from)
            AND (p_date_to IS NULL OR COALESCE(h.document_date, h.posting_date) <= p_date_to)
        END
      )
      AND (
        p_gl_account_id IS NULL
        OR COALESCE(CASE WHEN g.preset_id = p_preset_id THEN g.id ELSE NULL END, best_active.id, g.id) = p_gl_account_id
      )
  )
  SELECT
    r.item_id,
    r.mapped_id AS gl_account_id,
    r.source_table,
    r.item_type,
    r.partner,
    r.description,
    r.amount,
    r.original_amount,
    r.original_currency,
    r.item_date,
    r.is_temporary
  FROM raw_items r
  ORDER BY r.item_date DESC, r.item_id ASC
  LIMIT p_limit
  OFFSET COALESCE(p_offset, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb, text, text, uuid, integer, integer) TO authenticated, service_role;


-- ─── 7. UPDATE GET_GL_ACCOUNT_CARD_ITEMS (INCLUDE SZTORNOZOTT ENTRIES) ─────────

CREATE OR REPLACE FUNCTION public.get_gl_account_card_items(
  p_company_id uuid,
  p_preset_id uuid,
  p_gl_account_id uuid DEFAULT NULL::uuid,
  p_gl_number_prefix character varying DEFAULT NULL::character varying,
  p_date_from date DEFAULT '1900-01-01'::date,
  p_date_to date DEFAULT '2099-12-31'::date,
  p_include_opening boolean DEFAULT true,
  p_date_basis character varying DEFAULT 'kibocsatas'::character varying,
  p_posting_status character varying DEFAULT 'all'::character varying
)
RETURNS TABLE(
  line_id uuid,
  header_id uuid,
  posting_date date,
  document_date date,
  document_id character varying,
  journal_code character varying,
  journal_name character varying,
  gl_account_id uuid,
  gl_number character varying,
  gl_short_name character varying,
  contra_gl_number character varying,
  contra_gl_name character varying,
  partner_id uuid,
  partner_name character varying,
  partner_tax_number character varying,
  description text,
  dc_type character varying,
  debit_amount numeric,
  credit_amount numeric,
  foreign_amount numeric,
  currency character varying,
  project_name character varying,
  running_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opening_debit NUMERIC := 0;
  v_opening_credit NUMERIC := 0;
  v_opening_net NUMERIC := 0;
  v_running NUMERIC := 0;
  v_row RECORD;
BEGIN
  -- 1. Calculate opening balance prior to p_date_from
  SELECT 
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END), 0)
  INTO v_opening_debit, v_opening_credit
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON h.id = l.header_id
  JOIN public.gl_accounts g ON g.id = l.gl_account_id
  WHERE h.company_id = p_company_id
    AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
    AND (p_gl_number_prefix IS NULL OR g.gl_number LIKE p_gl_number_prefix || '%')
    AND (
      CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END < p_date_from
    )
    AND (p_posting_status = 'all' OR h.status IN ('KONYVELT', 'SZTORNOZOTT'));

  v_opening_net := v_opening_debit - v_opening_credit;
  v_running := v_opening_net;

  -- 2. Return opening row if requested
  IF p_include_opening THEN
    line_id := NULL;
    header_id := NULL;
    posting_date := p_date_from;
    document_date := p_date_from;
    document_id := 'NYITÓ';
    journal_code := 'NY';
    journal_name := 'Nyitó napló';
    gl_account_id := p_gl_account_id;
    gl_number := COALESCE(p_gl_number_prefix, '000');
    gl_short_name := 'Nyitó egyenleg';
    contra_gl_number := '-';
    contra_gl_name := '-';
    partner_id := NULL;
    partner_name := NULL;
    partner_tax_number := NULL;
    description := 'Időszak eleji nyitó egyenleg';
    dc_type := CASE WHEN v_opening_net >= 0 THEN 'T' ELSE 'K' END;
    debit_amount := CASE WHEN v_opening_net >= 0 THEN v_opening_net ELSE 0 END;
    credit_amount := CASE WHEN v_opening_net < 0 THEN ABS(v_opening_net) ELSE 0 END;
    foreign_amount := NULL;
    currency := 'HUF';
    project_name := NULL;
    running_balance := v_running;
    RETURN NEXT;
  END IF;

  -- 3. Loop through items in date range and calculate running balance
  FOR v_row IN
    SELECT 
      l.id AS r_line_id,
      h.id AS r_header_id,
      h.posting_date AS r_posting_date,
      h.document_date AS r_document_date,
      h.document_id AS r_document_id,
      j.code AS r_journal_code,
      j.name AS r_journal_name,
      g.id AS r_gl_account_id,
      g.gl_number AS r_gl_number,
      g.short_name AS r_gl_short_name,
      (
        SELECT STRING_AGG(DISTINCT cg.gl_number, ', ')
        FROM public.acc_journal_lines cl
        JOIN public.gl_accounts cg ON cg.id = cl.gl_account_id
        WHERE cl.header_id = h.id AND cl.dc_type <> l.dc_type
      ) AS r_contra_gl_number,
      (
        SELECT STRING_AGG(DISTINCT cg.short_name, ', ')
        FROM public.acc_journal_lines cl
        JOIN public.gl_accounts cg ON cg.id = cl.gl_account_id
        WHERE cl.header_id = h.id AND cl.dc_type <> l.dc_type
      ) AS r_contra_gl_name,
      p.id AS r_partner_id,
      p.name AS r_partner_name,
      p.tax_number AS r_partner_tax_number,
      COALESCE(l.description, h.description) AS r_description,
      l.dc_type AS r_dc_type,
      CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END AS r_debit_amount,
      CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END AS r_credit_amount,
      l.foreign_amount AS r_foreign_amount,
      h.currency AS r_currency,
      proj.name AS r_project_name
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON h.id = l.header_id
    JOIN public.acc_journals j ON j.id = h.journal_id
    JOIN public.gl_accounts g ON g.id = l.gl_account_id
    LEFT JOIN public.partners p ON p.id = h.partner_id
    LEFT JOIN public.projects proj ON proj.id = l.project_id
    WHERE h.company_id = p_company_id
      AND (p_gl_account_id IS NULL OR l.gl_account_id = p_gl_account_id)
      AND (p_gl_number_prefix IS NULL OR g.gl_number LIKE p_gl_number_prefix || '%')
      AND (
        CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END BETWEEN p_date_from AND p_date_to
      )
      AND (p_posting_status = 'all' OR h.status IN ('KONYVELT', 'SZTORNOZOTT'))
    ORDER BY (CASE WHEN p_date_basis = 'teljesites' THEN h.document_date ELSE h.posting_date END) ASC, h.created_at ASC, l.sequence_number ASC
  LOOP
    line_id := v_row.r_line_id;
    header_id := v_row.r_header_id;
    posting_date := v_row.r_posting_date;
    document_date := v_row.r_document_date;
    document_id := v_row.r_document_id;
    journal_code := v_row.r_journal_code;
    journal_name := v_row.r_journal_name;
    gl_account_id := v_row.r_gl_account_id;
    gl_number := v_row.r_gl_number;
    gl_short_name := v_row.r_gl_short_name;
    contra_gl_number := COALESCE(v_row.r_contra_gl_number, '-');
    contra_gl_name := COALESCE(v_row.r_contra_gl_name, '-');
    partner_id := v_row.r_partner_id;
    partner_name := v_row.r_partner_name;
    partner_tax_number := v_row.r_partner_tax_number;
    description := v_row.r_description;
    dc_type := v_row.r_dc_type;
    debit_amount := v_row.r_debit_amount;
    credit_amount := v_row.r_credit_amount;
    foreign_amount := v_row.r_foreign_amount;
    currency := v_row.r_currency;
    project_name := v_row.r_project_name;

    v_running := v_running + debit_amount - credit_amount;
    running_balance := v_running;

    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_gl_account_card_items(uuid, uuid, uuid, character varying, date, date, boolean, character varying, character varying) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_account_card_items(uuid, uuid, uuid, character varying, date, date, boolean, character varying, character varying) TO authenticated, service_role;


-- ─── 8. FIX EXISTING VBV VISION V/9 ENTRY IMPORT_KEY ───────────────────────────

DO $$
BEGIN
  PERFORM set_config('visibill.allow_admin_fix', 'true', true);

  UPDATE public.acc_journal_headers
     SET import_key = 'dcb0c57b-5ea2-4a24-845a-b5215cb6f215'
   WHERE id = 'fde378a7-0259-4b88-82dd-48e634b690d5'
     AND (import_key IS NULL OR import_key = '');
END $$;
