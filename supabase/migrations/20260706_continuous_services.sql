-- ============================================================================
-- Folyamatos szolgáltatás (Continuous Services) — Áfa tv. 58.§
-- ============================================================================
-- 1. nav_invoices bővítés: is_continuous, service_period, TI mezők
-- 2. accrual_entries tábla: időbeli elhatárolási javaslatok
-- 3. calculate_invoice_ti RPC: TI heurisztika
-- 4. generate_accrual_proposals RPC: elhatárolási javaslat generálás
-- 5. Auto-detect: trigger a NAV sync-ből érkező service period adatokra

-- ============================================================================
-- 1. nav_invoices — Új oszlopok
-- ============================================================================

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS is_continuous BOOLEAN DEFAULT FALSE;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS service_period_start DATE;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS service_period_end DATE;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS calculated_ti DATE;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS ti_override DATE;

ALTER TABLE public.nav_invoices
  ADD COLUMN IF NOT EXISTS ti_calculation_method TEXT;

-- Index for continuous service queries
CREATE INDEX IF NOT EXISTS idx_nav_invoices_continuous
  ON public.nav_invoices(company_id)
  WHERE is_continuous = true;

-- ============================================================================
-- 2. accrual_entries — Időbeli elhatárolási tételek
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accrual_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  preset_id UUID NOT NULL,
  invoice_id UUID REFERENCES public.nav_invoices(id) ON DELETE CASCADE,
  accrual_type TEXT NOT NULL CHECK (accrual_type IN ('AIE', 'PIE')),
  accrual_date DATE NOT NULL,
  reversal_date DATE,
  amount NUMERIC NOT NULL,
  gl_debit TEXT NOT NULL,
  gl_credit TEXT NOT NULL,
  status TEXT DEFAULT 'proposed' CHECK (status IN ('proposed', 'booked', 'reversed')),
  booked_journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.accrual_entries ENABLE ROW LEVEL SECURITY;

-- RLS policy — users can view entries for their own companies
CREATE POLICY "Users can view accrual entries for own companies"
  ON public.accrual_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accrual_entries.company_id
      AND c.owner_id = auth.uid()
    )
  );

-- RLS policy — users can manage entries for own companies
CREATE POLICY "Users can manage accrual entries for own companies"
  ON public.accrual_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = accrual_entries.company_id
      AND c.owner_id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role can manage accrual entries"
  ON public.accrual_entries
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accrual_entries_company
  ON public.accrual_entries(company_id, accrual_date);

CREATE INDEX IF NOT EXISTS idx_accrual_entries_invoice
  ON public.accrual_entries(invoice_id);

-- ============================================================================
-- 3. calculate_invoice_ti — TI heurisztika (3-lépéses)
-- ============================================================================
-- Logika:
--   1. Ha van service_period_end → TI = service_period_end
--   2. Ha van payment_date → TI = payment_date
--   3. Egyéb: TI = invoice_delivery_date (vagy invoice_issue_date)

