-- Add invoice_type column and new columns for all invoice types
ALTER TABLE public.invoices 
ADD COLUMN invoice_type text NOT NULL DEFAULT 'sima_szamla';

-- Add columns for egyszerusitett_szamla
ALTER TABLE public.invoices 
ADD COLUMN termek_szolgaltatas_tipusa text;

-- Add columns for proforma
ALTER TABLE public.invoices 
ADD COLUMN dokumentum_azonosito text,
ADD COLUMN fizetendo_osszeg numeric,
ADD COLUMN fizetesi_mod text,
ADD COLUMN bankszamlaszam_iban text,
ADD COLUMN adojogi_megjegyzes text,
ADD COLUMN fizetesi_hatarido date;

-- Add columns for vegszamla
ALTER TABLE public.invoices 
ADD COLUMN elolegszamla_hivatkozas text,
ADD COLUMN elszamolt_eloleg_osszeg numeric;

-- Create check constraint for invoice_type values
ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_type_check 
CHECK (invoice_type IN ('sima_szamla', 'vegszamla', 'proforma', 'egyszerusitett_szamla'));

-- Create an index on invoice_type for better query performance
CREATE INDEX idx_invoices_type ON public.invoices(invoice_type);

-- Update existing records to have the correct invoice type
UPDATE public.invoices SET invoice_type = 'sima_szamla' WHERE invoice_type = 'sima_szamla';