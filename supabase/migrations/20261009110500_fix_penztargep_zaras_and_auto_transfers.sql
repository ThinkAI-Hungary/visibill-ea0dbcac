-- Migration: 20261009110500_fix_penztargep_zaras_and_auto_transfers.sql
-- Purpose:
--   1. Fix sync_petty_cash_on_invoice_change trigger function to correctly handle penztargep_zaras (cash register closures)
--      as cash_sale with positive amount on UPDATE events, preventing them from being flipped into negative cash_expense.
--   2. Add trg_auto_categorize_transfers trigger on transactions to automatically classify MARKETS - TRADE,
--      TREASURY - TRADE, and own-account transfers as 'számlák közötti átvezetés' and 'no_match_category',
--      preventing them from becoming unmatched supplier transactions.

-- 1. Fix sync_petty_cash_on_invoice_change
CREATE OR REPLACE FUNCTION public.sync_petty_cash_on_invoice_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.petty_cash_entries
    WHERE source_table = 'invoices' AND source_id = OLD.id AND source_type != 'invoice_settlement';
    
    PERFORM public.sync_petty_cash_entries(OLD.company_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.invoice_type IN ('penztarbizonylat', 'penztargep_zaras') OR NEW.fizetesi_mod ILIKE '%készpénz%') AND NEW.statusz != 'jovahagyasra_var' THEN
      IF EXISTS (
        SELECT 1 FROM public.petty_cash_entries
        WHERE source_table = 'invoices' AND source_id = NEW.id AND source_type != 'invoice_settlement'
      ) THEN
        UPDATE public.petty_cash_entries
        SET 
          entry_date = NEW.kibocsatas_datuma,
          description = CASE 
            WHEN NEW.invoice_type = 'penztargep_zaras' THEN
              'Pénztárgép napi zárás (' || COALESCE(NEW.bizonylatsorszam, 'Zárás') || ')'
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN
              CASE 
                WHEN NEW.invoice_direction = 'OUTBOUND' THEN 'Pénztári bevétel - ' || COALESCE(NEW.vevo_nev, 'Ismeretlen')
                ELSE 'Pénztári kiadás - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
              END
            ELSE
              'Készpénzes kiadás - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
          END,
          amount = CASE 
            WHEN NEW.invoice_type = 'penztargep_zaras' THEN NEW.brutto_vegosszeg
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'INBOUND' THEN -(NEW.brutto_vegosszeg)
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN NEW.brutto_vegosszeg
            ELSE -(NEW.brutto_vegosszeg)
          END,
          currency = COALESCE(NEW.penznem, 'HUF'),
          source_type = CASE 
            WHEN NEW.invoice_type = 'penztargep_zaras' THEN 'cash_sale'
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'OUTBOUND' THEN 'cash_sale'
            ELSE 'cash_expense'
          END
        WHERE source_table = 'invoices' AND source_id = NEW.id AND source_type != 'invoice_settlement';
      ELSE
        PERFORM public.sync_petty_cash_entries(NEW.company_id);
      END IF;
    ELSE
      DELETE FROM public.petty_cash_entries
      WHERE source_table = 'invoices' AND source_id = NEW.id AND source_type != 'invoice_settlement';
      
      -- Also re-sync to ensure everything is recalculated
      PERFORM public.sync_petty_cash_entries(NEW.company_id);
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    IF (NEW.invoice_type IN ('penztarbizonylat', 'penztargep_zaras') OR NEW.fizetesi_mod ILIKE '%készpénz%') AND NEW.statusz != 'jovahagyasra_var' THEN
      PERFORM public.sync_petty_cash_entries(NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$function$;

-- 2. Create auto_categorize_transfers trigger function
CREATE OR REPLACE FUNCTION public.auto_categorize_transfers()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- If transaction is an internal transfer or FX trade
  IF (
    NEW.description ILIKE '%MARKETS - TRADE%'
    OR NEW.description ILIKE '%TREASURY - TRADE%'
    OR NEW.description ILIKE '%SAJÁT SZÁMLA%'
    OR NEW.description ILIKE '%SAJÁT SZÁMLÁRÓL%'
    OR NEW.description ILIKE '%SAJÁT SZÁMLÁRA%'
    OR (NEW.description ILIKE '%ÁTVEZETÉS%' AND NEW.description ILIKE '%SZÁMLA%')
  ) THEN
    -- Only set if not already manually matched to an invoice
    IF NEW.matched_invoice_id IS NULL THEN
      NEW.type := 'számlák közötti átvezetés';
      NEW.match_type := 'no_match_category';
      NEW.confidence_score := 0;
      IF NEW.reason IS NULL OR NEW.reason = '' THEN
        NEW.reason := 'Automatikus átvezetés besorolás (saját számla / devizaváltás)';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Attach trigger to transactions table
DROP TRIGGER IF EXISTS trg_auto_categorize_transfers ON public.transactions;
CREATE TRIGGER trg_auto_categorize_transfers
BEFORE INSERT OR UPDATE OF description, type, matched_invoice_id ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_categorize_transfers();

REVOKE ALL ON FUNCTION public.auto_categorize_transfers() FROM anon;
GRANT EXECUTE ON FUNCTION public.auto_categorize_transfers() TO authenticated, service_role;
