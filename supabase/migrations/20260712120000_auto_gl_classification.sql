-- 1. Segédfunkció az automatikus GL osztályozási munkák beütemezéséhez
CREATE OR REPLACE FUNCTION public.enqueue_auto_gl_classification(p_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_preset_id uuid;
BEGIN
  -- Kikeresük a cég aktív számlatükör sablonját (prioritás: egyedi custom sablon > generic beépített sablon)
  SELECT id INTO v_active_preset_id
  FROM public.chart_of_accounts_presets
  WHERE (company_id = p_company_id OR company_id IS NULL)
    AND is_active = true
  ORDER BY (company_id IS NULL) ASC, created_at DESC
  LIMIT 1;

  -- Csak akkor ütemezzük be, ha van aktív számlatükör sablon a céghez
  IF v_active_preset_id IS NOT NULL THEN
    -- Debouncing: csak akkor szúrunk be, ha jelenleg nincs még beütemezett vagy feldolgozás alatti GL munka a céghez
    IF NOT EXISTS (
      SELECT 1 FROM public.gl_upload_notifications
      WHERE company_id = p_company_id
        AND processing_status IN ('pending', 'processing')
    ) THEN
      INSERT INTO public.gl_upload_notifications (
        company_id,
        target_preset_id,
        processing_status,
        message
      ) VALUES (
        p_company_id,
        v_active_preset_id,
        'pending',
        'Automatikus háttér-besorolás (új tételek érkeztek)'
      );
    END IF;
  END IF;
END;
$$;

-- 2. Trigger és funkció a NAV számlákhoz (amikor beérkeznek a részletek/tételsorok)
CREATE OR REPLACE FUNCTION public.trg_nav_invoice_details_fetched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.details_fetched = true AND (TG_OP = 'INSERT' OR OLD.details_fetched IS NULL OR OLD.details_fetched = false) THEN
    PERFORM public.enqueue_auto_gl_classification(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_nav_invoice_details_fetched ON public.nav_invoices;
CREATE TRIGGER trg_on_nav_invoice_details_fetched
AFTER INSERT OR UPDATE ON public.nav_invoices
FOR EACH ROW
EXECUTE FUNCTION public.trg_nav_invoice_details_fetched();

-- 3. Trigger és funkció a manuális számlákhoz (amikor új tételsorokat szúrnak be)
CREATE OR REPLACE FUNCTION public.trg_invoice_items_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.invoices WHERE id = NEW.invoice_id;
  IF v_company_id IS NOT NULL THEN
    PERFORM public.enqueue_auto_gl_classification(v_company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_invoice_items_inserted ON public.invoice_items;
CREATE TRIGGER trg_on_invoice_items_inserted
AFTER INSERT ON public.invoice_items
FOR EACH ROW
EXECUTE FUNCTION public.trg_invoice_items_inserted();

-- 4. Trigger és funkció a banki tranzakciókhoz (amikor új tranzakciókat töltenek fel)
CREATE OR REPLACE FUNCTION public.trg_transactions_inserted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    PERFORM public.enqueue_auto_gl_classification(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_transactions_inserted ON public.transactions;
CREATE TRIGGER trg_on_transactions_inserted
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.trg_transactions_inserted();
