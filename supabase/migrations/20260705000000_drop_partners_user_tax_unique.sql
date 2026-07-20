-- ==================================================
-- MERGED FROM: 20260705_drop_partners_user_tax_unique.sql
-- ==================================================
-- ============================================================
-- Fix: Drop invalid partners_user_tax_unique index
-- ============================================================
-- Problem: The UNIQUE INDEX (user_id, tax_number) prevents
-- multi-company users from having the same partner (e.g.
-- Magyar Telekom) in multiple companies. Error 23505:
-- "duplicate key value violates unique constraint
--  partners_user_tax_unique"
--
-- Root cause: This index was created pre-company_id era
-- (migration 20251205) when partners were user-scoped.
-- After company_id was introduced, the correct dedup key
-- became (company_id, tax_number) — which already exists
-- as partners_company_id_tax_number_key.
--
-- The user_id column is a "creator stamp", not a tenant ID.
-- A-024 ADR confirms: dedup is (company_id, tax_number).
-- ============================================================

DROP INDEX IF EXISTS partners_user_tax_unique;


-- ==================================================
-- MERGED FROM: 20260705_feedback_delete_policy.sql
-- ==================================================
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


-- ==================================================
-- MERGED FROM: 20260705_fix_stable_rpc_readonly_conflict.sql
-- ==================================================
-- ============================================================
-- Fix: STABLE → VOLATILE for RPC functions called via PostgREST
-- ============================================================
-- Problem: PostgREST runs the check_request() pre-request hook
-- inside the SAME transaction as the RPC call. When an RPC function
-- is declared STABLE, PostgreSQL opens a READ-ONLY transaction.
-- The check_request() hook does INSERT INTO private.rate_limits,
-- which fails with: "cannot execute INSERT in a read-only transaction"
-- (SQLSTATE 25006), causing the entire RPC to return HTTP 405.
--
-- Fix: Change STABLE → VOLATILE for RPC functions exposed to
-- PostgREST via POST. The functions themselves only do SELECTs,
-- but the enclosing transaction must allow writes for the
-- pre-request hook to work.
-- ============================================================

-- 1. get_accounty_dashboard_kpis
DROP FUNCTION IF EXISTS public.get_accounty_dashboard_kpis(UUID[], DATE, DATE);

CREATE OR REPLACE FUNCTION public.get_accounty_dashboard_kpis(
  p_company_ids UUID[],
  p_now_date DATE,
  p_week_date DATE
)
RETURNS TABLE(
  missing_items BIGINT,
  upcoming_deadlines BIGINT,
  critical_clients BIGINT,
  today_deadlines BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('open', 'notified'))::BIGINT AS missing_items,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date >= p_now_date
       AND due_date <= p_week_date)::BIGINT AS upcoming_deadlines,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_missing_items
     WHERE company_id = ANY(p_company_ids)
       AND priority = 'urgent'
       AND status IN ('open', 'notified'))::BIGINT AS critical_clients,

    (SELECT COALESCE(COUNT(*), 0)
     FROM public.accounty_deadlines
     WHERE company_id = ANY(p_company_ids)
       AND status IN ('pending', 'in_progress')
       AND due_date = p_now_date)::BIGINT AS today_deadlines;
END;
$$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_accounty_dashboard_kpis(UUID[], DATE, DATE) TO authenticated;

-- Force PostgREST schema cache reload
SELECT pg_notify('pgrst', 'reload schema');


-- ==================================================
-- MERGED FROM: 20260705_pdf_export_jobs.sql
-- ==================================================
-- PDF Export Jobs — Tracks server-side PDF export jobs for submitted invoices

CREATE TABLE IF NOT EXISTS pdf_export_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','error','cancelled','downloaded','expired')),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  invoice_direction TEXT CHECK (invoice_direction IN ('INBOUND', 'OUTBOUND') OR invoice_direction IS NULL),
  total_invoices INT DEFAULT 0,
  processed_invoices INT DEFAULT 0,
  current_invoice_name TEXT,
  result_urls TEXT[],
  result_sizes BIGINT[],
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE pdf_export_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pdf_export_jobs_select_own_company"
  ON pdf_export_jobs FOR SELECT
  USING (company_id IN (SELECT company_id FROM company_members WHERE user_id = auth.uid()));

