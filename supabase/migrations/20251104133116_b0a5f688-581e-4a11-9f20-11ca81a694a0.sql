-- Create salaries table for managing both salaries and government contributions
CREATE TABLE public.salaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('salary', 'tax_contribution', 'social_security', 'health_insurance', 'pension', 'other')),
  employee_name TEXT,
  recipient_name TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_to_transfer NUMERIC NOT NULL CHECK (amount_to_transfer >= 0),
  payment_date DATE,
  due_date DATE,
  period_month INTEGER CHECK (period_month >= 1 AND period_month <= 12),
  period_year INTEGER CHECK (period_year >= 2000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'overdue')),
  payment_reference TEXT,
  file_url TEXT,
  file_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'automated')),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.salaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own salaries"
ON public.salaries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own salaries"
ON public.salaries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own salaries"
ON public.salaries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own salaries"
ON public.salaries
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_salaries_updated_at
BEFORE UPDATE ON public.salaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for salary files
INSERT INTO storage.buckets (id, name, public)
VALUES ('salaries', 'salaries', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for salary files
CREATE POLICY "Users can view their own salary files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'salaries' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own salary files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'salaries' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own salary files"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'salaries' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own salary files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'salaries' AND auth.uid()::text = (storage.foldername(name))[1]);