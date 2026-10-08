-- EB-0257: Könyvelési Naplók csoportosítása, kétirányú bank szinkron, sor-szintű partnerkezelés és zárt gépi naplók
-- Migration: 20261008130000_eb0257_journal_line_partner_and_bank_sync.sql

-- 1. acc_journal_lines partner_id mező hozzáadása
ALTER TABLE public.acc_journal_lines 
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_acc_journal_lines_partner_id 
  ON public.acc_journal_lines(partner_id) 
  WHERE partner_id IS NOT NULL;

-- 2. acc_journals oszlopok bővítése
ALTER TABLE public.acc_journals 
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(64);

ALTER TABLE public.acc_journals 
  ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN NOT NULL DEFAULT false;

-- Meglévő zárt rendszernaplók megjelölése
UPDATE public.acc_journals 
SET is_system_locked = true 
WHERE code IN ('603', '605', '901') 
   OR (type = 'SYSTEM' AND code NOT IN ('BÉR', '604'));

-- 3. Meglévő bankszámlaszámok feltöltése (Backfill)
UPDATE public.acc_journals j
SET bank_account_number = b.account_number
FROM public.company_bank_accounts b
WHERE b.journal_id = j.id 
  AND b.account_number IS NOT NULL 
  AND (j.bank_account_number IS NULL OR j.bank_account_number = '');

-- 4. Sor-szintű partnerek áttöltése a meglévő fejléces partnerekből immutability védelemmel
DO $$
BEGIN
  PERFORM set_config('visibill.allow_gl_remap', 'true', true);

  UPDATE public.acc_journal_lines l
  SET partner_id = h.partner_id
  FROM public.acc_journal_headers h
  WHERE l.header_id = h.id 
    AND h.partner_id IS NOT NULL 
    AND l.partner_id IS NULL;
END $$;

-- 5. Kétirányú szinkronizációs trigger funkció: acc_journals -> company_bank_accounts
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
        REPLACE(REPLACE(account_number, '-', ''), ' ', '') = REPLACE(REPLACE(v_cleaned_acc, '-', ''), ' ', '')
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
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_acc_sync_journal_to_bank_account ON public.acc_journals;
CREATE TRIGGER trg_acc_sync_journal_to_bank_account
  AFTER INSERT OR UPDATE OF bank_account_number, currency, name, type
  ON public.acc_journals
  FOR EACH ROW
  EXECUTE FUNCTION public.acc_sync_journal_to_bank_account();

-- 6. Kétirányú szinkronizációs trigger funkció: company_bank_accounts -> acc_journals
CREATE OR REPLACE FUNCTION public.acc_sync_bank_account_to_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF NEW.journal_id IS NOT NULL AND NEW.account_number IS NOT NULL AND TRIM(NEW.account_number) <> '' THEN
    UPDATE public.acc_journals
    SET bank_account_number = TRIM(NEW.account_number),
        currency = COALESCE(NULLIF(TRIM(NEW.currency), ''), currency)
    WHERE id = NEW.journal_id
      AND (bank_account_number IS NULL OR bank_account_number <> TRIM(NEW.account_number));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_acc_sync_bank_account_to_journal ON public.company_bank_accounts;
CREATE TRIGGER trg_acc_sync_bank_account_to_journal
  AFTER INSERT OR UPDATE OF journal_id, account_number, currency
  ON public.company_bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.acc_sync_bank_account_to_journal();
