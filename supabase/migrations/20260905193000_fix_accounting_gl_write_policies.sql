-- ===========================================================================
-- Batch POL-4: General Ledger & Accounting Write Policies (Acc Module)
-- Eliminates multiple_permissive_policies on:
--   acc_accounting_periods, acc_journal_counters, acc_journal_headers,
--   acc_journal_lines, acc_journals, gl_audit_accounts, gl_audit_partners
-- ===========================================================================

-- 1. acc_accounting_periods
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_write" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_insert" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_update" ON public.acc_accounting_periods;
DROP POLICY IF EXISTS "acc_accounting_periods_authenticated_delete" ON public.acc_accounting_periods;

CREATE POLICY "acc_accounting_periods_authenticated_insert" ON public.acc_accounting_periods
FOR INSERT TO authenticated
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_accounting_periods_authenticated_update" ON public.acc_accounting_periods
FOR UPDATE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
)
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_accounting_periods_authenticated_delete" ON public.acc_accounting_periods
FOR DELETE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

-- 2. acc_journal_counters
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_write" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_insert" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_update" ON public.acc_journal_counters;
DROP POLICY IF EXISTS "acc_journal_counters_authenticated_delete" ON public.acc_journal_counters;

CREATE POLICY "acc_journal_counters_authenticated_insert" ON public.acc_journal_counters
FOR INSERT TO authenticated
WITH CHECK (
  (journal_id IN (
    SELECT j.id FROM public.acc_journals j
    WHERE j.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_counters_authenticated_update" ON public.acc_journal_counters
FOR UPDATE TO authenticated
USING (
  (journal_id IN (
    SELECT j.id FROM public.acc_journals j
    WHERE j.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
)
WITH CHECK (
  (journal_id IN (
    SELECT j.id FROM public.acc_journals j
    WHERE j.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_counters_authenticated_delete" ON public.acc_journal_counters
FOR DELETE TO authenticated
USING (
  (journal_id IN (
    SELECT j.id FROM public.acc_journals j
    WHERE j.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

-- 3. acc_journal_headers
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_write" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_insert" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_update" ON public.acc_journal_headers;
DROP POLICY IF EXISTS "acc_journal_headers_authenticated_delete" ON public.acc_journal_headers;

CREATE POLICY "acc_journal_headers_authenticated_insert" ON public.acc_journal_headers
FOR INSERT TO authenticated
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_headers_authenticated_update" ON public.acc_journal_headers
FOR UPDATE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
)
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_headers_authenticated_delete" ON public.acc_journal_headers
FOR DELETE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

-- 4. acc_journal_lines
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_write" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_insert" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_update" ON public.acc_journal_lines;
DROP POLICY IF EXISTS "acc_journal_lines_authenticated_delete" ON public.acc_journal_lines;

CREATE POLICY "acc_journal_lines_authenticated_insert" ON public.acc_journal_lines
FOR INSERT TO authenticated
WITH CHECK (
  (header_id IN (
    SELECT h.id FROM public.acc_journal_headers h
    WHERE h.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_lines_authenticated_update" ON public.acc_journal_lines
FOR UPDATE TO authenticated
USING (
  (header_id IN (
    SELECT h.id FROM public.acc_journal_headers h
    WHERE h.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
)
WITH CHECK (
  (header_id IN (
    SELECT h.id FROM public.acc_journal_headers h
    WHERE h.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journal_lines_authenticated_delete" ON public.acc_journal_lines
FOR DELETE TO authenticated
USING (
  (header_id IN (
    SELECT h.id FROM public.acc_journal_headers h
    WHERE h.company_id IN (
      SELECT cm.company_id FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
    )
  ))
  OR is_support_admin()
);

-- 5. acc_journals
DROP POLICY IF EXISTS "acc_journals_authenticated_write" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_authenticated_insert" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_authenticated_update" ON public.acc_journals;
DROP POLICY IF EXISTS "acc_journals_authenticated_delete" ON public.acc_journals;

CREATE POLICY "acc_journals_authenticated_insert" ON public.acc_journals
FOR INSERT TO authenticated
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journals_authenticated_update" ON public.acc_journals
FOR UPDATE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
)
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "acc_journals_authenticated_delete" ON public.acc_journals
FOR DELETE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

-- 6. gl_audit_accounts
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_write" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_insert" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_update" ON public.gl_audit_accounts;
DROP POLICY IF EXISTS "gl_audit_accounts_authenticated_delete" ON public.gl_audit_accounts;

CREATE POLICY "gl_audit_accounts_authenticated_insert" ON public.gl_audit_accounts
FOR INSERT TO authenticated
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "gl_audit_accounts_authenticated_update" ON public.gl_audit_accounts
FOR UPDATE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
)
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "gl_audit_accounts_authenticated_delete" ON public.gl_audit_accounts
FOR DELETE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

-- 7. gl_audit_partners
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_write" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_insert" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_update" ON public.gl_audit_partners;
DROP POLICY IF EXISTS "gl_audit_partners_authenticated_delete" ON public.gl_audit_partners;

CREATE POLICY "gl_audit_partners_authenticated_insert" ON public.gl_audit_partners
FOR INSERT TO authenticated
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "gl_audit_partners_authenticated_update" ON public.gl_audit_partners
FOR UPDATE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
)
WITH CHECK (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);

CREATE POLICY "gl_audit_partners_authenticated_delete" ON public.gl_audit_partners
FOR DELETE TO authenticated
USING (
  (company_id IN (
    SELECT cm.company_id FROM public.company_members cm
    WHERE cm.user_id = (SELECT auth.uid())
  ))
  OR is_support_admin()
);
