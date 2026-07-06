-- Allow management/thinkai roles to delete feedback (tickets).
-- Cascade constraints handle related ticket_comments, ticket_events, ticket_reads.

CREATE POLICY "Management can delete feedback"
  ON public.feedback
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND is_support_admin = true
        AND role IN ('management', 'thinkai')
    )
  );
