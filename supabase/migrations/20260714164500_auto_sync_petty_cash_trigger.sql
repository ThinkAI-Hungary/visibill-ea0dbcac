-- Migration: Auto-sync invoices to petty cash entries
-- Created at: 2026-07-14
 
CREATE OR REPLACE FUNCTION public.sync_petty_cash_on_invoice_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.petty_cash_entries
    WHERE source_table = 'invoices' AND source_id = OLD.id;
    
    PERFORM public.sync_petty_cash_entries(OLD.company_id);
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF NEW.invoice_type = 'penztarbizonylat' OR NEW.fizetesi_mod ILIKE '%készpénz%' THEN
      IF EXISTS (
        SELECT 1 FROM public.petty_cash_entries
        WHERE source_table = 'invoices' AND source_id = NEW.id
      ) THEN
        UPDATE public.petty_cash_entries
        SET 
          entry_date = NEW.kibocsatas_datuma,
          description = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN
              CASE 
                WHEN NEW.invoice_direction = 'OUTBOUND' THEN 'Pénztári bevétel (' || COALESCE(NEW.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(NEW.vevo_nev, 'Ismeretlen')
                ELSE 'Pénztári kiadás (' || COALESCE(NEW.adojogi_megjegyzes, 'Készpénz') || ') - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
              END
            ELSE
              'Készpénzes kiadás - ' || COALESCE(NEW.elado_nev, 'Ismeretlen')
          END,
          amount = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'INBOUND' THEN -(NEW.brutto_vegosszeg)
            WHEN NEW.invoice_type = 'penztarbizonylat' THEN NEW.brutto_vegosszeg
            ELSE -(NEW.brutto_vegosszeg)
          END,
          currency = COALESCE(NEW.penznem, 'HUF'),
          source_type = CASE 
            WHEN NEW.invoice_type = 'penztarbizonylat' AND NEW.invoice_direction = 'OUTBOUND' THEN 'cash_sale'
            ELSE 'cash_expense'
          END
        WHERE source_table = 'invoices' AND source_id = NEW.id;
      ELSE
        PERFORM public.sync_petty_cash_entries(NEW.company_id);
      END IF;
    ELSE
      DELETE FROM public.petty_cash_entries
      WHERE source_table = 'invoices' AND source_id = NEW.id;
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    IF NEW.invoice_type = 'penztarbizonylat' OR NEW.fizetesi_mod ILIKE '%készpénz%' THEN
      PERFORM public.sync_petty_cash_entries(NEW.company_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
 
DROP TRIGGER IF EXISTS trg_sync_petty_cash_on_invoice ON public.invoices;
 
CREATE TRIGGER trg_sync_petty_cash_on_invoice
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.sync_petty_cash_on_invoice_change();
