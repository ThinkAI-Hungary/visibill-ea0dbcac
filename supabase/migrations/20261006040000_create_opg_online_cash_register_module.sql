-- Migration: 20261006040000_create_opg_online_cash_register_module.sql
-- Description: Online Cash Register (OPG - Online Pénztárgép) core module tables, RLS, indexes and Petty Cash integration RPCs

-- ==============================================================================
-- 1. opg_cash_registers (Pénztárgépek törzsadat)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.opg_cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  ap_code text NOT NULL,                                           -- AP kód (pl. "A12345678")
  name text NOT NULL,                                              -- Megnevezés (pl. "Főpénztár - Recepció")
  location text,                                                   -- Telephely / Cím
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'error', 'disconnected')),
  petty_cash_register_id uuid REFERENCES public.petty_cash_registers(id) ON DELETE SET NULL, -- Hozzárendelt házipénztár
  cash_booking_mode text NOT NULL DEFAULT 'daily_z_summary' CHECK (cash_booking_mode IN ('daily_z_summary', 'itemized_receipt')),
  sync_interval_minutes integer NOT NULL DEFAULT 60,
  last_successful_sync_at timestamptz,
  last_failed_sync_at timestamptz,
  last_error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT uq_opg_cash_registers_company_ap UNIQUE (company_id, ap_code)
);

CREATE INDEX IF NOT EXISTS idx_opg_cash_registers_company ON public.opg_cash_registers(company_id);
CREATE INDEX IF NOT EXISTS idx_opg_cash_registers_status ON public.opg_cash_registers(status);
CREATE INDEX IF NOT EXISTS idx_opg_cash_registers_pcr ON public.opg_cash_registers(petty_cash_register_id);

