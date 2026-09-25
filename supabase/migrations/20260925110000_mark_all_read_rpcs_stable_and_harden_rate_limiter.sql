-- ============================================================
-- Migration: Mark All Read-Only RPC Functions as STABLE & Harden Rate Limiter
-- Description: 
--   1. Marks all remaining 24 read-only analytical, filtering, and reporting
--      RPC functions as STABLE. This guarantees PostgREST executes them
--      in read-only transactions (transaction_read_only = 'on').
--   2. Updates public.check_request() pre-request hook to explicitly
--      exempt read-only /rpc/get_*, /rpc/fetch_*, /rpc/suggest_* paths
--      from mutating rate limits, completely eliminating HTTP 429 false positives.
-- Date: 2026-09-25
-- Related ADR: A-152 (Rate Limiter RPC Stability & Realtime Leak Hardening)
-- ============================================================

-- 1. Mark analytical, filtering, and reporting RPC functions as STABLE
ALTER FUNCTION public.get_accounty_dashboard_kpis(uuid[], date, date) STABLE;
ALTER FUNCTION public.get_bs_report(uuid, uuid, date, integer, jsonb) STABLE;
ALTER FUNCTION public.get_company_email_accounts(uuid) STABLE;
ALTER FUNCTION public.get_company_email_settings(uuid) STABLE;
ALTER FUNCTION public.get_courier_reports_counts_by_upload(uuid[]) STABLE;
ALTER FUNCTION public.get_default_company_smtp(uuid) STABLE;
ALTER FUNCTION public.get_filtered_nav_invoices(uuid, date, date, text, text, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, uuid, text, text, date, date, text, text) STABLE;
ALTER FUNCTION public.get_filtered_submitted_invoices(uuid, date, date, text, text, text, text, text, text, numeric, numeric, text, text, integer, integer, date, date, text, text, date, date, text, text) STABLE;
ALTER FUNCTION public.get_fx_differences(uuid, date, date) STABLE;
ALTER FUNCTION public.get_gl_account_card_items(uuid, uuid, uuid, character varying, date, date, boolean, character varying, character varying) STABLE;
ALTER FUNCTION public.get_gl_analytic_reconciliation(uuid, uuid, date) STABLE;
ALTER FUNCTION public.get_invoice_aggregates(uuid, date, date) STABLE;
ALTER FUNCTION public.get_invoice_kpis(uuid, date, date, text, text, text, text, text, text, text, numeric, numeric, date, date, text, text, date, date, text, text) STABLE;
ALTER FUNCTION public.get_linked_invoices(uuid, text[], text[], uuid[]) STABLE;
ALTER FUNCTION public.get_management_files(integer, integer, text, text, text, uuid, uuid, text, text, timestamp with time zone, timestamp with time zone) STABLE;
ALTER FUNCTION public.get_nav_invoice_aggregates(uuid, date, date) STABLE;
ALTER FUNCTION public.get_partner_ledger_card(uuid, uuid, date, date) STABLE;
ALTER FUNCTION public.get_partner_monthly_cash_total(uuid, uuid, text, date) STABLE;
ALTER FUNCTION public.get_partner_ranking(uuid, date, date) STABLE;
ALTER FUNCTION public.get_petty_cash_balance(uuid) STABLE;
ALTER FUNCTION public.get_single_email_account(uuid) STABLE;
ALTER FUNCTION public.get_transaction_filter_options(uuid) STABLE;
ALTER FUNCTION public.get_unclassified_gl_items(uuid, text) STABLE;
ALTER FUNCTION public.get_upo_credentials_status(uuid, text) STABLE;

-- 2. Update public.check_request() pre-request hook with defense-in-depth RPC bypass
CREATE OR REPLACE FUNCTION public.check_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  req_method text := current_setting('request.method', true);
  req_path text := current_setting('request.path', true);
  req_ip inet;
  jwt_role text := current_setting('request.jwt.claims', true)::json->>'role';
  count_in_window integer;
  max_requests integer;
  raw_ip text;

  -- Headers and bot/script detection variables
  v_headers_raw text;
  v_headers json;
  v_user_agent text := '';
  v_client_info text := '';
  v_origin text := '';
  v_referer text := '';
  v_is_script boolean := false;
