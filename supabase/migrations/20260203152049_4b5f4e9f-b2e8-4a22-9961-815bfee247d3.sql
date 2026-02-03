-- Create storage policies for the transactions bucket
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload their own transaction files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'transactions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own transaction files
CREATE POLICY "Users can view their own transaction files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'transactions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own transaction files
CREATE POLICY "Users can delete their own transaction files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'transactions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);