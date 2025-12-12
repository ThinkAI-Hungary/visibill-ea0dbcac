-- Add paid and submitted columns to nav_invoices
ALTER TABLE public.nav_invoices
ADD COLUMN paid boolean DEFAULT false,
ADD COLUMN submitted boolean DEFAULT false;