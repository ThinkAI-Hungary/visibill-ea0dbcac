-- Create email preferences table
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  welcome_email BOOLEAN DEFAULT true,
  invoice_processed BOOLEAN DEFAULT true,
  invoice_failed BOOLEAN DEFAULT true,
  subscription_warnings BOOLEAN DEFAULT true,
  monthly_summary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own email preferences"
  ON public.user_email_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own email preferences"
  ON public.user_email_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email preferences"
  ON public.user_email_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create trigger to initialize email preferences for new users
CREATE OR REPLACE FUNCTION public.initialize_email_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_email_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to profiles table (runs after user creation)
CREATE TRIGGER on_profile_created_init_email_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_email_preferences();

-- Update trigger for email preferences
CREATE TRIGGER update_user_email_preferences_updated_at
  BEFORE UPDATE ON public.user_email_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();