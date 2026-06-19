-- Add registration_source to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS registration_source TEXT;

-- Update handle_new_user trigger function to parse and pass source
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
  INSERT INTO public.profiles (user_id, name, email_verified, email_verify_token, registration_source)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'name',
    false,
    verify_token,
    COALESCE(NEW.raw_user_meta_data ->> 'source', 'eaisybill')
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
      'name', COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
      'source', COALESCE(NEW.raw_user_meta_data ->> 'source', 'eaisybill')
    )
  ) INTO request_id;
  
  RAISE LOG '[handle_new_user] Welcome email queued via pg_net, request_id: %', request_id;

  RETURN NEW;
END;
$function$;
