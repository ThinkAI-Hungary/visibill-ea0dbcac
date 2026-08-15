import React, { useState } from 'react';
import { Sparkles, Loader2, RefreshCw, Send, HelpCircle, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PnlAiAssistantProps {
  revenue: number;
  materials: number;
  personnel: number;
  depreciation: number;
  otherExpenses: number;
  taxes: number;
  netProfit: number;
  inThousands: boolean;
}

export function PnlAiAssistant({
  revenue,
  materials,
  personnel,
  depreciation,
  otherExpenses,
  taxes,
  netProfit,
  inThousands,
}: PnlAiAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [messages, setMessages] = useState<Array<{ sender: 'ai' | 'user'; text: string }>>([]);
  const [userInput, setUserInput] = useState('');

  const formatHuf = (v: number) => {
    return new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 }).format(Math.round(v)) + (inThousands ? ' E Ft' : ' Ft');
  };

  const generateReport = async () => {
    setLoading(true);
    setAnalysis(null);
    setMessages([]);

    const prompt = `Kérlek készíts egy részletes, professzionális menedzseri elemzést és költségszerkezet-vizsgálatot a következő P&L adatok alapján (magyar nyelven):
- Nettó árbevétel: ${formatHuf(revenue)}
- Anyagjellegű kiadások: ${formatHuf(materials)}
- Személyi jellegű kiadások: ${formatHuf(personnel)}
- Értékcsökkenés: ${formatHuf(depreciation)}
- Egyéb működési kiadások: ${formatHuf(otherExpenses)}
- Adók: ${formatHuf(taxes)}
- Adózott eredmény (nettó profit): ${formatHuf(netProfit)}

Az elemzés legyen tagolt, tömör, és tartalmazzon 3 konkrét adóoptimalizálási vagy költségcsökkentési tippet a magyar jogszabályok szerint. Kérlek ne használj markdown félkövér jelölőket (csillagokat), hanem használj tiszta nagybetűs címsorokat és unicode pontokat (•) a felsorolásokhoz.`;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/accounty-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt }],
            context: { 
              page: '/profit-and-loss',
              financials: { revenue, materials, personnel, depreciation, otherExpenses, taxes, netProfit }
            },
          }),
        }
      );

      if (!response.ok) throw new Error('Hiba az AI kapcsolat felépítésekor.');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      setMessages([{ sender: 'ai', text: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataVal = trimmed.slice(6);
          try {
            const parsed = JSON.parse(dataVal);
            if (parsed.done) break;
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages([{ sender: 'ai', text: accumulated }]);
            }
          } catch {}
        }
      }
      setAnalysis(accumulated);
    } catch (err) {
      console.error(err);
      setMessages([{ sender: 'ai', text: 'Sajnálom, nem sikerült elérni az AI szolgáltatást. Ellenőrizd a kapcsolatot!' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || loading) return;

    const userText = userInput;
    setUserInput('');
    setLoading(true);

    const updatedMessages = [...messages, { sender: 'user', text: userText }];
    setMessages(updatedMessages);

    const chatHistory = updatedMessages.map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant',
      content: m.text
    }));

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
      const response = await fetch(
        `${supabaseUrl}/functions/v1/accounty-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: chatHistory,
            context: { 
              page: '/profit-and-loss',
              financials: { revenue, materials, personnel, depreciation, otherExpenses, taxes, netProfit }
            },
          }),
        }
      );

      if (!response.ok) throw new Error('Hálózati hiba a lekérdezés során.');

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let buffer = '';

      setMessages(prev => [...prev, { sender: 'ai', text: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataVal = trimmed.slice(6);
          try {
            const parsed = JSON.parse(dataVal);
            if (parsed.done) break;
            if (parsed.content) {
              accumulated += parsed.content;
              setMessages(prev => {
                const next = [...prev];
                next[next.length - 1] = { sender: 'ai', text: accumulated };
                return next;
              });
            }
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { sender: 'ai', text: 'Sajnálom, hiba történt a válaszadás során.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-border/60 bg-card/60 backdrop-blur-sm flex flex-col h-[350px]">
      <CardHeader className="py-3 border-b bg-muted/20 flex flex-row items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          <CardTitle className="text-sm font-semibold">AI Pénzügyi Asszisztens</CardTitle>
        </div>
        {analysis && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={generateReport} title="Újragenerálás">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-3 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 p-4">
            <div className="bg-indigo-500/10 text-indigo-500 p-3 rounded-2xl">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Azonnali AI Pénzügyi Elemzés</p>
              <p className="text-[11px] text-muted-foreground max-w-[280px]">
                Elemezze a jelenlegi jövedelmezőségi rátákat, költségszerkezeteket és kapjon adóoptimalizálási tanácsokat.
              </p>
            </div>
            <Button size="sm" onClick={generateReport} className="gap-1.5 font-medium text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
              Elemzés indítása
            </Button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages container */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 scrollbar-thin text-xs">
              {messages.map((msg, index) => (
                <div key={index} className={cn(
                  "flex flex-col max-w-[85%] rounded-xl p-3 leading-relaxed",
                  msg.sender === 'ai' 
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-auto rounded-tl-none whitespace-pre-line"
                    : "bg-indigo-600 text-white ml-auto rounded-tr-none"
                )}>
                  {msg.text.replace(/\*\*/g, '')}
                </div>
              ))}
              {loading && (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 mr-auto rounded-xl rounded-tl-none p-3 max-w-[85%] flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span className="text-[10px] text-muted-foreground">AI gondolkodik...</span>
                </div>
              )}
            </div>

            {/* Questions shortcuts */}
            <div className="flex gap-1.5 py-1.5 border-t overflow-x-auto shrink-0 select-none scrollbar-none">
              <button 
                type="button"
                onClick={() => { setUserInput("Hogyan tudok adót csökkenteni?"); }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full whitespace-nowrap transition-colors border"
              >
                Adóoptimalizálás?
              </button>
              <button 
                type="button"
                onClick={() => { setUserInput("Elemzed a személyi bérköltségeket?"); }}
                className="text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1 rounded-full whitespace-nowrap transition-colors border"
              >
                Bérköltségek auditja?
              </button>
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="flex gap-1 border-t pt-2 shrink-0">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Kérdezzen az adatokról..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 border-0 rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Button type="submit" size="icon" className="h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
