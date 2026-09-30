-- ==============================================================================
-- Migration: 20260928120000_periodic_cash_reports_schema.sql
-- Description: Időszaki Pénztárjelentés (Periodic Cash Report) és Házipénztár Modul
--              törvényi megfelelőségű (Sztv. 165–168. §) bővítése:
--              1. petty_cash_registers szabályzati paraméterek
--              2. cash_reports tábla (pénztárjelentések állapotgéppel)
--              3. cash_receipts tábla (szigorú számadású BPB/KPB bizonylatok)
--              4. denomination_sheets tábla (címletjegyzékek)
--              5. cash_closing_protocols tábla (zárási jegyzőkönyvek)
--              6. petty_cash_entries tétel-kapcsolatok (cash_report_id, line_no, storno)
--              7. RLS szabályok és teljesítmény indexek
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Bővítések a petty_cash_registers táblában (Pénztár szabályzati paraméterek)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.petty_cash_registers
  ADD COLUMN IF NOT EXISTS closing_mode text NOT NULL DEFAULT 'monthly'
    CHECK (closing_mode IN ('daily', 'weekly', 'decade', 'monthly', 'custom')),
  ADD COLUMN IF NOT EXISTS custom_days integer DEFAULT 30,
  ADD COLUMN IF NOT EXISTS cash_limit numeric NOT NULL DEFAULT 1500000,
  ADD COLUMN IF NOT EXISTS limit_action text NOT NULL DEFAULT 'warn'
    CHECK (limit_action IN ('warn', 'block')),
  ADD COLUMN IF NOT EXISTS receipt_policy text NOT NULL DEFAULT 'when_no_document'
    CHECK (receipt_policy IN ('always', 'when_no_document')),
  ADD COLUMN IF NOT EXISTS approval_threshold numeric DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS gl_account text NOT NULL DEFAULT '381',
  ADD COLUMN IF NOT EXISTS is_single_person_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cashier_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS controller_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.petty_cash_registers.closing_mode IS 'Zárási gyakoriság: daily, weekly, decade, monthly, custom';
COMMENT ON COLUMN public.petty_cash_registers.cash_limit IS 'Pénzkezelési szabályzat szerinti keretösszeg (Ft)';
COMMENT ON COLUMN public.petty_cash_registers.receipt_policy IS 'BPB/KPB kiállítási szabály: always vagy when_no_document';
COMMENT ON COLUMN public.petty_cash_registers.is_single_person_mode IS 'Egyszemélyes mód engedélyezése (pénztáros = ellenőr)';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. cash_reports tábla (Pénztárjelentések)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  seq_no integer,
  report_number text,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closing', 'closed', 'posted', 'reopened')),
  opening_balance numeric NOT NULL DEFAULT 0,
  total_in numeric NOT NULL DEFAULT 0,
  total_out numeric NOT NULL DEFAULT 0,
  closing_balance_book numeric NOT NULL DEFAULT 0,
  closing_balance_actual numeric,
  difference numeric,
  currency text NOT NULL DEFAULT 'HUF',
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  content_hash text,
  version integer NOT NULL DEFAULT 1,
  pdf_document_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexek cash_reports
