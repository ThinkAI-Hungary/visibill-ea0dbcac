-- Add terheles_datuma column to transactions table
-- For bank card charges, this stores the actual purchase date (extracted from description)
-- rather than the bank processing date (transaction_date).
-- This allows more accurate invoice matching.
ALTER TABLE public.transactions 
  ADD COLUMN IF NOT EXISTS terheles_datuma DATE;

COMMENT ON COLUMN public.transactions.terheles_datuma IS 
  'Bankkártyás terhelés tényleges dátuma (a leírásból kinyerve, YYYYMMDD formátum). Ha kitöltve, a matchelés ezt használja a transaction_date helyett.';