CREATE POLICY "pdf_export_jobs_insert_own"
  ON pdf_export_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pdf_export_jobs_update_own"
  ON pdf_export_jobs FOR UPDATE
  USING (user_id = auth.uid());

CREATE INDEX idx_pdf_export_jobs_company_status ON pdf_export_jobs(company_id, status);
CREATE INDEX idx_pdf_export_jobs_user_status ON pdf_export_jobs(user_id, status);

ALTER PUBLICATION supabase_realtime ADD TABLE pdf_export_jobs;

CREATE OR REPLACE FUNCTION update_pdf_export_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pdf_export_jobs_updated_at
  BEFORE UPDATE ON pdf_export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_pdf_export_jobs_updated_at();


-- ==================================================
-- MERGED FROM: 20260705_rate_limit_skip_service_role.sql
-- ==================================================
-- ============================================================
-- Fix: Skip rate limiting for service_role callers
-- ============================================================
-- Problem: The check_request() pre-request hook rate-limits ALL
-- PostgREST mutations at 500 req / 5 min per IP. Server-side
-- callers (Worker, Edge Functions, cron jobs) share few IPs and
-- easily exceed this limit, blocking real users.
--
-- Root cause: nav-auto-sync cron (02:00 UTC) generates 500+
-- mutations in <1 minute from a single AWS IP, exhausting the
-- quota. The worker adds ~25-30/min from its DigitalOcean IP.
--
-- Fix: Early RETURN for service_role JWT. These are trusted
-- server-side callers. service_role already bypasses RLS, so
-- rate limiting it provides no additional security benefit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req_method text := current_setting('request.method', true);
  req_ip inet;
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
  count_in_window integer;
  max_requests integer;
  raw_ip text;
BEGIN
  -- Only rate-limit mutating requests (GET/HEAD are read-only)
  IF req_method IS NULL OR req_method = 'GET' OR req_method = 'HEAD' THEN
    RETURN;
  END IF;

  -- Skip rate limiting for service_role (Worker, Edge Functions, cron jobs).
  -- These are trusted server-side callers, not end-user traffic.
  -- service_role already bypasses RLS — rate limiting adds no security.
  IF jwt_role = 'service_role' THEN
    RETURN;
  END IF;

  -- Extract client IP from X-Forwarded-For header
  raw_ip := split_part(
    current_setting('request.headers', true)::json->>'x-forwarded-for',
    ',', 1);
  
  -- If no IP available, skip rate limiting
  IF raw_ip IS NULL OR raw_ip = '' THEN
    RETURN;
  END IF;

  req_ip := raw_ip::inet;

  -- Set max requests based on role
  IF jwt_role = 'anon' OR jwt_role IS NULL THEN
    max_requests := 10;    -- anon: 10 mutations per 5 min
  ELSE
    max_requests := 500;   -- authenticated: 500 mutations per 5 min
  END IF;

  -- Count recent requests from this IP
  SELECT count(*) INTO count_in_window
  FROM private.rate_limits
  WHERE ip = req_ip 
    AND request_at > now() - interval '5 minutes';

  -- Enforce limit
  IF count_in_window >= max_requests THEN
    RAISE sqlstate 'PGRST' USING
      message = json_build_object(
        'code',    'RATE_LIMIT_EXCEEDED',
        'message', 'Túl sok kérés érkezett. Kérjük próbáld újra 1 perc múlva.',
        'details', format('Rate limit: %s requests per 5 minutes exceeded', max_requests)
      )::text,
      detail = json_build_object(
        'status', 429,
        'headers', json_build_object(
          'Retry-After', '60',
          'X-RateLimit-Limit', max_requests::text,
          'X-RateLimit-Remaining', '0'
        )
      )::text;
  END IF;

  -- Record this request
  INSERT INTO private.rate_limits (ip, request_at) VALUES (req_ip, now());
END;
$function$;
