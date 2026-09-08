import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, ShieldAlert, BookOpen, Receipt, Landmark, Briefcase, Square,
  Plus, Trash2, MessageSquare, Clock, PanelLeftClose, PanelLeftOpen,
  Copy, Check, Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useAiChatSessions, useAiChatMessages, AiChatSession } from '@/hooks/useAiChatSessions';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { MessageFeedbackWidget } from '@/components/ai/MessageFeedbackWidget';
import { Skeleton } from '@/components/ui/skeleton';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  is_helpful?: boolean | null;
  feedback_reason?: string | null;
  feedback_at?: string | null;
}

export interface CompanySelectToken {
  id: string;
  name: string;
}

export const parseCompanySelectTokens = (content: string): { cleanText: string; tokens: CompanySelectToken[] } => {
  const tokens: CompanySelectToken[] = [];
  const regex = /<<COMPANY_SELECT:([a-zA-Z0-9-]+)\|([^>]+)>>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    tokens.push({ id: match[1], name: match[2].trim() });
  }
  const clean = content.replace(/<<COMPANY_SELECT:([a-zA-Z0-9-]+)\|([^>]+)>>/g, '').trim();
  const cleanText = clean || (tokens.length > 0 ? 'Kérlek válaszd ki, hogy melyik céghez szeretnéd tudni a számláid számát:' : '');
  return { cleanText, tokens };
};

export const QUICK_ACTIONS = [
  { 
    label: 'Számlafeltöltés és OCR', 
    icon: Receipt, 
    prompt: 'Hogyan működik a számlák feltöltése, az automatikus AI adatkinyerés (OCR) és a NAV számlaszinkronizáció az applikációban?' 
  },
  { 
    label: 'Banki tranzakció-párosítás', 
    icon: Landmark, 
    prompt: 'Hogyan működik az intelligens banki tranzakció-párosítás, és hogyan tudom a kifizetetlen számlákat egyeztetni a banki tételekkel?' 
  },
  { 
    label: 'Főkönyvi könyvelés és naplók', 
    icon: BookOpen, 
    prompt: 'Hogyan kezeli a rendszer a számlatükröt, a vegyes naplókat, és hogyan készíthető elő a havi könyvelés és ÁFA bevallás?' 
  },
  { 
    label: 'Portfólió és hiányzó számlák', 
    icon: Briefcase, 
    prompt: 'Hogyan követhetem az ügyfelek hiányzó számláit, az adónaptár határidőit és a könyvelőirodai teendőket a portfólióban?' 
  },
];

