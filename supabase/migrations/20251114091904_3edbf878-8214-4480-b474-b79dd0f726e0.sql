-- Create a function to send welcome email via Edge Function
CREATE OR REPLACE FUNCTION public.send_welcome_email_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Get user email and name from auth.users
  SELECT 
    email,
    COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
  INTO user_email, user_name
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Call the edge function asynchronously using pg_net
  PERFORM
    net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-welcome-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'userId', NEW.user_id,
        'email', user_email,
        'name', user_name
      )
    );

  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (fires when new profile is created after signup)
DROP TRIGGER IF EXISTS on_profile_created_send_welcome_email ON public.profiles;
CREATE TRIGGER on_profile_created_send_welcome_email
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email_on_signup();