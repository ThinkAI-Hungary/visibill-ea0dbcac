-- Step 1: Rename projects table to categories
ALTER TABLE public.projects RENAME TO categories;

-- Step 2: Rename project_id columns to category_id in all invoice tables
ALTER TABLE public.invoices RENAME COLUMN project_id TO category_id;
ALTER TABLE public.sima_szamla_backup RENAME COLUMN project_id TO category_id;
ALTER TABLE public.vegszamla_backup RENAME COLUMN project_id TO category_id;
ALTER TABLE public.proforma_backup RENAME COLUMN project_id TO category_id;
ALTER TABLE public.egyszerusitett_szamla_backup RENAME COLUMN project_id TO category_id;

-- Step 3: Create new projects table for real project management
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  budget NUMERIC,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on projects table
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects"
ON public.projects
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own projects"
ON public.projects
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
ON public.projects
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at on projects
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 4: Add project_id column to invoice tables (nullable, for gradual migration)
ALTER TABLE public.invoices ADD COLUMN project_id UUID;
ALTER TABLE public.sima_szamla_backup ADD COLUMN project_id UUID;
ALTER TABLE public.vegszamla_backup ADD COLUMN project_id UUID;
ALTER TABLE public.proforma_backup ADD COLUMN project_id UUID;
ALTER TABLE public.egyszerusitett_szamla_backup ADD COLUMN project_id UUID;