CREATE OR REPLACE FUNCTION public.calculate_invoice_ti(
  p_invoice_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice RECORD;
  v_ti DATE;
  v_method TEXT;
  v_is_continuous BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_invoice
  FROM public.nav_invoices
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Invoice not found');
  END IF;

  -- Detect continuous service
  -- A) Has service period → continuous
  IF v_invoice.service_period_start IS NOT NULL AND v_invoice.service_period_end IS NOT NULL THEN
    v_is_continuous := TRUE;
  END IF;

  -- Calculate TI with 3-step heuristic
  IF v_invoice.ti_override IS NOT NULL THEN
    -- Manual override takes priority
    v_ti := v_invoice.ti_override;
    v_method := 'manual';
  ELSIF v_invoice.service_period_end IS NOT NULL THEN
    -- Step 1: NAV service period end
    v_ti := v_invoice.service_period_end;
    v_method := 'nav_period_end';
  ELSIF v_invoice.payment_date IS NOT NULL AND v_is_continuous THEN
    -- Step 2: Payment due date (only for continuous services)
    v_ti := v_invoice.payment_date;
    v_method := 'payment_due';
  ELSE
    -- Step 3: Fallback to delivery date or issue date
    v_ti := COALESCE(v_invoice.invoice_delivery_date, v_invoice.invoice_issue_date);
    v_method := 'delivery_date';
  END IF;

  -- Update the invoice
  UPDATE public.nav_invoices
  SET
    is_continuous = v_is_continuous,
    calculated_ti = v_ti,
    ti_calculation_method = v_method
  WHERE id = p_invoice_id;

  RETURN json_build_object(
    'invoice_id', p_invoice_id,
    'calculated_ti', v_ti,
    'method', v_method,
    'is_continuous', v_is_continuous,
    'service_period_start', v_invoice.service_period_start,
    'service_period_end', v_invoice.service_period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_invoice_ti(UUID) TO authenticated, service_role;

-- ============================================================================
-- 4. generate_accrual_proposals — Elhatárolási javaslat generálás
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_accrual_proposals(
  p_company_id UUID,
  p_preset_id UUID,
  p_period_year INTEGER,
  p_period_month INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_period_start DATE;
  v_period_end DATE;
  v_invoice RECORD;
  v_total_days INTEGER;
  v_days_in_period INTEGER;
  v_accrual_amount NUMERIC;
  v_accrual_type TEXT;
  v_proposals_count INTEGER := 0;
  v_proposals JSON[];
BEGIN
  -- Calculate period boundaries
  v_period_start := make_date(p_period_year, p_period_month, 1);
  v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;

  -- Find continuous invoices whose service period overlaps with the target period
  FOR v_invoice IN
    SELECT
      ni.id,
      ni.invoice_number,
      ni.service_period_start,
      ni.service_period_end,
      ni.invoice_net_amount,
      ni.invoice_issue_date,
      COALESCE(ni.supplier_name, ni.customer_name) AS partner_name
    FROM public.nav_invoices ni
    WHERE ni.company_id = p_company_id
      AND ni.is_continuous = TRUE
      AND ni.service_period_start IS NOT NULL
      AND ni.service_period_end IS NOT NULL
      -- Service period must span beyond the target period (otherwise no accrual needed)
      AND (
        -- Service period starts before period end AND ends after period start (overlap)
        ni.service_period_start <= v_period_end
        AND ni.service_period_end >= v_period_start
        -- But doesn't fully fit within the period
        AND NOT (ni.service_period_start >= v_period_start AND ni.service_period_end <= v_period_end)
      )
      -- Skip invoices that already have a booked accrual for this period
      AND NOT EXISTS (
        SELECT 1 FROM public.accrual_entries ae
        WHERE ae.invoice_id = ni.id
          AND ae.accrual_date >= v_period_start
          AND ae.accrual_date <= v_period_end
          AND ae.status IN ('booked', 'proposed')
      )
  LOOP
    -- Calculate time-apportioned amount
    v_total_days := v_invoice.service_period_end - v_invoice.service_period_start + 1;
    
    IF v_total_days <= 0 THEN
      CONTINUE;
    END IF;

    -- Calculate overlap days with this period
    v_days_in_period := LEAST(v_invoice.service_period_end, v_period_end) 
                       - GREATEST(v_invoice.service_period_start, v_period_start) + 1;

    IF v_days_in_period <= 0 THEN
      CONTINUE;
    END IF;

    -- Proportional amount for this period
    v_accrual_amount := ROUND(
      COALESCE(v_invoice.invoice_net_amount, 0) * v_days_in_period::numeric / v_total_days::numeric,
      2
    );

    IF v_accrual_amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Determine accrual type:
    -- AIE (Aktív Időbeli Elhatárolás): Service already received, invoice not yet in period
    --   → We got the service this period but the cost belongs to a future period
    -- PIE (Passzív Időbeli Elhatárolás): Cost recorded, but service extends beyond period
    IF v_invoice.invoice_issue_date <= v_period_end THEN
      -- Invoice issued in/before this period, but service extends beyond → AIE
      v_accrual_type := 'AIE';
    ELSE
      -- Invoice not yet issued, but service started in this period → PIE
      v_accrual_type := 'PIE';
    END IF;

    -- Insert proposal
    INSERT INTO public.accrual_entries (
      company_id, preset_id, invoice_id, accrual_type,
      accrual_date, reversal_date, amount, gl_debit, gl_credit, status
    ) VALUES (
      p_company_id,
      p_preset_id,
      v_invoice.id,
      v_accrual_type,
      v_period_end,  -- Accrue at period end
      (v_period_end + INTERVAL '1 day')::date,  -- Reverse on first day of next period
      v_accrual_amount,
      CASE v_accrual_type WHEN 'AIE' THEN '391' ELSE '519' END,
      CASE v_accrual_type WHEN 'AIE' THEN '529' ELSE '481' END,
      'proposed'
    );

    v_proposals_count := v_proposals_count + 1;
    v_proposals := array_append(v_proposals, json_build_object(
      'invoice_id', v_invoice.id,
      'invoice_number', v_invoice.invoice_number,
      'partner_name', v_invoice.partner_name,
      'type', v_accrual_type,
      'amount', v_accrual_amount,
      'days_in_period', v_days_in_period,
      'total_days', v_total_days
    ));
  END LOOP;

  RETURN json_build_object(
    'proposals_count', v_proposals_count,
    'period', v_period_year || '-' || lpad(p_period_month::text, 2, '0'),
    'proposals', COALESCE(array_to_json(v_proposals), '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_accrual_proposals(UUID, UUID, INTEGER, INTEGER) TO authenticated, service_role;

-- ============================================================================
-- 5. get_filtered_nav_invoices — is_continuous + TI mezők hozzáadása
-- ============================================================================

-- Drop old overload first
DROP FUNCTION IF EXISTS public.get_filtered_nav_invoices(
  uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid
);

CREATE OR REPLACE FUNCTION public.get_filtered_nav_invoices(
  p_company_id uuid,
  p_date_from date,
  p_date_to date,
  p_direction text,
  p_search text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_paid text DEFAULT NULL,
  p_submitted text DEFAULT NULL,
  p_project_id text DEFAULT NULL,
  p_category_id text DEFAULT NULL,
  p_payment_method text DEFAULT NULL,
  p_amount_min numeric DEFAULT NULL,
  p_amount_max numeric DEFAULT NULL,
  p_sort_field text DEFAULT 'invoice_issue_date',
  p_sort_dir text DEFAULT 'desc',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50,
  p_issue_date_from date DEFAULT NULL,
  p_issue_date_to date DEFAULT NULL,
  p_preset_id uuid DEFAULT NULL,
  p_continuous text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  invoice_number text,
  invoice_direction text,
  invoice_issue_date date,
  invoice_delivery_date date,
  supplier_tax_number text,
  supplier_name text,
  supplier_address text,
  customer_tax_number text,
  customer_name text,
  customer_address text,
  invoice_net_amount numeric,
  invoice_gross_amount numeric,
  invoice_vat_amount numeric,
  currency text,
  payment_method text,
  invoice_operation text,
  payment_date date,
  paid boolean,
  submitted boolean,
  details_fetched boolean,
  company_id uuid,
  user_id uuid,
  created_at timestamptz,
  fetched_at timestamptz,
  project_id uuid,
  category_id uuid,
  transaction_id uuid,
  exclude_from_accounting boolean,
  gl_numbers text,
  is_continuous boolean,
  service_period_start date,
  service_period_end date,
  calculated_ti date,
  ti_override date,
  ti_calculation_method text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preset_id uuid;
BEGIN
  -- Resolve preset: use p_preset_id, fallback to active custom preset, fallback to generic preset
  IF p_preset_id IS NULL THEN
    SELECT cp.id INTO v_preset_id
    FROM public.chart_of_accounts_presets cp
    WHERE cp.company_id = p_company_id AND cp.is_active = true
    LIMIT 1;

    IF v_preset_id IS NULL THEN
      SELECT cp.id INTO v_preset_id
      FROM public.chart_of_accounts_presets cp
      WHERE cp.type = 'generic'
      LIMIT 1;
    END IF;
  ELSE
    v_preset_id := p_preset_id;
  END IF;

  RETURN QUERY
  SELECT
    ni.id, ni.invoice_number, ni.invoice_direction,
    ni.invoice_issue_date, ni.invoice_delivery_date,
    ni.supplier_tax_number, ni.supplier_name, ni.supplier_address,
    ni.customer_tax_number, ni.customer_name, ni.customer_address,
    ni.invoice_net_amount, ni.invoice_gross_amount, ni.invoice_vat_amount,
    ni.currency, ni.payment_method, ni.invoice_operation,
    ni.payment_date, ni.paid, ni.submitted, ni.details_fetched,
    ni.company_id, ni.user_id, ni.created_at, ni.fetched_at,
    ni.project_id, ni.category_id, ni.transaction_id,
    ni.exclude_from_accounting,
    (
      SELECT string_agg(DISTINCT g.gl_number, ', ')
      FROM public.nav_invoice_items nii
      JOIN public.gl_accounts g ON g.id = (
        CASE WHEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' 
        THEN (nii.gl_classifications -> (v_preset_id::text) ->> 'gl_account_id')::uuid 
        ELSE NULL END
      )
      WHERE nii.nav_invoice_id = ni.id
    ) AS gl_numbers,
    ni.is_continuous,
    ni.service_period_start,
    ni.service_period_end,
    ni.calculated_ti,
    ni.ti_override,
    ni.ti_calculation_method,
    count(*) OVER()::bigint AS total_count
  FROM nav_invoices ni
  WHERE ni.company_id = p_company_id
    AND ni.invoice_direction = p_direction
    AND ni.invoice_issue_date >= p_date_from
    AND ni.invoice_issue_date <= p_date_to
    AND (p_issue_date_from IS NULL OR ni.invoice_issue_date >= p_issue_date_from)
    AND (p_issue_date_to IS NULL OR ni.invoice_issue_date <= p_issue_date_to)
    AND (p_search IS NULL OR p_search = '' OR (
      ni.invoice_number ILIKE '%' || p_search || '%'
      OR ni.supplier_name ILIKE '%' || p_search || '%'
      OR ni.customer_name ILIKE '%' || p_search || '%'
      OR ni.supplier_tax_number ILIKE '%' || p_search || '%'
      OR ni.customer_tax_number ILIKE '%' || p_search || '%'
      OR ni.invoice_gross_amount::text ILIKE '%' || p_search || '%'
      OR ni.invoice_net_amount::text ILIKE '%' || p_search || '%'
    ))
    AND (p_currency IS NULL OR p_currency = 'all' OR ni.currency = p_currency)
    AND (p_paid IS NULL OR p_paid = 'all'
      OR (p_paid = 'yes' AND ni.transaction_id IS NOT NULL)
      OR (p_paid = 'no' AND ni.transaction_id IS NULL))
    AND (p_submitted IS NULL OR p_submitted = 'all'
      OR (p_submitted = 'yes' AND ni.submitted = true)
      OR (p_submitted = 'no' AND (ni.submitted IS NULL OR ni.submitted = false)))
    AND (p_project_id IS NULL OR p_project_id = 'all'
      OR (p_project_id = 'none' AND ni.project_id IS NULL)
      OR ni.project_id = p_project_id::uuid)
    AND (p_category_id IS NULL OR p_category_id = 'all'
      OR (p_category_id = 'none' AND ni.category_id IS NULL)
      OR ni.category_id = p_category_id::uuid)
    AND (p_payment_method IS NULL OR p_payment_method = 'all'
      OR (p_payment_method = 'none' AND ni.payment_method IS NULL)
      OR ni.payment_method = p_payment_method)
    AND (p_amount_min IS NULL OR COALESCE(ni.invoice_gross_amount, 0) >= p_amount_min)
    AND (p_amount_max IS NULL OR COALESCE(ni.invoice_gross_amount, 0) <= p_amount_max)
    -- NEW: Continuous service filter
    AND (p_continuous IS NULL OR p_continuous = 'all'
      OR (p_continuous = 'yes' AND ni.is_continuous = true)
      OR (p_continuous = 'no' AND (ni.is_continuous IS NULL OR ni.is_continuous = false)))
  ORDER BY
    CASE WHEN p_sort_dir = 'asc' THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END ASC NULLS LAST,
    CASE WHEN p_sort_dir = 'desc' OR p_sort_dir IS NULL THEN
      CASE p_sort_field
        WHEN 'invoice_issue_date' THEN ni.invoice_issue_date::text
        WHEN 'invoice_delivery_date' THEN ni.invoice_delivery_date::text
        WHEN 'invoice_number' THEN ni.invoice_number
        WHEN 'invoice_net_amount' THEN lpad(COALESCE(ni.invoice_net_amount, 0)::text, 20, '0')
        WHEN 'invoice_gross_amount' THEN lpad(COALESCE(ni.invoice_gross_amount, 0)::text, 20, '0')
        WHEN 'invoice_vat_amount' THEN lpad(COALESCE(ni.invoice_vat_amount, 0)::text, 20, '0')
        WHEN 'partner_name' THEN COALESCE(
          CASE WHEN p_direction = 'INBOUND' THEN ni.supplier_name ELSE ni.customer_name END, '')
        ELSE ni.invoice_issue_date::text
      END
    END DESC NULLS LAST
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text) TO authenticated, service_role;

-- ============================================================================
-- 6. book_accrual_entry — Elhatárolás könyvelése
-- ============================================================================

CREATE OR REPLACE FUNCTION public.book_accrual_entry(
  p_accrual_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  SELECT * INTO v_entry
  FROM public.accrual_entries
  WHERE id = p_accrual_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Accrual entry not found');
  END IF;

  IF v_entry.status != 'proposed' THEN
    RETURN json_build_object('error', 'Only proposed entries can be booked');
  END IF;

  UPDATE public.accrual_entries
  SET status = 'booked'
  WHERE id = p_accrual_id;

  RETURN json_build_object(
    'success', true,
    'accrual_id', p_accrual_id,
    'status', 'booked'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.book_accrual_entry(UUID) TO authenticated, service_role;

-- ============================================================================
-- 7. reverse_accrual_entry — Elhatárolás visszafordítása
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_accrual_entry(
  p_accrual_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  SELECT * INTO v_entry
  FROM public.accrual_entries
  WHERE id = p_accrual_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Accrual entry not found');
  END IF;

  IF v_entry.status != 'booked' THEN
    RETURN json_build_object('error', 'Only booked entries can be reversed');
  END IF;

  UPDATE public.accrual_entries
  SET status = 'reversed'
  WHERE id = p_accrual_id;

  RETURN json_build_object(
    'success', true,
    'accrual_id', p_accrual_id,
    'status', 'reversed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_accrual_entry(UUID) TO authenticated, service_role;

-- ============================================================================
-- 8. toggle_invoice_continuous — Manuális toggle
-- ============================================================================

CREATE OR REPLACE FUNCTION public.toggle_invoice_continuous(
  p_invoice_id UUID,
  p_is_continuous BOOLEAN,
  p_service_period_start DATE DEFAULT NULL,
  p_service_period_end DATE DEFAULT NULL,
  p_ti_override DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ti DATE;
  v_method TEXT;
BEGIN
  -- Update the is_continuous flag and optional period/override
  UPDATE public.nav_invoices
  SET
    is_continuous = p_is_continuous,
    service_period_start = COALESCE(p_service_period_start, service_period_start),
    service_period_end = COALESCE(p_service_period_end, service_period_end),
    ti_override = p_ti_override
  WHERE id = p_invoice_id;

  -- Recalculate TI
  PERFORM public.calculate_invoice_ti(p_invoice_id);

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'is_continuous', p_is_continuous
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_invoice_continuous(UUID, BOOLEAN, DATE, DATE, DATE) TO authenticated, service_role;
