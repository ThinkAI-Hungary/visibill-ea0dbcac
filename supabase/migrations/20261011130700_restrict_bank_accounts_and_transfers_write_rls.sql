-- ============================================================================
-- RBAC Csomag A (A-247): company_bank_accounts + payment_transfers write-RLS szigorítás
--
-- Korábban: INSERT/UPDATE/DELETE minden company_members tagnak engedett volt, kivéve
--           employee / viewer  -> az 'assistant' (Asszisztens) is írhatott.
-- Mostantól: írás csak owner / admin / member (Pénzügyi Vezető) / support_admin.
--           assistant / viewer / employee: csak olvas (SELECT policy változatlan).
--
-- service_role policy-k változatlanok. Az acc_sync_* triggerek SECURITY DEFINER-ek,
-- így az RLS szigorítás nem érinti őket.
-- Idempotens: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================================

-- ── company_bank_accounts ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can insert bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can update bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can delete bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Finance roles can insert bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Finance roles can update bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Finance roles can delete bank accounts" ON public.company_bank_accounts;

CREATE POLICY "Finance roles can insert bank accounts"
  ON public.company_bank_accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

CREATE POLICY "Finance roles can update bank accounts"
  ON public.company_bank_accounts FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

CREATE POLICY "Finance roles can delete bank accounts"
  ON public.company_bank_accounts FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

-- ── payment_transfers ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members can insert payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can update payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can delete payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Finance roles can insert payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Finance roles can update payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Finance roles can delete payment transfers" ON public.payment_transfers;

CREATE POLICY "Finance roles can insert payment transfers"
  ON public.payment_transfers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

CREATE POLICY "Finance roles can update payment transfers"
  ON public.payment_transfers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

CREATE POLICY "Finance roles can delete payment transfers"
  ON public.payment_transfers FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role IN ('owner', 'admin', 'member', 'support_admin')
  ));

NOTIFY pgrst, 'reload schema';
