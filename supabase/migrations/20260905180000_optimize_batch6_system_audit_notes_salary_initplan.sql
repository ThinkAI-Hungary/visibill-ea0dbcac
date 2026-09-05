-- ============================================================================
-- Migration: Batch 6 - Optimize RLS InitPlan (Chat, Audit, Notes, Salary & Core)
-- Date: 2026-09-05
-- Tables:
--   1. accounty_ai_chat_sessions (1 policy)
--   2. accounty_ai_chat_messages (1 policy)
--   3. accounty_audit_log (2 policies cleaned)
--   4. accounty_ev_audit_log (2 policies)
--   5. accounty_gdpr_requests (4 policies)
--   6. accounty_portal_tokens (1 policy)
--   7. api_keys (1 policy)
--   8. company_email_accounts (2 policies)
--   9. company_members (1 policy)
--  10. eaisybill_module_permissions (2 policies)
--  11. feedback (1 policy)
--  12. notes (4 policies)
--  13. pdf_export_jobs (5 policies)
--  14. salary (3 policies)
--  15. ticket_comments (1 policy)
-- Target Policies: Final 31 InitPlan warnings resolved (Reaching 0 total warnings)
-- Standards: ADR A-003, A-016, A-017, Supabase Postgres Best Practices
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. accounty_ai_chat_sessions
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_ai_chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.accounty_ai_chat_sessions;
DROP POLICY IF EXISTS "accounty_ai_chat_sessions_service_role_all" ON public.accounty_ai_chat_sessions;

CREATE POLICY "Users can manage own chat sessions"
  ON public.accounty_ai_chat_sessions
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "accounty_ai_chat_sessions_service_role_all"
  ON public.accounty_ai_chat_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 2. accounty_ai_chat_messages
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_ai_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own chat messages" ON public.accounty_ai_chat_messages;
DROP POLICY IF EXISTS "accounty_ai_chat_messages_service_role_all" ON public.accounty_ai_chat_messages;

CREATE POLICY "Users can manage own chat messages"
  ON public.accounty_ai_chat_messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_ai_chat_sessions s
      WHERE s.id = accounty_ai_chat_messages.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounty_ai_chat_sessions s
      WHERE s.id = accounty_ai_chat_messages.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "accounty_ai_chat_messages_service_role_all"
  ON public.accounty_ai_chat_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. accounty_audit_log
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop legacy unoptimized duplicate policies
DROP POLICY IF EXISTS "audit_log_insert" ON public.accounty_audit_log;
DROP POLICY IF EXISTS "audit_log_select" ON public.accounty_audit_log;
DROP POLICY IF EXISTS "accounty_audit_log_service_role_all" ON public.accounty_audit_log;

CREATE POLICY "accounty_audit_log_service_role_all"
  ON public.accounty_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 4. accounty_ev_audit_log
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_ev_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_ev_audit_log_insert" ON public.accounty_ev_audit_log;
DROP POLICY IF EXISTS "accounty_ev_audit_log_select" ON public.accounty_ev_audit_log;
DROP POLICY IF EXISTS "accounty_ev_audit_log_service_role_all" ON public.accounty_ev_audit_log;

CREATE POLICY "accounty_ev_audit_log_insert"
  ON public.accounty_ev_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = (SELECT auth.uid()));

CREATE POLICY "accounty_ev_audit_log_select"
  ON public.accounty_ev_audit_log
  FOR SELECT
  TO authenticated
  USING (
    (performed_by = (SELECT auth.uid()))
    OR has_accounty_company_access(company_id)
  );

CREATE POLICY "accounty_ev_audit_log_service_role_all"
  ON public.accounty_ev_audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 5. accounty_gdpr_requests
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_gdpr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdpr_select" ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS "gdpr_insert" ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS "gdpr_update" ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS "gdpr_delete" ON public.accounty_gdpr_requests;
DROP POLICY IF EXISTS "accounty_gdpr_requests_service_role_all" ON public.accounty_gdpr_requests;

CREATE POLICY "gdpr_select"
  ON public.accounty_gdpr_requests
  FOR SELECT
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_gdpr_requests.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_gdpr_requests.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "gdpr_insert"
  ON public.accounty_gdpr_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_gdpr_requests.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_gdpr_requests.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "gdpr_update"
  ON public.accounty_gdpr_requests
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_gdpr_requests.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_gdpr_requests.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_gdpr_requests.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = accounty_gdpr_requests.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "gdpr_delete"
  ON public.accounty_gdpr_requests
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounty_assignments aa
      WHERE aa.company_id = accounty_gdpr_requests.company_id
        AND aa.accountant_user_id = (SELECT auth.uid())
        AND aa.role = 'senior'::text
    )
  );

