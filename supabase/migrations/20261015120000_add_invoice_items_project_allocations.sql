-- Migration: 20261015120000_add_invoice_items_project_allocations.sql
-- Add project_allocations JSONB column to nav_invoice_items and invoice_items

ALTER TABLE public.nav_invoice_items 
ADD COLUMN IF NOT EXISTS project_allocations jsonb DEFAULT NULL;

ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS project_allocations jsonb DEFAULT NULL;

-- Create GIN index for efficient searching/filtering on project allocations
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_project_allocations 
ON public.nav_invoice_items USING gin (project_allocations);

CREATE INDEX IF NOT EXISTS idx_invoice_items_project_allocations 
ON public.invoice_items USING gin (project_allocations);

-- Add comments for schema documentation
COMMENT ON COLUMN public.nav_invoice_items.project_allocations IS 'Array of {project_id: uuid, percentage: numeric} representing multi-project cost allocation (summing to 100%)';
COMMENT ON COLUMN public.invoice_items.project_allocations IS 'Array of {project_id: uuid, percentage: numeric} representing multi-project cost allocation (summing to 100%)';
