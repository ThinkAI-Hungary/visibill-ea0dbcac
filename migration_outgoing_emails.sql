-- Outgoing emails log table for Accounty communication
CREATE TABLE IF NOT EXISTS public.outgoing_emails (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  company_id text NOT NULL,
  company_name text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'normal',
  message_id text,
  portal_link text,
  missing_item_ids jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  resend_id text,
  created_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE public.outgoing_emails ENABLE ROW LEVEL SECURITY;

-- Users can see their own sent emails
CREATE POLICY "Users can view own outgoing emails"
  ON public.outgoing_emails
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (edge function uses service role key)
CREATE POLICY "Service role can insert outgoing emails"
  ON public.outgoing_emails
  FOR INSERT
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_outgoing_emails_user_id ON public.outgoing_emails(user_id);
CREATE INDEX idx_outgoing_emails_company_id ON public.outgoing_emails(company_id);
CREATE INDEX idx_outgoing_emails_created_at ON public.outgoing_emails(created_at DESC);