BEGIN
  -- 1. Trusted server-side bypass: service_role (Worker, Cron jobs, internal Supabase services)
  -- service_role already bypasses RLS — rate limiting and bot blocking adds no security.
  IF jwt_role = 'service_role' THEN
    RETURN;
  END IF;

  -- 2. Extract and parse HTTP headers
  v_headers_raw := current_setting('request.headers', true);
  IF v_headers_raw IS NOT NULL AND v_headers_raw != '' THEN
    BEGIN
      v_headers := v_headers_raw::json;
      v_user_agent := lower(coalesce(v_headers->>'user-agent', ''));
      v_client_info := lower(coalesce(v_headers->>'x-client-info', ''));
      v_origin := coalesce(v_headers->>'origin', '');
      v_referer := coalesce(v_headers->>'referer', '');
    EXCEPTION WHEN OTHERS THEN
      v_headers := NULL;
    END;
  END IF;

  -- 3. Script / Automation Shield for authenticated user sessions
  -- Restricts direct PostgREST calls from scripts (Node.js, Python, curl, Postman, etc.)
  IF jwt_role = 'authenticated' THEN
    -- Allow internal Edge Function calls (Deno runtime)
    IF NOT (v_user_agent LIKE 'deno%' OR v_client_info LIKE '%deno%') THEN
      -- Case A: Known script runners / bot user-agents
      IF v_user_agent = ''
         OR v_user_agent LIKE 'node%'
         OR v_user_agent LIKE '%node-fetch%'
         OR v_user_agent LIKE '%axios%'
         OR v_user_agent LIKE '%undici%'
         OR v_user_agent LIKE 'python%'
         OR v_user_agent LIKE '%aiohttp%'
         OR v_user_agent LIKE '%requests%'
         OR v_user_agent LIKE '%urllib%'
         OR v_user_agent LIKE 'curl%'
         OR v_user_agent LIKE 'wget%'
         OR v_user_agent LIKE 'httpie%'
         OR v_user_agent LIKE '%postman%'
         OR v_user_agent LIKE '%insomnia%'
         OR v_user_agent LIKE '%go-http-client%'
         OR v_user_agent LIKE 'powershell%' THEN
        v_is_script := true;
      -- Case B: Missing both Origin and Referer (non-browser execution)
      ELSIF v_origin = '' AND v_referer = '' THEN
        v_is_script := true;
      END IF;
    END IF;

    -- Block automated scripts with HTTP 403 Forbidden
    IF v_is_script THEN
      RAISE sqlstate 'PGRST' USING
        message = json_build_object(
          'code',    'AUTOMATION_BLOCKED',
          'message', 'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
          'details', 'Direct script automation is restricted. Please use the official Visibill web application.'
        )::text,
        detail = json_build_object(
          'status', 403,
          'headers', json_build_object(
            'Content-Type', 'application/json'
          )
        )::text;
    END IF;
  END IF;

  -- 4. Rate Limiter (Only applies to mutating requests: POST, PATCH, DELETE)
  -- GET / HEAD are read-only; STABLE/IMMUTABLE RPCs execute in read-only transactions.
  IF req_method IS NULL OR req_method = 'GET' OR req_method = 'HEAD' THEN
    RETURN;
  END IF;

  IF current_setting('transaction_read_only', true) = 'on' THEN
    RETURN;
  END IF;

  -- Skip rate limiting if the request is calling an analytical / read-only RPC endpoint
  IF req_path IS NOT NULL AND (
    req_path LIKE '/rpc/get_%' OR 
    req_path LIKE '/rpc/fetch_%' OR 
    req_path LIKE '/rpc/suggest_%'
  ) THEN
    RETURN;
  END IF;

  -- Extract client IP from X-Forwarded-For header
  IF v_headers IS NOT NULL THEN
    raw_ip := split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1);
  ELSE
    raw_ip := '';
  END IF;

  IF raw_ip IS NULL OR raw_ip = '' THEN
    RETURN;
  END IF;

  BEGIN
    req_ip := raw_ip::inet;
  EXCEPTION WHEN OTHERS THEN
    RETURN;
  END;

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

REVOKE ALL ON FUNCTION public.check_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_request() TO anon, authenticated, service_role;
