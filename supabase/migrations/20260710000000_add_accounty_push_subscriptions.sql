-- ==================================================
-- MERGED FROM: 20260710_add_accounty_push_subscriptions.sql
-- ==================================================
-- Add accounty push subscriptions table
CREATE TABLE IF NOT EXISTS public.accounty_push_subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint text NOT NULL,
    auth_key text NOT NULL,
    p256dh_key text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT accounty_push_subscriptions_pkey PRIMARY KEY (id),
    CONSTRAINT accounty_push_subscriptions_endpoint_key UNIQUE (endpoint)
);

ALTER TABLE public.accounty_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- InitPlan optimized auth checks (SELECT auth.uid())
CREATE POLICY "Users can view their own push subscriptions" ON public.accounty_push_subscriptions
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own push subscriptions" ON public.accounty_push_subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own push subscriptions" ON public.accounty_push_subscriptions
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- We don't necessarily need UPDATE if we just delete/re-insert, but let's add it for completeness
CREATE POLICY "Users can update their own push subscriptions" ON public.accounty_push_subscriptions
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Automatically update updated_at using custom trigger function
CREATE OR REPLACE FUNCTION update_accounty_push_subs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_accounty_push_subs_updated_at
    BEFORE UPDATE ON public.accounty_push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_accounty_push_subs_updated_at();

-- Security explicitly granted
REVOKE ALL ON TABLE public.accounty_push_subscriptions FROM anon;
GRANT ALL ON TABLE public.accounty_push_subscriptions TO authenticated;
GRANT ALL ON TABLE public.accounty_push_subscriptions TO service_role;


-- ==================================================
-- MERGED FROM: 20260710_add_digest_preferences.sql
-- ==================================================
-- Migration: Add Digest Preferences to accounty_email_preferences
-- Description: Adds dedicated columns for the new Digest feature instead of using JSONB.
-- Defaults to disabled (digest_enabled = false) as per user requirements.

ALTER TABLE accounty_email_preferences
  ADD COLUMN IF NOT EXISTS digest_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_frequency text DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS digest_delivery_time text DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS digest_include_kpis boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_deadlines boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_missing_items boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_client_summary boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS digest_include_audit_log boolean DEFAULT false;

-- Add comments for documentation
COMMENT ON COLUMN accounty_email_preferences.digest_enabled IS 'Mornings digest enabled switch (opt-in)';
COMMENT ON COLUMN accounty_email_preferences.digest_frequency IS 'daily, weekly, or biweekly';
COMMENT ON COLUMN accounty_email_preferences.digest_delivery_time IS 'Target delivery hour (e.g. 08:00)';


-- ==================================================
-- MERGED FROM: 20260710_fix_transactions_unique_constraint.sql
-- ==================================================
-- ============================================================================
-- Migration: Fix Transactions Unique Constraint Scoping (Multi-Tenant Fix)
-- ============================================================================

-- Drop the old constraint that was incorrectly scoped only to (transaction_date, description)
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS unique_transaction_entry;

-- Re-create the constraint scoped to (company_id, transaction_date, description)
ALTER TABLE public.transactions
  ADD CONSTRAINT unique_transaction_entry UNIQUE (company_id, transaction_date, description);
