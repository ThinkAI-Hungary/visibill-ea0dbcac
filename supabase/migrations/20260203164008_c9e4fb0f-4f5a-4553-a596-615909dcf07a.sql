-- Create RLS policies for transactions table
-- Users can access transactions linked to their own uploads

CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (
  upload_id IS NULL OR
  EXISTS (
    SELECT 1 FROM transaction_uploads
    WHERE transaction_uploads.id = transactions.upload_id
    AND transaction_uploads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their own transactions"
ON public.transactions
FOR INSERT
WITH CHECK (
  upload_id IS NULL OR
  EXISTS (
    SELECT 1 FROM transaction_uploads
    WHERE transaction_uploads.id = transactions.upload_id
    AND transaction_uploads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own transactions"
ON public.transactions
FOR UPDATE
USING (
  upload_id IS NULL OR
  EXISTS (
    SELECT 1 FROM transaction_uploads
    WHERE transaction_uploads.id = transactions.upload_id
    AND transaction_uploads.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own transactions"
ON public.transactions
FOR DELETE
USING (
  upload_id IS NULL OR
  EXISTS (
    SELECT 1 FROM transaction_uploads
    WHERE transaction_uploads.id = transactions.upload_id
    AND transaction_uploads.user_id = auth.uid()
  )
);