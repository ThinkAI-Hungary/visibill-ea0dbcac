-- Create invoice uploads table for raw uploaded files
CREATE TABLE public.invoice_uploads (
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
ALTER TABLE public.invoice_uploads ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own invoice uploads" 
ON public.invoice_uploads 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own invoice uploads" 
ON public.invoice_uploads 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own invoice uploads" 
ON public.invoice_uploads 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own invoice uploads" 
ON public.invoice_uploads 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_invoice_uploads_updated_at
BEFORE UPDATE ON public.invoice_uploads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create invoice-uploads storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoice-uploads', 'invoice-uploads', false);

-- Create storage policies for invoice uploads
CREATE POLICY "Users can view their own invoice upload files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'invoice-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own invoice files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'invoice-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own invoice upload files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'invoice-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own invoice upload files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'invoice-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);