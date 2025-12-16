-- Add project_id column to nav_invoices table
ALTER TABLE public.nav_invoices ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- Create index for efficient queries
CREATE INDEX idx_nav_invoices_project_id ON public.nav_invoices(project_id);