-- Add UPDATE and DELETE RLS policies for hp_settings
CREATE POLICY "Members can update hp_settings"
ON public.hp_settings
FOR UPDATE
TO authenticated
USING (auth.uid() IN (
  SELECT company_members.user_id
  FROM company_members
  WHERE company_members.company_id = hp_settings.company_id
));

CREATE POLICY "Members can delete hp_settings"
ON public.hp_settings
FOR DELETE
TO authenticated
USING (auth.uid() IN (
  SELECT company_members.user_id
  FROM company_members
  WHERE company_members.company_id = hp_settings.company_id
));