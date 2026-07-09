-- Add accounty push preferences table
CREATE TABLE IF NOT EXISTS public.accounty_push_preferences (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled boolean NOT NULL DEFAULT false,
    missing_invoice_alert boolean NOT NULL DEFAULT false,
    deadline_reminder boolean NOT NULL DEFAULT false,
    client_status_change boolean NOT NULL DEFAULT false,
    approval_request boolean NOT NULL DEFAULT false,
    critical_alerts boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT accounty_push_preferences_pkey PRIMARY KEY (id),
    CONSTRAINT accounty_push_preferences_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.accounty_push_preferences ENABLE ROW LEVEL SECURITY;

-- InitPlan optimized auth checks (SELECT auth.uid())
CREATE POLICY "Users can view their own push preferences" ON public.accounty_push_preferences
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own push preferences" ON public.accounty_push_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own push preferences" ON public.accounty_push_preferences
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Automatically update updated_at using custom trigger function
CREATE OR REPLACE FUNCTION update_accounty_push_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_accounty_push_prefs_updated_at
    BEFORE UPDATE ON public.accounty_push_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_accounty_push_prefs_updated_at();

-- Security explicitly granted
REVOKE ALL ON TABLE public.accounty_push_preferences FROM anon;
GRANT ALL ON TABLE public.accounty_push_preferences TO authenticated;
GRANT ALL ON TABLE public.accounty_push_preferences TO service_role;
