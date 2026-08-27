-- Migration: Fix Journals Header Immutability Trigger Return
-- Date: 2026-08-27

CREATE OR REPLACE FUNCTION public.acc_enforce_header_immutability()
RETURNS TRIGGER AS $$
BEGIN
  -- If it is a delete operation, NEW is NULL. We must check OLD status and return OLD.
  IF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('KONYVELT', 'SZTORNOZOTT') THEN
      RAISE EXCEPTION 'Posted journal entry (Header ID: %) is immutable and cannot be deleted.', OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  -- If it is an update operation, enforce immutability rules unless it's a storno transition
  IF OLD.status IN ('KONYVELT', 'SZTORNOZOTT') THEN
    IF NOT (OLD.status = 'KONYVELT' AND NEW.status = 'SZTORNOZOTT'
            AND NEW.journal_number = OLD.journal_number
            AND NEW.posting_date = OLD.posting_date
            AND NEW.accounting_year = OLD.accounting_year) THEN
      RAISE EXCEPTION 'Posted journal entry (Header ID: %) is immutable.', OLD.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
