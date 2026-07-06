-- ============================================================================
-- AI Chat Persistence — accounty_ai_chat_sessions + accounty_ai_chat_messages
-- ============================================================================
-- Stores AI assistant conversation history per user.
-- Sessions are auto-titled from the first user message.
-- ============================================================================

-- ── 1. Sessions table ──
CREATE TABLE IF NOT EXISTS public.accounty_ai_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Új beszélgetés',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Messages table ──
CREATE TABLE IF NOT EXISTS public.accounty_ai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.accounty_ai_chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. RLS ──
ALTER TABLE public.accounty_ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounty_ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chat sessions"
  ON public.accounty_ai_chat_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat messages"
  ON public.accounty_ai_chat_messages FOR ALL
  USING (session_id IN (
    SELECT id FROM public.accounty_ai_chat_sessions WHERE user_id = auth.uid()
  ))
  WITH CHECK (session_id IN (
    SELECT id FROM public.accounty_ai_chat_sessions WHERE user_id = auth.uid()
  ));

-- ── 4. Indexes ──
CREATE INDEX idx_accounty_ai_sessions_user
  ON public.accounty_ai_chat_sessions(user_id, updated_at DESC);

CREATE INDEX idx_accounty_ai_messages_session
  ON public.accounty_ai_chat_messages(session_id, created_at ASC);

-- ── 5. Auto-update updated_at trigger ──
CREATE OR REPLACE FUNCTION public.accounty_ai_session_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.accounty_ai_chat_sessions
  SET updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounty_ai_message_touch
  AFTER INSERT ON public.accounty_ai_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.accounty_ai_session_touch();

COMMENT ON TABLE public.accounty_ai_chat_sessions IS
  'AI Assistant chat sessions per user. Each session is a separate conversation thread.';
COMMENT ON TABLE public.accounty_ai_chat_messages IS
  'Individual messages within an AI chat session. Ordered by created_at.';
