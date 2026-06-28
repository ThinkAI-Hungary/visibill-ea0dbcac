-- Fix the UPDATE policy for feedback table to include the USING clause, enabling support admins to edit tickets.
DROP POLICY IF EXISTS "Support admins can update all feedback" ON public.feedback;
CREATE POLICY "Support admins can update all feedback" ON public.feedback
  FOR UPDATE TO authenticated
  USING (public.is_support_admin())
  WITH CHECK (public.is_support_admin());