/* ─── Relative time helper ─── */
export function relativeTime(dateStr: string): string {
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

/* ─── Skeleton Loaders ─── */
function SidebarSessionsSkeleton() {
  return (
    <div className="p-1.5 space-y-1.5 animate-in fade-in duration-200">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg">
          <Skeleton className="w-3.5 h-3.5 rounded-xs shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Skeleton className={cn("h-3", i % 2 === 0 ? "w-4/5" : "w-3/5")} />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatMessagesSkeleton() {
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* 1. User message bubble skeleton (right) */}
      <div className="flex justify-end">
        <div className="max-w-[75%] sm:max-w-[50%] rounded-2xl rounded-br-md px-4 py-3 bg-primary/20 border border-primary/25 space-y-2">
          <Skeleton className="h-3.5 w-44 bg-primary/30 ml-auto" />
          <Skeleton className="h-3 w-28 bg-primary/20 ml-auto" />
          <div className="flex justify-end pt-1">
            <Skeleton className="h-2 w-10 bg-primary/20" />
          </div>
        </div>
      </div>

      {/* 2. Assistant message bubble skeleton (left) */}
      <div className="flex justify-start">
        <div className="w-[85%] max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-border/40 space-y-2.5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-primary" />
            </div>
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-3.5 w-[92%]" />
          <Skeleton className="h-3.5 w-[96%]" />
          <Skeleton className="h-3.5 w-[85%]" />
          <Skeleton className="h-3.5 w-[65%]" />
          <div className="pt-2 flex flex-wrap gap-2">
            <Skeleton className="h-7 w-28 rounded-xl" />
            <Skeleton className="h-7 w-32 rounded-xl" />
          </div>
          <div className="pt-1">
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
      </div>

      {/* 3. User message bubble skeleton (right) */}
      <div className="flex justify-end">
        <div className="max-w-[65%] sm:max-w-[40%] rounded-2xl rounded-br-md px-4 py-3 bg-primary/20 border border-primary/25 space-y-2">
          <Skeleton className="h-3.5 w-36 bg-primary/30 ml-auto" />
          <div className="flex justify-end pt-1">
            <Skeleton className="h-2 w-10 bg-primary/20" />
          </div>
        </div>
      </div>

      {/* 4. Assistant message bubble skeleton (left) */}
      <div className="flex justify-start">
        <div className="w-[80%] max-w-[80%] rounded-2xl rounded-bl-md px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-border/40 space-y-2.5">
          <Skeleton className="h-3.5 w-[90%]" />
          <Skeleton className="h-3.5 w-[78%]" />
          <Skeleton className="h-3.5 w-[45%]" />
          <div className="pt-1">
            <Skeleton className="h-2 w-10" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══ CONVERSATION SIDEBAR ═══ */
/* ═══════════════════════════════════════════════════════ */

export function ConversationSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  isCollapsed,
  onToggleCollapse,
  compact,
  isLoading,
}: {
  sessions: AiChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  compact?: boolean;
  isLoading?: boolean;
}) {
  const flyoutRef = useRef<HTMLDivElement>(null);

  // In compact mode: handle Escape key to dismiss flyout
  useEffect(() => {
    if (!compact || isCollapsed) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onToggleCollapse();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [compact, isCollapsed, onToggleCollapse]);

  const handleSelectSession = (id: string) => {
    onSelectSession(id);
    if (window.innerWidth < 640) {
      onToggleCollapse();
    }
  };

  const handleNewSession = () => {
    onNewSession();
    if (window.innerWidth < 640) {
      onToggleCollapse();
    }
  };

  // Full page collapsed state: standard mini-strip
  if (isCollapsed && !compact) {
    return (
      <div className="flex flex-col items-center py-3 px-1 border-r border-border bg-card/50 gap-2 shrink-0">
        <CustomTooltip content="Beszélgetések megjelenítése" side="right">
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </CustomTooltip>
        <CustomTooltip content="Új beszélgetés" side="right">
          <button
            onClick={onNewSession}
            className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </CustomTooltip>
      </div>
    );
  }

  // Full page expanded state: standard 240px column
  if (!compact) {
    return (
      <div className="flex flex-col border-r border-border bg-card/50 shrink-0 w-[240px]">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Beszélgetések</span>
          <div className="flex items-center gap-1">
            <CustomTooltip content="Új beszélgetés" side="bottom">
              <button
                onClick={onNewSession}
                className="p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </CustomTooltip>
            <CustomTooltip content="Panel elrejtése" side="bottom">
              <button
                onClick={onToggleCollapse}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </CustomTooltip>
          </div>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
          {isLoading && sessions.length === 0 ? (
            <SidebarSessionsSkeleton />
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="w-6 h-6 text-muted-foreground/40 mb-2" />
              <p className="text-[11px] text-muted-foreground/60">Nincs korábbi beszélgetés</p>
            </div>
          ) : (
            sessions.map(session => (
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
              <CustomTooltip content="Beszélgetés törlése" side="left">
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </CustomTooltip>
            </button>
          )))}
        </div>
      </div>
    );
  }

  // Compact (Drawer) mode:
  return (
    <>
      <div className="flex flex-col items-center py-3 px-1 border-r border-border bg-card/50 gap-2 shrink-0">
        <CustomTooltip content={isCollapsed ? "Beszélgetések megjelenítése" : "Beszélgetések elrejtése"} side="left">
          <button
            data-sidebar-toggle="true"
            onClick={onToggleCollapse}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              !isCollapsed
                ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
            )}
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </CustomTooltip>
        <CustomTooltip content="Új beszélgetés" side="left">
          <button
            onClick={handleNewSession}
            className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </CustomTooltip>
      </div>

      {/* Flyout panel extending outwards to the left */}
      {!isCollapsed && (
        <div
          ref={flyoutRef}
          className={cn(
            "fixed sm:absolute inset-0 sm:inset-auto sm:top-0 sm:bottom-0 sm:right-full sm:w-[280px]",
            "bg-card sm:border-l sm:border-border sm:border-y-0 sm:rounded-none",
            "sm:shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.12)] dark:sm:shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.4)]",
            "flex flex-col z-50",
            "animate-in slide-in-from-right-4 fade-in duration-200 ease-out"
          )}
        >
          {/* Header matching drawer header height */}
          <div className="h-[57px] px-3.5 flex items-center justify-between border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Beszélgetések
              </span>
              {sessions.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {sessions.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <CustomTooltip content="Új beszélgetés" side="bottom">
                <button
                  onClick={handleNewSession}
                  className="p-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </CustomTooltip>
              <CustomTooltip content="Panel bezárása" side="bottom">
                <button
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </CustomTooltip>
            </div>
          </div>

          {/* Session list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoading && sessions.length === 0 ? (
              <SidebarSessionsSkeleton />
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-muted-foreground">Nincs korábbi beszélgetés</p>
                <p className="text-[11px] text-muted-foreground/60 mt-1">
                  Kezdj egy új beszélgetést a fenti + gombbal.
                </p>
              </div>
            ) : (
              sessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all group relative cursor-pointer border",
                    session.id === activeSessionId
                      ? "bg-primary/10 text-primary border-primary/20 shadow-xs"
                      : "hover:bg-muted/70 text-foreground/80 border-transparent hover:border-border/40"
                  )}
                >
                  <MessageSquare className={cn(
                    "w-4 h-4 shrink-0",
                    session.id === activeSessionId ? "text-primary" : "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-xs font-medium truncate leading-snug">{session.title}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-2.5 h-2.5 shrink-0" />
                      <span>{relativeTime(session.updated_at)}</span>
                    </p>
                  </div>
                  <CustomTooltip content="Beszélgetés törlése" side="left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive text-muted-foreground transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </CustomTooltip>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
/* ═══ CHAT COMPONENT ═══ */
/* ═══════════════════════════════════════════════════════ */

export interface AiAssistantChatProps {
  fullPage?: boolean;
  onSidebarChange?: (open: boolean) => void;
}

export function AiAssistantChat({ fullPage = false, onSidebarChange }: AiAssistantChatProps) {
  const { session: authSession } = useAuth();
  const { companies } = useCompany();
  // Only auto-lock if user has exactly ONE company. If multiple companies, let the chat context ask conversationally!
  const [chatCompanyId, setChatCompanyId] = useState<string | null>(() => {
    return companies?.length === 1 ? companies[0].id : null;
  });

  const { sessions, sessionsLoading, createSession, deleteSession, updateTitle, addMessage, submitFeedback } = useAiChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
    return localStorage.getItem('eaisybooks_active_chat_session_id');
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(!fullPage);
  const { data: dbMessages, isLoading: isMessagesLoading, isFetching: isMessagesFetching } = useAiChatMessages(activeSessionId);

  // Notify parent of sidebar collapsed state changes
  useEffect(() => {
    onSidebarChange?.(!sidebarCollapsed);
  }, [sidebarCollapsed, onSidebarChange]);

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionCreatingRef = useRef(false);
  const newSessionModeRef = useRef(false);
  const lastSendRef = useRef(0);
  const isInitialScrollRef = useRef(true);
  const currentLoadedSessionIdRef = useRef<string | null>(null);
  const prevMessagesCountRef = useRef(0);
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active message loading state (when switching sessions or initial load)
  const isMessagesLoadingActive = Boolean(
    activeSessionId &&
    !isStreaming &&
    (isMessagesLoading || (isMessagesFetching && messages.length === 0))
  );

  // Auto-resize textarea to fit content up to max-height (140px)
  const adjustTextareaHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const scrollH = el.scrollHeight;
    const maxHeight = 140;
    if (scrollH > maxHeight) {
      el.style.height = `${maxHeight}px`;
      el.style.overflowY = 'auto';
    } else {
      el.style.height = `${Math.max(scrollH, 42)}px`;
      el.style.overflowY = 'hidden';
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  // Reset textarea height and overflow when input is cleared or set externally
  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = '42px';
      textareaRef.current.style.overflowY = 'hidden';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && input.trim()) {
        sendMessage(input);
      }
    }
  };

  const handleCopy = useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'Másolva', description: 'Az üzenet szövege a vágólapra másolva.' });
  }, [toast]);

  // Sync DB messages to local state when session changes
  useEffect(() => {
    // If user explicitly started a new conversation, never overwrite with old session messages
    if (newSessionModeRef.current && !activeSessionId) {
      setMessages([]);
      currentLoadedSessionIdRef.current = null;
      return;
    }

    if (dbMessages && !isStreaming) {
      const isSessionChange = currentLoadedSessionIdRef.current !== activeSessionId;
      currentLoadedSessionIdRef.current = activeSessionId;

      setMessages(prev => {
        // If it's a background refetch for the current active session:
        if (!isSessionChange) {
          // If local state has more messages than dbMessages (e.g. newly sent or just finished assistant response),
          // don't drop them while the DB refetch catches up
          if (prev.length > dbMessages.length) {
            return prev;
          }

          // If message count is identical, check if any feedback status or content changed
          if (prev.length === dbMessages.length) {
            const isIdentical = prev.every((m, idx) => {
              const db = dbMessages[idx];
              return m.id === db.id && m.is_helpful === db.is_helpful && m.feedback_reason === db.feedback_reason;
            });
            if (isIdentical) {
              return prev;
            }
          }
        }

        return dbMessages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          is_helpful: m.is_helpful,
          feedback_reason: m.feedback_reason,
          feedback_at: m.feedback_at,
        }));
      });

      if (isSessionChange) {
        isInitialScrollRef.current = true;
      }
    }
  }, [dbMessages, activeSessionId, isStreaming]);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (isInitialScrollRef.current) {
      // Instant jump to bottom without smooth animation when opening/loading conversation
      el.scrollTop = el.scrollHeight;
      if (messages.length > 0) {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
          isInitialScrollRef.current = false;
        });
      }
    } else if (messages.length > prevMessagesCountRef.current || streamingContent) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    prevMessagesCountRef.current = messages.length;
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
    setChatCompanyId(companies?.length === 1 ? companies[0].id : null);
    setMessages([]);
    setInput('');
  }, [companies]);

  /* ─── Select existing session ─── */
  const handleSelectSession = useCallback((id: string) => {
    if (id === activeSessionId) return;
    newSessionModeRef.current = false;
    setMessages([]);
    setActiveSessionId(id);
    setChatCompanyId(companies?.length === 1 ? companies[0].id : null);
  }, [companies, activeSessionId]);

  /* ─── Delete session ─── */
  const handleDeleteSession = useCallback(async (id: string) => {
    stopStreaming();

    const remaining = sessions.filter(s => s.id !== id);

    if (activeSessionId === id) {
      if (remaining.length > 0) {
        const nextSession = remaining[0];
        newSessionModeRef.current = false;
        setMessages([]);
        setActiveSessionId(nextSession.id);
        setChatCompanyId(companies?.length === 1 ? companies[0].id : null);
      } else {
        newSessionModeRef.current = true;
        setActiveSessionId(null);
        setChatCompanyId(companies?.length === 1 ? companies[0].id : null);
        setMessages([]);
        setInput('');
        localStorage.removeItem('eaisybooks_active_chat_session_id');
      }
    }

    try {
      await deleteSession(id);
    } catch {
      toast({
        title: 'Hiba a törlés során',
        description: 'Nem sikerült törölni a beszélgetést.',
        variant: 'destructive',
      });
    }
  }, [deleteSession, activeSessionId, sessions, stopStreaming, toast, companies]);

  /* ─── Send message ─── */
  const sendMessage = useCallback(async (text: string, overrideCompanyId?: string) => {
    if (!text.trim() || isStreaming) return;

    if (!authSession?.access_token) {
      toast({
        title: 'Bejelentkezés szükséges',
        description: 'A csevegés használatához kérlek jelentkezz be újra.',
        variant: 'destructive',
      });
      return;
    }

    const now = Date.now();
    if (!overrideCompanyId && now - lastSendRef.current < 2000) {
      toast({ title: 'Túl gyors', description: 'Kérlek várj egy pillanatot a következő üzenet előtt.', variant: 'destructive' });
      return;
    }
    lastSendRef.current = now;

    let currentSessionId = activeSessionId;

    if (!currentSessionId) {
      sessionCreatingRef.current = true;
      try {
        const title = text.trim().length > 50 ? text.trim().slice(0, 47) + '...' : text.trim();
        const newSession = await createSession(title);
        currentSessionId = newSession.id;
        currentLoadedSessionIdRef.current = newSession.id;
        setActiveSessionId(newSession.id);
        newSessionModeRef.current = false;
      } finally {
        sessionCreatingRef.current = false;
      }
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    // Persist user message to DB
    if (currentSessionId) {
      addMessage(currentSessionId, 'user', text.trim()).catch(err => {
        reportError({ type: 'api_call', component: 'AiAssistantChat', action: 'addMessage_user', message: 'Failed to save user message', error: err });
      });
    }

    const isFirstMessage = messages.length === 0;
    if (isFirstMessage && activeSessionId) {
      const autoTitle = text.trim().length > 50 ? text.trim().slice(0, 47) + '...' : text.trim();
      updateTitle({ sessionId: activeSessionId, title: autoTitle });
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const chatMessages = [
        ...messages.slice(-20).map(m => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: text.trim(),
        },
      ];

      const activeCompanyIdToUse = overrideCompanyId !== undefined ? overrideCompanyId : chatCompanyId;
      const targetCompany = companies?.find(c => c.id === activeCompanyIdToUse);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accounty-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authSession.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'x-client-info': 'eaisybill-web',
          },
          body: JSON.stringify({
            messages: chatMessages,
            companyId: activeCompanyIdToUse || undefined,
            userCompanies: companies?.map(c => ({
              id: c.id,
              name: c.name,
              tax_number: (c as any).tax_number,
            })) || [],
            context: {
              page: window.location.pathname,
              companyName: targetCompany?.name || undefined,
            },
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Elérted a kérdezési limitet (30 kérdés / óra). Kérlek várj egy kicsit!');
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Szerverhiba (${response.status})`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Nem sikerült a stream olvasása.');

      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6).trim();
            if (!dataStr || dataStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                accumulated += parsed.content;
                setStreamingContent(accumulated);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) throw e;
            }
          }
        }
      }

      // Finalize assistant message
      if (accumulated && currentSessionId) {
        try {
          const saved = await addMessage(currentSessionId, 'assistant', accumulated);
          setMessages(prev => [...prev, {
            id: saved?.id || crypto.randomUUID(),
            role: 'assistant',
            content: accumulated,
            timestamp: new Date(),
          }]);
        } catch (saveErr) {
          reportError({ type: 'api_call', component: 'AiAssistantChat', action: 'addMessage_assistant', message: 'Failed to save assistant message', error: saveErr });
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: accumulated,
            timestamp: new Date(),
          }]);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        const partial = streamingContent ? streamingContent + '\n\n*[Megszakítva]*' : '*[A kapcsolat megszakadt vagy újraindult. Kérlek tedd fel újra a kérdést!]*';
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: partial,
          timestamp: new Date(),
        }]);
        if (currentSessionId) {
          addMessage(currentSessionId, 'assistant', partial).catch(() => {});
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
        toast({
          title: 'Hiba a válaszadás során',
          description: err.message || 'Kérlek próbáld újra.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [messages, isStreaming, authSession, streamingContent, activeSessionId, createSession, updateTitle, addMessage, chatCompanyId, companies, toast]);

  const handleSelectCompanyFromBubble = useCallback((compId: string, compName: string) => {
    setChatCompanyId(compId);
    sendMessage(`A(z) ${compName} számláira és adataira vagyok kíváncsi.`, compId);
  }, [sendMessage]);

  const handleFeedback = useCallback(async (messageId: string, isHelpful: boolean | null, reason?: string | null) => {
    // Optimistic local state update with snapshot for rollback
    let rollbackMessages: Message[] = [];
    setMessages(prev => {
      rollbackMessages = prev;
      return prev.map(msg => 
        msg.id === messageId 
          ? {
              ...msg,
              is_helpful: isHelpful,
              feedback_reason: isHelpful === false ? (reason ?? null) : null,
              feedback_at: isHelpful !== null ? new Date().toISOString() : null,
            }
          : msg
      );
    });

    try {
      await submitFeedback({
        messageId,
        sessionId: activeSessionId || undefined,
        isHelpful,
        reason,
      });
      if (isHelpful !== null) {
        toast({
          title: isHelpful ? 'Köszönjük a visszajelzést!' : 'Visszajelzés elmentve',
          description: isHelpful
            ? 'Örülünk, hogy hasznos volt a válasz.'
            : 'Köszönjük! A visszajelzésed alapján finomítjuk a belső tudástárat.',
        });
      }
    } catch (err: any) {
      if (rollbackMessages.length > 0) {
        setMessages(rollbackMessages);
      }
      toast({
        title: 'Hiba a visszajelzés rögzítésekor',
        description: err?.message || 'Kérlek próbáld újra.',
        variant: 'destructive',
      });
    }
  }, [submitFeedback, activeSessionId, toast]);

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
        isLoading={sessionsLoading}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Warning banner */}
        <div className="px-4 py-2 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-normal">
            Az AI válaszok tájékoztató jellegűek, nem minősülnek jogi tanácsadásnak.
          </p>
        </div>

        {/* Messages */}
        <div ref={scrollRef} data-ai-chat="true" className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Skeleton loader when switching sessions or initial loading */}
          {isMessagesLoadingActive && <ChatMessagesSkeleton />}

          {/* Empty conversation welcome state */}
          {!isMessagesLoadingActive && messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="p-3 bg-gradient-to-br from-teal-500/15 to-emerald-500/15 rounded-2xl mb-4 border border-teal-500/20 text-primary">
                <Bot className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1.5">
                {activeSessionId ? 'Üres beszélgetés' : 'Új beszélgetés'}
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mb-6 leading-relaxed">
                Kérdezz bátran az applikáció funkcióiról, a számlafeldolgozásról vagy a könyvelési folyamatokról.
              </p>
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {QUICK_ACTIONS.map(qa => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.prompt || `${qa.label} – kérlek adj részletes tájékoztatást.`)}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                  >
                    <qa.icon className="w-4 h-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-foreground/85 group-hover:text-foreground leading-snug">{qa.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {!isMessagesLoadingActive && messages.map(msg => {
            const isAssistant = msg.role === 'assistant';
            const { cleanText, tokens: companyTokens } = isAssistant
              ? parseCompanySelectTokens(msg.content)
              : { cleanText: msg.content, tokens: [] };

            return (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-3 relative group/msg',
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
                )}>
                  {isAssistant && (
                    <CustomTooltip content={copiedId === msg.id ? "Másolva!" : "Szöveg másolása"} side="top">
                      <button
                        onClick={() => handleCopy(msg.id, cleanText)}
                        className="absolute top-2 right-2 p-1.5 rounded-md bg-card/85 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/40 shadow-xs opacity-0 group-hover/msg:opacity-100 transition-all duration-200"
                        aria-label="Szöveg másolása"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </CustomTooltip>
                  )}
                  <div className={cn("text-sm leading-relaxed space-y-1", isAssistant && "pr-6")}>
                    {renderContent(cleanText)}
                  </div>
                  {isAssistant && companyTokens.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap gap-2">
                      {companyTokens.map(tok => (
                        <button
                          key={tok.id}
                          type="button"
                          onClick={() => handleSelectCompanyFromBubble(tok.id, tok.name)}
                          disabled={isStreaming}
                          className={cn(
                            "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95",
                            tok.id === chatCompanyId
                              ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                              : "bg-background/90 hover:bg-primary/10 text-foreground border border-border hover:border-primary/50 hover:text-primary shadow-2xs"
                          )}
                        >
                          <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                            <Building2 className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <span>{tok.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {isAssistant && !isStreaming && (
                    <MessageFeedbackWidget
                      messageId={msg.id}
                      isHelpful={msg.is_helpful}
                      feedbackReason={msg.feedback_reason}
                      onFeedback={(isHelpful, reason) => handleFeedback(msg.id, isHelpful, reason)}
                      disabled={isStreaming}
                    />
                  )}
                  <p className={cn(
                    "text-[10px] mt-1.5 leading-none select-none",
                    msg.role === 'user'
                      ? "text-white/75 text-right font-medium"
                      : "text-muted-foreground text-left"
                  )}>
                    {msg.timestamp.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
          {/* Streaming message */}
          {isStreaming && (
            <div className="flex justify-start">
              {streamingContent ? (() => {
                const { cleanText: streamClean, tokens: streamTokens } = parseCompanySelectTokens(streamingContent);
                return (
                  <div className="max-w-[85%] bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="text-sm leading-relaxed space-y-1">
                      {renderContent(streamClean)}
                      <span className="inline-block w-1.5 h-3.5 bg-primary animate-pulse rounded-xs ml-1 align-middle" />
                    </div>
                    {streamTokens.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap gap-2">
                        {streamTokens.map(tok => (
                          <button
                            key={tok.id}
                            type="button"
                            onClick={() => handleSelectCompanyFromBubble(tok.id, tok.name)}
                            disabled={isStreaming}
                            className={cn(
                              "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95",
                              tok.id === chatCompanyId
                                ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                                : "bg-background/90 hover:bg-primary/10 text-foreground border border-border hover:border-primary/50 hover:text-primary shadow-2xs"
                            )}
                          >
                            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <span>{tok.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })() : (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg rounded-bl-xs bg-slate-100 dark:bg-slate-800 border border-border/30 h-[22px]">
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-duration:800ms]" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-duration:800ms]" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/70 animate-bounce [animation-duration:800ms]" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              id="ai-chat-prompt-textarea"
              name="ai-chat-prompt-textarea"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Kérdezz az applikációról..."
              rows={1}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              data-form-type="other"
              data-1p-ignore="true"
              data-lpignore="true"
              disabled={isStreaming}
              style={{ height: '42px', overflowY: 'hidden' }}
              className="flex-1 h-[42px] min-h-[42px] max-h-[140px] resize-none overflow-hidden rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 placeholder:truncate placeholder:whitespace-nowrap placeholder:overflow-hidden focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 transition-colors leading-normal shadow-xs"
            />
            {isStreaming ? (
              <CustomTooltip content="Generálás leállítása" side="top">
                <Button
                  size="icon"
                  variant="destructive"
                  onClick={stopStreaming}
                  className="h-[42px] w-[42px] rounded-xl shrink-0"
                  aria-label="Generálás leállítása"
                >
                  <Square className="w-4 h-4" />
                </Button>
              </CustomTooltip>
            ) : (
              <CustomTooltip content="Üzenet küldése (Enter, új sor: Shift+Enter)" side="top">
                <Button
                  size="icon"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="h-[42px] w-[42px] rounded-xl shrink-0"
                  aria-label="Üzenet küldése"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </CustomTooltip>
            )}
          </div>
          <p className="text-[9px] text-slate-400 mt-1.5 text-center">AI Asszisztens · A válaszok tájékoztató jellegűek</p>
        </div>
      </div>
    </div>
  );
}

export default AiAssistantChat;
