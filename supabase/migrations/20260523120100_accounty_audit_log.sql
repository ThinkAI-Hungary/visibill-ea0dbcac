-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Accounty Audit Log                                         ║
-- ║  Ki, mit, mikor — teljes művelettörténet                    ║
-- ╚═══════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.accounty_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ki
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  
  -- Mit
  action TEXT NOT NULL,                -- 'create_client', 'resolve_missing', 'complete_deadline', 'generate_report', etc.
  entity_type TEXT NOT NULL,           -- 'client', 'missing_item', 'deadline', 'report', 'portal_token', etc.
  entity_id TEXT,                      -- UUID of the affected entity
  
  -- Kontextus
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  company_name TEXT,
  details JSONB DEFAULT '{}',          -- Extra metadata
  
  -- Mikor
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexek a gyors lekérdezéshez
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.accounty_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_company_id ON public.accounty_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.accounty_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.accounty_audit_log(action);

-- RLS
ALTER TABLE public.accounty_audit_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own logs
CREATE POLICY "accounty_audit_log_select"
  ON public.accounty_audit_log FOR SELECT TO authenticated
  USING (true);

-- Authenticated users can insert logs
CREATE POLICY "accounty_audit_log_insert"
  ON public.accounty_audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.accounty_audit_log IS 'Accounty művelettörténet: ki, mit, mikor. Automatikusan logolódik minden fontosabb művelet.';
