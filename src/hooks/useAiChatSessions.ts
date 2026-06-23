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
    },
    onSuccess: () => {
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
    // Invalidate messages cache for this session
    queryClient.invalidateQueries({ queryKey: messagesKey(sessionId) });
    return data as AiChatMessage;
  }, [queryClient]);

  return {
    sessions: sessionsQuery.data || [],
    sessionsLoading: sessionsQuery.isLoading,
    createSession: createSessionMut.mutateAsync,
    deleteSession: deleteSessionMut.mutateAsync,
    updateTitle: updateTitleMut.mutateAsync,
    addMessage,
  };
}

/* ─── Hook for session messages ─── */
export function useAiChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: messagesKey(sessionId || ''),
    queryFn: async () => {
      if (!sessionId) return [];
      const { data, error } = await (supabase as any)
        .from('accounty_ai_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AiChatMessage[];
    },
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}
