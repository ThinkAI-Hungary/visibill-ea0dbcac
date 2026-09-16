-- Migration: 20260916000004_add_penztargep_zaras_invoice_type.sql
-- Purpose: Add 'penztargep_zaras' (cash register daily closure / Z-report) to invoices_type_check constraint

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check CHECK (
  invoice_type = ANY (ARRAY[
    'sima_szla'::text,
    'egyszerusitett_szla'::text,
    'dijbekero_proforma'::text,
    'dijbekero'::text,
    'vegszamla'::text,
    'garanciajegy'::text,
    'elolegszamla'::text,
    'sztorno_szla'::text,
    'penztarbizonylat'::text,
    'vamhatarozat'::text,
    'penztargep_zaras'::text
  ])
);
