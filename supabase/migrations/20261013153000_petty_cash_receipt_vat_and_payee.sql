-- ==============================================================================
-- Migration: 20261013153000_petty_cash_receipt_vat_and_payee.sql
-- Description: Bővíti a petty_cash_entries táblát az egyedi név (payee_name),
--              a bizonylatszám (receipt_number) és az ÁFA kezelés mezőivel
--              (net_amount, vat_amount, vat_code_id, vat_row_override).
-- ==============================================================================

-- 1. Oszlopok hozzáadása a petty_cash_entries táblához
ALTER TABLE public.petty_cash_entries
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS payee_name text,
  ADD COLUMN IF NOT EXISTS net_amount numeric,
  ADD COLUMN IF NOT EXISTS vat_amount numeric,
  ADD COLUMN IF NOT EXISTS vat_code_id uuid REFERENCES public.vat_codes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vat_row_override text;

-- 2. Indexek létrehozása a gyors szűréshez és kereséshez
CREATE INDEX IF NOT EXISTS idx_pce_receipt_number
  ON public.petty_cash_entries(company_id, receipt_number);

CREATE INDEX IF NOT EXISTS idx_pce_payee_name
  ON public.petty_cash_entries(company_id, payee_name);

CREATE INDEX IF NOT EXISTS idx_pce_vat_code
  ON public.petty_cash_entries(company_id, vat_code_id);

-- 3. Meglévő rekordok kitöltése a kapcsolódó táblákból (ha van kapcsolat)
-- 3a. cash_receipts kapcsolatból
UPDATE public.petty_cash_entries pce
   SET receipt_number = cr.receipt_number,
       payee_name = COALESCE(pce.payee_name, cr.payer_or_payee_name)
  FROM public.cash_receipts cr
 WHERE pce.receipt_id = cr.id
   AND pce.receipt_number IS NULL;

-- 3b. invoices kapcsolatból (ahol source_table = 'invoices')
UPDATE public.petty_cash_entries pce
   SET receipt_number = COALESCE(pce.receipt_number, inv.bizonylatsorszam),
       payee_name = COALESCE(pce.payee_name, CASE WHEN pce.amount >= 0 THEN inv.vevo_nev ELSE inv.elado_nev END),
       net_amount = COALESCE(pce.net_amount, inv.adoalap_osszesen),
       vat_amount = COALESCE(pce.vat_amount, inv.afa_osszeg_osszesen),
       vat_code_id = COALESCE(pce.vat_code_id, inv.vat_code_id),
       vat_row_override = COALESCE(pce.vat_row_override, inv.vat_row_override)
  FROM public.invoices inv
 WHERE pce.source_table = 'invoices'
   AND pce.source_id = inv.id
   AND (pce.receipt_number IS NULL OR pce.net_amount IS NULL);

-- 4. RPC segédfüggvény: generate_next_cash_receipt_number
-- Kiszámítja a következő bizonylatszámot a pénztárhoz és az évhez zárt sorszámozással
CREATE OR REPLACE FUNCTION public.generate_next_cash_receipt_number(
  p_company_id uuid,
  p_cash_register_id uuid,
  p_receipt_type text,
  p_issued_at date DEFAULT CURRENT_DATE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_norm_type text;
  v_year text;
  v_prefix text;
  v_seq_no integer;
BEGIN
  IF lower(p_receipt_type) IN ('in', 'income', 'bevetel', 'bevétel') THEN
    v_norm_type := 'in';
    v_prefix := 'BPB-';
  ELSIF lower(p_receipt_type) IN ('out', 'expense', 'kiadas', 'kiadás') THEN
    v_norm_type := 'out';
    v_prefix := 'KPB-';
  ELSE
    RAISE EXCEPTION 'Érvénytelen bizonylat típus: % (csak in vagy out)', p_receipt_type;
  END IF;

  v_year := to_char(COALESCE(p_issued_at, CURRENT_DATE), 'YYYY');

  -- Következő sorszám meghatározása a meglévő bizonylatok és pénztári tételek alapján
  SELECT COALESCE(MAX(seq_no), 0) + 1
    INTO v_seq_no
    FROM public.cash_receipts
   WHERE company_id = p_company_id
     AND cash_register_id = p_cash_register_id
     AND receipt_type = v_norm_type
     AND to_char(issued_at, 'YYYY') = v_year;

  RETURN v_prefix || v_year || '-' || lpad(v_seq_no::text, 5, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_next_cash_receipt_number(uuid, uuid, text, date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_next_cash_receipt_number(uuid, uuid, text, date) TO authenticated, service_role;
