-- Add public SELECT policy for invoice-uploads bucket
CREATE POLICY "Public can view invoice uploads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'invoice-uploads');

-- Also add for szla_image bucket if used
CREATE POLICY "Public can view szla_image files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'szla_image');