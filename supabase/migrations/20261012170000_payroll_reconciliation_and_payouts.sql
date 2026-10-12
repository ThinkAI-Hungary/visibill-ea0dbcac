-- ═══════════════════════════════════════════════════════════════
-- Migration: 20261012170000_payroll_reconciliation_and_payouts.sql
-- Description: Module 14 - Payroll 471 General Ledger Reconciliation,
--              Bank Payout Matching, Discrepancy Reporting & Audit
-- ═══════════════════════════════════════════════════════════════

-- 1. Table: accounty_payroll_reconciliations
CREATE TABLE IF NOT EXISTS public.accounty_payroll_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES public.accounty_payroll_cycles(id) ON DELETE SET NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_net_accrued NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_bank_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_cash_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_deductions_cleared NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_advances_cleared NUMERIC(18,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  discrepancy_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING_PAYOUT' CHECK (status IN ('BALANCED', 'PENDING_PAYOUT', 'MISMATCH', 'OVERPAID')),
  audited_at TIMESTAMPTZ,
  audited_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_reconciliation_company_month UNIQUE (company_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_payroll_rec_company_period 
  ON public.accounty_payroll_reconciliations(company_id, year, month);

ALTER TABLE public.accounty_payroll_reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payroll reconciliations of their companies"
  ON public.accounty_payroll_reconciliations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = accounty_payroll_reconciliations.company_id
        AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = accounty_payroll_reconciliations.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- 2. Table: accounty_payroll_payout_matches
CREATE TABLE IF NOT EXISTS public.accounty_payroll_payout_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_id UUID REFERENCES public.accounty_payroll_cycles(id) ON DELETE CASCADE,
  calculation_id UUID REFERENCES public.accounty_payroll_calculations(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.accounty_employees(id) ON DELETE CASCADE,
  bank_transaction_id UUID REFERENCES public.bank_transactions(id) ON DELETE SET NULL,
  cash_document_id UUID,
  match_type TEXT NOT NULL DEFAULT 'AUTO_IBAN' CHECK (match_type IN ('AUTO_IBAN', 'AUTO_AMOUNT', 'AUTO_NAME', 'MANUAL', 'GIRO_BATCH_SPLIT')),
  match_status TEXT NOT NULL DEFAULT 'MATCHED' CHECK (match_status IN ('MATCHED', 'PENDING', 'REJECTED', 'DISCREPANCY')),
  matched_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  expected_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  discrepancy NUMERIC(18,2) GENERATED ALWAYS AS (matched_amount - expected_amount) STORED,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payout_matches_company_cycle 
  ON public.accounty_payroll_payout_matches(company_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_payout_matches_employee 
  ON public.accounty_payroll_payout_matches(employee_id);
CREATE INDEX IF NOT EXISTS idx_payout_matches_bank_tx 
  ON public.accounty_payroll_payout_matches(bank_transaction_id);

ALTER TABLE public.accounty_payroll_payout_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage payroll payout matches of their companies"
  ON public.accounty_payroll_payout_matches
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = accounty_payroll_payout_matches.company_id
        AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = accounty_payroll_payout_matches.company_id
        AND company_members.user_id = auth.uid()
    )
  );

-- 3. RPC: get_payroll_471_reconciliation
CREATE OR REPLACE FUNCTION public.get_payroll_471_reconciliation(
  p_company_id UUID,
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_record RECORD;
  v_period_start DATE;
  v_period_end DATE;
  v_payout_deadline DATE;
  
  -- Főkönyvi 471-es változók
  v_opening_471 NUMERIC(18,2) := 0;
  v_debit_471 NUMERIC(18,2) := 0;
  v_credit_471 NUMERIC(18,2) := 0;
  v_closing_471 NUMERIC(18,2) := 0;
  
  -- Bérszámfejtési összesítők
  v_total_gross NUMERIC(18,2) := 0;
  v_total_net NUMERIC(18,2) := 0;
  v_total_commute NUMERIC(18,2) := 0;
  v_total_szja NUMERIC(18,2) := 0;
  v_total_tb NUMERIC(18,2) := 0;
  v_total_szocho NUMERIC(18,2) := 0;
  v_total_deductions NUMERIC(18,2) := 0;
  v_employee_count INT := 0;

  -- Kifizetési adatok
  v_total_paid NUMERIC(18,2) := 0;
  v_paid_count INT := 0;
  v_pending_count INT := 0;
  v_discrepancy_count INT := 0;
  
  v_employees_list JSONB := '[]'::jsonb;
  v_discrepancies_list JSONB := '[]'::jsonb;
  v_status TEXT := 'PENDING_PAYOUT';
  v_discrepancy_amount NUMERIC(18,2) := 0;
BEGIN
  -- Jogosultság ellenőrzése
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég béradatainak megtekintéséhez';
  END IF;

  v_period_start := MAKE_DATE(p_year, p_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month - 1 day')::DATE;
  v_payout_deadline := (v_period_start + INTERVAL '1 month + 9 days')::DATE; -- Következő hó 10.

  -- 1. Bérciklus lekérése
  SELECT id, status, current_step, approved_at
    INTO v_cycle_record
    FROM public.accounty_payroll_cycles
   WHERE company_id = p_company_id AND year = p_year AND month = p_month
   LIMIT 1;

  -- 2. Bérszámfejtési kalkulációk összesítése
  IF v_cycle_record.id IS NOT NULL THEN
    SELECT
      COUNT(c.id),
      COALESCE(SUM(c.gross_salary), 0),
      COALESCE(SUM(c.net_salary), 0),
      COALESCE(SUM(c.szja_amount), 0),
      COALESCE(SUM(c.tb_amount), 0),
      COALESCE(SUM(c.szocho_amount), 0),
      COALESCE(SUM(c.total_deductions), 0),
      COALESCE(SUM(COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)), 0)
    INTO
      v_employee_count,
      v_total_gross,
      v_total_net,
      v_total_szja,
      v_total_tb,
      v_total_szocho,
      v_total_deductions,
      v_total_commute
    FROM public.accounty_payroll_calculations c
    WHERE c.cycle_id = v_cycle_record.id;
  END IF;

  -- 3. 471-es Főkönyvi egyenleg lekérése
  -- Nyitó: a tárgyhó előtti összes K - T egyenleg a 471-es számlákon
  SELECT COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE -l.amount END), 0)
    INTO v_opening_471
    FROM public.acc_journal_lines l
    JOIN public.acc_journal_headers h ON l.header_id = h.id
    JOIN public.gl_accounts g ON l.gl_account_id = g.id
   WHERE h.company_id = p_company_id
     AND g.gl_number LIKE '471%'
     AND h.status IN ('KONYVELT', 'LEKONYVELT')
     AND h.posting_date < v_period_start;

  -- Tárgyhavi forgalom a 471-esen
  SELECT
    COALESCE(SUM(CASE WHEN l.dc_type = 'T' THEN l.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN l.dc_type = 'K' THEN l.amount ELSE 0 END), 0)
  INTO v_debit_471, v_credit_471
  FROM public.acc_journal_lines l
  JOIN public.acc_journal_headers h ON l.header_id = h.id
  JOIN public.gl_accounts g ON l.gl_account_id = g.id
  WHERE h.company_id = p_company_id
    AND g.gl_number LIKE '471%'
    AND h.status IN ('KONYVELT', 'LEKONYVELT')
    AND h.posting_date >= v_period_start
    AND h.posting_date <= v_period_end;

  v_closing_471 := v_opening_471 + v_credit_471 - v_debit_471;

  -- 4. Dolgozónkénti kifizetési lista és párosítások lekérése
  IF v_cycle_record.id IS NOT NULL THEN
    WITH employee_data AS (
      SELECT
        c.id AS calculation_id,
        c.employment_id,
        e.id AS employee_id,
        CONCAT(e.last_name, ' ', e.first_name) AS employee_name,
        COALESCE(e.bank_account, e.iban, '') AS bank_account,
        c.gross_salary,
        c.net_salary,
        COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0) AS commute_reimbursement,
        c.total_deductions,
        (c.net_salary + COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)) AS total_payable,
        COALESCE(pm.matched_amount, 0) AS paid_amount,
        COALESCE(pm.match_status, 'PENDING') AS match_status,
        pm.match_type,
        bt.id AS bank_transaction_id,
        bt.transaction_date AS paid_date,
        bt.counterparty_name,
        bt.counterparty_account
      FROM public.accounty_payroll_calculations c
      JOIN public.accounty_employments emp ON c.employment_id = emp.id
      JOIN public.accounty_employees e ON emp.employee_id = e.id
      LEFT JOIN public.accounty_payroll_payout_matches pm ON pm.calculation_id = c.id
      LEFT JOIN public.bank_transactions bt ON pm.bank_transaction_id = bt.id
      WHERE c.cycle_id = v_cycle_record.id
    )
    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'calculation_id', calculation_id,
          'employee_id', employee_id,
          'employee_name', employee_name,
          'bank_account', bank_account,
          'gross_salary', gross_salary,
          'net_salary', net_salary,
          'commute_reimbursement', commute_reimbursement,
          'total_payable', total_payable,
          'paid_amount', paid_amount,
          'difference', (paid_amount - total_payable),
          'match_status', CASE
            WHEN paid_amount >= total_payable AND total_payable > 0 THEN 'PAID'
            WHEN paid_amount > 0 AND paid_amount < total_payable THEN 'PARTIAL'
            WHEN paid_amount > total_payable THEN 'OVERPAID'
            ELSE 'PENDING'
          END,
          'match_type', match_type,
          'paid_date', paid_date
        ) ORDER BY employee_name ASC
      ), '[]'::jsonb),
      COALESCE(SUM(paid_amount), 0),
      COUNT(CASE WHEN paid_amount >= total_payable AND total_payable > 0 THEN 1 END),
      COUNT(CASE WHEN paid_amount = 0 THEN 1 END),
      COUNT(CASE WHEN paid_amount > total_payable OR (paid_amount > 0 AND paid_amount < total_payable) THEN 1 END)
    INTO v_employees_list, v_total_paid, v_paid_count, v_pending_count, v_discrepancy_count
    FROM employee_data;
  END IF;

  -- 5. Havi Eltéréslista összeállítása (Discrepancies)
  -- 5a. Dupla vagy túlfizetés
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'OVERPAYMENT',
      'severity', 'CRITICAL',
      'title', 'Túlfizetés / Lehetséges Dupla Utalás',
      'employee_name', item->>'employee_name',
      'expected_amount', (item->>'total_payable')::numeric,
      'actual_amount', (item->>'paid_amount')::numeric,
      'diff_amount', (item->>'difference')::numeric,
      'message', CONCAT(item->>'employee_name', ' részére a kifizetett összeg (', (item->>'paid_amount'), ' Ft) meghaladja az előírt nettó bért (', (item->>'total_payable'), ' Ft).')
    )
  ), '[]'::jsonb)
  INTO v_discrepancies_list
  FROM jsonb_array_elements(v_employees_list) AS item
  WHERE (item->>'paid_amount')::numeric > (item->>'total_payable')::numeric;

  -- 5b. Határidőn túli kifizetetlen munkabér (Mt. 157. § - hó 10. után)
  IF CURRENT_DATE > v_payout_deadline THEN
    WITH unpaid_items AS (
      SELECT
        item->>'employee_name' AS emp_name,
        (item->>'total_payable')::numeric AS payable,
        (item->>'paid_amount')::numeric AS paid
      FROM jsonb_array_elements(v_employees_list) AS item
      WHERE (item->>'paid_amount')::numeric = 0 AND (item->>'total_payable')::numeric > 0
    )
    SELECT v_discrepancies_list || COALESCE(jsonb_agg(
      jsonb_build_object(
        'type', 'OVERDUE_PAYOUT',
        'severity', 'WARNING',
        'title', 'Kifizetetlen Munkabér (Határidő Lejárt)',
        'employee_name', emp_name,
        'expected_amount', payable,
        'actual_amount', paid,
        'diff_amount', -payable,
        'message', CONCAT(emp_name, ' munkabére (', payable, ' Ft) a kifizetési határidő (', v_payout_deadline, ') ellenére még nem került kifizetésre.')
      )
    ), '[]'::jsonb)
    INTO v_discrepancies_list
    FROM unpaid_items;
  END IF;

  -- 5c. Főkönyvi 471-es és Béranalitika eltérés (ha a bérfeladás Követel forgalma eltér a számfejtett nettótól)
  IF ABS(v_credit_471 - (v_total_net + v_total_commute)) > 1 AND v_cycle_record.id IS NOT NULL THEN
    v_discrepancies_list := v_discrepancies_list || jsonb_build_array(
      jsonb_build_object(
        'type', 'GL_PAYROLL_MISMATCH',
        'severity', 'CRITICAL',
        'title', 'Főkönyv 471 Előírás és Béranalitika Eltérés',
        'expected_amount', (v_total_net + v_total_commute),
        'actual_amount', v_credit_471,
        'diff_amount', (v_credit_471 - (v_total_net + v_total_commute)),
        'message', CONCAT('A főkönyvben előírt 471-es követel forgalom (', v_credit_471, ' Ft) eltér a bérszámfejtés szerinti nettó kifizetendő összegtől (', (v_total_net + v_total_commute), ' Ft). Hiányzó vagy nem egyező bérfeladás!')
      )
    );
  END IF;

  -- 6. Státusz megállapítása
  v_discrepancy_amount := v_closing_471;
  IF v_closing_471 = 0 AND (v_pending_count = 0 OR v_employee_count = 0) THEN
    v_status := 'BALANCED';
  ELSIF v_closing_471 < 0 THEN
    v_status := 'OVERPAID';
  ELSIF v_closing_471 > 0 AND CURRENT_DATE <= v_payout_deadline THEN
    v_status := 'PENDING_PAYOUT';
  ELSE
    v_status := 'MISMATCH';
  END IF;

  -- 7. Snapshot mentése/frissítése az accounty_payroll_reconciliations táblába
  INSERT INTO public.accounty_payroll_reconciliations (
    company_id, cycle_id, year, month,
    opening_balance, total_net_accrued, total_bank_paid, total_cash_paid,
    closing_balance, discrepancy_amount, status, audited_at, audited_by
  ) VALUES (
    p_company_id, v_cycle_record.id, p_year, p_month,
    v_opening_471, (v_total_net + v_total_commute), v_total_paid, 0,
    v_closing_471, v_discrepancy_amount, v_status, now(), auth.uid()
  )
  ON CONFLICT (company_id, year, month) DO UPDATE SET
    cycle_id = EXCLUDED.cycle_id,
    opening_balance = EXCLUDED.opening_balance,
    total_net_accrued = EXCLUDED.total_net_accrued,
    total_bank_paid = EXCLUDED.total_bank_paid,
    closing_balance = EXCLUDED.closing_balance,
    discrepancy_amount = EXCLUDED.discrepancy_amount,
    status = EXCLUDED.status,
    audited_at = now(),
    audited_by = auth.uid(),
    updated_at = now();

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'year', p_year,
    'month', p_month,
    'cycle', jsonb_build_object(
      'id', v_cycle_record.id,
      'status', v_cycle_record.status,
      'payout_deadline', v_payout_deadline
    ),
    'reconciliation', jsonb_build_object(
      'opening_balance', v_opening_471,
      'total_net_accrued', (v_total_net + v_total_commute),
      'credit_471', v_credit_471,
      'debit_471', v_debit_471,
      'total_paid', v_total_paid,
      'closing_balance', v_closing_471,
      'discrepancy_amount', v_discrepancy_amount,
      'is_balanced', (v_closing_471 = 0),
      'status', v_status
    ),
    'payroll_summary', jsonb_build_object(
      'employee_count', v_employee_count,
      'total_gross', v_total_gross,
      'total_net', v_total_net,
      'total_commute', v_total_commute,
      'total_szja', v_total_szja,
      'total_tb', v_total_tb,
      'total_szocho', v_total_szocho,
      'total_deductions', v_total_deductions
    ),
    'payout_stats', jsonb_build_object(
      'total_paid', v_total_paid,
      'paid_count', v_paid_count,
      'pending_count', v_pending_count,
      'discrepancy_count', v_discrepancy_count,
      'payout_ratio', CASE WHEN (v_total_net + v_total_commute) > 0 THEN ROUND((v_total_paid / (v_total_net + v_total_commute)) * 100, 1) ELSE 100 END
    ),
    'employees', v_employees_list,
    'discrepancies', v_discrepancies_list
  );