CREATE POLICY "accounty_gdpr_requests_service_role_all"
  ON public.accounty_gdpr_requests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 6. accounty_portal_tokens
-- ----------------------------------------------------------------------------
ALTER TABLE public.accounty_portal_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounty_portal_tokens_insert" ON public.accounty_portal_tokens;

CREATE POLICY "accounty_portal_tokens_insert"
  ON public.accounty_portal_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = (SELECT auth.uid()))
    AND has_accounty_company_access(company_id)
  );

-- ----------------------------------------------------------------------------
-- 7. api_keys
-- ----------------------------------------------------------------------------
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_keys_company_admin" ON public.api_keys;
DROP POLICY IF EXISTS "api_keys_service_role_all" ON public.api_keys;

CREATE POLICY "api_keys_company_admin"
  ON public.api_keys
  FOR ALL
  TO authenticated
  USING (
    ((company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )) OR (
      (company_id IS NULL) AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.role = ANY (ARRAY['thinkai'::text, 'management'::text])
        )
      )
    ))
  )
  WITH CHECK (
    ((company_id IN (
      SELECT cm.company_id
      FROM public.company_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )) OR (
      (company_id IS NULL) AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = (SELECT auth.uid())
            AND p.role = ANY (ARRAY['thinkai'::text, 'management'::text])
        )
      )
    ))
  );

CREATE POLICY "api_keys_service_role_all"
  ON public.api_keys
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 8. company_email_accounts
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_email_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view company email accounts" ON public.company_email_accounts;
DROP POLICY IF EXISTS "Company owners and admins can manage company email accounts" ON public.company_email_accounts;

CREATE POLICY "Company members can view company email accounts"
  ON public.company_email_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_email_accounts.company_id
        AND cm.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Company owners and admins can manage company email accounts"
  ON public.company_email_accounts
  FOR ALL
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_email_accounts.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_email_accounts.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_email_accounts.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_email_accounts.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text])
    ))
  );

-- ----------------------------------------------------------------------------
-- 9. company_members
-- ----------------------------------------------------------------------------
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner or admin can update members" ON public.company_members;

CREATE POLICY "Owner or admin can update members"
  ON public.company_members
  FOR UPDATE
  TO authenticated
  USING (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = (SELECT auth.uid())
        AND cm2.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
    ))
  )
  WITH CHECK (
    (EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = company_members.company_id
        AND c.owner_id = (SELECT auth.uid())
    ))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = company_members.company_id
        AND cm2.user_id = (SELECT auth.uid())
        AND cm2.role = ANY (ARRAY['admin'::text, 'owner'::text, 'support_admin'::text])
    ))
  );

-- ----------------------------------------------------------------------------
-- 10. eaisybill_module_permissions
-- ----------------------------------------------------------------------------
ALTER TABLE public.eaisybill_module_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage company module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "Users can read own module perms" ON public.eaisybill_module_permissions;
DROP POLICY IF EXISTS "eaisybill_module_permissions_service_role_all" ON public.eaisybill_module_permissions;

CREATE POLICY "Users can read own module perms"
  ON public.eaisybill_module_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Admins manage company module perms"
  ON public.eaisybill_module_permissions
  FOR ALL
  TO authenticated
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

CREATE POLICY "eaisybill_module_permissions_service_role_all"
  ON public.eaisybill_module_permissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 11. feedback
-- ----------------------------------------------------------------------------
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can delete feedback" ON public.feedback;

CREATE POLICY "Management can delete feedback"
  ON public.feedback
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = (SELECT auth.uid())
        AND p.is_support_admin = true
        AND p.role = ANY (ARRAY['management'::text, 'thinkai'::text])
    )
  );

-- ----------------------------------------------------------------------------
-- 12. notes
-- ----------------------------------------------------------------------------
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select own or shared company notes" ON public.notes;
DROP POLICY IF EXISTS "Users can insert notes as themselves for their company" ON public.notes;
DROP POLICY IF EXISTS "Users can update own or shared company notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own or shared company notes" ON public.notes;
DROP POLICY IF EXISTS "notes_service_role_all" ON public.notes;

CREATE POLICY "Users can select own or shared company notes"
  ON public.notes
  FOR SELECT
  TO authenticated
  USING (
    ((is_private = true) AND (user_id = (SELECT auth.uid())))
    OR
    ((is_private = false) AND (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = notes.company_id
        AND cm.user_id = (SELECT auth.uid())
    )))
  );

