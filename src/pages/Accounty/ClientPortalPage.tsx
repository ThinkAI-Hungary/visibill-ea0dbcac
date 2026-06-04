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
import { useAccountyClients, useAccountyMissingItems } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

interface PortalRequest {
  id: string;
  type: 'bejovo' | 'kimeno' | 'bank' | 'ber';
  title: string;
  description: string;
  status: 'pending' | 'submitted' | 'approved' | 'rejected';
  dueDate: string;
  category: string;
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
  const params = useParams<{ id?: string; token?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [generatingLink, setGeneratingLink] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<Record<string, File[]>>({});
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Determine if we're in magic-link mode (/portal/:token) or admin mode (/accounty/payroll/:id/portal)
  const isMagicLink = !!params.token;
  const directCompanyId = params.id || '';

  // Resolve token → company_id for magic link mode
  const { data: tokenData } = useQuery({
    queryKey: ['portal-token-resolve', params.token],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_portal_tokens' as any)
        .select('company_id, token, expires_at, is_active, requested_item_ids')
        .eq('token', params.token)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: isMagicLink && !!params.token,
    staleTime: 60_000,
  });

  const companyId = isMagicLink ? (tokenData?.company_id || '') : directCompanyId;

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const { data: missingItems = [] } = useAccountyMissingItems(companyId || '');

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

  // File upload handler — resolves a specific missing item, logs to accounty_uploads
  const handleFileUpload = async (files: FileList, requestTitle: string, missingItemId?: string) => {
    if (!companyId || !files.length) return;

    const portalToken = isMagicLink ? params.token || null : null;

    try {
      const uploadedPaths: string[] = [];

      for (const file of Array.from(files)) {
        const filePath = `accounty-portal/${companyId}/${Date.now()}_${file.name}`;

        // 1. Create audit log entry (pending)
        const { data: logEntry, error: logErr } = await supabase
          .from('accounty_uploads' as any)
          .insert({
            company_id: companyId,
            missing_item_id: missingItemId || null,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type || null,
            file_size_bytes: file.size,
            upload_source: isMagicLink ? 'portal' : 'admin',
            status: 'uploading',
            uploaded_by: user?.id || null,
            portal_token: portalToken,
          } as any)
          .select('id')
          .single();

        if (logErr) {
          console.error('[Portal] Upload log insert error:', logErr.message);
        }
        const logId = (logEntry as any)?.id;

        // 2. Upload to storage
        const { error: uploadErr } = await supabase.storage
          .from('accounty_uploads')
          .upload(filePath, file, { upsert: false });

        if (uploadErr) {
          console.error('[Portal] Storage upload error:', uploadErr.message);
          // Update log → error
          if (logId) {
            await supabase.from('accounty_uploads' as any)
              .update({ status: 'error', error_message: uploadErr.message, completed_at: new Date().toISOString() } as any)
              .eq('id', logId);
          }
        } else {
          uploadedPaths.push(filePath);
          console.log('[Portal] File uploaded to storage:', filePath);
          // Update log → success
          if (logId) {
            await supabase.from('accounty_uploads' as any)
              .update({ status: 'success', completed_at: new Date().toISOString() } as any)
              .eq('id', logId);
          }
        }
      }

      // 3. Only resolve if at least one file was actually uploaded
      if (missingItemId && uploadedPaths.length > 0) {
        const { data: existing } = await supabase
          .from('accounty_missing_items' as any)
          .select('uploaded_files')
          .eq('id', missingItemId)
          .single();

        const existingFiles: string[] = (existing as any)?.uploaded_files || [];

        const { data: updateResult, error: resolveErr } = await supabase
          .from('accounty_missing_items' as any)
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolved_by: user?.id || null,
            uploaded_files: [...existingFiles, ...uploadedPaths],
          } as any)
          .eq('id', missingItemId)
          .select();

        if (resolveErr) {
          console.error('[Portal] DB resolve error:', resolveErr.message);
          toast({ variant: 'destructive', title: 'Hiba', description: `Státusz frissítés sikertelen: ${resolveErr.message}` });
          return;
        }
        console.log('[Portal] DB update result:', updateResult);
        queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });

