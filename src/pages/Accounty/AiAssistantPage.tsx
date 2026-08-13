import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Sparkles, Send, Zap, ShieldAlert, BookOpen, BarChart3, FileCheck, Square,
  Plus, Trash2, MessageSquare, Clock, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { useAuth } from '@/contexts/AuthContext';
import { useAiChatSessions, useAiChatMessages, AiChatSession } from '@/hooks/useAiChatSessions';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { 
    label: 'Családi kedvezmény optimalizáció', 
    icon: Zap, 
    prompt: 'Kérlek elemezd a 2026-os családi kedvezmény szabályokat 2 gyermek esetén. Hogyan lehet ezt optimálisan megosztani a szülők között?' 
  },
  { 
    label: 'Bér anomália-detekció', 
    icon: BarChart3, 
    prompt: 'Milyen anomáliákat és eltéréseket érdemes leginkább ellenőrizni a havi bérszámfejtési adatokban a beküldés előtt?' 
  },
  { 
    label: 'KIVA vs TAO adótervezés', 
    icon: FileCheck, 
    prompt: 'Milyen szempontok alapján érdemes egy cégnek a kisvállalati adót (KIVA) választania a társasági adó (TAO) helyett?' 
  },
  { 
    label: '2608-as bevallás ellenőrzés', 
    icon: BookOpen, 
    prompt: 'Melyek a leggyakoribb hibák a havi 08-as járulékbevallás összeállításakor, és hogyan kerülhetem el őket?' 
  },
];

