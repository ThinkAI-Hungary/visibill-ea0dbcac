-- Create bank_statement_uploads table for tracking raw uploaded files
CREATE TABLE public.bank_statement_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  upload_status TEXT NOT NULL DEFAULT 'uploaded',
  processing_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  error_message TEXT,
  metadata JSONB
);

-- Enable Row Level Security
ALTER TABLE public.bank_statement_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own bank statement uploads" 
ON public.bank_statement_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bank statement uploads" 
ON public.bank_statement_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bank statement uploads" 
ON public.bank_statement_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bank statement uploads" 
ON public.bank_statement_uploads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bank_statement_uploads_updated_at
BEFORE UPDATE ON public.bank_statement_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();