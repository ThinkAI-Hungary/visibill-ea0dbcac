-- Migration to add assigned_to column and support admin policies
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles(user_id);

-- Helper function to check if the current user is a support admin
CREATE OR REPLACE FUNCTION public.is_support_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND is_support_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_support_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_support_admin() TO authenticated, service_role;

-- RLS policies for feedback table to allow support admins full read/update access
DROP POLICY IF EXISTS "Support admins can select all feedback" ON public.feedback;
CREATE POLICY "Support admins can select all feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.is_support_admin());

DROP POLICY IF EXISTS "Support admins can update all feedback" ON public.feedback;
CREATE POLICY "Support admins can update all feedback" ON public.feedback
  FOR UPDATE TO authenticated
  WITH CHECK (public.is_support_admin());

-- Elevate test users to support admin status
UPDATE public.profiles SET is_support_admin = true WHERE user_id = 'e5b822ee-4240-4350-9ebe-a14357d5bd89'; -- balazs@thinkai.hu
UPDATE public.profiles SET is_support_admin = true WHERE user_id = 'd83fd63d-c069-4cbf-81e8-b62a447bfeca'; -- management@thinkai.hu
