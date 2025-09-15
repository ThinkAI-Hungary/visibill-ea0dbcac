-- Create storage policies for bank-statements bucket
CREATE POLICY "Users can upload their own bank statements" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'bank-statements' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own bank statements" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'bank-statements' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own bank statements" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'bank-statements' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own bank statements" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'bank-statements' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);