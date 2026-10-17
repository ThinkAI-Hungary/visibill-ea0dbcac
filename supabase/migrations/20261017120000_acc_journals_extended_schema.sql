-- Migration: acc_journals extended schema for unlimited journals, bank/cash routing and specialized invoice/system journals
-- Date: 2026-10-17
-- Module: eaisybooks / accounting journals

-- 1. acc_journals oszlopok bővítése
ALTER TABLE public.acc_journals 
  ADD COLUMN IF NOT EXISTS company_bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS petty_cash_register_id UUID REFERENCES public.petty_cash_registers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_type VARCHAR(32),
  ADD COLUMN IF NOT EXISTS default_contra_gl_number VARCHAR(16);

-- 2. Indexek hozzáadása
CREATE INDEX IF NOT EXISTS idx_acc_journals_company_bank_acc 
  ON public.acc_journals(company_bank_account_id) 
  WHERE company_bank_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_journals_petty_cash_reg 
  ON public.acc_journals(petty_cash_register_id) 
  WHERE petty_cash_register_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_acc_journals_company_sub_type 
  ON public.acc_journals(company_id, sub_type);

-- 3. Meglévő banknaplók összekötése a company_bank_accounts rekordokkal
UPDATE public.acc_journals j
SET company_bank_account_id = b.id
FROM public.company_bank_accounts b
WHERE b.journal_id = j.id
  AND j.company_bank_account_id IS NULL;

UPDATE public.acc_journals j
SET company_bank_account_id = b.id
FROM public.company_bank_accounts b
WHERE b.company_id = j.company_id
  AND j.type = 'BANK'
  AND j.company_bank_account_id IS NULL
  AND j.bank_account_number IS NOT NULL
  AND REPLACE(REPLACE(b.account_number, '-', ''), ' ', '') = REPLACE(REPLACE(j.bank_account_number, '-', ''), ' ', '');

-- 4. Meglévő naplók altípusainak (sub_type) és alapértelmezett számláinak beállítása
UPDATE public.acc_journals
SET sub_type = 'OPENING', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '491')
WHERE code = 'NY' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'CLOSING', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '492')
WHERE code IN ('Z', 'ZAR') AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'BANK_HUF', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '3841')
WHERE code = 'B1' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'BANK_FX', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '3861')
WHERE code = 'B2' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'PETTY_CASH_HUF', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '3811')
WHERE code = 'P1' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'CUSTOMER_LEGACY', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '311')
WHERE code = 'V' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'SUPPLIER_LEGACY', default_contra_gl_number = COALESCE(default_contra_gl_number, connected_gl_account, '454')
WHERE code = 'SZ' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'GENERAL_MIXED'
WHERE code = 'VE' AND (sub_type IS NULL OR sub_type = '');

UPDATE public.acc_journals
SET sub_type = 'PAYROLL', is_system_locked = true, default_contra_gl_number = COALESCE(default_contra_gl_number, '471')
WHERE code IN ('BER', 'BÉR') AND (sub_type IS NULL OR sub_type = '');