CREATE POLICY "Users can insert notes as themselves for their company"
  ON public.notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (user_id = (SELECT auth.uid()))
    AND
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = notes.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "Users can update own or shared company notes"
  ON public.notes
  FOR UPDATE
  TO authenticated
  USING (
    ((is_private = true) AND (user_id = (SELECT auth.uid())))
    OR
    ((is_private = false) AND (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = notes.company_id
        AND cm.user_id = (SELECT auth.uid())
    )))
  )
  WITH CHECK (
    ((is_private = true) AND (user_id = (SELECT auth.uid())))
    OR
    ((is_private = false) AND (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = notes.company_id
        AND cm.user_id = (SELECT auth.uid())
    )))
  );

CREATE POLICY "Users can delete own or shared company notes"
  ON public.notes
  FOR DELETE
  TO authenticated
  USING (
    ((is_private = true) AND (user_id = (SELECT auth.uid())))
    OR
    ((is_private = false) AND (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = notes.company_id
        AND cm.user_id = (SELECT auth.uid())
    )))
  );

CREATE POLICY "notes_service_role_all"
  ON public.notes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 13. pdf_export_jobs
-- ----------------------------------------------------------------------------
ALTER TABLE public.pdf_export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own export jobs" ON public.pdf_export_jobs;
DROP POLICY IF EXISTS "Users can update own export jobs" ON public.pdf_export_jobs;
DROP POLICY IF EXISTS "pdf_export_jobs_insert_own" ON public.pdf_export_jobs;
DROP POLICY IF EXISTS "pdf_export_jobs_select_own_company" ON public.pdf_export_jobs;
DROP POLICY IF EXISTS "pdf_export_jobs_update_own" ON public.pdf_export_jobs;
DROP POLICY IF EXISTS "pdf_export_jobs_service_role_all" ON public.pdf_export_jobs;

CREATE POLICY "pdf_export_jobs_select_own_company"
  ON public.pdf_export_jobs
  FOR SELECT
  TO authenticated
  USING (
    (user_id = (SELECT auth.uid()))
    OR
    (EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = pdf_export_jobs.company_id
        AND cm.user_id = (SELECT auth.uid())
    ))
  );

CREATE POLICY "pdf_export_jobs_insert_own"
  ON public.pdf_export_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "pdf_export_jobs_update_own"
  ON public.pdf_export_jobs
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "pdf_export_jobs_service_role_all"
  ON public.pdf_export_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 14. salary
-- ----------------------------------------------------------------------------
ALTER TABLE public.salary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can create salary" ON public.salary;
DROP POLICY IF EXISTS "Members can update salary" ON public.salary;
DROP POLICY IF EXISTS "Members can delete salary" ON public.salary;
DROP POLICY IF EXISTS "salary_service_role_all" ON public.salary;

CREATE POLICY "Members can create salary"
  ON public.salary
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = salary.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

CREATE POLICY "Members can update salary"
  ON public.salary
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = salary.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = salary.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

CREATE POLICY "Members can delete salary"
  ON public.salary
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = salary.company_id
        AND cm.user_id = (SELECT auth.uid())
        AND cm.role = ANY (ARRAY['owner'::text, 'admin'::text, 'support_admin'::text])
    )
  );

CREATE POLICY "salary_service_role_all"
  ON public.salary
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 15. ticket_comments
-- ----------------------------------------------------------------------------
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view comments on their tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "ticket_comments_service_role_all" ON public.ticket_comments;

CREATE POLICY "Users can view comments on their tickets"
  ON public.ticket_comments
  FOR SELECT
  TO authenticated
  USING (
    is_support_admin()
    OR (
      (EXISTS (
        SELECT 1 FROM public.feedback f
        WHERE f.id = ticket_comments.feedback_id
          AND f.user_id = (SELECT auth.uid())
      ))
      AND (is_internal = false)
    )
  );

CREATE POLICY "ticket_comments_service_role_all"
  ON public.ticket_comments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 16. Security Hardening: Revoke direct anon privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.accounty_ai_chat_sessions FROM anon;
REVOKE ALL ON TABLE public.accounty_ai_chat_messages FROM anon;
REVOKE ALL ON TABLE public.accounty_audit_log FROM anon;
REVOKE ALL ON TABLE public.accounty_ev_audit_log FROM anon;
REVOKE ALL ON TABLE public.accounty_gdpr_requests FROM anon;
REVOKE ALL ON TABLE public.api_keys FROM anon;
REVOKE ALL ON TABLE public.company_email_accounts FROM anon;
REVOKE ALL ON TABLE public.eaisybill_module_permissions FROM anon;
REVOKE ALL ON TABLE public.notes FROM anon;
REVOKE ALL ON TABLE public.pdf_export_jobs FROM anon;
REVOKE ALL ON TABLE public.salary FROM anon;
