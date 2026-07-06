-- Migration to add is_internal to ticket_comments and restrict access
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

-- Recreate SELECT policy on ticket_comments to restrict internal notes to support admins
DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;

CREATE POLICY "Users can view comments on their tickets" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    public.is_support_admin()
    OR (
      (feedback_id IN (SELECT id FROM public.feedback WHERE user_id = auth.uid()))
      AND (is_internal = false)
    )
  );
