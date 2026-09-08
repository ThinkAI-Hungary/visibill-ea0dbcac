-- Migration: 20260908150000_soft_delete_ai_chat_sessions.sql
-- Description: Implement soft delete pattern for accounty_ai_chat_sessions to preserve
--              conversations and message feedback (ratings) for RAG tuning and auditability.

-- 1. Add is_deleted and deleted_at columns to accounty_ai_chat_sessions
ALTER TABLE public.accounty_ai_chat_sessions
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.accounty_ai_chat_sessions.is_deleted IS 'Soft delete kapcsoló: ha true, a felhasználó számára a listában rejtett, de az audit és RAG tuning adatok megmaradnak';
COMMENT ON COLUMN public.accounty_ai_chat_sessions.deleted_at IS 'A beszélgetés felhasználói törlésének / archiválásának időbélyege';

-- 2. Create partial index for fast active session queries
CREATE INDEX IF NOT EXISTS idx_accounty_ai_sessions_user_active
  ON public.accounty_ai_chat_sessions(user_id, updated_at DESC)
  WHERE is_deleted = false;

-- 3. Update RLS policies on accounty_ai_chat_sessions
DROP POLICY IF EXISTS "Users can manage own chat sessions" ON public.accounty_ai_chat_sessions;
DROP POLICY IF EXISTS "Users can view own chat sessions" ON public.accounty_ai_chat_sessions;
DROP POLICY IF EXISTS "Users can insert own chat sessions" ON public.accounty_ai_chat_sessions;
DROP POLICY IF EXISTS "Users can update own chat sessions" ON public.accounty_ai_chat_sessions;

-- Allow SELECT for own sessions (allows joining in view_ai_chat_feedback_reports)
CREATE POLICY "Users can view own chat sessions"
  ON public.accounty_ai_chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow INSERT for own sessions
CREATE POLICY "Users can insert own chat sessions"
  ON public.accounty_ai_chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow UPDATE for own sessions (updating title or soft deleting via is_deleted = true)
CREATE POLICY "Users can update own chat sessions"
  ON public.accounty_ai_chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Update view_ai_chat_feedback_reports to expose session soft-delete status
DROP VIEW IF EXISTS public.view_ai_chat_feedback_reports;

CREATE VIEW public.view_ai_chat_feedback_reports AS
SELECT 
  m.id AS message_id,
  m.session_id,
  s.user_id,
  s.title AS session_title,
  s.is_deleted AS is_session_deleted,
  (
    SELECT prev.content 
    FROM public.accounty_ai_chat_messages prev 
    WHERE prev.session_id = m.session_id 
      AND prev.created_at < m.created_at 
      AND prev.role = 'user' 
    ORDER BY prev.created_at DESC 
    LIMIT 1
  ) AS user_question,
  m.content AS ai_answer,
  m.is_helpful,
  m.feedback_reason,
  m.feedback_at
FROM public.accounty_ai_chat_messages m
JOIN public.accounty_ai_chat_sessions s ON s.id = m.session_id
WHERE m.role = 'assistant' AND m.is_helpful IS NOT NULL
ORDER BY m.feedback_at DESC;

ALTER VIEW public.view_ai_chat_feedback_reports SET (security_invoker = true);
GRANT SELECT ON public.view_ai_chat_feedback_reports TO authenticated, service_role;
