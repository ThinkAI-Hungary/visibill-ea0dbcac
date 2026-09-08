import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback } from 'react';

/* ─── Types ─── */
export interface AiChatSession {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AiChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  is_helpful?: boolean | null;
  feedback_reason?: string | null;
  feedback_at?: string | null;
}

export interface SubmitMessageFeedbackParams {
  messageId: string;
  sessionId?: string;
  isHelpful: boolean | null;
  reason?: string | null;
}

/* ─── Query Keys ─── */
const SESSIONS_KEY = ['accounty-ai-chat-sessions'];
const messagesKey = (sessionId: string) => ['accounty-ai-chat-messages', sessionId];

/* ─── Hook ─── */
export function useAiChatSessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── List sessions (newest first) ──
  const sessionsQuery = useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('accounty_ai_chat_sessions')
        .select('*')
        .eq('user_id', user!.id)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AiChatSession[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  // ── Create session ──
  const createSessionMut = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await (supabase as any)
        .from('accounty_ai_chat_sessions')
        .insert({ user_id: user!.id, title })
        .select()
        .single();
      if (error) throw error;
      return data as AiChatSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  // ── Delete session ──
  const deleteSessionMut = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase as any)
        .from('accounty_ai_chat_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
      return sessionId;
    },
    onMutate: async (sessionId: string) => {
      await queryClient.cancelQueries({ queryKey: SESSIONS_KEY });
      const previousSessions = queryClient.getQueryData<AiChatSession[]>(SESSIONS_KEY);
      if (previousSessions) {
        queryClient.setQueryData<AiChatSession[]>(
          SESSIONS_KEY,
          previousSessions.filter(s => s.id !== sessionId)
        );
      }
      return { previousSessions };
    },
    onError: (_err, _sessionId, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(SESSIONS_KEY, context.previousSessions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  // ── Update session title ──
  const updateTitleMut = useMutation({
    mutationFn: async ({ sessionId, title }: { sessionId: string; title: string }) => {
      const { error } = await (supabase as any)
        .from('accounty_ai_chat_sessions')
        .update({ title })
        .eq('id', sessionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  // ── Add message ──
  const addMessage = useCallback(async (sessionId: string, role: 'user' | 'assistant', content: string) => {
    const { data, error } = await (supabase as any)
      .from('accounty_ai_chat_messages')
      .insert({ session_id: sessionId, role, content })
      .select()
      .single();
    if (error) throw error;
    // Optimistically update query cache
    queryClient.setQueryData<AiChatMessage[]>(messagesKey(sessionId), (old) => {
      if (!old) return [data as AiChatMessage];
      if (old.some(m => m.id === data.id)) return old;
      return [...old, data as AiChatMessage];
    });
    // Invalidate messages cache for this session
    queryClient.invalidateQueries({ queryKey: messagesKey(sessionId) });
    return data as AiChatMessage;
  }, [queryClient]);

  // ── Submit message feedback ──
  const submitFeedbackMut = useMutation({
    mutationFn: async ({ messageId, isHelpful, reason }: SubmitMessageFeedbackParams) => {
      const now = isHelpful !== null ? new Date().toISOString() : null;
      const { error } = await (supabase as any)
        .from('accounty_ai_chat_messages')
        .update({
          is_helpful: isHelpful,
          feedback_reason: isHelpful === false ? (reason ?? null) : null,
          feedback_at: now,
        })
        .eq('id', messageId);
      if (error) throw error;
      return { messageId, isHelpful, reason, feedback_at: now };
    },
    onMutate: async ({ messageId, sessionId, isHelpful, reason }) => {
      if (!sessionId) return;
      await queryClient.cancelQueries({ queryKey: messagesKey(sessionId) });
      const previousMessages = queryClient.getQueryData<AiChatMessage[]>(messagesKey(sessionId));
      if (previousMessages) {
        queryClient.setQueryData<AiChatMessage[]>(
          messagesKey(sessionId),
          previousMessages.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  is_helpful: isHelpful,
                  feedback_reason: isHelpful === false ? (reason ?? null) : null,
                  feedback_at: isHelpful !== null ? new Date().toISOString() : null,
                }
              : m
          )
        );
      }
      return { previousMessages, sessionId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages && context?.sessionId) {
        queryClient.setQueryData(messagesKey(context.sessionId), context.previousMessages);
      }
    },
    onSettled: (_data, _error, vars) => {
      if (vars.sessionId) {
        queryClient.invalidateQueries({ queryKey: messagesKey(vars.sessionId) });
      }
    },
  });

  return {
    sessions: sessionsQuery.data || [],
    sessionsLoading: sessionsQuery.isLoading,
    createSession: createSessionMut.mutateAsync,
    deleteSession: deleteSessionMut.mutateAsync,
    updateTitle: updateTitleMut.mutateAsync,
    addMessage,
    submitFeedback: submitFeedbackMut.mutateAsync,
  };
}

/* ─── Standalone Hook for message feedback ─── */
export function useSubmitMessageFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ messageId, isHelpful, reason }: SubmitMessageFeedbackParams) => {
      const now = isHelpful !== null ? new Date().toISOString() : null;
      const { error } = await (supabase as any)
        .from('accounty_ai_chat_messages')
        .update({
          is_helpful: isHelpful,
          feedback_reason: isHelpful === false ? (reason ?? null) : null,
          feedback_at: now,
        })
        .eq('id', messageId);
      if (error) throw error;
      return { messageId, isHelpful, reason, feedback_at: now };
    },
    onMutate: async ({ messageId, sessionId, isHelpful, reason }) => {
      if (!sessionId) return;
      await queryClient.cancelQueries({ queryKey: messagesKey(sessionId) });
      const previousMessages = queryClient.getQueryData<AiChatMessage[]>(messagesKey(sessionId));
      if (previousMessages) {
        queryClient.setQueryData<AiChatMessage[]>(
          messagesKey(sessionId),
          previousMessages.map(m =>
            m.id === messageId
              ? {
                  ...m,
                  is_helpful: isHelpful,
                  feedback_reason: isHelpful === false ? (reason ?? null) : null,
                  feedback_at: isHelpful !== null ? new Date().toISOString() : null,
                }
              : m
          )
        );
      }
      return { previousMessages, sessionId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousMessages && context?.sessionId) {
        queryClient.setQueryData(messagesKey(context.sessionId), context.previousMessages);
      }
    },
    onSettled: (_data, _error, vars) => {
      if (vars.sessionId) {
        queryClient.invalidateQueries({ queryKey: messagesKey(vars.sessionId) });
      }
    },
  });
}

/* ─── Hook for session messages ─── */
export function useAiChatMessages(sessionId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: messagesKey(sessionId || ''),
    queryFn: async () => {
      if (!sessionId || !user?.id) return [];
      const { data, error } = await (supabase as any)
        .from('accounty_ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AiChatMessage[];
    },
    enabled: !!sessionId && !!user?.id,
    staleTime: 10_000,
  });
}