        toast({
          title: 'Feltöltve ✓',
          description: `${uploadedPaths.length} fájl sikeresen feltöltve a(z) "${requestTitle}" tételhez.`,
        });
      } else if (missingItemId && uploadedPaths.length === 0) {
        toast({ variant: 'destructive', title: 'Feltöltés sikertelen', description: 'A fájl nem töltődött fel. Kérjük próbálja újra.' });
      }
    } catch (err: any) {
      console.error('[Portal] Upload error:', err);
      toast({ variant: 'destructive', title: 'Feltöltési hiba', description: err?.message || 'A fájl feltöltés sikertelen.' });
    }
  };

  // Build requests from actual missing items in Supabase
  // If magic link has specific requested_item_ids, filter to only those
  const requestedItemIds: string[] = isMagicLink && tokenData?.requested_item_ids ? tokenData.requested_item_ids : [];

  const requests: PortalRequest[] = useMemo(() => {
    const itemsToShow = requestedItemIds.length > 0
      ? missingItems.filter(item => requestedItemIds.includes(item.id))
      : missingItems;

    return itemsToShow.map(item => {
      const categoryLabels: Record<string, string> = {
        bejovo: 'Bejövő számla', kimeno: 'Kimenő számla', bank: 'Banki tétel', ber: 'Bér dokumentum',
      };
      return {
        id: item.id,
        type: (item.category || 'bejovo') as PortalRequest['type'],
        title: `${item.title}${item.subtitle ? ` – ${item.subtitle}` : ''}${item.invoiceNumber ? ` (${item.invoiceNumber})` : ''}`,
        description: categoryLabels[item.category] || item.category,
        category: categoryLabels[item.category] || item.category,
        status: item.notificationCount > 0 ? 'submitted' : 'pending',
        dueDate: item.itemDate || new Date().toISOString(),
      };
    });
  }, [missingItems, requestedItemIds]);

  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Bekérésre vár' },
    submitted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Bekérve' },
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Beérkezett' },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Elutasítva' },
  };


  const handleChatSubmit = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendMessage.mutate(text);
  };

  // ── MAGIC LINK MODE: Client-facing document upload portal ──
  if (isMagicLink) {

    const handleStageFiles = (reqId: string, files: FileList) => {
      setStagedFiles(prev => ({
        ...prev,
        [reqId]: [...(prev[reqId] || []), ...Array.from(files)],
      }));
    };

    const handleRemoveFile = (reqId: string, fileIndex: number) => {
      setStagedFiles(prev => {
        const current = [...(prev[reqId] || [])];
        current.splice(fileIndex, 1);
        return { ...prev, [reqId]: current };
      });
    };

    const handleUploadSingle = async (reqId: string, reqTitle: string) => {
      const files = stagedFiles[reqId];
      if (!files?.length) return;
      setUploadingIds(prev => new Set(prev).add(reqId));
      try {
        // Create a FileList-like structure from the staged files
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        await handleFileUpload(dt.files, reqTitle, reqId);
        setUploadedIds(prev => new Set(prev).add(reqId));
        setStagedFiles(prev => { const n = { ...prev }; delete n[reqId]; return n; });
      } finally {
        setUploadingIds(prev => { const n = new Set(prev); n.delete(reqId); return n; });
      }
    };

    const handleUploadAll = async () => {
      for (const req of requests) {
        if (stagedFiles[req.id]?.length && !uploadedIds.has(req.id)) {
          await handleUploadSingle(req.id, req.title);
        }
      }
    };

    const totalStagedCount = Object.values(stagedFiles).reduce((sum, f) => sum + f.length, 0);

    return (
      <div className="min-h-screen bg-background">
        {/* Top header bar */}
        <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100">{company?.name || 'Betöltés...'}</h1>
                <p className="text-[11px] text-slate-500">Dokumentum feltöltő portál</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
              <Shield className="w-3.5 h-3.5" />
              <span className="font-medium">Biztonságos kapcsolat</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

          {/* Welcome card */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Üdvözöljük! 👋
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Könyvelője hiányzó dokumentumokat kér Öntől. Kérjük, válassza ki a megfelelő fájlokat 
              az egyes tételeknél, majd kattintson a feltöltés gombra.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                {requests.length} hiányzó dokumentum
              </span>
            </div>
          </div>

          {/* Missing documents list */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Hiányzó dokumentumok</h3>
            </div>
            {requests.length === 0 ? (
              <div className="py-10 text-center">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Minden dokumentum beérkezett!</p>
                <p className="text-xs text-slate-400 mt-1">Köszönjük a gyors válaszát.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {requests.map((req) => {
                  const isOverdue = new Date(req.dueDate) < new Date() && req.status === 'pending';
                  const staged = stagedFiles[req.id] || [];
                  const isUploading = uploadingIds.has(req.id);
                  const isUploaded = uploadedIds.has(req.id);

                  return (
                    <div key={req.id} className={cn(
                      'px-6 py-4 transition-colors',
                      isUploaded ? 'bg-green-50/50 dark:bg-green-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                    )}>
                      {/* Document info row */}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isUploaded && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
                            <p className={cn(
                              'text-sm font-semibold',
                              isUploaded ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'
                            )}>{req.title}</p>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                              {req.category}
                            </span>
                            <span className={cn('text-xs', isOverdue ? 'text-red-500 font-semibold' : 'text-slate-400')}>
                              Határidő: {new Date(req.dueDate).toLocaleDateString('hu-HU')}
                              {isOverdue && ' · LEJÁRT'}
                            </span>
                          </div>
                        </div>

                        {!isUploaded && (
                          <label className="cursor-pointer shrink-0">
                            <div className={cn(
                              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors',
                              staged.length > 0
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border hover:bg-slate-200 dark:hover:bg-slate-700'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                            )}>
                              <Upload className="w-3.5 h-3.5" />
                              {staged.length > 0 ? 'Másik fájl' : 'Fájl kiválasztása'}
                            </div>
                            <input type="file" className="hidden" multiple onChange={(e) => {
                              if (e.target.files?.length) handleStageFiles(req.id, e.target.files);
                            }} />
                          </label>
                        )}
                        {isUploaded && (
                          <span className="px-3 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold">
                            ✓ Feltöltve
                          </span>
                        )}
                      </div>

                      {/* Staged files list */}
                      {staged.length > 0 && !isUploaded && (
                        <div className="mt-3 space-y-1.5">
                          {staged.map((file, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                              <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{file.name}</span>
                              <span className="text-[10px] text-slate-400 shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                              <button
                                onClick={() => handleRemoveFile(req.id, idx)}
                                className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors shrink-0"
                              >
                                <X className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => handleUploadSingle(req.id, req.title)}
                            disabled={isUploading}
                            className="mt-1 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                          >
                            {isUploading ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Feltöltés...</>
                            ) : (
                              <><Upload className="w-3.5 h-3.5" /> Feltöltés ({staged.length} fájl)</>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Global upload button */}
            {totalStagedCount > 0 && (
              <div className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/30">
                <button
                  onClick={handleUploadAll}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-colors shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  Összes feltöltése ({totalStagedCount} fájl)
                </button>
              </div>
            )}
          </div>

          {/* Footer disclaimer */}
          <div className="text-center pt-4 pb-8 space-y-1">
            <p className="text-[11px] text-slate-400">
              Ez a link egyedi az Ön számára. Kérjük, ne ossza meg másokkal.
            </p>
            <p className="text-[10px] text-slate-500/60">
              Powered by Accounty · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!isMagicLink && (
            <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ügyfélportál</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} · Adatbekérés és dokumentumkezelés</p>
          </div>
        </div>
        {!isMagicLink && (
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
        )}
      </div>

      {!isMagicLink && (
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
      )}

      {/* ── Data Requests (from actual missing items) ── */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Adatbekérések — {currentYear}. {MONTHS[currentMonth - 1]}</h2>
          <span className="text-xs text-slate-500">{requests.length} dokumentum</span>
        </div>
        {requests.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Nincs hiányzó dokumentum</p>
            <p className="text-xs text-slate-400 mt-1">Minden szükséges dokumentum beérkezett.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Dokumentum</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kategória</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Határidő</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Státusz</th>
                  <th className="px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {requests.map((req) => {
                  const status = statusColors[req.status];
                  const isOverdue = new Date(req.dueDate) < new Date() && req.status === 'pending';
                  return (
                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{req.title}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {req.category}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('text-xs font-medium', isOverdue ? 'text-red-600' : 'text-slate-600 dark:text-slate-400')}>
                          {new Date(req.dueDate).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          {isOverdue && <span className="ml-1 text-[9px] font-bold text-red-600">LEJÁRT</span>}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', status.bg, status.text)}>{status.label}</span>
                      </td>
                      <td className="px-5 py-3">
                        <label className="cursor-pointer">
                          <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all">
                            <Upload className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-semibold text-primary">Feltöltés</span>
                          </div>
                          <input type="file" className="hidden" multiple onChange={(e) => {
                            if (e.target.files?.length) handleFileUpload(e.target.files, req.title);
                          }} />
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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