-- ==============================================================================
-- 2. opg_transactions (Tranzakciók / Nyugták / Z-zárások)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.opg_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opg_id uuid NOT NULL REFERENCES public.opg_cash_registers(id) ON DELETE CASCADE,
  external_transaction_id text NOT NULL,                           -- NAV OPG / gép oldali egyedi azonosító (deduplikáció)
  receipt_number text NOT NULL,                                    -- Nyugtaszám / Bizonylatszám (pl. NY-2026/000123)
  transaction_date date NOT NULL,
  transaction_time time NOT NULL,
  transaction_type text NOT NULL DEFAULT 'receipt' CHECK (transaction_type IN ('receipt', 'simplified_invoice', 'z_report', 'storno', 'refund')),
  total_gross_amount numeric(15,2) NOT NULL DEFAULT 0,
  cash_amount numeric(15,2) NOT NULL DEFAULT 0,
  card_amount numeric(15,2) NOT NULL DEFAULT 0,
  szep_card_amount numeric(15,2) NOT NULL DEFAULT 0,
  voucher_amount numeric(15,2) NOT NULL DEFAULT 0,
  other_payment_amount numeric(15,2) NOT NULL DEFAULT 0,
  payment_method_breakdown jsonb NOT NULL DEFAULT '{"cash": 0, "card": 0, "szep_card": 0, "voucher": 0, "other": 0}'::jsonb,
  vat_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,                -- {"vat_27": {"net": 0, "vat": 0, "gross": 0}, ...}
  processing_status text NOT NULL DEFAULT 'new' CHECK (processing_status IN ('new', 'processed', 'error', 'skipped')),
  cash_entry_id uuid REFERENCES public.petty_cash_entries(id) ON DELETE SET NULL, -- Létrejött házipénztár tétel kapcsolata
  source_payload jsonb,                                            -- Eredeti nyers JSON válasz az auditálhatósághoz
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_opg_transactions_company_external UNIQUE (company_id, external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_opg_transactions_company_date ON public.opg_transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_opg_transactions_opg_date ON public.opg_transactions(opg_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_opg_transactions_status ON public.opg_transactions(company_id, processing_status);
CREATE INDEX IF NOT EXISTS idx_opg_transactions_cash_entry ON public.opg_transactions(cash_entry_id) WHERE cash_entry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opg_transactions_external_id ON public.opg_transactions(external_transaction_id);

-- ==============================================================================
-- 3. opg_sync_logs (Szinkronizációs és audit napló)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.opg_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opg_id uuid REFERENCES public.opg_cash_registers(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  period_from date,
  period_to date,
  records_fetched integer NOT NULL DEFAULT 0,
  records_new integer NOT NULL DEFAULT 0,
  records_duplicated integer NOT NULL DEFAULT 0,
  records_errors integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_message text,
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_opg_sync_logs_company_time ON public.opg_sync_logs(company_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_opg_sync_logs_opg ON public.opg_sync_logs(opg_id);

-- ==============================================================================
-- 4. Row Level Security (RLS)
-- ==============================================================================
ALTER TABLE public.opg_cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opg_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opg_sync_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- opg_cash_registers
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_cash_registers' AND policyname = 'Members can view opg_cash_registers') THEN
    CREATE POLICY "Members can view opg_cash_registers" ON public.opg_cash_registers
      FOR SELECT TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_cash_registers' AND policyname = 'Members can manage opg_cash_registers') THEN
    CREATE POLICY "Members can manage opg_cash_registers" ON public.opg_cash_registers
      FOR ALL TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())))
      WITH CHECK (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_cash_registers' AND policyname = 'Service role full access on opg_cash_registers') THEN
    CREATE POLICY "Service role full access on opg_cash_registers" ON public.opg_cash_registers
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- opg_transactions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_transactions' AND policyname = 'Members can view opg_transactions') THEN
    CREATE POLICY "Members can view opg_transactions" ON public.opg_transactions
      FOR SELECT TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_transactions' AND policyname = 'Members can manage opg_transactions') THEN
    CREATE POLICY "Members can manage opg_transactions" ON public.opg_transactions
      FOR ALL TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())))
      WITH CHECK (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_transactions' AND policyname = 'Service role full access on opg_transactions') THEN
    CREATE POLICY "Service role full access on opg_transactions" ON public.opg_transactions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  -- opg_sync_logs
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_sync_logs' AND policyname = 'Members can view opg_sync_logs') THEN
    CREATE POLICY "Members can view opg_sync_logs" ON public.opg_sync_logs
      FOR SELECT TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_sync_logs' AND policyname = 'Members can manage opg_sync_logs') THEN
    CREATE POLICY "Members can manage opg_sync_logs" ON public.opg_sync_logs
      FOR ALL TO authenticated
      USING (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())))
      WITH CHECK (company_id IN (SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'opg_sync_logs' AND policyname = 'Service role full access on opg_sync_logs') THEN
    CREATE POLICY "Service role full access on opg_sync_logs" ON public.opg_sync_logs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.opg_cash_registers TO authenticated, service_role;
GRANT ALL ON public.opg_transactions TO authenticated, service_role;
GRANT ALL ON public.opg_sync_logs TO authenticated, service_role;

-- ==============================================================================
-- 5. RPC: process_opg_transaction_to_petty_cash
-- Automatizált vagy manuális házipénztárba könyvelés OPG tételből
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_opg_transaction_to_petty_cash(p_transaction_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx record;
  v_opg record;
  v_target_register_id uuid;
  v_cash_entry_id uuid;
  v_amount numeric;
  v_description text;
BEGIN
  -- 1. Tranzakció adatok betöltése
  SELECT * INTO v_tx
  FROM public.opg_transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPG tranzakció nem található: %', p_transaction_id;
  END IF;

  -- Ha már könyvelve van, nem duplázzuk
  IF v_tx.cash_entry_id IS NOT NULL THEN
    RETURN v_tx.cash_entry_id;
  END IF;

  -- Készpénz összeg vizsgálat
  v_amount := COALESCE(v_tx.cash_amount, 0);
  IF v_amount = 0 THEN
    -- Nincs készpénz forgalom ebben a tételben (pl. tisztán bankkártyás), átugorjuk
    UPDATE public.opg_transactions
    SET processing_status = 'skipped',
        updated_at = now()
    WHERE id = p_transaction_id;
    RETURN NULL;
  END IF;

  -- Ha storno vagy visszáru, a pénzmozgás iránya ellenkező (kiadás a kasszából)
  IF v_tx.transaction_type IN ('storno', 'refund') AND v_amount > 0 THEN
    v_amount := -v_amount;
  END IF;

  -- 2. Pénztárgép adatok lekérése a hozzárendelt házipénztár azonosításához
  SELECT * INTO v_opg
  FROM public.opg_cash_registers
  WHERE id = v_tx.opg_id;

  v_target_register_id := v_opg.petty_cash_register_id;

  -- Ha nincs közvetlen hozzárendelt házipénztár, megpróbáljuk a cég alapértelmezettjét
  IF v_target_register_id IS NULL THEN
    SELECT id INTO v_target_register_id
    FROM public.petty_cash_registers
    WHERE company_id = v_tx.company_id AND is_default = true
    LIMIT 1;
  END IF;

  IF v_target_register_id IS NULL THEN
    -- Fallback: a cég első aktív házipénztára
    SELECT id INTO v_target_register_id
    FROM public.petty_cash_registers
    WHERE company_id = v_tx.company_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_target_register_id IS NULL THEN
    UPDATE public.opg_transactions
    SET processing_status = 'error',
        error_message = 'Nincs elérhető házipénztár a céghez rendelve a könyveléshez.',
        updated_at = now()
    WHERE id = p_transaction_id;
    RETURN NULL;
  END IF;

  -- Leírás összeállítása
  IF v_tx.transaction_type = 'z_report' THEN
    v_description := 'OPG Napi zárás (' || v_tx.receipt_number || ') - AP: ' || COALESCE(v_opg.ap_code, 'N/A');
  ELSIF v_tx.transaction_type = 'storno' THEN
    v_description := 'OPG Sztornó bizonylat (' || v_tx.receipt_number || ') - AP: ' || COALESCE(v_opg.ap_code, 'N/A');
  ELSIF v_tx.transaction_type = 'refund' THEN
    v_description := 'OPG Visszáru (' || v_tx.receipt_number || ') - AP: ' || COALESCE(v_opg.ap_code, 'N/A');
  ELSE
    v_description := 'OPG Nyugta készpénzbevétel (' || v_tx.receipt_number || ') - AP: ' || COALESCE(v_opg.ap_code, 'N/A');
  END IF;

  -- 3. Házipénztár tétel beszúrása
  INSERT INTO public.petty_cash_entries (
    company_id,
    register_id,
    entry_date,
    description,
    amount,
    currency,
    source_type,
    source_id,
    source_table,
    routed_by,
    created_at
  ) VALUES (
    v_tx.company_id,
    v_target_register_id,
    v_tx.transaction_date,
    v_description,
    v_amount,
    'HUF',
    'cash_sale',
    v_tx.id,
    'opg_transactions',
    'opg_auto',
    now()
  )
  RETURNING id INTO v_cash_entry_id;

  -- 4. OPG tranzakció frissítése
  UPDATE public.opg_transactions
  SET processing_status = 'processed',
      cash_entry_id = v_cash_entry_id,
      error_message = NULL,
      updated_at = now()
  WHERE id = p_transaction_id;

  RETURN v_cash_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.process_opg_transaction_to_petty_cash(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_opg_transaction_to_petty_cash(uuid) TO authenticated, service_role;

-- ==============================================================================
-- 6. RPC: process_pending_opg_transactions (Kötegelt feldolgozás)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_pending_opg_transactions(
  p_company_id uuid,
  p_opg_id uuid DEFAULT NULL
)
RETURNS TABLE (
  processed_count integer,
  skipped_count integer,
  error_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rec record;
  v_result uuid;
  v_processed integer := 0;
  v_skipped integer := 0;
  v_errors integer := 0;
BEGIN
  FOR v_rec IN
    SELECT t.id, t.cash_amount, r.cash_booking_mode, t.transaction_type
    FROM public.opg_transactions t
    JOIN public.opg_cash_registers r ON r.id = t.opg_id
    WHERE t.company_id = p_company_id
      AND t.processing_status = 'new'
      AND (p_opg_id IS NULL OR t.opg_id = p_opg_id)
    ORDER BY t.transaction_date ASC, t.transaction_time ASC
  LOOP
    -- Szűrés a pénztárgép könyvelési módja szerint:
    -- Ha daily_z_summary mód van beállítva, csak a Z-zárást könyveljük automatikusan a házipénztárba
    -- Ha itemized_receipt van beállítva, a nyugtákat könyveljük egyenként
    IF v_rec.cash_booking_mode = 'daily_z_summary' AND v_rec.transaction_type NOT IN ('z_report', 'storno', 'refund') THEN
      UPDATE public.opg_transactions
      SET processing_status = 'skipped',
          updated_at = now()
      WHERE id = v_rec.id;
      v_skipped := v_skipped + 1;
    ELSIF v_rec.cash_booking_mode = 'itemized_receipt' AND v_rec.transaction_type = 'z_report' THEN
      UPDATE public.opg_transactions
      SET processing_status = 'skipped',
          updated_at = now()
      WHERE id = v_rec.id;
      v_skipped := v_skipped + 1;
    ELSE
      BEGIN
        v_result := public.process_opg_transaction_to_petty_cash(v_rec.id);
        IF v_result IS NOT NULL THEN
          v_processed := v_processed + 1;
        ELSE
          v_skipped := v_skipped + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.opg_transactions
        SET processing_status = 'error',
            error_message = SQLERRM,
            updated_at = now()
        WHERE id = v_rec.id;
        v_errors := v_errors + 1;
      END;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_processed, v_skipped, v_errors;
END;
$$;

REVOKE ALL ON FUNCTION public.process_pending_opg_transactions(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_pending_opg_transactions(uuid, uuid) TO authenticated, service_role;
