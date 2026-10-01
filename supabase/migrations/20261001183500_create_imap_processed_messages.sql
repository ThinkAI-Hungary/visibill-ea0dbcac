-- Migration: Create imap_processed_messages for tracking processed emails without setting \Seen flag
CREATE TABLE IF NOT EXISTS public.imap_processed_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id uuid REFERENCES public.company_email_accounts(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email_uid text NOT NULL,
  message_id text,
  subject text,
  sender text,
  has_attachments boolean NOT NULL DEFAULT false,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_imap_processed_account_uid UNIQUE(account_id, email_uid)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_imap_processed_company_uid ON public.imap_processed_messages (company_id, email_uid) WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_imap_processed_account_uid ON public.imap_processed_messages(account_id, email_uid);
CREATE INDEX IF NOT EXISTS idx_imap_processed_company ON public.imap_processed_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_imap_processed_message_id ON public.imap_processed_messages(message_id) WHERE message_id IS NOT NULL;

ALTER TABLE public.imap_processed_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imap_processed_messages' AND policyname = 'Members can view processed emails of their company'
  ) THEN
    CREATE POLICY "Members can view processed emails of their company" 
      ON public.imap_processed_messages 
      FOR SELECT 
      TO authenticated 
      USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = (SELECT auth.uid())));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'imap_processed_messages' AND policyname = 'Service role full access on imap_processed_messages'
  ) THEN
    CREATE POLICY "Service role full access on imap_processed_messages" 
      ON public.imap_processed_messages 
      FOR ALL 
      TO service_role 
      USING (true) 
      WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT ON public.imap_processed_messages TO authenticated;
GRANT ALL ON public.imap_processed_messages TO service_role;
