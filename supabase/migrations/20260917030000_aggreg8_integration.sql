-- Migration: 20260917030000_aggreg8_integration.sql
-- Description: Aggreg8 Open Banking (PSD2) integration schema, consents, accounts, webhook logs, and bank_transactions extensions

-- 1. Aggreg8 Settings (Customer token cache & config)
CREATE TABLE IF NOT EXISTS public.aggreg8_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'prod')),
  customer_token TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aggreg8_settings ENABLE ROW LEVEL SECURITY;

-- Only service role can access settings by default
DROP POLICY IF EXISTS "Service role full access on aggreg8_settings" ON public.aggreg8_settings;
CREATE POLICY "Service role full access on aggreg8_settings"
  ON public.aggreg8_settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Aggreg8 Consents (ISC - Information Sharing Consents)
CREATE TABLE IF NOT EXISTS public.aggreg8_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  info_sharing_consent_id TEXT NOT NULL UNIQUE,
  a8_user_id TEXT NOT NULL,
  bank_id TEXT NOT NULL,
  bank_name TEXT,
  bank_logo_url TEXT,
  active_sync_enabled BOOLEAN DEFAULT true,
  passive_sync_enabled BOOLEAN DEFAULT true,
  active_sync_expiration_date TIMESTAMPTZ,
  passive_sync_expiration_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key indexes (Rule: mandatory B-tree on REFERENCES)
CREATE INDEX IF NOT EXISTS idx_aggreg8_consents_company_id ON public.aggreg8_consents(company_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_consents_user_id ON public.aggreg8_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_consents_isc_id ON public.aggreg8_consents(info_sharing_consent_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_consents_status ON public.aggreg8_consents(status);

ALTER TABLE public.aggreg8_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view aggreg8 consents" ON public.aggreg8_consents;
CREATE POLICY "Company members can view aggreg8 consents"
  ON public.aggreg8_consents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company managers can manage aggreg8 consents" ON public.aggreg8_consents;
CREATE POLICY "Company managers can manage aggreg8 consents"
  ON public.aggreg8_consents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_consents.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- 3. Aggreg8 Accounts (Mapping Aggreg8 accounts to company bank accounts)
CREATE TABLE IF NOT EXISTS public.aggreg8_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES public.aggreg8_consents(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  a8_account_id TEXT NOT NULL UNIQUE,
  company_bank_account_id UUID REFERENCES public.company_bank_accounts(id) ON DELETE SET NULL,
  account_name TEXT,
  account_number TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'HUF',
  balance DECIMAL(15,2),
  last_ordinal_on_account INTEGER DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_aggreg8_accounts_consent_id ON public.aggreg8_accounts(consent_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_accounts_company_id ON public.aggreg8_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_accounts_cba_id ON public.aggreg8_accounts(company_bank_account_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_accounts_a8_id ON public.aggreg8_accounts(a8_account_id);

ALTER TABLE public.aggreg8_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view aggreg8 accounts" ON public.aggreg8_accounts;
CREATE POLICY "Company members can view aggreg8 accounts"
  ON public.aggreg8_accounts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company managers can manage aggreg8 accounts" ON public.aggreg8_accounts;
CREATE POLICY "Company managers can manage aggreg8 accounts"
  ON public.aggreg8_accounts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = aggreg8_accounts.company_id
        AND company_members.user_id = auth.uid()
        AND company_members.role NOT IN ('employee', 'viewer')
    )
  );

-- 4. Aggreg8 Webhook Logs (Audit trail for callbacks)
CREATE TABLE IF NOT EXISTS public.aggreg8_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  user_flow_id TEXT,
  a8_user_id TEXT,
  info_sharing_consent_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aggreg8_webhook_logs_type ON public.aggreg8_webhook_logs(notification_type);
CREATE INDEX IF NOT EXISTS idx_aggreg8_webhook_logs_created_at ON public.aggreg8_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aggreg8_webhook_logs_isc_id ON public.aggreg8_webhook_logs(info_sharing_consent_id);
CREATE INDEX IF NOT EXISTS idx_aggreg8_webhook_logs_user_flow_id ON public.aggreg8_webhook_logs(user_flow_id);

ALTER TABLE public.aggreg8_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on aggreg8_webhook_logs" ON public.aggreg8_webhook_logs;
CREATE POLICY "Service role full access on aggreg8_webhook_logs"
  ON public.aggreg8_webhook_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Extend bank_transactions table with Aggreg8 fields
ALTER TABLE public.bank_transactions
  ADD COLUMN IF NOT EXISTS a8_transaction_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS a8_account_id TEXT,
  ADD COLUMN IF NOT EXISTS a8_consent_id TEXT,
  ADD COLUMN IF NOT EXISTS bank_id TEXT,
  ADD COLUMN IF NOT EXISTS ordinal_on_account INTEGER,
  ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'booked' CHECK (status IN ('booked', 'pending')),
  ADD COLUMN IF NOT EXISTS enriched_partner_name TEXT,
  ADD COLUMN IF NOT EXISTS enriched_category_id TEXT,
  ADD COLUMN IF NOT EXISTS enriched_category_name TEXT,
  ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Performance index for incremental transaction syncing:
CREATE INDEX IF NOT EXISTS idx_bank_transactions_ordinal
  ON public.bank_transactions(a8_account_id, ordinal_on_account DESC);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_a8_id
  ON public.bank_transactions(a8_transaction_id);

-- 6. Updated at triggers
DROP TRIGGER IF EXISTS update_aggreg8_settings_updated_at ON public.aggreg8_settings;
CREATE TRIGGER update_aggreg8_settings_updated_at
  BEFORE UPDATE ON public.aggreg8_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_aggreg8_consents_updated_at ON public.aggreg8_consents;
CREATE TRIGGER update_aggreg8_consents_updated_at
  BEFORE UPDATE ON public.aggreg8_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_aggreg8_accounts_updated_at ON public.aggreg8_accounts;
CREATE TRIGGER update_aggreg8_accounts_updated_at
  BEFORE UPDATE ON public.aggreg8_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
