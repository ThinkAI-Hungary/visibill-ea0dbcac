import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Zap, ShieldAlert, ChevronRight, BookOpen, AlertTriangle, BarChart3, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: { title: string; ref: string }[];
}

const QUICK_ACTIONS = [
  { label: 'Kedvezmény-optimalizáció', icon: Zap, prompt: 'Kérlek elemezd a családon belüli kedvezmény-elosztás optimumát.' },
  { label: 'Anomália-detekció', icon: BarChart3, prompt: 'Vannak-e anomáliák az utolsó havi bértömeg-adatokban?' },
  { label: 'Bevallás előellenőrzés', icon: FileCheck, prompt: 'Kérlek ellenőrizd a következő havi bevallás konzisztenciáját.' },
  { label: 'Jogszabály kérdés', icon: BookOpen, prompt: '' },
];

const PLACEHOLDER_RESPONSES: Record<string, { content: string; sources: { title: string; ref: string }[] }> = {
  'kedvezmény': {
    content: '**Családi kedvezmény 2026-ban (2 gyermek után):**\n\nA 2026-os duplázás után:\n- 2 eltartott: **40 000 Ft/hó/gyermek** (összesen 80 000 Ft/hó)\n- Adóalap-csökkentés: 80 000 × 15% SZJA + 80 000 × 18,5% TB = **26 800 Ft/hó megtakarítás**\n\n💡 *Optimalizációs javaslat*: Ha mindkét szülő dolgozik, érdemes a magasabb jövedelmű szülőnél érvényesíteni a teljes kedvezményt.',
    sources: [
      { title: 'Szja tv. 29/B. § (2026 módosítás)', ref: '2025. évi CXLII. törvény' },
      { title: 'Családi kedvezmény duplázás', ref: 'Magyar Közlöny 2025/178.' },
    ],
  },
  'anomália': {
    content: '**Anomália-detekció eredménye:**\n\n✅ Az elmúlt havi bértömeg-adatokból nem észleltem szignifikáns eltérést.\n\n*Ellenőrzött metrikák:*\n- Bértömeg változás: +2.1% (normál sávban)\n- Túlóra arány: 4.3% (előző hó: 3.9%)\n- Új belépők/kilépők: 0/0\n\n⚠️ *Megjegyzés*: Ez egy placeholder válasz. Az éles verzióban a tényleges bérszámfejtési adatokat elemezzük.',
    sources: [],
  },
  'default': {
    content: '🤖 *Az AI asszisztens jelenleg fejlesztés alatt áll.*\n\nA végleges verzióban az alábbi funkciók lesznek elérhetők:\n\n- Természetes nyelvű jogszabály-keresés\n- Kedvezmény-optimalizáció családon belül\n- Bértömeg anomália-detekció\n- Bevallás-előellenőrzés\n- Dokumentum-mintázat elemzés\n\nA háttérben Anthropic Claude AI-t használunk, az adatok anonimizálva kerülnek feldolgozásra.',
    sources: [{ title: 'GDPR megfelelőség', ref: 'Belső adatkezelési szabályzat' }],
  },
};

function getResponse(input: string) {
  const lower = input.toLowerCase();
  if (lower.includes('kedvezmény') || lower.includes('család') || lower.includes('gyermek')) return PLACEHOLDER_RESPONSES['kedvezmény'];
  if (lower.includes('anomália') || lower.includes('bértömeg') || lower.includes('eltérés')) return PLACEHOLDER_RESPONSES['anomália'];
  return PLACEHOLDER_RESPONSES['default'];
}

interface AiAssistantChatProps {
  fullPage?: boolean;
}

export function AiAssistantChat({ fullPage = false }: AiAssistantChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const resp = getResponse(text);
      const aiMsg: Message = {
        id: crypto.randomUUID(), role: 'assistant', content: resp.content,
        timestamp: new Date(), sources: resp.sources,
      };
      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 800 + Math.random() * 1200);
  };

  return (
    <div className={cn('flex flex-col', fullPage ? 'h-[calc(100vh-120px)]' : 'h-full')}>
      {/* GDPR banner */}
      <div className="px-4 py-2.5 bg-amber-50/80 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800/40 flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
          Az AI-asszisztens válaszainak hivatkozási alapja a saját adatbázis. A foglalkoztatottak személyes adatait nem küldjük külső LLM-szolgáltatónak, csak anonimizált formában.
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
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
                  onClick={() => sendMessage(qa.prompt || `${qa.label} – kérlek elemezd.`)}
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
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {/* Sources */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Hivatkozások</p>
                  {msg.sources.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">
                      <BookOpen className="w-3 h-3 shrink-0" />
                      <span className="font-medium">{s.title}</span>
                      <span className="text-slate-400">— {s.ref}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1.5">
                {msg.timestamp.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
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
          />
          <Button size="icon" onClick={() => sendMessage(input)} disabled={!input.trim() || isTyping} className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
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
