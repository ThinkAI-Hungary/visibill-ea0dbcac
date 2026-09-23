import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, Settings, FileText, UploadCloud, RefreshCcw, FileCheck,
  Clock, AlertTriangle, FileWarning, TrendingUp, CheckCircle2, ChevronRight,
  Bell, ChevronDown, EyeOff, Wrench, Calendar, Hash, Info, Plus, X,
  Phone, MessageCircle, Mail, Globe, PhoneCall, PhoneOff, Mic, Link2, Check, Loader2,
  ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { blockingCategoryMeta, type BlockingCategory, type BlockingItem } from './types';
import { useAccountyClients, useAccountyMissingItems, useIgnoreMissingItem, useAddMissingItem, useAccountyDeadlines, useAccountyCommunicationPrefs, useUpsertCommunicationPrefs, useCompleteDeadline, useAccountyTaxProfile, useUpsertTaxProfile, useGeneratePortalToken, useCompanyInvoices, useAccountyAuditLog, type AuditLogEntry, type CompanyInvoice, type AccountyDeadline, type AccountyMissingItem } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { extractNavSyncError, formatNavErrorMessage } from '@/lib/nav/navErrorUtils';
import {
  generateRequestEmail,
  addToApprovalQueue,
  type OutgoingMessage,
  type MissingItemForEmail,
} from './generateRequestEmail';

import { PageHeader } from '@/components/ui/page-header';
import ClientProfileTab from '@/components/accounty/client-details/ClientProfileTab';
import ClientInvoicesTab from '@/components/accounty/client-details/ClientInvoicesTab';
import ClientPayrollTab from '@/components/accounty/client-details/ClientPayrollTab';
import ClientReportsTab from '@/components/accounty/client-details/ClientReportsTab';
import ClientSettingsTab from '@/components/accounty/client-details/ClientSettingsTab';

