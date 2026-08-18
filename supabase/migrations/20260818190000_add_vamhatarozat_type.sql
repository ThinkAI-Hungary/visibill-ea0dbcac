-- Drop the invoices type check constraint and recreate it to include 'vamhatarozat'
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_type_check;

ALTER TABLE public.invoices ADD CONSTRAINT invoices_type_check 
  CHECK (invoice_type = ANY (ARRAY[
    'sima_szla'::text, 
    'egyszerusitett_szla'::text, 
    'dijbekero_proforma'::text, 
    'dijbekero'::text, 
    'vegszamla'::text, 
    'garanciajegy'::text, 
    'elolegszamla'::text, 
    'sztorno_szla'::text,
    'penztarbizonylat'::text,
    'vamhatarozat'::text
  ]));
