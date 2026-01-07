-- Add AI categorization reason column to nav_invoices
ALTER TABLE public.nav_invoices
ADD COLUMN ai_categorization_reason text;