-- Ensure RLS is enabled and add user-scoped policies for transaction_uploads
ALTER TABLE public.transaction_uploads ENABLE ROW LEVEL SECURITY;

-- Insert: users can create their own upload records
DROP POLICY IF EXISTS "Users can create their own transaction uploads" ON public.transaction_uploads;
CREATE POLICY "Users can create their own transaction uploads"
ON public.transaction_uploads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Select: users can view their own upload records
DROP POLICY IF EXISTS "Users can view their own transaction uploads" ON public.transaction_uploads;
CREATE POLICY "Users can view their own transaction uploads"
ON public.transaction_uploads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Update: users can update their own upload records
DROP POLICY IF EXISTS "Users can update their own transaction uploads" ON public.transaction_uploads;
CREATE POLICY "Users can update their own transaction uploads"
ON public.transaction_uploads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete: users can delete their own upload records
DROP POLICY IF EXISTS "Users can delete their own transaction uploads" ON public.transaction_uploads;
CREATE POLICY "Users can delete their own transaction uploads"
ON public.transaction_uploads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
