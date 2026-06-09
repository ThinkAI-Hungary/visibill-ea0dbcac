-- Fix: Registration "Database error saving new user" — TWO root causes
--
-- ROOT CAUSE 1: handle_new_user() uses gen_random_bytes(32) to generate
-- an email verification token, but SET search_path TO 'public' excluded
-- the 'extensions' schema where gen_random_bytes lives (pgcrypto).
-- Error: "function gen_random_bytes(integer) does not exist (SQLSTATE 42883)"
--
-- ROOT CAUSE 2: initialize_user_subscription() was missing SECURITY DEFINER,
-- so RLS on user_subscriptions blocked the cascading INSERT because
-- auth.uid() is NULL in the trigger context.
--
-- Fix: Add 'extensions' to search_path in handle_new_user, and add
-- SECURITY DEFINER to initialize_user_subscription.

-- 1. Fix handle_new_user: add 'extensions' schema to search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  verify_token text;
  request_id bigint;
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';
  supabase_url text := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
BEGIN
  -- Generate verification token
  verify_token := encode(gen_random_bytes(32), 'hex');

  -- Insert profile
  INSERT INTO public.profiles (user_id, name, email_verified, email_verify_token)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    false,
    verify_token
  );

  -- Fire welcome email via pg_net (async server-to-server HTTP, no CORS)
  SELECT net.http_post(
    url := supabase_url || '/functions/v1/send-welcome-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', anon_key,
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object(
      'userId', NEW.id::text,
      'email', NEW.email,
      'name', COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
    )
  ) INTO request_id;
  
  RAISE LOG '[handle_new_user] Welcome email queued via pg_net, request_id: %', request_id;

  RETURN NEW;
END;
$function$;

-- 2. Fix initialize_user_subscription: add SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.initialize_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
  VALUES (NEW.user_id, 'teszt', 999999, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;
