-- ==============================================================================
-- Migration: 20260908130000_add_ai_chat_message_feedback.sql
-- Description: Add user feedback tracking (is_helpful, feedback_reason, feedback_at)
--              to accounty_ai_chat_messages for internal RAG tuning and analytics.
-- ==============================================================================

-- 1. Add feedback columns to accounty_ai_chat_messages
ALTER TABLE public.accounty_ai_chat_messages 
  ADD COLUMN IF NOT EXISTS is_helpful boolean DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feedback_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS feedback_at timestamp with time zone DEFAULT NULL;

COMMENT ON COLUMN public.accounty_ai_chat_messages.is_helpful IS 'Felhasználói visszajelzés: true = Hasznos, false = Nem hasznos, NULL = nincs még értékelve';
COMMENT ON COLUMN public.accounty_ai_chat_messages.feedback_reason IS 'Opcionális indoklás vagy kategória (pl. pontatlan adat, nem releváns válasz) RAG tuninghoz';
COMMENT ON COLUMN public.accounty_ai_chat_messages.feedback_at IS 'A visszajelzés leadásának időbélyege';

-- 2. Partial index for rapid filtering of feedback ratings
CREATE INDEX IF NOT EXISTS idx_accounty_ai_chat_messages_feedback 
  ON public.accounty_ai_chat_messages (is_helpful, feedback_at) 
  WHERE is_helpful IS NOT NULL;

-- 3. Reporting view for knowledge base (RAG) fine-tuning
CREATE OR REPLACE VIEW public.view_ai_chat_feedback_reports AS
SELECT 
  m.id AS message_id,
  m.session_id,
  s.user_id,
  s.title AS session_title,
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

-- Enable security_invoker to ensure row-level security (RLS) is respected for the caller
ALTER VIEW public.view_ai_chat_feedback_reports SET (security_invoker = true);

-- 4. Permissions on the view
GRANT SELECT ON public.view_ai_chat_feedback_reports TO authenticated, service_role;
