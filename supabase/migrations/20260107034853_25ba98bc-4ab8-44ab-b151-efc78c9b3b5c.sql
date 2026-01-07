-- Add category_id column to nav_invoices table
ALTER TABLE public.nav_invoices
ADD COLUMN category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- Create index for efficient category lookup
CREATE INDEX idx_nav_invoices_category_id ON public.nav_invoices(category_id);