CREATE INDEX IF NOT EXISTS idx_cash_reports_company ON public.cash_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_reports_register ON public.cash_reports(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_reports_status ON public.cash_reports(company_id, cash_register_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_reports_dates ON public.cash_reports(company_id, period_start, period_end);

-- RLS cash_reports
ALTER TABLE public.cash_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view cash_reports" ON public.cash_reports;
CREATE POLICY "Members can view cash_reports"
  ON public.cash_reports FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can insert cash_reports" ON public.cash_reports;
CREATE POLICY "Members can insert cash_reports"
  ON public.cash_reports FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can update cash_reports" ON public.cash_reports;
CREATE POLICY "Members can update cash_reports"
  ON public.cash_reports FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can delete cash_reports" ON public.cash_reports;
CREATE POLICY "Members can delete cash_reports"
  ON public.cash_reports FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. cash_receipts tábla (BPB / KPB szigorú számadású pénztárbizonylatok)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_register_id uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  cash_entry_id uuid, -- FK később köthető a körkörös függőség elkerülésére
  receipt_type text NOT NULL CHECK (receipt_type IN ('in', 'out')),
  seq_no integer NOT NULL,
  receipt_number text NOT NULL,
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  payer_or_payee_name text,
  payer_or_payee_address text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'HUF',
  amount_in_words text NOT NULL,
  legal_title text,
  description text,
  attachments jsonb DEFAULT '[]'::jsonb,
  is_cancelled boolean NOT NULL DEFAULT false,
  cancellation_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexek cash_receipts
CREATE INDEX IF NOT EXISTS idx_cash_receipts_company ON public.cash_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_register ON public.cash_receipts(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_number ON public.cash_receipts(company_id, receipt_number);
CREATE INDEX IF NOT EXISTS idx_cash_receipts_entry ON public.cash_receipts(cash_entry_id) WHERE cash_entry_id IS NOT NULL;

-- RLS cash_receipts
ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view cash_receipts" ON public.cash_receipts;
CREATE POLICY "Members can view cash_receipts"
  ON public.cash_receipts FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can insert cash_receipts" ON public.cash_receipts;
CREATE POLICY "Members can insert cash_receipts"
  ON public.cash_receipts FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can update cash_receipts" ON public.cash_receipts;
CREATE POLICY "Members can update cash_receipts"
  ON public.cash_receipts FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can delete cash_receipts" ON public.cash_receipts;
CREATE POLICY "Members can delete cash_receipts"
  ON public.cash_receipts FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. denomination_sheets tábla (Címletjegyzékek)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.denomination_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_report_id uuid NOT NULL REFERENCES public.cash_reports(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'HUF',
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric NOT NULL DEFAULT 0,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexek denomination_sheets
CREATE INDEX IF NOT EXISTS idx_denomination_sheets_report ON public.denomination_sheets(cash_report_id);
CREATE INDEX IF NOT EXISTS idx_denomination_sheets_company ON public.denomination_sheets(company_id);

-- RLS denomination_sheets
ALTER TABLE public.denomination_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view denomination_sheets" ON public.denomination_sheets;
CREATE POLICY "Members can view denomination_sheets"
  ON public.denomination_sheets FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can insert denomination_sheets" ON public.denomination_sheets;
CREATE POLICY "Members can insert denomination_sheets"
  ON public.denomination_sheets FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can update denomination_sheets" ON public.denomination_sheets;
CREATE POLICY "Members can update denomination_sheets"
  ON public.denomination_sheets FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can delete denomination_sheets" ON public.denomination_sheets;
CREATE POLICY "Members can delete denomination_sheets"
  ON public.denomination_sheets FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. cash_closing_protocols tábla (Zárási jegyzőkönyvek)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cash_closing_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cash_report_id uuid NOT NULL REFERENCES public.cash_reports(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  book_balance numeric NOT NULL,
  actual_balance numeric NOT NULL,
  difference numeric NOT NULL DEFAULT 0,
  difference_reason text,
  action text CHECK (action IS NULL OR action IN ('cashier_repays', 'booked_as_shortage', 'booked_as_surplus', 'pending_investigation')),
  balancing_entry_id uuid, -- FK később
  cashier_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cashier_signed_at timestamptz,
  controller_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  controller_signed_at timestamptz,
  is_single_person boolean NOT NULL DEFAULT false,
  notes text,
  pdf_document_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexek cash_closing_protocols
CREATE INDEX IF NOT EXISTS idx_closing_protocols_report ON public.cash_closing_protocols(cash_report_id);
CREATE INDEX IF NOT EXISTS idx_closing_protocols_company ON public.cash_closing_protocols(company_id);

-- RLS cash_closing_protocols
ALTER TABLE public.cash_closing_protocols ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view cash_closing_protocols" ON public.cash_closing_protocols;
CREATE POLICY "Members can view cash_closing_protocols"
  ON public.cash_closing_protocols FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can insert cash_closing_protocols" ON public.cash_closing_protocols;
CREATE POLICY "Members can insert cash_closing_protocols"
  ON public.cash_closing_protocols FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can update cash_closing_protocols" ON public.cash_closing_protocols;
CREATE POLICY "Members can update cash_closing_protocols"
  ON public.cash_closing_protocols FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "Members can delete cash_closing_protocols" ON public.cash_closing_protocols;
CREATE POLICY "Members can delete cash_closing_protocols"
  ON public.cash_closing_protocols FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
  ));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Bővítések a petty_cash_entries táblában (Pénztári tételek)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.petty_cash_entries
  ADD COLUMN IF NOT EXISTS cash_report_id uuid REFERENCES public.cash_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_no integer,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'pending_approval', 'posted', 'cancelled')),
  ADD COLUMN IF NOT EXISTS direction text CHECK (direction IN ('in', 'out')),
  ADD COLUMN IF NOT EXISTS legal_title text,
  ADD COLUMN IF NOT EXISTS gl_contra_account text,
  ADD COLUMN IF NOT EXISTS cancelled_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS receipt_id uuid REFERENCES public.cash_receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_cash_report ON public.petty_cash_entries(cash_report_id);
CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_receipt_id ON public.petty_cash_entries(receipt_id) WHERE receipt_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_petty_cash_entries_status ON public.petty_cash_entries(company_id, status);

-- Hivatkozás frissítése a cash_receipts és closing_protocols felé
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_receipts_cash_entry'
  ) THEN
    ALTER TABLE public.cash_receipts
      ADD CONSTRAINT fk_cash_receipts_cash_entry
      FOREIGN KEY (cash_entry_id) REFERENCES public.petty_cash_entries(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_closing_protocols_balancing_entry'
  ) THEN
    ALTER TABLE public.cash_closing_protocols
      ADD CONSTRAINT fk_closing_protocols_balancing_entry
      FOREIGN KEY (balancing_entry_id) REFERENCES public.petty_cash_entries(id) ON DELETE SET NULL;
  END IF;
END $$;
