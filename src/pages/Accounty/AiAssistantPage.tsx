import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Send, Zap, ShieldAlert, BookOpen, BarChart3, FileCheck, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const QUICK_ACTIONS = [
  { label: 'Kedvezmény-optimalizáció', icon: Zap, prompt: 'Kérlek elemezd a 2026-os családi kedvezmény szabályokat 2 gyermek esetén. Hogyan optimalizálható a szülők között?' },
  { label: 'Anomália-detekció', icon: BarChart3, prompt: 'Mire figyeljek a havi bértömeg-ellenőrzésnél? Milyen anomáliákat érdemes keresni?' },
  { label: 'Bevallás előellenőrzés', icon: FileCheck, prompt: 'Milyen gyakori hibákra figyeljek a 2608-as havi bevallás beadása előtt?' },
  { label: 'Jogszabály kérdés', icon: BookOpen, prompt: '' },
];

interface AiAssistantChatProps {
  fullPage?: boolean;
}

export function AiAssistantChat({ fullPage = false }: AiAssistantChatProps) {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamingContent]);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Build chat history for API (last 20 messages to limit context)
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
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            messages: chatHistory,
            context: {
              page: window.location.pathname,
            },
          }),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Ismeretlen hiba' }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      // Read streaming response
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

      // Finalize the assistant message
      if (accumulated) {
        const aiMsg: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: accumulated,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User cancelled - save partial content
        if (streamingContent) {
          setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: streamingContent + '\n\n*[Megszakítva]*',
            timestamp: new Date(),
          }]);
        }
      } else {
        console.error('[AI Chat] Error:', err);
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: ` Hiba történt: ${err.message}\n\nKérlek próbáld újra.`,
          timestamp: new Date(),
        }]);
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortRef.current = null;
    }
  }, [messages, isStreaming, session, streamingContent]);

  // Simple markdown-like rendering: **bold**, *italic*, \n, - lists
  const renderContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, i) => {
      // Process inline formatting
      let html = line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">$1</code>');

      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <li key={i} className="ml-4 list-disc" dangerouslySetInnerHTML={{ __html: html.slice(2) }} />;
      }
      if (/^\d+\.\s/.test(line)) {
        return <li key={i} className="ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: html.replace(/^\d+\.\s/, '') }} />;
      }
      if (!line.trim()) return <br key={i} />;
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  return (
    <div className={cn('flex flex-col', fullPage ? 'h-[calc(100vh-120px)]' : 'h-full')}>
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
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">AI Asszisztens</h3>
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
              'max-w-[85%] rounded-2xl px-4 py-3',
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-md'
            )}>
              <div className="text-sm leading-relaxed space-y-1">
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
