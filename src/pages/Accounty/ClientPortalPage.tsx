import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Upload, CheckCircle2, Clock, AlertTriangle,
  FileText, Send, Download, Users, Calendar, MessageCircle,
  Shield, ExternalLink, Loader2, Copy, Link2, X, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePayrollCycles, usePayrollEmployees } from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

interface PortalRequest {
  id: string;
  type: 'attendance' | 'changes' | 'new_employee' | 'termination' | 'documents';
  title: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  dueDate: string;
  submittedAt?: string;
  files?: string[];
}

interface ChatMessage {
  id: string;
  company_id: string;
  sender_user_id: string | null;
  sender_name: string;
  message: string;
  is_from_client: boolean;
  created_at: string;
}

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export default function ClientPortalPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generatingLink, setGeneratingLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');

  // ── Fetch active portal tokens ──
  const { data: portalTokens = [] } = useQuery({
    queryKey: ['portal-tokens', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_portal_tokens' as any)
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
  });

  // ── Fetch chat messages (real, not mock) ──
  const { data: messages = [] } = useQuery({
    queryKey: ['accounty-messages', companyId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from('accounty_messages' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!companyId,
    refetchInterval: 15_000, // Poll every 15s for new messages
  });

  // ── Send message mutation ──
  const sendMessage = useMutation({
    mutationFn: async (text: string) => {
      const senderName = user?.user_metadata?.name || user?.email || 'Könyvelő';
      const { error } = await supabase
        .from('accounty_messages' as any)
        .insert({
          company_id: companyId,
          sender_user_id: user?.id,
          sender_name: senderName,
          message: text,
          is_from_client: false,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-messages', companyId] });
      setChatInput('');
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    },
  });

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'active'), [employees]);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // ── Portal link with 1-hour rate limit ──
  const handleGeneratePortalLink = async () => {
    if (!companyId || !user?.id) return;

    // Rate limit: check if last token was created less than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentToken = portalTokens.find((t: any) => t.created_at > oneHourAgo);
    if (recentToken) {
      const createdAt = new Date(recentToken.created_at);
      const minutesLeft = Math.ceil((createdAt.getTime() + 3600000 - Date.now()) / 60000);
      toast({
        variant: 'destructive',
        title: 'Túl gyakori generálás',
        description: `Legközelebb ${minutesLeft} perc múlva generálhatsz új linket.`,
      });
      return;
    }

    setGeneratingLink(true);
    try {
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error } = await supabase
        .from('accounty_portal_tokens' as any)
        .insert({
          company_id: companyId,
          token,
          created_by: user.id,
          expires_at: expiresAt.toISOString(),
          is_active: true,
        } as any);

      if (error) throw error;

      const link = `${window.location.origin}/portal/${token}`;
      await navigator.clipboard.writeText(link);
      queryClient.invalidateQueries({ queryKey: ['portal-tokens', companyId] });

      toast({ title: 'Portál link generálva ✓', description: 'A link a vágólapra másolva. Érvényes: 30 nap.' });
    } catch (err) {
      console.error('Portal token error:', err);
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült a link generálás.' });
    } finally {
      setGeneratingLink(false);
    }
  };

  // ── Invite: generate link + send email ──
  const handleSendInvite = async () => {
    // First generate a portal link
    await handleGeneratePortalLink();
    // Then attempt to send an email notification via edge function
    if (!user?.id || !companyId) return;
    try {
      const latestToken = portalTokens[0];
      if (!latestToken) return;
      const link = `${window.location.origin}/portal/${latestToken.token}`;

      await supabase.functions.invoke('send-notification-email', {
        body: {
          user_id: user.id,
          type: 'portal_invite',
          title: `Portál hozzáférés: ${company?.name || ''}`,
          subject: `Adatbekérés — ${company?.name || 'Ügyfél'}`,
          body_html: `<p>Kedves Ügyfelünk!</p><p>Az alábbi linken töltheti fel a szükséges dokumentumokat:</p><p><a href="${link}">${link}</a></p><p>A link 30 napig érvényes.</p>`,
        },
      });
      toast({ title: 'Meghívó elküldve ✉️', description: `Portál link és e-mail kiküldve a(z) ${company?.name || 'ügyfél'} részére.` });
    } catch {
      // Link was already generated, email is optional
      toast({ title: 'Link generálva', description: 'Portál link létrehozva, de az e-mail küldés sikertelen.' });
    }
  };

  // File upload handler with auto-resolve
  const handleFileUpload = async (files: FileList, requestTitle: string) => {
    if (!companyId || !files.length) return;

    try {
      for (const file of Array.from(files)) {
        const filePath = `accounty-portal/${companyId}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('uploads')
          .upload(filePath, file, { upsert: false });

        if (uploadErr) {
          console.error('Upload error:', uploadErr);
        }
      }

      const { error: resolveErr } = await supabase
        .from('accounty_missing_items' as any)
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id || null,
        } as any)
        .eq('company_id', companyId)
        .in('status', ['open', 'notified']);

      if (resolveErr) console.error('Auto-resolve error:', resolveErr);

      queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });

      toast({
        title: 'Feltöltve ✓',
        description: `${files.length} fájl a(z) "${requestTitle}" kéréshez. Kapcsolódó hiányzó tételek feloldva.`,
      });
    } catch (err) {
      console.error('Upload error:', err);
      toast({ variant: 'destructive', title: 'Feltöltési hiba', description: 'A fájl feltöltés sikertelen.' });
    }
  };

  // Build dynamic requests from the latest cycle state
  const latestCycle = cycles
    .filter(c => c.status !== 'closed')
    .sort((a, b) => b.year - a.year || b.month - a.month)[0];

  const requests: PortalRequest[] = useMemo(() => {
    if (!latestCycle) return [];
    const cycleDueDate = new Date(latestCycle.year, latestCycle.month - 1, 5).toISOString();
    const stepDone = (latestCycle.current_step || 1) > 1;
    const monthLabel = `${latestCycle.year}. ${MONTHS[latestCycle.month - 1]}`;

    return [
      {
        id: `${latestCycle.id}-att`, type: 'attendance' as const, title: 'Jelenléti ív',
        description: `${monthLabel} havi munkaidő-nyilvántartás`,
        status: stepDone ? 'submitted' : 'pending', dueDate: cycleDueDate,
      },
      {
        id: `${latestCycle.id}-chg`, type: 'changes' as const, title: 'Bérmódosítások',
        description: 'Béremelések, státuszváltozások a hónapban',
        status: stepDone ? 'submitted' : 'pending', dueDate: cycleDueDate,
      },
      {
        id: `${latestCycle.id}-new`, type: 'new_employee' as const, title: 'Új belépők',
        description: 'Új foglalkoztatottak adatai (TAJ, adóazonosító, bankszámla)',
        status: stepDone ? 'submitted' : 'pending', dueDate: new Date(latestCycle.year, latestCycle.month - 1, 3).toISOString(),
      },
      {
        id: `${latestCycle.id}-caf`, type: 'documents' as const, title: 'Cafeteria igények',
        description: 'SZÉP kártya, rekreáció, egyéb juttatás igénylések',
        status: stepDone ? 'submitted' : 'pending', dueDate: new Date(latestCycle.year, latestCycle.month - 1, 10).toISOString(),
      },
    ];
  }, [latestCycle, cycles]);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Várakozik' },
    submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Beküldve' },
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Elfogadva' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Elutasítva' },
  };

  const typeIcons: Record<string, React.ElementType> = {
    attendance: Clock, changes: FileText, new_employee: Users, termination: AlertTriangle, documents: Upload,
  };

  const handleChatSubmit = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendMessage.mutate(text);
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ügyfélportál</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} · Adatbekérés és dokumentumkezelés</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGeneratePortalLink} disabled={generatingLink} className="flex items-center gap-2">
            {generatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {generatingLink ? 'Generálás...' : 'Portál link'}
          </Button>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            onClick={handleSendInvite}>
            <Mail className="w-4 h-4" /> Meghívó küldése
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: Shield, label: 'Portál státusz', value: portalTokens.length > 0 ? 'Aktív' : 'Nincs link', sub: portalTokens.length > 0 ? `${portalTokens.length} aktív link` : 'Generálj linket', color: portalTokens.length > 0 ? 'text-green-600' : 'text-slate-400' },
          { icon: Clock, label: 'Függő kérések', value: requests.filter(r => r.status === 'pending').length, sub: 'Válaszra vár', color: 'text-amber-600' },
          { icon: Users, label: 'Foglalkoztatottak', value: activeEmployees.length, sub: 'Aktív', color: 'text-blue-600' },
          { icon: Calendar, label: 'Aktuális ciklus', value: `${currentYear}/${String(currentMonth).padStart(2, '0')}`, sub: MONTHS[currentMonth - 1], color: 'text-violet-600' },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-xl border border-border shadow-soft p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={cn('w-4 h-4', card.color)} />
              <span className="text-xs font-medium text-slate-500 uppercase">{card.label}</span>
            </div>
            <p className={cn('text-lg font-bold', card.color)}>{card.value}</p>
            <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Active Portal Links ── */}
      {portalTokens.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary" />
              Aktív portál linkek
            </h2>
            <span className="text-xs text-slate-500">{portalTokens.length} db</span>
          </div>
          <div className="divide-y divide-border/50">
            {portalTokens.map((t: any) => {
              const link = `${window.location.origin}/portal/${t.token}`;
              const expiresDate = new Date(t.expires_at);
              const daysLeft = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / 86400000));
              return (
                <div key={t.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <ExternalLink className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400 truncate max-w-xs">{link}</p>
                      <p className="text-[10px] text-slate-400">
                        Létrehozva: {new Date(t.created_at).toLocaleDateString('hu-HU')} · Lejár: {daysLeft} nap múlva
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-xs shrink-0"
                    onClick={async () => {
                      await navigator.clipboard.writeText(link);
                      toast({ title: 'Másolva ✓', description: 'A portál link a vágólapra másolva.' });
                    }}
                  >
                    <Copy className="w-3 h-3" /> Másolás
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Data Requests ── */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Adatbekérések — {currentYear}. {MONTHS[currentMonth - 1]}</h2>
          <span className="text-xs text-slate-500">{requests.length} kérés</span>
        </div>
        <div className="divide-y divide-border/50">
          {requests.map((req) => {
            const StatusIcon = typeIcons[req.type] || FileText;
            const status = statusColors[req.status];
            const isOverdue = new Date(req.dueDate) < new Date() && req.status === 'pending';
            return (
              <div key={req.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800')}>
                  <StatusIcon className={cn('w-5 h-5', isOverdue ? 'text-red-600' : 'text-slate-500')} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{req.title}</p>
                    {isOverdue && <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[9px] font-bold rounded-full uppercase">Lejárt!</span>}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{req.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Határidő: {new Date(req.dueDate).toLocaleDateString('hu-HU')}</p>
                </div>
                <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', status.bg, status.text)}>{status.label}</span>
                <label className="cursor-pointer">
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                    <Upload className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-primary">Feltöltés</span>
                  </div>
                  <input type="file" className="hidden" multiple onChange={(e) => {
                    if (e.target.files?.length) handleFileUpload(e.target.files, req.title);
                  }} />
                </label>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Communication (real messages) ── */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Kommunikáció</h2>
          <span className="text-xs text-slate-400 ml-auto">{messages.length} üzenet</span>
        </div>
        <div className="p-5 space-y-3 max-h-80 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="py-8 text-center">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm text-slate-500">Még nincs üzenet. Írj az ügyfélnek!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.is_from_client ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-md rounded-xl px-4 py-2.5',
                  msg.is_from_client
                    ? 'bg-slate-100 dark:bg-slate-800 border border-border'
                    : 'bg-primary/10 border border-primary/20'
                )}>
                  <div className="flex items-center gap-2 mb-1">
                    <MessageCircle className="w-3 h-3 text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">{msg.sender_name}</span>
                    <span className="text-[10px] text-slate-400">{new Date(msg.created_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">{msg.message}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-border/50">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Üzenet írása..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSubmit(); } }}
          />
          <Button
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={!chatInput.trim() || sendMessage.isPending}
            onClick={handleChatSubmit}
          >
            {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}