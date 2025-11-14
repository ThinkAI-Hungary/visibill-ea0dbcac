-- Remove welcome_email column from user_email_preferences table
ALTER TABLE public.user_email_preferences DROP COLUMN IF EXISTS welcome_email;