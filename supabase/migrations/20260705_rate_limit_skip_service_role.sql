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