/* ─── Relative time helper ─── */
function relativeTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'most';
  if (diffMin < 60) return `${diffMin} perce`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} órája`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'tegnap';
  if (diffD < 7) return `${diffD} napja`;
  return d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
}

/* ═══════════════════════════════════════════════════════ */
/* ═══ CONVERSATION SIDEBAR ═══ */
/* ═══════════════════════════════════════════════════════ */

function ConversationSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isCollapsed,
  onToggleCollapse,
  compact,
}: {
  sessions: AiChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  compact?: boolean;
}) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-border bg-card/50 gap-2 shrink-0">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          title="Beszélgetések megjelenítése"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onNewSession}
          className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Új beszélgetés"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col border-r border-border bg-card/50 shrink-0",
      compact ? "w-[200px]" : "w-[240px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Beszélgetések</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewSession}
            className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            title="Új beszélgetés"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Panel elrejtése"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
        {sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <MessageSquare className="w-6 h-6 text-muted-foreground/40 mb-2" />
            <p className="text-[11px] text-muted-foreground/60">Nincs korábbi beszélgetés</p>
          </div>
        )}
        {sessions.map(session => (
          <button
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={cn(
              "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all group relative",
              session.id === activeSessionId
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/80 text-foreground/80"
            )}
          >
            <MessageSquare className={cn(
              "w-3.5 h-3.5 shrink-0",
              session.id === activeSessionId ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{session.title}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {relativeTime(session.updated_at)}
              </p>
            </div>
            {/* Delete button on hover */}
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
              title="Beszélgetés törlése"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══ CHAT COMPONENT ═══ */
/* ═══════════════════════════════════════════════════════ */

interface AiAssistantChatProps {
  fullPage?: boolean;
}

export function AiAssistantChat({ fullPage = false }: AiAssistantChatProps) {
  const { session: authSession } = useAuth();
  const { sessions, createSession, deleteSession, updateTitle, addMessage } = useAiChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('eaisybooks_active_chat_session_id');
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!fullPage);
  const { data: dbMessages } = useAiChatMessages(activeSessionId);

  // Sync activeSessionId to localStorage to persist context across page changes
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem('eaisybooks_active_chat_session_id', activeSessionId);
    } else {
      localStorage.removeItem('eaisybooks_active_chat_session_id');
    }
  }, [activeSessionId]);

  // Local message state (for real-time display during streaming)
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionCreatingRef = useRef(false);
  const newSessionModeRef = useRef(false);
  const lastSendRef = useRef(0);
  const { toast } = useToast();

  // Auto-select first session on load (but NOT when user explicitly started a new conversation)
  useEffect(() => {
    if (!activeSessionId && sessions.length > 0 && !sessionCreatingRef.current && !newSessionModeRef.current) {
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Sync DB messages to local state when session changes
  useEffect(() => {
    if (dbMessages) {
      setMessages(
        dbMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
        }))
      );
    }
  }, [dbMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  /* ─── Start new session ─── */
  const handleNewSession = useCallback(async () => {
    newSessionModeRef.current = true;
    setActiveSessionId(null);
    setMessages([]);
    setInput('');
  }, []);

  /* ─── Select existing session ─── */
  const handleSelectSession = useCallback((id: string) => {
    newSessionModeRef.current = false;
    setActiveSessionId(id);
  }, []);

  /* ─── Delete session ─── */
  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
      setMessages([]);
    }
  }, [deleteSession, activeSessionId]);

  /* ─── Send message ─── */
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // Rate limit: max 1 message per 3 seconds
    const now = Date.now();
    if (now - lastSendRef.current < 3000) {
      toast({ title: 'Túl gyors', description: 'Kérlek várj pár másodpercet a következő üzenet előtt.', variant: 'destructive' });
      return;
    }
    lastSendRef.current = now;

    let currentSessionId = activeSessionId;

    // Create session on first message if needed
    if (!currentSessionId) {
      sessionCreatingRef.current = true;
      try {
        const title = text.trim().length > 50 ? text.trim().slice(0, 47) + '...' : text.trim();
        const newSession = await createSession(title);
        currentSessionId = newSession.id;
        setActiveSessionId(newSession.id);
        newSessionModeRef.current = false;
      } finally {
        sessionCreatingRef.current = false;
      }
    } else {
      // If this is the first message in existing session, update title
      if (messages.length === 0) {
        const title = text.trim().length > 50 ? text.trim().slice(0, 47) + '...' : text.trim();
        updateTitle({ sessionId: currentSessionId, title });
      }
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    // Save user message to DB
    addMessage(currentSessionId!, 'user', text).catch(() => {});

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const chatHistory = updatedMessages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/accounty-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession?.access_token}`,
          },
          body: JSON.stringify({
            messages: chatHistory,
            context: { page: window.location.pathname },
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (parsed.done) break;
            if (parsed.content) {
              accumulated += parsed.content;
              setStreamingContent(accumulated);
            }
          } catch {}
        }
      }

      if (accumulated) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
        // Save assistant message to DB
        addMessage(currentSessionId!, 'assistant', accumulated).catch(() => {});
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (streamingContent) {
          const partial = streamingContent + '\n\n*[Megszakítva]*';
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: partial,
            timestamp: new Date(),
          }]);
          addMessage(currentSessionId!, 'assistant', partial).catch(() => {});
        }
      } else {
        reportError({ type: 'api_call', component: 'AiAssistantChat', action: 'error', message: 'AI Chat streaming failed', error: err });
        const errorContent = `Hiba történt: ${err.message}\n\nKérlek próbáld újra.`;
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorContent,
          timestamp: new Date(),
        }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [messages, isStreaming, authSession, streamingContent, activeSessionId, createSession, updateTitle, addMessage]);

  // Simple markdown-like rendering (with HTML sanitization)
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Escape HTML first to prevent XSS
      let escaped = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      // Then apply markdown formatting
      let html = escaped
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">$1</code>')
        .replace(/###\s+(.+)/g, '<span class="font-bold text-base">$1</span>');

      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: html.slice(html.indexOf(';') + 1).replace(/^\s/, '') }} />;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: html.replace(/^\d+\.\s/, '') }} />;
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className={cn('flex', fullPage ? 'h-[calc(100vh-120px)]' : 'h-full min-h-[400px]')}>
      {/* Conversation Sidebar */}
      <ConversationSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(v => !v)}
        compact={!fullPage}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* GDPR banner */}
        <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
            Az AI válaszok tájékoztató jellegűek, nem minősülnek jogi tanácsadásnak. A foglalkoztatottak személyes adatait nem küldjük a szolgáltatónak.
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="p-3 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-2xl mb-4">
                <Sparkles className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
                {activeSessionId ? 'Üres beszélgetés' : 'Új beszélgetés'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6">
                Kérdezz bármit a jogszabályokról, kedvezményekről, vagy kérj elemzést a bérszámfejtési adatokról.
              </p>
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {QUICK_ACTIONS.map(qa => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.prompt || `${qa.label} – kérlek adj részletes tájékoztatást.`)}
                    className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                  >
                    <qa.icon className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 relative group/msg',
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-md'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
              )}>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(msg.content);
                      toast({ title: 'Másolva', description: 'Az üzenet szövege a vágólapra másolva.' });
                    }}
                    className="absolute top-2 right-2 p-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 opacity-0 group-hover/msg:opacity-100 transition-all duration-200"
                    title="Szöveg másolása"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 002 2h2a2 2 0 002-2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                )}
                <div className={cn("text-sm leading-relaxed space-y-1", msg.role === 'assistant' && "pr-6")}>
                  {renderContent(msg.content)}
                </div>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5">
                  {msg.timestamp.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          {/* Streaming message */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                {streamingContent ? (
                  <div className="text-sm leading-relaxed space-y-1">
                    {renderContent(streamingContent)}
                    <span className="inline-block w-2 h-4 bg-violet-500 animate-pulse rounded-sm ml-0.5" />
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Kérdezz a jogszabályokról, kedvezményekről..."
              className="flex-1 bg-card border-border"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="destructive" onClick={stopStreaming} className="shrink-0" title="Leállítás">
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim()} className="shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            )}
          </div>
          <p className="text-[9px] text-slate-400 mt-1.5 text-center">GPT-4o mini · A válaszok tájékoztató jellegűek</p>
        </div>
      </div>
    </div>
  );
}

// Full page version
export default function AiAssistantPage() {
  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-lg shadow-violet-500/25">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">AI Asszisztens</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Kedvezmény-optimalizáló, anomália-detektor, jogszabály-kereső</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <AiAssistantChat fullPage />
      </div>
    </div>
  );
}
