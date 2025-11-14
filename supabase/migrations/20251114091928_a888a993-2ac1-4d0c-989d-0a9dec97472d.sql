-- Drop the problematic trigger and function
DROP TRIGGER IF EXISTS on_profile_created_send_welcome_email ON public.profiles;
DROP FUNCTION IF EXISTS public.send_welcome_email_on_signup();

-- We'll handle welcome emails via application code instead
-- The trigger approach with pg_net requires additional configuration