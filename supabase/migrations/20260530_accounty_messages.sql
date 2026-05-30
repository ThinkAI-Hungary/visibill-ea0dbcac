-- ============================================================================
-- ACCOUNTY MESSAGES — Ügyfélportál kommunikáció
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounty_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  is_from_client BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.accounty_messages IS 'Ügyfélportál kommunikáció: könyvelő ↔ ügyfél üzenetek cégenkénti csevegés.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_accounty_messages_company ON public.accounty_messages(company_id);
CREATE INDEX IF NOT EXISTS idx_accounty_messages_created ON public.accounty_messages(created_at DESC);

-- RLS
ALTER TABLE public.accounty_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "accounty_messages_all" ON public.accounty_messages
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT aa.company_id FROM public.accounty_assignments aa
      WHERE aa.accountant_user_id = auth.uid()
    )
  );
