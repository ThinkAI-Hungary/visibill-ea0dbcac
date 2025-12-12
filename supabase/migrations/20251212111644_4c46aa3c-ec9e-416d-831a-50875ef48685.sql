-- Add weekly_summary column to user_email_preferences table
ALTER TABLE public.user_email_preferences 
ADD COLUMN IF NOT EXISTS weekly_summary boolean DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.user_email_preferences.weekly_summary IS 'Whether user wants to receive weekly summary emails';