export default function ClientDetailsPage() {
  const navigate = useNavigate();
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const { t, i18n } = useTranslation('accounty');
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = prefix === '/hr' || i18n.language === 'hr';
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

      const [outResult, inResult] = await Promise.all([
        supabase.functions.invoke('nav-sync', {
          body: { direction: 'OUTBOUND', dateFrom: firstDayStr, dateTo: lastDayStr, companyId: id }
        }),
        supabase.functions.invoke('nav-sync', {
          body: { direction: 'INBOUND', dateFrom: firstDayStr, dateTo: lastDayStr, companyId: id }
        })
      ]);

      const errOut = outResult.error ? await extractNavSyncError(outResult.error) : null;
      const errIn = inResult.error ? await extractNavSyncError(inResult.error) : null;

      if (errOut || errIn) {
        const primaryError = errOut || errIn;
        throw primaryError || new Error('NAV szinkronizáció sikertelen');
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
      const rawMsg = err?.message || 'Nem sikerült kapcsolatot létesíteni a NAV szerverrel. Ellenőrizd a hitelesítő adatokat.';
      const errMsg = formatNavErrorMessage(rawMsg);
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
  const supabaseMissing = (supabaseMissingData as any)?.items;
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
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return (allDeadlines || []).filter(d => {
      if (d.companyId !== id || d.status === 'completed') return false;
      const dueDate = new Date(d.dueDate);
      const diffMs = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      // If overdue by more than 30 days, it is no longer relevant
      if (diffDays < -30) return false;
      return true;
    });
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

  // Map Supabase missing items → BlockingItem format for UI compatibility (filtering out resolved items)
  const supabaseBlockingItems: BlockingItem[] = useMemo(() => {
    if (!supabaseMissing) return [];
    return supabaseMissing
      .filter(mi => mi.status === 'open' || mi.status === 'notified')
      .map(mi => {
        let title = mi.title;
        let subtitle = mi.subtitle || '';
        let details = mi.details || '';
        if (isHr) {
          if (title.includes('Bérszámfejtési adatok')) {
            title = title
              .replace('Bérszámfejtési adatok', 'Podaci za obračun plaća')
              .replace('január', 'siječanj').replace('február', 'veljača').replace('március', 'ožujak')
              .replace('április', 'travanj').replace('május', 'svibanj').replace('június', 'lipanj')
              .replace('július', 'srpanj').replace('augusztus', 'kolovoz').replace('szeptember', 'rujan')
              .replace('október', 'listopad').replace('november', 'studeni').replace('december', 'prosinac');
          }
          if (subtitle === 'Havi kötelező nyilatkozat és jelenléti ív') {
            subtitle = 'Mjesečna obvezna izjava i evidencija radnog vremena';
          } else if (subtitle === 'Manuálisan felvett') {
            subtitle = 'Ručni unos';
          }
          if (details.includes('bérszámfejtéshez szükséges adatok')) {
            details = 'Prikupljanje podataka potrebnih za obračun plaća (evidencija radnog vremena, godišnji odmori, prekovremeni rad, ostale promjene).';
          }
        }
        const sourceLabel = isHr
          ? (mi.source === 'nav_detektor' ? 'Porezna uprava (E-račun)'
             : mi.source === 'bank_detektor' ? 'Nadzor bankovnih izvadaka'
             : mi.source === 'ber_cron' ? 'Mjesečna obvezna izjava'
             : 'Ručni unos')
          : (mi.source === 'nav_detektor' ? 'NAV Online Számla'
             : mi.source === 'bank_detektor' ? 'Bankkivonat-figyelő'
             : mi.source === 'ber_cron' ? 'Havi kötelező nyilatkozat'
             : 'Kézi rögzítés');

        const amountStr = mi.amount 
          ? (isHr 
              ? `${mi.amount.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` 
              : `${mi.amount.toLocaleString('hu-HU')} Ft`) 
          : undefined;

        return {
          id: mi.id,
          clientId: mi.companyId,
          category: mi.category,
          title,
          subtitle,
          source: sourceLabel,
          amount: amountStr,
          date: mi.itemDate || undefined,
          priority: mi.priority,
          details,
          invoiceNumber: mi.invoiceNumber || undefined,
          resolveRoute: mi.resolveRoute || undefined,
        };
      });
  }, [supabaseMissing, isHr]);

  // Dynamic KPI values
  const missingCount = useMemo(() => {
    if (!supabaseMissing) return 0;
    return supabaseMissing.filter(mi => mi.status === 'open' || mi.status === 'notified').length;
  }, [supabaseMissing]);
  const upcomingDeadlineCount = companyDeadlines.length;

  // Real invoices
  const { data: companyInvoices } = useCompanyInvoices(id || '');

  const unprocessedCount = useMemo(() => {
    if (!companyInvoices) return 0;
    return companyInvoices.filter(inv => inv.status === 'Új').length;
  }, [companyInvoices]);

  const awaitingCodingCount = useMemo(() => {
    if (!companyInvoices) return 0;
    return companyInvoices.filter(inv => inv.status === 'Kontírozásra vár').length;
  }, [companyInvoices]);

  const estimatedVatBalance = useMemo(() => {
    if (!companyInvoices) return 0;
    let balance = 0;
    companyInvoices.forEach(inv => {
      const val = inv.vatAmount || 0;
      if (inv.type === 'kimeno') {
        balance += val;
      } else if (inv.type === 'bejovo') {
        balance -= val;
      }
    });
    return balance;
  }, [companyInvoices]);

  const invoiceData = useMemo(() => {
    if (!companyInvoices) return [];
    return companyInvoices.slice(0, 5).map((inv) => {
      const dotColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-500'
        : inv.status === 'Problémás' ? 'bg-red-500' : 'bg-blue-500';
      const statusColor = inv.status === 'Kontírozott' || inv.status === 'Exportálva' ? 'bg-emerald-100 text-emerald-700'
        : inv.status === 'Problémás' ? 'bg-red-100 text-red-700'
        : inv.status === 'Új' ? 'bg-amber-100 text-amber-700'
        : 'bg-muted text-muted-foreground';
      const statusLabel = inv.status === 'Új' ? (isHr ? 'U obradi' : 'Feldolgozás alatt')
        : inv.status === 'Kontírozott' ? (isHr ? 'Proknjiženo' : 'Könyvelve')
        : inv.status === 'Exportálva' ? (isHr ? 'Izvezeno' : 'Exportálva')
        : inv.status === 'Kontírozásra vár' ? (isHr ? 'Čeka knjiženje' : 'Kontírozásra vár')
        : inv.status;
      return {
        id: inv.id,
        number: inv.invoiceNumber,
        company: inv.partnerName,
        amount: isHr
          ? new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(inv.grossAmount) + ' €'
          : new Intl.NumberFormat('hu-HU').format(inv.grossAmount) + ' Ft',
        date: inv.date,
        status: statusLabel,
        dotColor,
        statusColor,
      };
    });
  }, [companyInvoices]);

  return (
    <div className="w-full space-y-6 page-animate">
      
      {/* Header */}
      <PageHeader
        title={clientLoading ? 'Betöltés...' : client.name}
        description={clientLoading ? undefined : (client.taxNumber ? (isHr ? `OIB: ${client.taxNumber}` : `Adószám: ${client.taxNumber}`) : undefined)}
        breadcrumbs={[
          { label: 'eaisyBooks', href: `${prefix}/eaisybooks` },
          { label: client.name || (isHr ? t('client_details.client') : 'Ügyfél'), href: `${prefix}/eaisybooks/${id}/${dateRange}/overview` },
          { label: pathname.endsWith('/settings') ? t('client_details.settings') : t('client_details.overview') },
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleNavSync}
            disabled={isSyncing}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border border-indigo-200 dark:border-indigo-900/40',
              isSyncing
                ? 'bg-primary/10 text-primary dark:text-primary cursor-not-allowed animate-pulse'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm'
            )}
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <RefreshCcw className="w-4 h-4 shrink-0" />}
            {isSyncing ? t('client_details.nav_syncing') : t('client_details.nav_sync')}
          </button>
          <button
            onClick={startCall}
            disabled={callState !== 'idle' && callState !== 'completed' && callState !== 'failed'}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors',
              callState === 'idle' || callState === 'completed' || callState === 'failed'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            <Phone className="w-4 h-4" />
            {t('client_details.ai_call')}
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
                : 'bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-muted'
            )}
          >
            {generateToken.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : linkCopied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            {generateToken.isPending ? t('client_details.magic_link_generating') : linkCopied ? t('client_details.magic_link_copied') : t('client_details.magic_link')}
          </button>
          <button 
            onClick={() => {
              if (pathname.endsWith('/settings')) {
                navigate(pathname.replace(/(?:overview|settings|profile)$/, 'overview'));
              } else {
                navigate(pathname.replace(/(?:overview|settings|profile)$/, 'settings'));
              }
            }}
            className={cn(
              "p-2 rounded-full transition-all duration-200 shadow-sm border active:scale-95",
              pathname.endsWith('/settings')
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "bg-card border-border text-muted-foreground hover:text-muted-foreground dark:hover:text-muted-foreground/60 hover:bg-muted dark:hover:bg-muted"
            )}
            title={pathname.endsWith('/settings') ? t('client_details.back_to_overview') : t('client_details.settings')}
          >
            <Settings className="w-5 h-5" />
          </button>
          </div>
        }
      />

      {navSyncError && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm animate-in slide-in-from-top-2 duration-300">
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
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'settings'))}
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

      {/* TABS CONTENT */}
      {(() => {
        const isOverview = pathname.endsWith('/overview') || (!pathname.endsWith('/settings') && !pathname.endsWith('/profile'));
        if (isOverview) {
          return (
            <div className="space-y-6 page-animate">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div 
              className="bg-card rounded-lg border border-border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-1"
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'invoices'))}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{t('client_overview.kpi_unprocessed')}</h3>
                <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">{unprocessedCount}</div>
            </div>

            <div 
              className="bg-card rounded-lg border border-border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-1"
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'invoices'))}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{t('client_overview.kpi_awaiting_coding')}</h3>
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                  <FileCheck className="w-4 h-4 text-blue-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">{awaitingCodingCount}</div>
            </div>

            <div 
              className="bg-card rounded-lg border border-border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-1"
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'missing-invoices'))}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{t('client_overview.kpi_missing')}</h3>
                <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center">
                  <FileWarning className="w-4 h-4 text-red-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">{missingCount}</div>
            </div>

            <div className="bg-card rounded-lg border border-border p-5 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-1">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">{t('client_overview.kpi_vat_balance')}</h3>
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {isHr
                  ? new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 2 }).format(estimatedVatBalance) + ' €'
                  : new Intl.NumberFormat('hu-HU').format(estimatedVatBalance) + ' Ft'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <Button 
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'invoices'))}
              className="h-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-base font-semibold flex items-center justify-center gap-2"
            >
              <FileCheck className="w-5 h-5" />
              {t('client_overview.btn_process_invoices')}
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'missing-invoices'))}
            >
              <AlertTriangle className="w-5 h-5 text-muted-foreground" />
              {t('client_overview.btn_request_missing')}
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-card border-border text-foreground hover:bg-accent hover:text-accent-foreground rounded-lg text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(pathname.replace(/(?:overview|settings|profile)$/, 'reports'))}
            >
              <UploadCloud className="w-5 h-5 text-muted-foreground" />
              {t('client_overview.btn_generate_report')}
            </Button>
          </div>

          {/* Gyors elérés — korábban csak a Bérszámfejtés fülről volt elérhető */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {[
              { label: t('client_overview.quick_cegkapu'), path: pathname.replace(/(?:overview|settings|profile)$/, 'cegkapu') },
              { label: t('client_overview.quick_representation'), path: pathname.replace(/(?:overview|settings|profile)$/, 'representation') },
              { label: t('client_overview.quick_data_retention'), path: pathname.replace(/(?:overview|settings|profile)$/, 'data-retention') },
              { label: t('client_overview.quick_filings'), path: pathname.replace(/(?:overview|settings|profile)$/, 'payroll/filings') },
              { label: t('client_overview.quick_structure'), path: pathname.replace(/(?:overview|settings|profile)$/, 'structure') },
              { label: t('client_overview.quick_params'), path: pathname.replace(/(?:overview|settings|profile)$/, 'payroll/tax-params') },
            ].map((link, idx) => (
              <button
                key={link.path + idx}
                onClick={() => navigate(link.path)}
                className="flex items-center justify-center p-3 h-14 rounded-lg bg-card border border-border shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 group text-center"
              >
                <span className="text-xs font-semibold text-foreground/90 group-hover:text-primary transition-colors text-center leading-tight">
                  {link.label}
                </span>
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
            const getCatLabel = (cat: BlockingCategory) => {
              switch (cat) {
                case 'bejovo': return t('client_overview.cat_inbound');
                case 'kimeno': return t('client_overview.cat_outbound');
                case 'bank': return t('client_overview.cat_bank');
                case 'ber': return t('client_overview.cat_payroll');
                default: return blockingCategoryMeta[cat]?.label;
              }
            };
            const grouped = categories.map((cat) => ({
              category: cat,
              meta: { ...blockingCategoryMeta[cat], label: getCatLabel(cat) },
              items: allItems.filter((item) => item.category === cat),
            }));
            const totalCount = allItems.length;

            const priorityBadge = (p: BlockingItem['priority']) => {
              const styles = {
                urgent: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400',
                medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400',
                low: 'bg-muted text-muted-foreground',
              };
              const labels = {
                urgent: t('client_overview.priority_urgent'),
                medium: t('client_overview.priority_medium'),
                low: t('client_overview.priority_low'),
              };
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
                    <h2 className="text-lg font-semibold text-foreground">
                      {t('client_overview.blocking_title')}
                    </h2>
                    {totalCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">
                        {t('client_overview.blocking_count_suffix', { count: totalCount })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {totalCount === 0 && (
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {t('client_overview.blocking_no_items')}
                      </div>
                    )}
                    <button
                      onClick={() => setShowAddForm(!showAddForm)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        showAddForm
                          ? 'bg-muted text-foreground/90'
                          : 'bg-muted text-muted-foreground hover:bg-muted dark:hover:bg-muted'
                      )}
                    >
                      {showAddForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                      {showAddForm ? t('client_overview.btn_cancel') : t('client_overview.btn_add')}
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
                  <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                    <h4 className="text-sm font-semibold text-foreground mb-3">{t('client_overview.add_title')}</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Kategória */}
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">{t('client_overview.field_category')}</label>
                        <select
                          value={newItem.category}
                          onChange={(e) => setNewItem({ ...newItem, category: e.target.value as BlockingCategory })}
                          className="w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="bejovo">{t('client_overview.cat_inbound')}</option>
                          <option value="kimeno">{t('client_overview.cat_outbound')}</option>
                          <option value="bank">{t('client_overview.cat_bank')}</option>
                          <option value="ber">{t('client_overview.cat_payroll')}</option>
                        </select>
                      </div>
                      {/* Megnevezés */}
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">{t('client_overview.field_title')}</label>
                        <input
                          type="text"
                          placeholder={t('client_overview.placeholder_title')}
                          value={newItem.title}
                          onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      {/* Részlet */}
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">{t('client_overview.field_subtitle')}</label>
                        <input
                          type="text"
                          placeholder={t('client_overview.placeholder_subtitle')}
                          value={newItem.subtitle}
                          onChange={(e) => setNewItem({ ...newItem, subtitle: e.target.value })}
                          className="w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
                        />
                      </div>
                      {/* Prioritás + Gomb */}
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 block">{t('client_overview.field_priority')}</label>
                          <select
                            value={newItem.priority}
                            onChange={(e) => setNewItem({ ...newItem, priority: e.target.value as BlockingItem['priority'] })}
                            className="w-full h-9 px-2.5 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-slate-400"
                          >
                            <option value="urgent">{t('client_overview.priority_urgent')}</option>
                            <option value="medium">{t('client_overview.priority_medium')}</option>
                            <option value="low">{t('client_overview.priority_low')}</option>
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
                            className="h-9 px-4 rounded-lg bg-slate-900 dark:bg-muted text-white dark:text-foreground text-xs font-semibold hover:bg-slate-800 dark:hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t('client_overview.btn_submit_add')}
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
                      className="bg-muted/30 border border-border rounded-lg p-4 flex flex-col gap-3 min-h-[200px]"
                    >
                      {/* Column header with count */}
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-bold text-foreground/90 uppercase tracking-wide">
                          {meta.icon} {meta.label}
                        </h3>
                        <span className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full',
                          items.length > 0
                            ? 'bg-muted text-foreground/90'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                        )}>
                          {items.length > 0 ? items.length : ''}
                        </span>
                      </div>

                      {/* Items */}
                      {items.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-xs text-muted-foreground italic">{t('client_overview.empty_category')}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {items.map((item) => {
                            const isExpanded = expandedItemId === item.id;
                            return (
                              <div
                                key={item.id}
                                className={cn(
                                  'bg-card border rounded-lg transition-all duration-200',
                                  isExpanded
                                    ? 'border-border/80 shadow-md'
                                    : 'border-border shadow-sm hover:border-border/80'
                                )}
                              >
                                {/* Card header – always visible */}
                                <button
                                  className="w-full p-3 flex items-start justify-between gap-2 text-left cursor-pointer"
                                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                                      {item.title}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">
                                      {item.subtitle}
                                    </p>
                                    <div className="mt-2">
                                      {priorityBadge(item.priority)}
                                    </div>
                                  </div>
                                  <ChevronDown
                                    className={cn(
                                      'w-4 h-4 text-muted-foreground shrink-0 mt-0.5 transition-transform duration-200',
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
                                  <div className="px-3 pb-3 border-t border-border">
                                    {/* Detail rows */}
                                    <div className="mt-3 space-y-2">
                                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="font-medium">{t('client_overview.label_source')}</span>
                                        <span>{item.source}</span>
                                      </div>
                                      {item.date && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                          <span className="font-medium">{t('client_overview.label_date')}</span>
                                          <span>{item.date}</span>
                                        </div>
                                      )}
                                      {item.amount && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                          <span className="font-medium">{t('client_overview.label_amount')}</span>
                                          <span className="font-semibold text-foreground">{item.amount}</span>
                                        </div>
                                      )}
                                      {item.invoiceNumber && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                          <span className="font-medium">{t('client_overview.label_invoice_num')}</span>
                                          <span className="font-mono text-[11px]">{item.invoiceNumber}</span>
                                        </div>
                                      )}
                                    </div>

                                    {/* Details text */}
                                    <p className="mt-3 text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-md p-2.5 border border-border">
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
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        {t('client_overview.btn_ignore')}
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
                                          {t('client_overview.btn_resolve')}
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
                                            deadline: item.date ? new Date(item.date).toLocaleDateString('hu-HU') : undefined,
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
                                          navigate(`${prefix}/eaisybooks/approval-queue`);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                      >
                                        <Bell className="w-3.5 h-3.5" />
                                        {t('client_overview.btn_send_request')}
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
            <RecentActivities companyId={client?.id} />

            {/* Upcoming Deadlines */}
            <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border">
                <h3 className="font-semibold text-foreground">{t('client_overview.deadlines_title')}</h3>
              </div>
              <div className="p-4 space-y-3 flex-1">
                {companyDeadlines.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                    {t('client_overview.deadlines_empty')}
                  </div>
                ) : (
                  companyDeadlines.slice(0, 4).map((dl) => {
                    const dueDate = new Date(dl.dueDate);
                    const now = new Date();
                    const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    const typeLabels: Record<string, string> = { afa: 'ÁFA', jarulek: 'Járulék', kata: 'Kata', ber: 'Bér', tao: 'TAO', ipa: 'IPA', egyeb: 'Egyéb' };
                    const rawTitle = dl.title || '';
                    let label = isHr
                      ? (DEADLINE_TITLES_HR[rawTitle] || DEADLINE_TYPES_HR[dl.deadlineType] || rawTitle || dl.deadlineType)
                      : (rawTitle || typeLabels[dl.deadlineType] || dl.deadlineType);
                    if (isHr && !DEADLINE_TITLES_HR[rawTitle]) {
                      label = label
                        .replace('Bér járulékok befizetése', 'Uplata doprinosa na plaće')
                        .replace('Bér járulékok', 'Doprinosi na plaće')
                        .replace('Bérszámfejtés leadás', 'Predaja obračuna plaća')
                        .replace('Járulékbevallás + befizetés', 'Prijava i uplata doprinosa')
                        .replace('ÁFA bevallás (negyedéves)', 'Prijava PDV-a (tromjesečna)')
                        .replace('ÁFA bevallás (éves)', 'Prijava PDV-a (godišnja)')
                        .replace('ÁFA bevallás', 'Prijava PDV-a')
                        .replace('KATA adó befizetés', 'Uplata paušalnog poreza')
                        .replace('TAO bevallás', 'Prijava poreza na dobit')
                        .replace('IPA bevallás', 'Prijava lokalnog poreza');
                    }

                    return (
                      <div
                        key={dl.id}
                        className={cn(
                          "border rounded-lg p-4 flex items-center justify-between",
                          isOverdue
                            ? "border-red-200 dark:border-red-950/40 bg-red-50/10 dark:bg-red-950/20"
                            : "border-border bg-muted/20"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-full bg-card shadow-sm flex items-center justify-center shrink-0 border",
                            isOverdue ? "border-red-100 dark:border-red-950/50" : "border-border"
                          )}>
                            <Clock className={cn("w-5 h-5", isOverdue ? "text-red-500" : "text-muted-foreground")} />
                          </div>
                          <div>
                            <p className={cn("text-sm font-semibold", isOverdue ? "text-red-600 dark:text-red-400" : "text-foreground")}>{label}</p>
                            <p className={cn("text-xs", isOverdue ? "text-red-500/80 dark:text-red-400/60" : "text-muted-foreground")}>
                              {dueDate.toLocaleDateString(isHr ? 'hr-HR' : 'hu-HU')}
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
                                : "bg-muted text-muted-foreground"
                          )}>
                            {isOverdue ? t('client_overview.deadline_overdue', { days: Math.abs(diffDays) }) : t('client_overview.deadline_days_left', { days: diffDays })}
                          </div>
                          <button
                            onClick={() => completeDeadlineMutation.mutate(dl.id)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                            title={t('client_overview.btn_mark_complete')}
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
      );
    }
        if (pathname.endsWith('/profile')) {
          return (
            <ClientProfileTab
              clientId={id || ''}
              client={client}
              notifPrefs={notifPrefs}
              setNotifPrefs={setNotifPrefs}
              taxProfileData={taxProfileData}
            />
          );
        }
        if (pathname.endsWith('/settings')) {
          return (
            <ClientSettingsTab
              clientId={id || ''}
              notifPrefs={notifPrefs}
              setNotifPrefs={setNotifPrefs}
              commPrefsData={commPrefsData}
              taxProfileData={taxProfileData}
            />
          );
        }
        return null;
      })()}


      {/* Floating AI Call Panel */}
      {callState !== 'idle' && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className={cn(
            'rounded-lg shadow-2xl border p-5 w-80 transition-all duration-300',
            callState === 'completed'
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800'
              : callState === 'failed'
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                : 'bg-card border-border'
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
                  <p className="text-xs font-bold text-foreground">AI Telefonhívás</p>
                  <p className="text-[10px] text-muted-foreground">{client.name}</p>
                </div>
              </div>
              {(callState === 'completed' || callState === 'failed') && (
                <button
                  onClick={() => setCallState('idle')}
                  className="p-1 hover:bg-muted dark:hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
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
                  <p className="text-sm font-semibold text-foreground">Tárcsázás...</p>
                  <p className="text-xs text-muted-foreground">Kapcsolódás az ügyfélhez</p>
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
                  <p className="text-sm font-semibold text-foreground">Csörög...</p>
                  <p className="text-xs text-muted-foreground">Várakozás a válaszra</p>
                </div>
              )}
              {callState === 'speaking' && (
                <div className="space-y-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground">Beszélgetés folyamatban</p>
                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatTime(callTimer)}</p>
                  <p className="text-[10px] text-muted-foreground"> AI kéri a hiányzó dokumentumokat</p>
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
                  <p className="text-xs text-muted-foreground">Az ügyfél ígérte a dokumentumokat 2 napon belül</p>
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
                  <p className="text-xs text-muted-foreground">Próbáld újra később</p>
                </div>
              )}
            </div>

            {/* Actions */}
            {(callState === 'dialing' || callState === 'ringing' || callState === 'speaking') && (
              <button
                onClick={endCall}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
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


const DEADLINE_TITLES_HR: Record<string, string> = {
  'Járulékbevallás + befizetés': 'Prijava i uplata doprinosa',
  'Bérszámfejtés leadás': 'Predaja obračuna plaća',
  'Bér járulékok befizetése': 'Uplata doprinosa na plaće',
  'Bér járulékok': 'Doprinosi na plaće',
  'ÁFA bevallás': 'Prijava PDV-a',
  'ÁFA bevallás (negyedéves)': 'Prijava PDV-a (tromjesečna)',
  'ÁFA bevallás (éves)': 'Prijava PDV-a (godišnja)',
  'KATA adó befizetés': 'Uplata paušalnog poreza',
  'TAO bevallás': 'Prijava poreza na dobit',
  'IPA bevallás': 'Prijava lokalnog poreza',
};

const DEADLINE_TYPES_HR: Record<string, string> = {
  afa: 'PDV',
  jarulek: 'Doprinosi',
  kata: 'Paušalni porez',
  ber: 'Plaće',
  tao: 'Porez na dobit',
  ipa: 'Lokalni porez',
  egyeb: 'Ostalo',
};

// ── RecentActivities: real data from accounty_audit_log ──

const ACTION_META: Record<string, { label: string; icon: React.ElementType; bg: string; iconColor: string }> = {
  create_client:     { label: 'Ügyfél létrehozva',        icon: Plus,        bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  resolve_missing:   { label: 'Hiányzó bizonylat rendezve', icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  complete_deadline: { label: 'Határidő teljesítve',      icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', iconColor: 'text-emerald-600' },
  generate_report:   { label: 'Riport generálva',         icon: FileText,    bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  upload_invoice:    { label: 'Számla feltöltve',          icon: UploadCloud, bg: 'bg-muted',      iconColor: 'text-muted-foreground' },
  nav_sync:          { label: 'NAV szinkronizálás',        icon: RefreshCcw,  bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  contiroz:          { label: 'Számla kontírozva',         icon: FileCheck,   bg: 'bg-amber-50 dark:bg-amber-900/30',    iconColor: 'text-amber-600' },
  send_notification: { label: 'Értesítés küldve',          icon: Bell,        bg: 'bg-violet-50 dark:bg-violet-900/30',  iconColor: 'text-violet-600' },
  add_missing:       { label: 'Hiányzó bizonylat rögzítve', icon: AlertTriangle, bg: 'bg-red-50 dark:bg-red-900/30',     iconColor: 'text-red-500' },
  ignore_missing:    { label: 'Bizonylat figyelmen kívül hagyva', icon: EyeOff, bg: 'bg-muted',   iconColor: 'text-muted-foreground' },
  generate_portal:   { label: 'Portál link generálva',     icon: Link2,       bg: 'bg-blue-50 dark:bg-blue-900/30',      iconColor: 'text-blue-600' },
  update_prefs:      { label: 'Kommunikációs beállítás frissítve', icon: Settings, bg: 'bg-muted', iconColor: 'text-muted-foreground' },
  update_tax:        { label: 'Adóprofil módosítva',       icon: Wrench,      bg: 'bg-amber-50 dark:bg-amber-900/30',    iconColor: 'text-amber-600' },
};

const DEFAULT_META = { label: 'Tevékenység', icon: Clock, bg: 'bg-muted', iconColor: 'text-muted-foreground' };

const ACTION_KEY_MAP: Record<string, string> = {
  create_client:     'client_overview.act_create_client',
  resolve_missing:   'client_overview.act_resolve_missing',
  complete_deadline: 'client_overview.act_complete_deadline',
  generate_report:   'client_overview.act_generate_report',
  upload_invoice:    'client_overview.act_upload_invoice',
  nav_sync:          'client_overview.act_nav_sync',
  contiroz:          'client_overview.act_contiroz',
  send_notification: 'client_overview.act_send_notification',
  add_missing:       'client_overview.act_add_missing',
  ignore_missing:    'client_overview.act_ignore_missing',
  generate_portal:   'client_overview.act_generate_portal',
  update_prefs:      'client_overview.act_update_prefs',
  update_tax:        'client_overview.act_update_tax',
};

function RecentActivities({ companyId }: { companyId?: string }) {
  const { t } = useTranslation('accounty');
  const { pathname } = useLocation();
  const isHr = pathname.startsWith('/hr');
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
      return new Date(iso).toLocaleDateString(isHr ? 'hr-HR' : 'hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden flex flex-col">
      <div className="p-5 border-b border-border flex justify-between items-center">
        <h3 className="font-semibold text-foreground">{t('client_overview.recent_activities_title')}</h3>
        {logs.length > 0 && (
          <span className="text-[10px] font-bold text-muted-foreground uppercase">
            {t('client_overview.recent_activities_count', { count: logs.length })}
          </span>
        )}
      </div>
      <div className="p-2 flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && logs.length === 0 && (
          <div className="text-center py-6">
            <Clock className="w-6 h-6 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{t('client_overview.recent_activities_empty')}</p>
          </div>
        )}
        {logs.map(log => {
          const meta = ACTION_META[log.action] || DEFAULT_META;
          const actionLabel = ACTION_KEY_MAP[log.action] ? t(ACTION_KEY_MAP[log.action]) : meta.label;
          const Icon = meta.icon;
          const details = log.details as any;
          const detailText = (details?.description || details?.item_title || details?.deadline_title || '') as string;
          return (
            <div key={log.id} className="flex items-start gap-4 p-3 hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', meta.bg)}>
                <Icon className={cn('w-4 h-4', meta.iconColor)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {actionLabel}
                  {detailText && <span className="font-normal text-muted-foreground"> — {detailText}</span>}
                </p>
                <p className="text-xs text-muted-foreground">
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
