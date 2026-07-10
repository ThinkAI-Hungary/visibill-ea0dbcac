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
