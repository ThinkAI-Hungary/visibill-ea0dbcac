-- ============================================================================
-- Accounty: Self-assign policy + Seed data
-- Az első könyvelő hozzárendeléshez szükséges (chicken-and-egg fix)
-- ============================================================================

-- Engedélyezzük, hogy egy authenticated user önmagát hozzárendelhesse
-- (accountant_user_id = auth.uid())
CREATE POLICY "accounty_assignments_self_assign"
  ON public.accounty_assignments
  FOR INSERT
  WITH CHECK (accountant_user_id = auth.uid());

-- Engedélyezzük, hogy a user törölhesse a saját hozzárendeléseit
CREATE POLICY "accounty_assignments_delete_own"
  ON public.accounty_assignments
  FOR DELETE
  USING (accountant_user_id = auth.uid());

-- ── Hasonló self-insert policy-k a többi accounty táblára ──

-- accounty_tax_profiles: authenticated user insert ha van assignment-je
CREATE POLICY "accounty_tax_profiles_insert_assigned"
  ON public.accounty_tax_profiles
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.company_id = accounty_tax_profiles.company_id
    )
  );

-- accounty_tax_profiles: update ha van assignment-je
CREATE POLICY "accounty_tax_profiles_update_assigned"
  ON public.accounty_tax_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
        AND aa.company_id = accounty_tax_profiles.company_id
    )
  );
