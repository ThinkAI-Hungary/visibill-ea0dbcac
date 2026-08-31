-- Partial index on nav_invoice_items(project_id) for project assignments & analytics
CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_project_id 
ON public.nav_invoice_items (project_id) 
WHERE (project_id IS NOT NULL);
