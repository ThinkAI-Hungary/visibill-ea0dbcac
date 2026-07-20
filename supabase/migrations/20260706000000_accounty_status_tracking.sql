-- ==================================================
-- MERGED FROM: 20260706_accounty_status_tracking.sql
-- ==================================================
-- Migration: Add last_computed_status to accounty_assignments
-- Required for: accounty-detect-missing client status change detection
-- Run this in Supabase SQL Editor BEFORE deploying the updated accounty-detect-missing function

-- Add the column (idempotent — won't fail if already exists)
ALTER TABLE accounty_assignments
  ADD COLUMN IF NOT EXISTS last_computed_status text DEFAULT 'Rendben';

-- Set initial status for existing assignments based on current missing items
UPDATE accounty_assignments aa
SET last_computed_status = CASE
  WHEN (SELECT count(*) FROM accounty_missing_items mi
        WHERE mi.company_id = aa.company_id
        AND mi.status IN ('open', 'notified')) > 3 THEN 'Kritikus'
  WHEN (SELECT count(*) FROM accounty_missing_items mi
        WHERE mi.company_id = aa.company_id
        AND mi.status IN ('open', 'notified')) > 0 THEN 'Feldolgozandó'
  ELSE 'Rendben'
END;

-- ═══════════════════════════════════════════════════════════════════
-- Email preferences: set ALL existing users to OFF (opt-in model)
-- Users can manually enable the ones they want in Settings → Értesítések
-- ═══════════════════════════════════════════════════════════════════

-- Change column defaults to false
ALTER TABLE accounty_email_preferences
  ALTER COLUMN missing_invoice_alert SET DEFAULT false,
  ALTER COLUMN deadline_reminder SET DEFAULT false,
  ALTER COLUMN client_status_change SET DEFAULT false,
  ALTER COLUMN approval_request SET DEFAULT false,
  ALTER COLUMN weekly_report SET DEFAULT false,
  ALTER COLUMN monthly_report SET DEFAULT false;

-- Reset all existing preferences to false
UPDATE accounty_email_preferences
SET
  missing_invoice_alert = false,
  deadline_reminder = false,
  client_status_change = false,
  approval_request = false,
  weekly_report = false,
  monthly_report = false;

-- Verify
SELECT company_id, last_computed_status, count(*) as assignment_count
FROM accounty_assignments
GROUP BY company_id, last_computed_status
ORDER BY last_computed_status;


-- ==================================================
-- MERGED FROM: 20260706_continuous_auto_detect.sql
-- ==================================================
-- ============================================================================
-- Folyamatos szolgáltatás auto-detekció — NAV lineDeliveryPeriod
-- ============================================================================
-- 1. nav_invoice_items: line_delivery_period_from/to oszlopok
-- 2. Trigger: nav_invoice_items INSERT/UPDATE → nav_invoices.is_continuous beállítás

-- ============================================================================
-- 1. nav_invoice_items — Új oszlopok a service period-hoz
-- ============================================================================

ALTER TABLE public.nav_invoice_items
  ADD COLUMN IF NOT EXISTS line_delivery_period_from DATE;

ALTER TABLE public.nav_invoice_items
  ADD COLUMN IF NOT EXISTS line_delivery_period_to DATE;

-- Index for quick lookup of items with delivery periods
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_delivery_period
  ON public.nav_invoice_items(nav_invoice_id)
  WHERE line_delivery_period_from IS NOT NULL;

-- ============================================================================
-- 2. Trigger function: auto-detect continuous service from line items
-- ============================================================================
-- When nav_invoice_items are inserted/updated with delivery period data,
-- auto-set the parent nav_invoice as continuous and populate service_period fields.

CREATE OR REPLACE FUNCTION public.auto_detect_continuous_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_has_period BOOLEAN;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Get the invoice ID from the affected row
  v_invoice_id := COALESCE(NEW.nav_invoice_id, OLD.nav_invoice_id);

  -- Check if any line item for this invoice has a delivery period
  SELECT
    bool_or(line_delivery_period_from IS NOT NULL AND line_delivery_period_to IS NOT NULL),
    MIN(line_delivery_period_from),
    MAX(line_delivery_period_to)
  INTO v_has_period, v_period_start, v_period_end
  FROM public.nav_invoice_items
  WHERE nav_invoice_id = v_invoice_id
    AND line_delivery_period_from IS NOT NULL;

  -- Update parent invoice
  IF v_has_period THEN
    UPDATE public.nav_invoices
    SET
      is_continuous = TRUE,
      service_period_start = COALESCE(service_period_start, v_period_start),
      service_period_end = COALESCE(service_period_end, v_period_end)
    WHERE id = v_invoice_id
      AND (is_continuous IS NULL OR is_continuous = FALSE);

    -- Recalculate TI if the function exists
    BEGIN
      PERFORM public.calculate_invoice_ti(v_invoice_id);
    EXCEPTION WHEN undefined_function THEN
      -- calculate_invoice_ti may not exist yet; skip silently
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger (drop first to be idempotent)
DROP TRIGGER IF EXISTS trg_auto_detect_continuous ON public.nav_invoice_items;

CREATE TRIGGER trg_auto_detect_continuous
  AFTER INSERT OR UPDATE OF line_delivery_period_from, line_delivery_period_to
  ON public.nav_invoice_items
  FOR EACH ROW
  WHEN (NEW.line_delivery_period_from IS NOT NULL)
  EXECUTE FUNCTION public.auto_detect_continuous_service();


-- ==================================================
-- MERGED FROM: 20260706_continuous_services.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260706_eaisybooks_cron_jobs.sql
-- ==================================================
-- ═══════════════════════════════════════════════════════════════════
-- eaisyBooks Cron Jobs
-- ═══════════════════════════════════════════════════════════════════
-- HASZNÁLAT: Másold be a teljes tartalmat a Supabase SQL Editorba.
-- FONTOS: A <CRON_SECRET_ACCOUNTY> helyére írd be a secretet (a <> jeleket is töröld)!
-- A secretet a Supabase Dashboard → Settings → Edge Functions → Secrets-ben találod.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Töröljük a régi eaisyBooks cron job-okat ha léteznek
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-detect-missing-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-check-deadlines-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-weekly-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-monthly-report');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('accounty-digest-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Hiányzó számla detektálás + ügyfél státusz változás — NAPONTA 5:00 CET
SELECT cron.schedule(
  'accounty-detect-missing-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-detect-missing',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 3. Határidő emlékeztető — NAPONTA 7:00 CET
SELECT cron.schedule(
  'accounty-check-deadlines-daily',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/accounty-check-deadlines',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Heti portfólió riport — HÉTFŐ 8:00 CET
SELECT cron.schedule(
  'accounty-weekly-report',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-weekly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 5. Havi portfólió riport — HÓNAP 1. 8:00 CET
SELECT cron.schedule(
  'accounty-monthly-report',
  '0 6 1 * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-monthly-report',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 6. Új Digest funkció (óránként fut, de csak annak küld, akinek akkor kell)
SELECT cron.schedule(
  'accounty-digest-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/send-accounty-digest',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "<CRON_SECRET_ACCOUNTY>"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);


-- ==================================================
-- MERGED FROM: 20260706_fx_gl_account_mapping.sql
-- ==================================================
-- Migration: Add FX GL account mapping columns to company_fx_settings
-- This allows accountants to configure which GL numbers receive FX gains and losses.

ALTER TABLE public.company_fx_settings
  ADD COLUMN IF NOT EXISTS fx_gain_gl_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fx_loss_gl_number text DEFAULT NULL;

COMMENT ON COLUMN public.company_fx_settings.fx_gain_gl_number
  IS 'GL account number for FX gains (e.g. 976). Editable by accountant.';
COMMENT ON COLUMN public.company_fx_settings.fx_loss_gl_number
  IS 'GL account number for FX losses (e.g. 876). Editable by accountant.';


-- ==================================================
-- MERGED FROM: 20260706_fx_inject_into_gl.sql
-- ==================================================
-- Migration: Inject FX differences into GL balances and categorized items
-- This adds a ⑥ UNION ALL branch so that FX gain/loss amounts appear in the
-- general ledger, mapped to the GL numbers configured in company_fx_settings.

-- ─── 1. Recreate get_gl_balances with FX branch ──────────────────────────
DROP FUNCTION IF EXISTS public.get_gl_balances(uuid, uuid, date, date, jsonb);

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
SET search_path TO 'public'
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
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )

    UNION ALL

    -- ④ Imported XML journal entries — DEBIT side (Tartozik = positive)
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

    UNION ALL

    -- ⑥ FX differences (árfolyamkülönbözet) — mapped via company_fx_settings
    SELECT
      fd.invoice_id AS item_id,
      fd.fx_difference AS amount,
      best_fx.id AS mapped_id
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


-- ─── 2. Recreate get_gl_categorized_items with FX branch ────────────────
DROP FUNCTION IF EXISTS public.get_gl_categorized_items(uuid, uuid, date, date, jsonb);

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
  item_date text,
  is_temporary boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
      t.transaction_date::text AS item_date,
      false AS is_temporary
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
      i.kibocsatas_datuma::text AS item_date,
      false AS is_temporary
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
      COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::text AS item_date,
      true AS is_temporary
    FROM public.nav_invoice_items ni
    JOIN public.nav_invoices n ON ni.nav_invoice_id = n.id
    WHERE n.company_id = p_company_id
      AND (p_date_from IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date >= p_date_from)
      AND (p_date_to IS NULL OR COALESCE(n.invoice_issue_date, n.invoice_delivery_date, n.created_at)::date <= p_date_to)
      AND NOT EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.company_id = n.company_id
          AND REPLACE(LOWER(i.bizonylatsorszam), ' ', '') = REPLACE(LOWER(n.invoice_number), ' ', '')
      )

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
      je.voucher_date::text AS item_date,
      false AS is_temporary
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
      je.voucher_date::text AS item_date,
      false AS is_temporary
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

    UNION ALL

    -- ⑥ FX differences (árfolyamkülönbözet)
    SELECT
      fd.invoice_id AS item_id,
      best_fx.id AS mapped_id,
      'fx_difference'::text AS source_table,
      CASE WHEN fd.fx_difference >= 0
        THEN 'Árfolyamnyereség'::text
        ELSE 'Árfolyamveszteség'::text
      END AS item_type,
      fd.partner_name::text AS partner,
      fd.invoice_number::text AS description,
      fd.fx_difference AS amount,
      fd.fx_difference::numeric AS original_amount,
      'HUF'::text AS original_currency,
      fd.settlement_date::text AS item_date,
      false AS is_temporary
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
    r.item_date,
    r.is_temporary
  FROM raw_items r
  LEFT JOIN public.gl_accounts active_g 
         ON r.mapped_id = active_g.id 
        AND active_g.preset_id = p_preset_id;
END;
$$;


-- ─── 3. Grant permissions ────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_balances(uuid, uuid, date, date, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_gl_categorized_items(uuid, uuid, date, date, jsonb) TO authenticated;
