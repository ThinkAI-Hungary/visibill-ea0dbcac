-- Add unique constraint on user_id and tax_number for partner upserts
CREATE UNIQUE INDEX IF NOT EXISTS partners_user_tax_unique ON public.partners (user_id, tax_number);