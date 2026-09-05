-- ===========================================================================
-- Batch POL-2: ALL vs SELECT Overlap on Core Master Tables
-- Eliminates multiple_permissive_policies on:
--   company_bank_accounts, company_email_accounts, payment_transfers,
--   feedback, eaisybill_module_permissions, accounty_module_permissions
-- ===========================================================================

-- 1. company_bank_accounts
DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can insert bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can update bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can delete bank accounts" ON public.company_bank_accounts;

CREATE POLICY "Members can insert bank accounts" ON public.company_bank_accounts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can update bank accounts" ON public.company_bank_accounts
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can delete bank accounts" ON public.company_bank_accounts
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_bank_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

-- 2. company_email_accounts
-- Drop duplicate redundant SELECT policy
DROP POLICY IF EXISTS "Members can view company_email_accounts" ON public.company_email_accounts;
DROP POLICY IF EXISTS "Company owners and admins can manage company email accounts" ON public.company_email_accounts;
DROP POLICY IF EXISTS "Company owners and admins can insert company email accounts" ON public.company_email_accounts;
DROP POLICY IF EXISTS "Company owners and admins can update company email accounts" ON public.company_email_accounts;
DROP POLICY IF EXISTS "Company owners and admins can delete company email accounts" ON public.company_email_accounts;

CREATE POLICY "Company owners and admins can insert company email accounts" ON public.company_email_accounts
FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_email_accounts.company_id AND c.owner_id = (SELECT auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_email_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ))
);

CREATE POLICY "Company owners and admins can update company email accounts" ON public.company_email_accounts
FOR UPDATE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_email_accounts.company_id AND c.owner_id = (SELECT auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_email_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ))
)
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_email_accounts.company_id AND c.owner_id = (SELECT auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_email_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ))
);

CREATE POLICY "Company owners and admins can delete company email accounts" ON public.company_email_accounts
FOR DELETE TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = company_email_accounts.company_id AND c.owner_id = (SELECT auth.uid())
  ))
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = company_email_accounts.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
  ))
);

-- 3. payment_transfers
DROP POLICY IF EXISTS "Members can manage payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can insert payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can update payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can delete payment transfers" ON public.payment_transfers;

CREATE POLICY "Members can insert payment transfers" ON public.payment_transfers
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can update payment transfers" ON public.payment_transfers
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

CREATE POLICY "Members can delete payment transfers" ON public.payment_transfers
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = payment_transfers.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role <> ALL (ARRAY['employee'::text, 'viewer'::text])
  )
);

-- 4. feedback
DROP POLICY IF EXISTS "Support admins can select all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can read own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Users can read feedback" ON public.feedback;

CREATE POLICY "Users can read feedback" ON public.feedback
FOR SELECT TO authenticated
USING (
  ((SELECT auth.uid()) = user_id)
  OR is_support_admin()
);

-- 5. eaisybill_module_permissions
DROP POLICY IF EXISTS "Admins manage company module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Users can read own module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Users can view module permissions" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Admins insert company module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Admins update company module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Admins delete company module perms" ON public.eaisybill_module_permissions;

CREATE POLICY "Users can view module permissions" ON public.eaisybill_module_permissions
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()))
  OR (EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = eaisybill_module_permissions.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
  ))
);

CREATE POLICY "Admins insert company module perms" ON public.eaisybill_module_permissions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = eaisybill_module_permissions.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
  )
);

CREATE POLICY "Admins update company module perms" ON public.eaisybill_module_permissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = eaisybill_module_permissions.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = eaisybill_module_permissions.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
  )
);

CREATE POLICY "Admins delete company module perms" ON public.eaisybill_module_permissions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.company_id = eaisybill_module_permissions.company_id
      AND cm.user_id = (SELECT auth.uid())
      AND cm.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
  )
);

-- 6. accounty_module_permissions
DROP POLICY IF EXISTS "module_perms_manage" ON public.accounty_module_permissions;
DROP POLICY IF EXISTS "module_perms_select" ON public.accounty_module_permissions;
DROP POLICY IF EXISTS "module_perms_insert" ON public.accounty_module_permissions;
DROP POLICY IF EXISTS "module_perms_update" ON public.accounty_module_permissions;
DROP POLICY IF EXISTS "module_perms_delete" ON public.accounty_module_permissions;

CREATE POLICY "module_perms_select" ON public.accounty_module_permissions
FOR SELECT TO authenticated
USING (
  (user_id = (SELECT auth.uid()))
  OR is_iroda_admin_for_firm(accounting_firm_id)
);

CREATE POLICY "module_perms_insert" ON public.accounty_module_permissions
FOR INSERT TO authenticated
WITH CHECK (is_iroda_admin_for_firm(accounting_firm_id));

CREATE POLICY "module_perms_update" ON public.accounty_module_permissions
FOR UPDATE TO authenticated
USING (is_iroda_admin_for_firm(accounting_firm_id))
WITH CHECK (is_iroda_admin_for_firm(accounting_firm_id));

CREATE POLICY "module_perms_delete" ON public.accounty_module_permissions
FOR DELETE TO authenticated
USING (is_iroda_admin_for_firm(accounting_firm_id));
