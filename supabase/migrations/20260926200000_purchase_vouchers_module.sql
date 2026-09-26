-- ========================================================================
-- Migration: Mezőgazdasági Felvásárlási Jegyek Modul (Purchase Vouchers)
-- Description: Szigorú számadású felvásárlási jegyek tárolása, kompenzációs
--              felár (12%/7%), őstermelői adatok és bérügyi/ÁFA integráció.
-- ========================================================================

-- 1. Cégbeállítás mező a felvásárlási jegyek opcionális aktiválásához
ALTER TABLE public.company_settings 
  ADD COLUMN IF NOT EXISTS has_purchase_vouchers BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS has_purchase_vouchers BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Felvásárlási Jegy Fejléc Tábla (public.purchase_vouchers)
CREATE TABLE IF NOT EXISTS public.purchase_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  voucher_number VARCHAR(100) NOT NULL,
  producer_name VARCHAR(255) NOT NULL,
  producer_tax_id VARCHAR(50),                -- Adóazonosító jel vagy adószám (NAV 08-hoz)
  producer_card_number VARCHAR(100),          -- Őstermelői igazolványszám / FELIR azonosító
  producer_address TEXT,
  producer_bank_account VARCHAR(100),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fulfillment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_due_date DATE,
  payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'TRANSFER')),
  net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  compensation_surcharge_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00 CHECK (compensation_surcharge_rate IN (12.00, 7.00, 0.00)),
  compensation_surcharge_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_deducted NUMERIC(15,2) NOT NULL DEFAULT 0, -- Levont SZJA előleg (ha van)
  paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  payroll_period VARCHAR(7),                  -- pl. '2026-03' (melyik havi számfejtéshez kapcsolt)
  payroll_processed BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  document_url TEXT,                          -- Bizonylat csatolmány (PDF/kép)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Felvásárlási Jegy Tételek Tábla (public.purchase_voucher_items)
CREATE TABLE IF NOT EXISTS public.purchase_voucher_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES public.purchase_vouchers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,            -- Termény / mezőgazdasági termék megnevezése
  vtszt_kn_code VARCHAR(20),                  -- VTSZ / KN kód
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'kg',
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  compensation_rate NUMERIC(5,2) NOT NULL DEFAULT 12.00,
  compensation_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Teljesítmény Indexek (Performance & Foreign Key Indexes)
CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_company_fulfillment 
  ON public.purchase_vouchers(company_id, fulfillment_date DESC);

CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_company_status 
  ON public.purchase_vouchers(company_id, payment_status);

CREATE INDEX IF NOT EXISTS idx_purchase_vouchers_company_payroll 
  ON public.purchase_vouchers(company_id, payroll_period);

CREATE INDEX IF NOT EXISTS idx_purchase_voucher_items_voucher 
  ON public.purchase_voucher_items(voucher_id);

CREATE INDEX IF NOT EXISTS idx_purchase_voucher_items_company 
  ON public.purchase_voucher_items(company_id);

-- 5. Row Level Security (RLS) Szabályok
ALTER TABLE public.purchase_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_voucher_items ENABLE ROW LEVEL SECURITY;

-- 5.1 purchase_vouchers RLS
DROP POLICY IF EXISTS "Users can view purchase_vouchers" ON public.purchase_vouchers;
CREATE POLICY "Users can view purchase_vouchers" ON public.purchase_vouchers
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_vouchers.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can insert purchase_vouchers" ON public.purchase_vouchers;
CREATE POLICY "Users can insert purchase_vouchers" ON public.purchase_vouchers
FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_vouchers.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can update purchase_vouchers" ON public.purchase_vouchers;
CREATE POLICY "Users can update purchase_vouchers" ON public.purchase_vouchers
FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_vouchers.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_vouchers.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can delete purchase_vouchers" ON public.purchase_vouchers;
CREATE POLICY "Users can delete purchase_vouchers" ON public.purchase_vouchers
FOR DELETE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_vouchers.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

-- 5.2 purchase_voucher_items RLS
DROP POLICY IF EXISTS "Users can view purchase_voucher_items" ON public.purchase_voucher_items;
CREATE POLICY "Users can view purchase_voucher_items" ON public.purchase_voucher_items
FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_voucher_items.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can insert purchase_voucher_items" ON public.purchase_voucher_items;
CREATE POLICY "Users can insert purchase_voucher_items" ON public.purchase_voucher_items
FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_voucher_items.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can update purchase_voucher_items" ON public.purchase_voucher_items;
CREATE POLICY "Users can update purchase_voucher_items" ON public.purchase_voucher_items
FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_voucher_items.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_voucher_items.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

DROP POLICY IF EXISTS "Users can delete purchase_voucher_items" ON public.purchase_voucher_items;
CREATE POLICY "Users can delete purchase_voucher_items" ON public.purchase_voucher_items
FOR DELETE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_members.company_id = purchase_voucher_items.company_id
      AND company_members.user_id = (SELECT auth.uid())
      AND company_members.role <> 'employee'::text
  ))
  OR has_company_access_via_cache(company_id, 'accounty'::text)
);

-- 6. Összesítő és KPI RPC Függvény (get_purchase_vouchers_summary)
CREATE OR REPLACE FUNCTION public.get_purchase_vouchers_summary(
  p_company_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_total_count INT := 0;
  v_total_net NUMERIC := 0;
  v_total_compensation NUMERIC := 0;
  v_total_gross NUMERIC := 0;
  v_unpaid_gross NUMERIC := 0;
  v_paid_gross NUMERIC := 0;
  v_unique_producers INT := 0;
BEGIN
  SELECT 
    COUNT(*),
    COALESCE(SUM(net_amount), 0),
    COALESCE(SUM(compensation_surcharge_amount), 0),
    COALESCE(SUM(gross_amount), 0),
    COALESCE(SUM(CASE WHEN payment_status = 'unpaid' THEN gross_amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN gross_amount ELSE 0 END), 0),
    COUNT(DISTINCT producer_name)
  INTO 
    v_total_count,
    v_total_net,
    v_total_compensation,
    v_total_gross,
    v_unpaid_gross,
    v_paid_gross,
    v_unique_producers
  FROM public.purchase_vouchers
  WHERE company_id = p_company_id
    AND (p_date_from IS NULL OR fulfillment_date >= p_date_from)
    AND (p_date_to IS NULL OR fulfillment_date <= p_date_to);

  RETURN jsonb_build_object(
    'total_count', v_total_count,
    'total_net', v_total_net,
    'total_compensation', v_total_compensation,
    'total_gross', v_total_gross,
    'unpaid_gross', v_unpaid_gross,
    'paid_gross', v_paid_gross,
    'unique_producers', v_unique_producers
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_purchase_vouchers_summary(UUID, DATE, DATE) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_purchase_vouchers_summary(UUID, DATE, DATE) TO authenticated, service_role;
