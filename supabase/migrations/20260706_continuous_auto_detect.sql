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
