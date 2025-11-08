-- Create salary table
CREATE TABLE public.salary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nev TEXT NOT NULL,
  osszeg NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.salary ENABLE ROW LEVEL SECURITY;

-- Create policies for salary
CREATE POLICY "Users can view their own salary entries"
ON public.salary
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own salary entries"
ON public.salary
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own salary entries"
ON public.salary
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own salary entries"
ON public.salary
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for salary updated_at
CREATE TRIGGER update_salary_updated_at
BEFORE UPDATE ON public.salary
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create tax table
CREATE TABLE public.tax (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  adonem TEXT NOT NULL,
  osszeg NUMERIC NOT NULL,
  kategoria TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tax ENABLE ROW LEVEL SECURITY;

-- Create policies for tax
CREATE POLICY "Users can view their own tax entries"
ON public.tax
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tax entries"
ON public.tax
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tax entries"
ON public.tax
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tax entries"
ON public.tax
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for tax updated_at
CREATE TRIGGER update_tax_updated_at
BEFORE UPDATE ON public.tax
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();