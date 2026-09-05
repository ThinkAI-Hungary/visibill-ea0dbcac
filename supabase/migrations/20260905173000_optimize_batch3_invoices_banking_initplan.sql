-- ============================================================================
-- Migration: Batch 3 - Optimize RLS InitPlan (Banking, Transfers & Rules)
-- Date: 2026-09-05
-- Tables:
--   1. company_bank_accounts (2 policies)
--   2. payment_transfers (2 policies)
--   3. company_fx_settings (3 policies)
--   4. transaction_rules (4 policies)
--   5. item_project_rules (3 policies)
--   6. company_prompt_rules (4 policies)
--   7. reverse_charge_entries (1 policy)
-- Total Target Policies: 19 InitPlan warnings resolved
-- Standards: ADR A-003, A-016, A-017, Supabase Postgres Best Practices
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. company_bank_accounts
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "Members can view bank accounts" ON public.company_bank_accounts;
DROP POLICY IF EXISTS "company_bank_accounts_service_role_all" ON public.company_bank_accounts;

CREATE POLICY "Members can view bank accounts"
  ON public.company_bank_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_bank_accounts.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can manage bank accounts"
  ON public.company_bank_accounts
  FOR ALL
  TO authenticated
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

CREATE POLICY "company_bank_accounts_service_role_all"
  ON public.company_bank_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. payment_transfers
-- ----------------------------------------------------------------------------
ALTER TABLE public.payment_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can manage payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "Members can view payment transfers" ON public.payment_transfers;
DROP POLICY IF EXISTS "payment_transfers_service_role_all" ON public.payment_transfers;

CREATE POLICY "Members can view payment transfers"
  ON public.payment_transfers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = payment_transfers.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can manage payment transfers"
  ON public.payment_transfers
  FOR ALL
  TO authenticated
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

CREATE POLICY "payment_transfers_service_role_all"
  ON public.payment_transfers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. company_fx_settings
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_fx_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can insert company_fx_settings" ON public.company_fx_settings;
DROP POLICY IF EXISTS "Members can update company_fx_settings" ON public.company_fx_settings;
DROP POLICY IF EXISTS "Members can view company_fx_settings" ON public.company_fx_settings;
DROP POLICY IF EXISTS "Members can delete company_fx_settings" ON public.company_fx_settings;
DROP POLICY IF EXISTS "company_fx_settings_service_role_all" ON public.company_fx_settings;

CREATE POLICY "Members can view company_fx_settings"
  ON public.company_fx_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_fx_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can insert company_fx_settings"
  ON public.company_fx_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_fx_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can update company_fx_settings"
  ON public.company_fx_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_fx_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_fx_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Members can delete company_fx_settings"
  ON public.company_fx_settings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_fx_settings.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "company_fx_settings_service_role_all"
  ON public.company_fx_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. transaction_rules
-- ----------------------------------------------------------------------------
ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable delete for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable insert for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable read access for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "Enable update for transaction rules" ON public.transaction_rules;
DROP POLICY IF EXISTS "transaction_rules_service_role_all" ON public.transaction_rules;

CREATE POLICY "Enable read access for transaction rules"
  ON public.transaction_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = transaction_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Enable insert for transaction rules"
  ON public.transaction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = transaction_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Enable update for transaction rules"
  ON public.transaction_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = transaction_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = transaction_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Enable delete for transaction rules"
  ON public.transaction_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = transaction_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "transaction_rules_service_role_all"
  ON public.transaction_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. item_project_rules
-- ----------------------------------------------------------------------------
ALTER TABLE public.item_project_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow delete access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "Allow insert access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "Allow read access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "Allow update access for company members" ON public.item_project_rules;
DROP POLICY IF EXISTS "item_project_rules_service_role_all" ON public.item_project_rules;

CREATE POLICY "Allow read access for company members"
  ON public.item_project_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = item_project_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Allow insert access for company members"
  ON public.item_project_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = item_project_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Allow update access for company members"
  ON public.item_project_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = item_project_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = item_project_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Allow delete access for company members"
  ON public.item_project_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = item_project_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "item_project_rules_service_role_all"
  ON public.item_project_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. company_prompt_rules
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_prompt_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable delete for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable insert for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable read access for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "Enable update for company prompt rules" ON public.company_prompt_rules;
DROP POLICY IF EXISTS "company_prompt_rules_service_role_all" ON public.company_prompt_rules;

CREATE POLICY "Enable read access for company prompt rules"
  ON public.company_prompt_rules
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_prompt_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = company_prompt_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Enable insert for company prompt rules"
  ON public.company_prompt_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_prompt_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = company_prompt_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Enable update for company prompt rules"
  ON public.company_prompt_rules
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_prompt_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = company_prompt_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_prompt_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = company_prompt_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Enable delete for company prompt rules"
  ON public.company_prompt_rules
  FOR DELETE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_prompt_rules.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = company_prompt_rules.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "company_prompt_rules_service_role_all"
  ON public.company_prompt_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 7. reverse_charge_entries
-- ----------------------------------------------------------------------------
ALTER TABLE public.reverse_charge_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rce_company_policy" ON public.reverse_charge_entries;
DROP POLICY IF EXISTS "reverse_charge_entries_service_role_all" ON public.reverse_charge_entries;

CREATE POLICY "rce_company_policy"
  ON public.reverse_charge_entries
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = reverse_charge_entries.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = reverse_charge_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = reverse_charge_entries.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = reverse_charge_entries.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "reverse_charge_entries_service_role_all"
  ON public.reverse_charge_entries
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. Security Hardening: Revoke direct anon privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.company_bank_accounts FROM anon;
REVOKE ALL ON TABLE public.payment_transfers FROM anon;
REVOKE ALL ON TABLE public.company_fx_settings FROM anon;
REVOKE ALL ON TABLE public.transaction_rules FROM anon;
REVOKE ALL ON TABLE public.item_project_rules FROM anon;
REVOKE ALL ON TABLE public.company_prompt_rules FROM anon;
REVOKE ALL ON TABLE public.reverse_charge_entries FROM anon;