END;
$$;

-- 4. RPC: auto_match_payroll_bank_transactions
CREATE OR REPLACE FUNCTION public.auto_match_payroll_bank_transactions(
  p_company_id UUID,
  p_year INT,
  p_month INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle_id UUID;
  v_period_start DATE;
  v_search_start DATE;
  v_search_end DATE;
  v_calc RECORD;
  v_matched_count INT := 0;
  v_candidate RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Nincs jogosultsága a cég béradatainak módosításához';
  END IF;

  v_period_start := MAKE_DATE(p_year, p_month, 1);
  -- Keresési ablak: tárgyhó 20-tól következő hó 20-ig
  v_search_start := v_period_start + INTERVAL '19 days';
  v_search_end := v_period_start + INTERVAL '1 month + 20 days';

  SELECT id INTO v_cycle_id
    FROM public.accounty_payroll_cycles
   WHERE company_id = p_company_id AND year = p_year AND month = p_month
   LIMIT 1;

  IF v_cycle_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nincs bérszámfejtési ciklus a megadott időszakra', 'matched_count', 0);
  END IF;

  -- Dolgozói kalkulációk iterálása
  FOR v_calc IN (
    SELECT
      c.id AS calculation_id,
      c.cycle_id,
      emp.id AS employment_id,
      e.id AS employee_id,
      e.first_name,
      e.last_name,
      CONCAT(e.last_name, ' ', e.first_name) AS full_name,
      REPLACE(REPLACE(COALESCE(e.bank_account, ''), '-', ''), ' ', '') AS clean_account,
      REPLACE(COALESCE(e.iban, ''), ' ', '') AS clean_iban,
      (c.net_salary + COALESCE((c.metadata->>'travel_reimbursement')::numeric, 0)) AS expected_amount
    FROM public.accounty_payroll_calculations c
    JOIN public.accounty_employments emp ON c.employment_id = emp.id
    JOIN public.accounty_employees e ON emp.employee_id = e.id
    WHERE c.cycle_id = v_cycle_id
      AND NOT EXISTS (
        SELECT 1 FROM public.accounty_payroll_payout_matches pm
        WHERE pm.calculation_id = c.id AND pm.match_status = 'MATCHED'
      )
  ) LOOP
    v_candidate := NULL;

    -- Tier 1: IBAN / Számlaszám és összeg egyezés
    IF LENGTH(v_calc.clean_account) >= 8 OR LENGTH(v_calc.clean_iban) >= 15 THEN
      SELECT bt.id, ABS(bt.amount) AS matched_amount
        INTO v_candidate
        FROM public.bank_transactions bt
       WHERE bt.company_id = p_company_id
         AND bt.amount < 0
         AND bt.transaction_date >= v_search_start
         AND bt.transaction_date <= v_search_end
         AND (
           (LENGTH(v_calc.clean_account) >= 8 AND REPLACE(REPLACE(COALESCE(bt.counterparty_account, ''), '-', ''), ' ', '') LIKE '%' || v_calc.clean_account || '%')
           OR
           (LENGTH(v_calc.clean_iban) >= 15 AND REPLACE(COALESCE(bt.counterparty_account, ''), ' ', '') ILIKE '%' || v_calc.clean_iban || '%')
         )
         AND ABS(bt.amount) = v_calc.expected_amount
       LIMIT 1;

      IF v_candidate.id IS NOT NULL THEN
        INSERT INTO public.accounty_payroll_payout_matches (
          company_id, cycle_id, calculation_id, employee_id,
          bank_transaction_id, match_type, match_status,
          matched_amount, expected_amount, matched_by
        ) VALUES (
          p_company_id, v_cycle_id, v_calc.calculation_id, v_calc.employee_id,
          v_candidate.id, 'AUTO_IBAN', 'MATCHED',
          v_candidate.matched_amount, v_calc.expected_amount, auth.uid()
        )
        ON CONFLICT DO NOTHING;

        v_matched_count := v_matched_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Tier 2: Név és pontos összeg egyezés
    SELECT bt.id, ABS(bt.amount) AS matched_amount
      INTO v_candidate
      FROM public.bank_transactions bt
     WHERE bt.company_id = p_company_id
       AND bt.amount < 0
       AND bt.transaction_date >= v_search_start
       AND bt.transaction_date <= v_search_end
       AND ABS(bt.amount) = v_calc.expected_amount
       AND (
         bt.counterparty_name ILIKE '%' || v_calc.last_name || '%'
         AND bt.counterparty_name ILIKE '%' || v_calc.first_name || '%'
       )
     LIMIT 1;

    IF v_candidate.id IS NOT NULL THEN
      INSERT INTO public.accounty_payroll_payout_matches (
        company_id, cycle_id, calculation_id, employee_id,
        bank_transaction_id, match_type, match_status,
        matched_amount, expected_amount, matched_by
      ) VALUES (
        p_company_id, v_cycle_id, v_calc.calculation_id, v_calc.employee_id,
        v_candidate.id, 'AUTO_NAME', 'MATCHED',
        v_candidate.matched_amount, v_calc.expected_amount, auth.uid()
      )
      ON CONFLICT DO NOTHING;

      v_matched_count := v_matched_count + 1;
      CONTINUE;
    END IF;

  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'matched_count', v_matched_count,
    'cycle_id', v_cycle_id
  );
END;
$$;
