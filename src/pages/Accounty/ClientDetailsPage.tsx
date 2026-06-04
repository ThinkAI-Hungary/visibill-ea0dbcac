import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, Settings, FileText, UploadCloud, RefreshCcw, FileCheck,
  Clock, AlertTriangle, FileWarning, TrendingUp, CheckCircle2, ChevronRight,
  Bell, ChevronDown, EyeOff, Wrench, Calendar, Hash, Info, Plus, X,
  Phone, MessageCircle, Mail, Globe, PhoneCall, PhoneOff, Mic, Link2, Check, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { blockingCategoryMeta, type BlockingCategory, type BlockingItem } from './types';
import { useAccountyClients, useAccountyMissingItems, useIgnoreMissingItem, useAddMissingItem, useAccountyDeadlines, useAccountyCommunicationPrefs, useUpsertCommunicationPrefs, useCompleteDeadline, useAccountyTaxProfile, useUpsertTaxProfile, useGeneratePortalToken, useCompanyInvoices } from '@/hooks/useAccountyData';
import { useToast } from '@/hooks/use-toast';
import {
  generateRequestEmail,
  addToApprovalQueue,
  type OutgoingMessage,
  type MissingItemForEmail,
} from './generateRequestEmail';

export default function ClientDetailsPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('Áttekintés');
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
    email: true,
    viber: true,
    phone: false,
    sms: false,
    language: 'hu',
    frequency: 'normal',
    autoReminder: true,
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
  const { data: supabaseMissing } = useAccountyMissingItems(id || '');
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
                console.error('Failed to generate portal token:', e);
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

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-full w-fit">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
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
            <Button className="h-14 bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white rounded-xl text-base font-semibold flex items-center justify-center gap-2">
              <FileCheck className="w-5 h-5" />
              Számlák feldolgozása
            </Button>
            <Button 
              variant="outline" 
              className="h-14 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl text-base font-semibold flex items-center justify-center gap-2"
              onClick={() => navigate(`/accounty/missing-invoices/${client.id}`)}
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

          {/* 🚨 Zárást blokkoló hiányosságok */}
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
                      🚨 Zárást blokkoló hiányosságok
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
                          <option value="bejovo">📥 Bejövő</option>
                          <option value="kimeno">📤 Kimenő</option>
                          <option value="bank">🏦 Bank</option>
                          <option value="ber">👥 Bér</option>
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
                            <option value="urgent">🔴 Sürgős</option>
                            <option value="medium">🟡 Közepes</option>
                            <option value="low">⚪ Alacsony</option>
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
                                console.error('Add blocking item failed:', err);
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
                          {items.length > 0 ? items.length : '✓'}
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
                                            console.error('Ignore failed:', err);
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

                                          // Generate real portal token
                                          let portalLink = `${window.location.origin}/portal/demo-fallback`;
                                          try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            const token = crypto.randomUUID();
                                            const expiresAt = new Date();
                                            expiresAt.setDate(expiresAt.getDate() + 30);
                                            const { error: tokenError } = await supabase
                                              .from('accounty_portal_tokens')
                                              .insert({
                                                company_id: id,
                                                token,
                                                created_by: user?.id,
                                                expires_at: expiresAt.toISOString(),
                                                is_active: true,
                                              });
                                            if (!tokenError) {
                                              portalLink = `${window.location.origin}/portal/${token}`;
                                            }
                                          } catch (err) {
                                            console.error('Portal token creation failed:', err);
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
            
            {/* Recent Activities */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Legutóbbi tevékenységek</h3>
                <button className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-100 flex items-center transition-colors">
                  Összes <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
              </div>
              <div className="p-2 flex-1">
                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                    <UploadCloud className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">12 számla feltöltve</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">2024.01.15</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Bérszámfejtés lezárva</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">2024.01.14</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <RefreshCcw className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">NAV szinkronizálás</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">2024.01.13</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors">
                  <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                    <FileCheck className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">5 számla kontírozva</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">2024.01.12</p>
                  </div>
                </div>
              </div>
            </div>

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
                            : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50"
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-6">
            {/* Cég adatok */}
            <div className="bg-card rounded-xl border border-border shadow-soft p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Cég adatok</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Cégnév</label>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-border">
                    {client.name}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Adószám</label>
                  <p className="text-sm font-mono font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-border">
                    {client.taxNumber || '–'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Visibill azonosító</label>
                  <p className="text-xs font-mono text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-lg border border-border">
                    {client.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Kapcsolattartó */}
            <div className="bg-card rounded-xl border border-border shadow-soft p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Kapcsolattartó</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Kapcsolattartó neve</label>
                  <input
                    type="text"
                    value={notifPrefs.contactName}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, contactName: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Kapcsolattartó neve"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">E-mail cím</label>
                  <input
                    type="email"
                    value={notifPrefs.contactEmail}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, contactEmail: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="ugyfel@pelda.hu"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Telefonszám</label>
                  <input
                    type="tel"
                    value={notifPrefs.contactPhone}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, contactPhone: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-card text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="+36 30 123 4567"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (!id) return;
                    setNotifSaving(true);
                    try {
                      await upsertCommPrefs.mutateAsync({
                        companyId: id,
                        contactName: notifPrefs.contactName,
                        contactEmail: notifPrefs.contactEmail,
                        contactPhone: notifPrefs.contactPhone,
                        channelEmail: notifPrefs.email,
                        channelViber: notifPrefs.viber,
                        channelSms: notifPrefs.sms,
                        channelPhone: notifPrefs.phone,
                        autoReminder: notifPrefs.autoReminder,
                      });
                      setNotifSaved(true);
                      setTimeout(() => setNotifSaved(false), 2000);
                    } catch {}
                    setNotifSaving(false);
                  }}
                  disabled={notifSaving}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {notifSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : notifSaved ? <Check className="w-4 h-4 mr-2" /> : null}
                  {notifSaved ? 'Mentve!' : 'Adatok mentése'}
                </Button>
              </div>
            </div>
          </div>

          {/* Tax profile summary */}
          {taxProfileData && (
            <div className="bg-card rounded-xl border border-border shadow-soft p-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Adóprofil összefoglaló</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">ÁFA típus</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {taxProfileData.vatType === 'normal' ? 'Általános' : taxProfileData.vatType === 'kata' ? 'KATA' : taxProfileData.vatType}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">ÁFA gyakoriság</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {taxProfileData.vatFrequency === 'monthly' ? 'Havi' : taxProfileData.vatFrequency === 'quarterly' ? 'Negyedéves' : taxProfileData.vatFrequency === 'annual' ? 'Éves' : taxProfileData.vatFrequency}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Iparűzési adó</p>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {taxProfileData.localTaxLiable ? 'Igen' : 'Nem'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Számlák Tab */}
      {activeTab === 'Számlák' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Összes számla</h3>
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{companyInvoices?.length || 0}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Feldolgozásra vár</h3>
              <div className="text-3xl font-bold text-amber-500">{companyInvoices?.filter(i => i.status === 'Új' || i.status === 'Kontírozásra vár').length || 0}</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Bruttó összesen</h3>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{new Intl.NumberFormat('hu-HU').format(companyInvoices?.reduce((s, i) => s + i.grossAmount, 0) || 0)} Ft</div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">ÁFA összesen</h3>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{new Intl.NumberFormat('hu-HU').format(companyInvoices?.reduce((s, i) => s + i.vatAmount, 0) || 0)} Ft</div>
            </div>
          </div>

          {/* Invoices List */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">Legutóbbi számlák</h3>
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 h-8"
                onClick={() => navigate(`/accounty/client/${id}/invoices`)}
              >
                Összes megtekintése <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
            <div className="p-2 space-y-1 bg-white dark:bg-slate-900">
              {invoiceData.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer group">
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${invoice.dotColor}`}></div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.number}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{invoice.company}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{invoice.amount}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{invoice.date}</p>
                    </div>
                    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-32 text-center", invoice.statusColor)}>
                      {invoice.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Bérszámfejtés Tab */}
      {activeTab === tabs[2] && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate(`/accounty/payroll/${client.id}`)}
              className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Bérszámfejtés Dashboard</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">KPI-k, ciklusok, foglalkoztatottak áttekintése</p>
            </button>

            <button
              onClick={() => navigate(`/accounty/payroll/${client.id}/employees`)}
              className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Settings className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Foglalkoztatottak</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Személyi nyilvántartás, jogviszonyok kezelése</p>
            </button>

            <button
              onClick={() => navigate(`/accounty/payroll/${client.id}/cycle/new`)}
              className="bg-card rounded-xl border border-border shadow-soft p-6 text-left hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Új havi ciklus</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bérszámfejtési időszak indítása</p>
            </button>
          </div>

          {/* Info box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-5">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              A bérszámfejtés modul teljes funkcionalitása az ügyfél-specifikus dashboard-on érhető el.
              Kattints a <strong>Bérszámfejtés Dashboard</strong> kártyára a teljes kezelőfelülethez.
            </p>
          </div>

          {/* Quick links */}
          <div className="bg-card rounded-xl border border-border shadow-soft p-5">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Gyors navigáció</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Paramétertábla 2026', path: `/accounty/payroll/${client.id}/tax-params` },
                { label: 'NAV bevallások', path: `/accounty/payroll/${client.id}/filings` },
                { label: 'Új foglalkoztatott', path: `/accounty/payroll/${client.id}/employees/new` },
              ].map((link) => (
                <button
                  key={link.label}
                  onClick={() => navigate(link.path)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Beállítások Tab */}
      {activeTab === tabs[4] && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Értesítési Preferenciák */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" />
                Értesítési csatornák
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Válaszd ki, milyen csatornákon értesítsük az ügyfelet a hiányzó dokumentumokról</p>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'email' as const, label: 'E-mail értesítés', desc: 'Automatikus e-mail a hiányzó számlákról', icon: Mail },
                { key: 'viber' as const, label: 'Viber / Telegram', desc: 'Üzenetek küldése Viber-en vagy Telegram-on', icon: MessageCircle },
                { key: 'phone' as const, label: 'AI Telefonhívás', desc: 'Automatikus telefonhívás AI hanggal', icon: Phone },
                { key: 'sms' as const, label: 'SMS értesítés', desc: 'SMS emlékeztető küldése', icon: MessageCircle },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      notifPrefs[key] ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-slate-100 dark:bg-slate-800'
                    )}>
                      <Icon className={cn('w-5 h-5', notifPrefs[key] ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors duration-200',
                      notifPrefs[key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                      notifPrefs[key] ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Nyelv & Gyakorisg */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-slate-500" />
                Nyelvi beállítások
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Értesítések nyelve</label>
                  <select
                    value={notifPrefs.language}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="hu">🇭🇺 Magyar</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="de">🇩🇪 Deutsch</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Értesítési frekvencia</label>
                  <select
                    value={notifPrefs.frequency}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="aggressive">🔴 Agresszív (naponta)</option>
                    <option value="normal">🟡 Normál (hetente 2x)</option>
                    <option value="gentle">🟢 Óvatos (hetente 1x)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-slate-500" />
                Automatizmus
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Automatikus emlékeztető</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Rendszer automatikusan küld emlékeztetőt a beállított csatornákon</p>
                  </div>
                  <button
                    onClick={() => setNotifPrefs(prev => ({ ...prev, autoReminder: !prev.autoReminder }))}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors duration-200',
                      notifPrefs.autoReminder ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                    )}
                  >
                    <div className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                      notifPrefs.autoReminder ? 'translate-x-[22px]' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Következő automatikus értesítés:</span>{' '}
                    2024.01.18 (péntek) 09:00
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Utoljára küldve:</span>{' '}
                    2024.01.14 (hétfő) 10:15 – E-mail + Viber
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kapcsolattartó */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-slate-500" />
              Ügyfél kapcsolattartó
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Kapcsolattartó neve</label>
                <input
                  type="text"
                  placeholder="pl. Kovács János"
                  value={notifPrefs.contactName}
                  onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">E-mail cím</label>
                <input
                  type="email"
                  placeholder="pl. kovacs@ceg.hu"
                  value={notifPrefs.contactEmail}
                  onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Telefonszám</label>
                <input
                  type="tel"
                  placeholder="pl. +36 30 123 4567"
                  value={notifPrefs.contactPhone}
                  onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
              </div>
            </div>

            {/* GDPR Opt-in */}
            <div className="mt-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">GDPR Hozzájárulás</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Az ügyfél hozzájárult az értesítések fogadásához
                    {commPrefsData?.gdprOptedIn && commPrefsData.gdprOptedInAt && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        — {new Date(commPrefsData.gdprOptedInAt).toLocaleDateString('hu-HU')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const newVal = !commPrefsData?.gdprOptedIn;
                    upsertCommPrefs.mutate({
                      companyId: id!,
                      contactName: notifPrefs.contactName,
                      contactEmail: notifPrefs.contactEmail,
                      contactPhone: notifPrefs.contactPhone,
                      channelEmail: notifPrefs.email,
                      channelViber: notifPrefs.viber,
                      channelSms: notifPrefs.sms,
                      channelPhone: notifPrefs.phone,
                      preferredLanguage: notifPrefs.language,
                      reminderFrequency: notifPrefs.frequency as 'low' | 'normal' | 'high',
                      autoReminder: notifPrefs.autoReminder,
                    });
                  }}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors duration-200',
                    commPrefsData?.gdprOptedIn ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    commPrefsData?.gdprOptedIn ? 'translate-x-[22px]' : 'translate-x-0.5'
                  )}></div>
                </button>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button 
                onClick={async () => {
                  setNotifSaving(true);
                  try {
                    await upsertCommPrefs.mutateAsync({
                      companyId: id!,
                      contactName: notifPrefs.contactName,
                      contactEmail: notifPrefs.contactEmail,
                      contactPhone: notifPrefs.contactPhone,
                      channelEmail: notifPrefs.email,
                      channelViber: notifPrefs.viber,
                      channelSms: notifPrefs.sms,
                      channelPhone: notifPrefs.phone,
                      preferredLanguage: notifPrefs.language,
                      reminderFrequency: notifPrefs.frequency as 'low' | 'normal' | 'high',
                      autoReminder: notifPrefs.autoReminder,
                    });
                    setNotifSaved(true);
                    setTimeout(() => setNotifSaved(false), 2000);
                  } catch (e) {
                    console.error('Failed to save communication prefs:', e);
                  } finally {
                    setNotifSaving(false);
                  }
                }}
                disabled={notifSaving}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {notifSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : notifSaved ? <Check className="w-4 h-4" /> : null}
                {notifSaving ? 'Mentés...' : notifSaved ? 'Mentve!' : 'Mentés'}
              </button>
            </div>
          </div>

          {/* Adózási Profil */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                Adózási profil
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cég adózási beállításai — ÁFA, járulék, KATA/KIVA státusz</p>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">ÁFA bevallás gyakorisága</label>
                  <select
                    value={taxProfileData?.vatFrequency || 'monthly'}
                    onChange={(e) => {
                      upsertTaxProfile.mutate({
                        companyId: id!,
                        vatFrequency: e.target.value as any,
                        contributionFrequency: taxProfileData?.contributionFrequency || 'monthly',
                        isKata: taxProfileData?.isKata ?? false,
                        isKiva: taxProfileData?.isKiva ?? false,
                      });
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="monthly">Havi</option>
                    <option value="quarterly">Negyedéves</option>
                    <option value="yearly">Éves</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Járulék bevallás gyakorisága</label>
                  <select
                    value={taxProfileData?.contributionFrequency || 'monthly'}
                    onChange={(e) => {
                      upsertTaxProfile.mutate({
                        companyId: id!,
                        vatFrequency: taxProfileData?.vatFrequency || 'monthly',
                        contributionFrequency: e.target.value as any,
                        isKata: taxProfileData?.isKata ?? false,
                        isKiva: taxProfileData?.isKiva ?? false,
                      });
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="monthly">Havi</option>
                    <option value="quarterly">Negyedéves</option>
                    <option value="yearly">Éves</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-6">
                {[
                  { key: 'isKata', label: 'KATA alany', value: taxProfileData?.isKata ?? false },
                  { key: 'isKiva', label: 'KIVA alany', value: taxProfileData?.isKiva ?? false },
                ].map(({ key, label, value }) => (
                  <div key={key} className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        upsertTaxProfile.mutate({
                          companyId: id!,
                          vatFrequency: taxProfileData?.vatFrequency || 'monthly',
                          contributionFrequency: taxProfileData?.contributionFrequency || 'monthly',
                          isKata: key === 'isKata' ? !value : (taxProfileData?.isKata ?? false),
                          isKiva: key === 'isKiva' ? !value : (taxProfileData?.isKiva ?? false),
                        });
                      }}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors duration-200',
                        value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                      )}
                    >
                      <div className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                        value ? 'translate-x-[22px]' : 'translate-x-0.5'
                      )}></div>
                    </button>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
                  </div>
                ))}
              </div>

              {taxProfileData?.navSynced && (
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
                  <Check className="w-3.5 h-3.5" />
                  NAV-ból szinkronizálva
                </div>
              )}
            </div>
          </div>

        </div>
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
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">🤖 AI kéri a hiányzó dokumentumokat</p>
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
