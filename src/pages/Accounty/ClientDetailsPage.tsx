import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, Settings, FileText, UploadCloud, RefreshCcw, FileCheck,
  Clock, AlertTriangle, FileWarning, TrendingUp, CheckCircle2, ChevronRight,
  Bell, ChevronDown, EyeOff, Wrench, Calendar, Hash, Info, Plus, X,
  Phone, MessageCircle, Mail, Globe, PhoneCall, PhoneOff, Mic, Link2, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { blockingCategoryMeta, type BlockingCategory, type BlockingItem } from './types';
import { useAccountyClients, useAccountyMissingItems, useIgnoreMissingItem, useAddMissingItem, useAccountyDeadlines, useAccountyCommunicationPrefs, useUpsertCommunicationPrefs, useCompleteDeadline, useAccountyTaxProfile, useUpsertTaxProfile, useGeneratePortalToken, useCompanyInvoices, useAccountyAuditLog, type AuditLogEntry, type CompanyInvoice, type AccountyDeadline, type AccountyMissingItem } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import {
  generateRequestEmail,
  addToApprovalQueue,
  type OutgoingMessage,
  type MissingItemForEmail,
} from './generateRequestEmail';

import ClientProfileTab from '@/components/accounty/client-details/ClientProfileTab';
import ClientInvoicesTab from '@/components/accounty/client-details/ClientInvoicesTab';
import ClientPayrollTab from '@/components/accounty/client-details/ClientPayrollTab';
import ClientReportsTab from '@/components/accounty/client-details/ClientReportsTab';
import ClientSettingsTab from '@/components/accounty/client-details/ClientSettingsTab';