-- 5. Kétirányú szinkron trigger frissítése: company_bank_accounts <-> acc_journals
CREATE OR REPLACE FUNCTION public.acc_sync_bank_account_to_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.journal_id IS NOT NULL AND NEW.account_number IS NOT NULL AND TRIM(NEW.account_number) <> '' THEN
    UPDATE public.acc_journals
    SET bank_account_number = TRIM(NEW.account_number),
        company_bank_account_id = NEW.id,
        currency = COALESCE(NULLIF(TRIM(NEW.currency), ''), currency)
    WHERE id = NEW.journal_id
      AND (
        bank_account_number IS NULL 
        OR bank_account_number <> TRIM(NEW.account_number)
        OR company_bank_account_id IS NULL
        OR company_bank_account_id <> NEW.id
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.acc_sync_journal_to_bank_account()
RETURNS TRIGGER AS $$
DECLARE
  v_cleaned_acc TEXT;
  v_existing_id UUID;
  v_bank_name TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.type = 'BANK' AND NEW.bank_account_number IS NOT NULL AND TRIM(NEW.bank_account_number) <> '' THEN
    v_cleaned_acc := TRIM(NEW.bank_account_number);
    v_bank_name := COALESCE(NULLIF(TRIM(NEW.name), ''), 'Bank');

    SELECT id INTO v_existing_id
    FROM public.company_bank_accounts
    WHERE company_id = NEW.company_id
      AND (
        id = NEW.company_bank_account_id
        OR REPLACE(REPLACE(account_number, '-', ''), ' ', '') = REPLACE(REPLACE(v_cleaned_acc, '-', ''), ' ', '')
        OR journal_id = NEW.id
      )
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.company_bank_accounts
      SET journal_id = NEW.id,
          account_number = v_cleaned_acc,
          currency = COALESCE(NEW.currency, currency),
          updated_at = NOW()
      WHERE id = v_existing_id;

      IF NEW.company_bank_account_id IS NULL OR NEW.company_bank_account_id <> v_existing_id THEN
        UPDATE public.acc_journals
        SET company_bank_account_id = v_existing_id
        WHERE id = NEW.id;
      END IF;
    ELSE
      INSERT INTO public.company_bank_accounts (
        company_id,
        bank_name,
        account_number,
        currency,
        journal_id,
        is_active,
        created_at,
        updated_at
      ) VALUES (
        NEW.company_id,
        v_bank_name,
        v_cleaned_acc,
        COALESCE(NEW.currency, 'HUF'),
        NEW.id,
        true,
        NOW(),
        NOW()
      ) RETURNING id INTO v_existing_id;

      UPDATE public.acc_journals
      SET company_bank_account_id = v_existing_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Továbbfejlesztett acc_seed_default_journals függvény
CREATE OR REPLACE FUNCTION public.acc_seed_default_journals(p_company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Authorization check: ha autentikált felhasználó hívja, ellenőrizzük a jogosultságot
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.assert_company_role_tier(p_company_id, 'ledger_write');
  END IF;

  INSERT INTO public.acc_journals (company_id, code, name, type, sub_type, connected_gl_account, default_contra_gl_number, currency, is_system_locked)
  VALUES
    (p_company_id, 'NY', 'Nyitó tételek', 'OPENING', 'OPENING', '491', '491', 'HUF', false),
    (p_company_id, 'B1', 'K&H bank HUF', 'BANK', 'BANK_HUF', '3841', '3841', 'HUF', false),
    (p_company_id, 'B2', 'K&H bank EUR', 'BANK', 'BANK_FX', '3861', '3861', 'EUR', false),
    (p_company_id, 'P1', 'Házipénztár HUF', 'PETTY_CASH', 'PETTY_CASH_HUF', '3811', '3811', 'HUF', false),
    (p_company_id, 'VF', 'Belföldi vevő számlák (Ft)', 'CUSTOMER', 'DOMESTIC_CUSTOMER', '3111', '3111', 'HUF', false),
    (p_company_id, 'VD', 'Devizás vevő számlák', 'CUSTOMER', 'FOREIGN_CUSTOMER', '316', '316', 'EUR', false),
    (p_company_id, 'SZF', 'Belföldi szállító számlák (Ft)', 'SUPPLIER', 'DOMESTIC_SUPPLIER', '4541', '4541', 'HUF', false),
    (p_company_id, 'SZD', 'Devizás szállító számlák', 'SUPPLIER', 'FOREIGN_SUPPLIER', '4542', '4542', 'EUR', false),
    (p_company_id, 'VE', 'Vegyes tételek', 'MIXED', 'GENERAL_MIXED', NULL, NULL, 'HUF', false),
    (p_company_id, 'TE', 'Tárgyi eszköz napló', 'SYSTEM', 'ASSET', '571', '571', 'HUF', true),
    (p_company_id, 'ARF', 'Árfolyamkülönbözet napló', 'SYSTEM', 'FX', '876', '876', 'HUF', true),
    (p_company_id, 'ELH', 'Időbeli elhatárolások naplója', 'SYSTEM', 'ACCRUAL', '391', '391', 'HUF', true),
    (p_company_id, 'BER', 'Bérfeladási napló', 'SYSTEM', 'PAYROLL', '471', '471', 'HUF', true),
    (p_company_id, 'Z', 'Záró tételek', 'CLOSING', 'CLOSING', '492', '492', 'HUF', false)
  ON CONFLICT (company_id, code) DO UPDATE
  SET sub_type = EXCLUDED.sub_type,
      default_contra_gl_number = COALESCE(acc_journals.default_contra_gl_number, EXCLUDED.default_contra_gl_number),
      is_system_locked = CASE WHEN EXCLUDED.is_system_locked THEN true ELSE acc_journals.is_system_locked END;
  
  RETURN TRUE;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.acc_seed_default_journals(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.acc_seed_default_journals(uuid) TO authenticated, service_role;

-- 7. Meglévő cégek automatikus seedelése az új naplókkal
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.companies LOOP
    PERFORM public.acc_seed_default_journals(r.id);
  END LOOP;
END $$;