export default function ClientDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Áttekintés');
  const [isSyncing, setIsSyncing] = useState(false);
  const [navSyncError, setNavSyncError] = useState<string | null>(null);

  const handleNavSync = async () => {
    if (!id) return;
    setIsSyncing(true);
    setNavSyncError(null);
    try {
      const today = new Date();
      const firstDayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayStr = today.toISOString().slice(0, 10);

      const [{ data: syncOut, error: errOut }, { data: syncIn, error: errIn }] = await Promise.all([
        supabase.functions.invoke('nav-sync', {
          body: { direction: 'OUTBOUND', dateFrom: firstDayStr, dateTo: lastDayStr, companyId: id }
        }),
        supabase.functions.invoke('nav-sync', {
          body: { direction: 'INBOUND', dateFrom: firstDayStr, dateTo: lastDayStr, companyId: id }
        })
      ]);

      if (errOut || errIn) {
        throw errOut || errIn || new Error('NAV szinkronizáció sikertelen');
      }

      toast({
        title: 'Sikeres NAV szinkronizáció!',
        description: 'Az inbound és outbound számlák frissítése befejeződött.'
      });

      // Invalidate query caches
      queryClient.invalidateQueries({ queryKey: ['companyInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-kata-customer-totals'] });
    } catch (err: any) {
      console.error('NAV sync error:', err);
      const errMsg = err?.message || 'Nem sikerült kapcsolatot létesíteni a NAV szerverrel. Ellenőrizd a hitelesítő adatokat.';
      setNavSyncError(errMsg);
      toast({
        title: 'Szinkronizálási hiba',
        description: errMsg,
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [manualItems, setManualItems] = useState<BlockingItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<{
    category: BlockingCategory;
    title: string;
    subtitle: string;
    priority: BlockingItem['priority'];
    details: string;
  }>({
    category: 'bejovo',
    title: '',
    subtitle: '',
    priority: 'medium',
    details: '',
  });
  const [notifPrefs, setNotifPrefs] = useState({
    email: false,
    viber: false,
    phone: false,
    sms: false,
    language: 'hu',
    frequency: 'normal',
    autoReminder: false,
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // AI Call state machine
  type CallState = 'idle' | 'dialing' | 'ringing' | 'speaking' | 'completed' | 'failed';
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTimer, setCallTimer] = useState(0);

  useEffect(() => {
    if (callState === 'idle' || callState === 'completed' || callState === 'failed') return;
    const timeouts: Record<string, { next: CallState; delay: number }> = {
      dialing: { next: 'ringing', delay: 2000 },
      ringing: { next: 'speaking', delay: 3000 },
      speaking: { next: 'completed', delay: 8000 },
    };
    const config = timeouts[callState];
    if (!config) return;
    const t = setTimeout(() => setCallState(config.next), config.delay);
    return () => clearTimeout(t);
  }, [callState]);

  useEffect(() => {
    if (callState !== 'speaking') { setCallTimer(0); return; }
    const i = setInterval(() => setCallTimer(s => s + 1), 1000);
    return () => clearInterval(i);
  }, [callState]);

  const startCall = () => { setCallState('dialing'); setCallTimer(0); };
  const endCall = () => { setCallState(callState === 'speaking' ? 'completed' : 'failed'); };
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Fetch client from Supabase
  const { data: supabaseClients, isLoading: clientLoading } = useAccountyClients();
  const { data: supabaseMissingData } = useAccountyMissingItems(id || '');
  const supabaseMissing = supabaseMissingData?.items;
  const ignoreMutation = useIgnoreMissingItem();
  const addMutation = useAddMissingItem();

  // Communication preferences
  const { data: commPrefsData } = useAccountyCommunicationPrefs(id || '');
  const upsertCommPrefs = useUpsertCommunicationPrefs();

  // Tax profile
  const { data: taxProfileData } = useAccountyTaxProfile(id || '');
  const upsertTaxProfile = useUpsertTaxProfile();

  // Deadline completion
  const completeDeadlineMutation = useCompleteDeadline();

  // Portal token generation
  const generateToken = useGeneratePortalToken();

  // Deadlines for this company
  const { data: allDeadlines } = useAccountyDeadlines();
  const companyDeadlines = useMemo(() => {
    return (allDeadlines || []).filter(d => d.companyId === id && d.status !== 'completed');
  }, [allDeadlines, id]);

  // Sync Supabase comm prefs → local state
  useEffect(() => {
    if (commPrefsData) {
      setNotifPrefs({
        email: commPrefsData.channelEmail,
        viber: commPrefsData.channelViber,
        phone: commPrefsData.channelPhone,
        sms: commPrefsData.channelSms,
        language: commPrefsData.preferredLanguage,
        frequency: commPrefsData.reminderFrequency,
        autoReminder: commPrefsData.autoReminder,
        contactName: commPrefsData.contactName || '',
        contactEmail: commPrefsData.contactEmail || '',
        contactPhone: commPrefsData.contactPhone || '',
      });
    }
  }, [commPrefsData]);

  const client = useMemo(() => {
    const found = supabaseClients?.find(c => c.id === id);
    if (found) return { id: found.id, name: found.name, taxNumber: found.taxNumber || '' };
    return { id: id || '1', name: 'Betöltés...', taxNumber: '' };
  }, [supabaseClients, id]);

  // Map Supabase missing items → BlockingItem format for UI compatibility
  const supabaseBlockingItems: BlockingItem[] = useMemo(() => {
    if (!supabaseMissing) return [];
    return supabaseMissing.map(mi => ({
      id: mi.id,
      clientId: mi.companyId,
      category: mi.category,
      title: mi.title,
      subtitle: mi.subtitle || '',
      source: mi.source === 'nav_detektor' ? 'NAV Online Számla'
        : mi.source === 'bank_detektor' ? 'Bankkivonat-figyelő'
        : mi.source === 'ber_cron' ? 'Havi kötelező nyilatkozat'
        : 'Kézi rögzítés',
      amount: mi.amount ? `${mi.amount.toLocaleString('hu-HU')} Ft` : undefined,
      date: mi.itemDate || undefined,
      priority: mi.priority,
      details: mi.details || '',
      invoiceNumber: mi.invoiceNumber || undefined,
      resolveRoute: mi.resolveRoute || undefined,
    }));
  }, [supabaseMissing]);

  // Dynamic KPI values
  const missingCount = supabaseMissing?.length || 0;
  const upcomingDeadlineCount = companyDeadlines.length;

  const tabs = ['Áttekintés', 'Profil', 'Számlák', 'Bérszámfejtés', 'Riportok', 'Beállítások'];

  // Real invoices
  const { data: companyInvoices } = useCompanyInvoices(id || '');
  const invoiceData = useMemo(() => {
    if (!companyInvoices) return [];
    return companyInvoices.slice(0, 5).map((inv) => {
      const dotColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-500'
        : inv.status === 'Problémás' ? 'bg-red-500' : 'bg-blue-500';
      const statusColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-100 text-emerald-700'
        : inv.status === 'Problémás' ? 'bg-red-100 text-red-700'
        : inv.status === 'Új' ? 'bg-amber-100 text-amber-700'
        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
      const statusLabel = inv.status === 'Új' ? 'Feldolgozás alatt'
        : inv.status === 'Kontírozott' ? 'Könyvelve'
        : inv.status === 'Exportálva' ? 'Exportálva' : inv.status;
      return {
        id: inv.id,
        number: inv.invoiceNumber,
        company: inv.partnerName,
        amount: new Intl.NumberFormat('hu-HU').format(inv.grossAmount) + ' Ft',
        date: inv.date,
        status: statusLabel,
        dotColor,
        statusColor,
      };
    });
  }, [companyInvoices]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{client.name}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{client.taxNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleNavSync}
            disabled={isSyncing}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border border-indigo-200 dark:border-indigo-900/40',
              isSyncing
                ? 'bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 cursor-not-allowed animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
            )}
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCcw className="w-4 h-4 shrink-0" />}
            {isSyncing ? 'NAV szinkron...' : 'NAV szinkron'}
          </button>
          <button
            onClick={startCall}
            disabled={callState !== 'idle' && callState !== 'completed' && callState !== 'failed'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              callState === 'idle' || callState === 'completed' || callState === 'failed'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
            )}
          >
            <Phone className="w-4 h-4" />
            AI Hívás
          </button>
          <button
            onClick={async () => {
              try {
                const result = await generateToken.mutateAsync(id!);
                const url = `${window.location.origin}/portal/${result.token}`;
                await navigator.clipboard.writeText(url);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch (e) {
                reportError({ type: 'db_query', component: 'ClientDetailsPage', action: 'error', message: 'Failed to generate portal token:', error: e });
              }
            }}
            disabled={generateToken.isPending}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all',
              linkCopied
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            )}
          >
            {generateToken.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : linkCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {generateToken.isPending ? 'Generálás...' : linkCopied ? 'Másolt!' : 'Magic Link'}
          </button>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {navSyncError && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-xl text-sm animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2.5 text-red-800 dark:text-red-300">
            <AlertTriangle className="w-4.5 h-4.5 text-red-500 shrink-0" />
            <div>
              <span className="font-semibold">NAV Szinkronizációs hiba:</span> {navSyncError}. Kérjük, ellenőrizze a NAV API technikai felhasználó beállításait.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/accounty/client/${id}/settings`)}
              className="bg-card border-red-200 hover:bg-red-50 dark:border-red-800/40 dark:hover:bg-red-900/20 text-red-800 dark:text-red-300 text-xs font-semibold px-3 py-1.5 h-auto rounded-lg transition-colors shadow-soft"
            >
              NAV API Beállítások
            </Button>
            <button
              onClick={() => setNavSyncError(null)}
              className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              if (tab === 'Számlák') {
                navigate(`/accounty/client/${id}/invoices`);
              } else if (tab === 'Bérszámfejtés') {
                navigate(`/accounty/client/${id}/payroll`);
              } else if (tab === 'Riportok') {
                navigate(`/accounty/client/${id}/reports`);
              } else if (tab === 'Beállítások') {
                navigate(`/accounty/client/${id}/settings`);
              } else {
                setActiveTab(tab);
              }
            }}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeTab === tab 
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}
      
      {/* Áttekintés Tab */}
      {activeTab === 'Áttekintés' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div 
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => setActiveTab('Számlák')}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Feldolgozatlan számlák</h3>
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">0</div>
            </div>

            <div 
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => setActiveTab('Számlák')}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Kontírozásra vár</h3>
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">0</div>
            </div>

            <div 
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1"
              onClick={() => navigate(`/accounty/missing-invoices/${client.id}`)}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Hiányzó számlák</h3>
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                  <FileWarning className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{missingCount}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-indigo-300 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">ÁFA egyenleg (becsült)</h3>
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">245,000 Ft</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate(`/accounty/client/${client.id}/invoices`)}
              className="h-14 bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white rounded-xl text-base font-semibold flex items-center justify-center gap-2"
            >
              <FileCheck className="w-5 h-5" />
              Számlák feldolgozása
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(`/accounty/client/${client.id}/missing-invoices`)}
            >
              <AlertTriangle className="w-5 h-5 text-slate-400" />
              Hiányzók bekérése
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(`/accounty/client/${client.id}/reports`)}
            >
              <UploadCloud className="w-5 h-5 text-slate-400" />
              Riport generálása
            </Button>
          </div>

          {/* Gyors elérés — korábban csak a Bérszámfejtés fülről volt elérhető */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: 'Cégkapu / KÜNY', path: `/accounty/client/${client.id}/cegkapu`, icon: '' },
              { label: 'NAV meghatalmazás', path: `/accounty/client/${client.id}/representation`, icon: '' },
              { label: 'Iratkezelés & GDPR', path: `/accounty/client/${client.id}/data-retention`, icon: '' },
              { label: 'NAV bevallások', path: `/accounty/payroll/${client.id}/filings`, icon: '' },
              { label: 'Bérezési struktúra', path: `/accounty/client/${client.id}/structure`, icon: '' },
              { label: 'Paramétertábla', path: `/accounty/payroll/${client.id}/tax-params`, icon: '' },
            ].map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.path)}
                className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <span className="text-xl">{link.icon}</span>
                <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors text-center leading-tight">{link.label}</span>
              </button>
            ))}
          </div>

          {/*  Zárást blokkoló hiányosságok */}
          {(() => {
            const allItems = [
              ...supabaseBlockingItems.filter((item) => item.clientId === client.id),
              ...manualItems.filter((item) => item.clientId === client.id),
            ].filter((item) => !ignoredIds.has(item.id));
            const categories: BlockingCategory[] = ['bejovo', 'kimeno', 'bank', 'ber'];
            const grouped = categories.map((cat) => ({
              category: cat,
              meta: blockingCategoryMeta[cat],
              items: allItems.filter((item) => item.category === cat),
            }));
            const totalCount = allItems.length;

            const priorityBadge = (p: BlockingItem['priority']) => {
              const styles = {
                urgent: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
                medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
                low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
              };
              const labels = { urgent: 'Sürgős', medium: 'Közepes', low: 'Alacsony' };
              return (
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', styles[p])}>
                  {labels[p]}
                </span>
              );
            };

            return (
              <div id="missing-items-section" className="mt-8 mb-8">
                {/* Section Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                       Zárást blokkoló hiányosságok
                    </h2>
                    {totalCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                        {totalCount} tétel
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCount === 0 && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        Nincs blokkoló hiányosság
                      </div>
                    )}
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        showAddForm
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      )}
                    >
                      {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {showAddForm ? 'Mégse' : 'Hozzáadás'}
                    </button>
                  </div>
                </div>

                {/* Add form */}
                <div
                  className={cn(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    showAddForm ? 'max-h-[400px] opacity-100 mb-4' : 'max-h-0 opacity-0'
                  )}
                >
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Hiányosság manuális felvétele</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Kategória */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Kategória</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value as BlockingCategory })}
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="bejovo"> Bejövő</option>
                          <option value="kimeno"> Kimenő</option>
                          <option value="bank"> Bank</option>
                          <option value="ber"> Bér</option>
                        </select>
                      </div>
                      {/* Megnevezés */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Megnevezés</label>
                        <input
                          type="text"
                          placeholder="pl. MOL Nyrt."
                          value={newItem.title}
                          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      {/* Részlet */}
                      <div>
                        <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Rövid leírás</label>
                        <input
                          type="text"
                          placeholder="pl. PDF hiányzik"
                          value={newItem.subtitle}
                          onChange={(e) => setNewItem({ ...newItem, subtitle: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      {/* Prioritás + Gomb */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Prioritás</label>
                          <select
                            value={newItem.priority}
                            onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as BlockingItem['priority'] })}
                            className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            <option value="urgent"> Sürgős</option>
                            <option value="medium"> Közepes</option>
                            <option value="low"> Alacsony</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={async () => {
                              if (!newItem.title.trim() || !id) return;
                              try {
                                await addMutation.mutateAsync({
                                  companyId: id,
                                  category: newItem.category,
                                  title: newItem.title,
                                  subtitle: newItem.subtitle || 'Manuálisan felvett',
                                  priority: newItem.priority,
                                  details: newItem.details || `Manuálisan felvett hiányosság: ${newItem.title}`,
                                });
                                setNewItem({ category: 'bejovo', title: '', subtitle: '', priority: 'medium', details: '' });
                                setShowAddForm(false);
                              } catch (err) {
                                reportError({ type: 'db_query', component: 'ClientDetailsPage', action: 'error', message: 'Add blocking item failed:', error: err });
                              }
                            }}
                            disabled={!newItem.title.trim()}
                            className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Felvesz
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4-column grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {grouped.map(({ category, meta, items }) => (
                    <div
                      key={category}
                      className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-3 min-h-[200px]"
                    >
                      {/* Column header with count */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                          {meta.icon} {meta.label}
                        </h3>
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          items.length > 0
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        )}>
                          {items.length > 0 ? items.length : ''}
                        </span>
                      </div>

                      {/* Items */}
                      {items.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nincs hiányosság</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {items.map((item) => {
                            const isExpanded = expandedItemId === item.id;
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  'bg-white dark:bg-slate-900 border rounded-lg transition-all duration-200',
                                  isExpanded
                                    ? 'border-slate-300 dark:border-slate-700 shadow-md'
                                    : 'border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'
                                )}
                              >
                                {/* Card header – always visible */}
                                <button
                                  className="w-full p-3 flex items-start justify-between gap-2 text-left cursor-pointer"
                                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
                                      {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                      {item.subtitle}
                                    </p>
                                    <div className="mt-2">
                                      {priorityBadge(item.priority)}
                                    </div>
                                  </div>
                                  <ChevronDown
                                    className={cn(
                                      'w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200',
                                      isExpanded && 'rotate-180'
                                    )}
                                  />
                                </button>

                                {/* Drill-down panel */}
                                <div
                                  className={cn(
                                    'overflow-hidden transition-all duration-300 ease-in-out',
                                    isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                                  )}
                                >
                                  <div className="px-3 pb-3 border-t border-slate-100 dark:border-slate-800">
                                    {/* Detail rows */}
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                        <span className="font-medium">Forrás:</span>
                                        <span>{item.source}</span>
                                      </div>
                                      {item.date && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="font-medium">Dátum:</span>
                                          <span>{item.date}</span>
                                        </div>
                                      )}
                                      {item.amount && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                          <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="font-medium">Összeg:</span>
                                          <span className="font-semibold text-slate-900 dark:text-slate-100">{item.amount}</span>
                                        </div>
                                      )}
                                      {item.invoiceNumber && (
                                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                                          <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                          <span className="font-medium">Szla#:</span>
                                          <span className="font-mono text-[11px]">{item.invoiceNumber}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Details text */}
                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-md p-2.5 border border-slate-100 dark:border-slate-800">
                                      {item.details}
                                    </p>

                                    {/* Action buttons */}
                                    <div className="mt-3 flex flex-col gap-1.5">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await ignoreMutation.mutateAsync(item.id);
                                          } catch (err) {
                                            reportError({ type: 'db_query', component: 'ClientDetailsPage', action: 'error', message: 'Ignore failed:', error: err });
                                          }
                                          setExpandedItemId(null);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        Ignorálom (fals pozitív)
                                      </button>
                                      {item.resolveRoute && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(item.resolveRoute!);
                                          }}
                                          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                        >
                                          <Wrench className="w-3.5 h-3.5" />
                                          Megoldom
                                        </button>
                                      )}
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          // Build approval queue message from this single item
                                          if (!id) return;
                                          const contactEmail = notifPrefs.contactEmail || 'nincs-megadva@example.com';

                                          // Generate real portal token using the hook (with specific item IDs)
                                          let portalLink = `${window.location.origin}/portal/demo-fallback`;
                                          try {
                                            const result = await generateToken.mutateAsync({ companyId: id, requestedItemIds: [item.id] });
                                            portalLink = `${window.location.origin}/portal/${result.token}`;
                                          } catch (err) {
                                            reportError({ type: 'db_query', component: 'ClientDetailsPage', action: 'error', message: 'Portal token creation failed:', error: err });
                                          }

                                          const missingItemForEmail: MissingItemForEmail = {
                                            title: item.title + (item.subtitle ? ` – ${item.subtitle}` : ''),
                                            category: item.category,
                                            deadline: item.itemDate ? new Date(item.itemDate).toLocaleDateString('hu-HU') : undefined,
                                          };
                                          const generated = generateRequestEmail({
                                            companyName: client?.name || 'Ismeretlen',
                                            missingItems: [missingItemForEmail],
                                            portalLink,
                                            senderName: 'ThinkAI',
                                          });
                                          const msg: OutgoingMessage = {
                                            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                            companyId: id,
                                            companyName: client?.name || 'Ismeretlen',
                                            contactEmail,
                                            channel: 'email',
                                            category: item.priority === 'urgent' ? 'urgent' : 'normal',
                                            subject: generated.subject,
                                            originalContext: `${item.title}${item.subtitle ? ` – ${item.subtitle}` : ''}`,
                                            aiGeneratedBody: generated.body,
                                            htmlPreview: generated.htmlPreview,
                                            portalLink,
                                            status: 'pending',
                                            createdAt: new Date().toISOString(),
                                            missingItemIds: [item.id],
                                          };
                                          addToApprovalQueue(msg);
                                          navigate('/accounty/approval-queue');
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                      >
                                        <Bell className="w-3.5 h-3.5" />
                                        Bekérés küldése
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Bottom Section */}
          <div className="grid grid-cols-2 gap-6">
            
            {/* Recent Activities — from audit log */}
            <RecentActivities companyId={client?.companyId} />

            {/* Upcoming Deadlines */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Következő határidők</h3>
              </div>
              <div className="p-4 space-y-3 flex-1">
                {companyDeadlines.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-slate-400 dark:text-slate-500">
                    Nincs közelgő határidő
                  </div>
                ) : (
                  companyDeadlines.slice(0, 4).map((dl) => {
                    const dueDate = new Date(dl.dueDate);
                    const now = new Date();
                    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const typeLabels: Record<string, string> = { afa: 'ÁFA', jarulek: 'Járulék', kata: 'Kata', ber: 'Bér', tao: 'TAO', ipa: 'IPA', egyeb: 'Egyéb' };
                    const label = dl.title || typeLabels[dl.deadlineType] || dl.deadlineType;

                    return (
                      <div
                        key={dl.id}
                        className={cn(
                          "border rounded-xl p-4 flex items-center justify-between",
                          isOverdue
                            ? "border-red-200 dark:border-red-900/50 bg-red-50/30 dark:bg-red-900/20"
                            : "border-slate-100 dark:border-slate-800 dark:bg-slate-900/50"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full bg-white dark:bg-slate-900 shadow-sm flex items-center justify-center shrink-0",
                            isOverdue ? "border border-red-100 dark:border-red-900/50" : "border border-slate-200 dark:border-slate-800"
                          )}>
                            <Clock className={cn("w-5 h-5", isOverdue ? "text-red-500" : "text-slate-500 dark:text-slate-400")} />
                          </div>
                          <div>
                            <p className={cn("text-sm font-semibold", isOverdue ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100")}>{label}</p>
                            <p className={cn("text-xs", isOverdue ? "text-red-500/80 dark:text-red-400/60" : "text-slate-500 dark:text-slate-400")}>
                              {dueDate.toLocaleDateString('hu-HU')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            isOverdue
                              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                              : diffDays <= 3
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400"
                                : "bg-slate-200/50 text-slate-600 dark:text-slate-400"
                          )}>
                            {isOverdue ? `${Math.abs(diffDays)} napja lejárt` : `${diffDays} nap`}
                          </div>
                          <button
                            onClick={() => completeDeadlineMutation.mutate(dl.id)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                            title="Megjelölés késznek"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profil Tab */}
      {activeTab === 'Profil' && (
        <ClientProfileTab
          clientId={id || ''}
          client={client}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
          taxProfileData={taxProfileData}
        />
      )}

      {/* Számlák Tab */}
      {activeTab === 'Számlák' && (
        <ClientInvoicesTab
          clientId={id || ''}
          companyInvoices={companyInvoices}
        />
      )}

      {/* Bérszámfejtés Tab */}
      {activeTab === 'Bérszámfejtés' && (
        <ClientPayrollTab
          client={client}
        />
      )}

      {/* Riportok Tab */}
      {activeTab === 'Riportok' && (
        <ClientReportsTab
          client={client}
          companyInvoices={companyInvoices}
          supabaseMissing={supabaseMissing}
          companyDeadlines={companyDeadlines}
        />
      )}

      {/* Beállítások Tab */}
      {activeTab === 'Beállítások' && (
        <ClientSettingsTab
          clientId={id || ''}
          notifPrefs={notifPrefs}
          setNotifPrefs={setNotifPrefs}
          commPrefsData={commPrefsData}
          taxProfileData={taxProfileData}
        />
      )}


      {/* Floating AI Call Panel */}
      {callState !== 'idle' && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className={cn(
            'rounded-2xl shadow-2xl border p-5 w-80 transition-all duration-300',
            callState === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
              : callState === 'failed'
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          )}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center',
                  callState === 'completed' ? 'bg-emerald-100 dark:bg-emerald-900/50' :
                  callState === 'failed' ? 'bg-red-100 dark:bg-red-900/50' :
                  'bg-emerald-100 dark:bg-emerald-900/50'
                )}>
                  {callState === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : callState === 'failed' ? (
                    <PhoneOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : (
                    <PhoneCall className={cn('w-4 h-4 text-emerald-600 dark:text-emerald-400', (callState === 'dialing' || callState === 'ringing') && 'animate-pulse')} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">AI Telefonhívás</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{client.name}</p>
                </div>
              </div>
              {(callState === 'completed' || callState === 'failed') && (
                <button
                  onClick={() => setCallState('idle')}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Status */}
            <div className="text-center py-3">
              {callState === 'dialing' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center animate-pulse">
                      <Phone className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tárcsázás...</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Kapcsolódás az ügyfélhez</p>
                </div>
              )}
              {callState === 'ringing' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                        <PhoneCall className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-emerald-400 animate-ping opacity-30" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Csörög...</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Várakozás a válaszra</p>
                </div>
              )}
              {callState === 'speaking' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Beszélgetés folyamatban</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatTime(callTimer)}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400"> AI kéri a hiányzó dokumentumokat</p>
                </div>
              )}
              {callState === 'completed' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Sikeres hívás!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Az ügyfél ígérte a dokumentumokat 2 napon belül</p>
                </div>
              )}
              {callState === 'failed' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                      <PhoneOff className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">Nem sikerült elérni</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Próbáld újra később</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(callState === 'dialing' || callState === 'ringing' || callState === 'speaking') && (
              <button
                onClick={endCall}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                Hívás befejezése
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// ── RecentActivities: real data from accounty_audit_log ──

const ACTION_META: Record<string, { label: string; icon: React.ElementType; bg: string; iconColor: string }> = {
  create_client:     { label: 'Ügyfél létrehozva',        icon: Plus,        bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  resolve_missing:   { label: 'Hiányzó bizonylat rendezve', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  complete_deadline: { label: 'Határidő teljesítve',      icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  generate_report:   { label: 'Riport generálva',         icon: FileText,    bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  upload_invoice:    { label: 'Számla feltöltve',          icon: UploadCloud, bg: 'bg-slate-100 dark:bg-slate-800',      iconColor: 'text-slate-600 dark:text-slate-400' },
  nav_sync:          { label: 'NAV szinkronizálás',        icon: RefreshCcw,  bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  contiroz:          { label: 'Számla kontírozva',         icon: FileCheck,   bg: 'bg-amber-50 dark:bg-amber-900/30',    iconColor: 'text-amber-600' },
  send_notification: { label: 'Értesítés küldve',          icon: Bell,        bg: 'bg-violet-50 dark:bg-violet-900/30',  iconColor: 'text-violet-600' },
  add_missing:       { label: 'Hiányzó bizonylat rögzítve', icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/30',     iconColor: 'text-red-500' },
  ignore_missing:    { label: 'Bizonylat figyelmen kívül hagyva', icon: EyeOff, bg: 'bg-slate-100 dark:bg-slate-800',   iconColor: 'text-slate-500' },
  generate_portal:   { label: 'Portál link generálva',     icon: Link2,       bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  update_prefs:      { label: 'Kommunikációs beállítás frissítve', icon: Settings, bg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-500' },
  update_tax:        { label: 'Adóprofil módosítva',       icon: Wrench,      bg: 'bg-amber-50 dark:bg-amber-900/30',    iconColor: 'text-amber-600' },
};

const DEFAULT_META = { label: 'Tevékenység', icon: Clock, bg: 'bg-slate-100 dark:bg-slate-800', iconColor: 'text-slate-500' };

function RecentActivities({ companyId }: { companyId?: string }) {
  const { data: allLogs, isLoading } = useAccountyAuditLog(50);

  const logs = useMemo(() => {
    if (!allLogs) return [];
    const filtered = companyId
      ? allLogs.filter(l => l.companyId === companyId)
      : allLogs;
    return filtered.slice(0, 6);
  }, [allLogs, companyId]);

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Legutóbbi tevékenységek</h3>
        {logs.length > 0 && (
          <span className="text-[10px] font-bold text-slate-400 uppercase">{logs.length} bejegyzés</span>
        )}
      </div>
      <div className="p-2 flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="text-center py-6">
            <Clock className="w-6 h-6 mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-400">Még nincs tevékenység</p>
          </div>
        )}
        {logs.map(log => {
          const meta = ACTION_META[log.action] || DEFAULT_META;
          const Icon = meta.icon;
          const detailText = log.details?.description || log.details?.item_title || log.details?.deadline_title || '';
          return (
            <div key={log.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                <Icon className={cn('w-4 h-4', meta.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {meta.label}
                  {detailText && <span className="font-normal text-slate-500"> — {detailText}</span>}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDate(log.createdAt)}
                  {log.userName && log.userName !== 'Ismeretlen' && <span className="ml-1.5">· {log.userName}</span>}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
