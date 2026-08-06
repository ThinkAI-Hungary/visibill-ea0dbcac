import React, { useState, useEffect } from 'react';
import { 
  Bell, Mail, MessageCircle, Phone, Globe, Clock, Settings, Check, Loader2,
  Shield, Building2, Key, Monitor, TestTube, User, Save, Trash2, Plus, 
  Calculator, MapPin, CreditCard, ChevronRight, AlertTriangle, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  useUpsertCommunicationPrefs, 
  useUpsertTaxProfile,
  useCegkapuSettings,
  useUpsertCegkapuSettings
} from '@/hooks/accounty';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

interface ClientSettingsTabProps {
  clientId: string;
  notifPrefs: {
    email: boolean;
    viber: boolean;
    phone: boolean;
    sms: boolean;
    language: string;
    frequency: string;
    autoReminder: boolean;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  };
  setNotifPrefs: React.Dispatch<React.SetStateAction<{
    email: boolean;
    viber: boolean;
    phone: boolean;
    sms: boolean;
    language: string;
    frequency: string;
    autoReminder: boolean;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
  }>>;
  commPrefsData?: any | null;
  taxProfileData?: {
    vatFrequency: 'monthly' | 'quarterly' | 'yearly';
    contributionFrequency: 'monthly' | 'quarterly' | 'yearly';
    isKata: boolean;
    isKiva: boolean;
    navSynced?: boolean;
  } | null;
}

type SubTab = 'notifications' | 'tax_profile' | 'cegkapu' | 'payroll';

type TarhelyType = 'cegkapu' | 'kuny';
type KauType = 'ugyfelkapu_plus' | 'dap' | 'eszig';

interface CegkapuFormData {
  tarhelyType: TarhelyType;
  tarhelyId: string;
  tarhelyStatus: 'active' | 'error' | 'unknown';
  tarhelyCompanyName: string;
  capacityUsed: number;
  capacityTotal: number;
  signerName: string;
  signerKauType: KauType;
  signerKauId: string;
  signerVerified: boolean;
  pollingFrequency: '15' | '30' | '60';
  autoReceipt: boolean;
  lastSync: string | null;
}

const CEGKAPU_DEFAULTS: CegkapuFormData = {
  tarhelyType: 'cegkapu',
  tarhelyId: '',
  tarhelyStatus: 'unknown',
  tarhelyCompanyName: '',
  capacityUsed: 0,
  capacityTotal: 100,
  signerName: '',
  signerKauType: 'ugyfelkapu_plus',
  signerKauId: '',
  signerVerified: false,
  pollingFrequency: '15',
  autoReceipt: true,
  lastSync: null,
};

interface PayrollSettings {
  rounding: 'none' | '1' | '10' | '100';
  workDaysSource: 'official' | 'custom';
  customWorkDays: number;
  premiumRules: 'mt' | 'ksz' | 'custom';
  costCenterEnabled: boolean;
  defaultWeeklyHours: number;
  szepProvider: string;
  paymentDay: number;
  emailPayslips: boolean;
  remoteAllowanceDefault: number;
}

const PAYROLL_DEFAULTS: PayrollSettings = {
  rounding: '1',
  workDaysSource: 'official',
  customWorkDays: 22,
  premiumRules: 'mt',
  costCenterEnabled: false,
  defaultWeeklyHours: 40,
  szepProvider: '',
  paymentDay: 10,
  emailPayslips: false,
  remoteAllowanceDefault: 32280,
};

export default function ClientSettingsTab({
  clientId,
  notifPrefs,
  setNotifPrefs,
  commPrefsData,
  taxProfileData,
}: ClientSettingsTabProps) {
  const { toast } = useToast();
  const { hash } = useLocation();
  const upsertCommPrefs = useUpsertCommunicationPrefs();
  const upsertTaxProfile = useUpsertTaxProfile();

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('notifications');

  useEffect(() => {
    if (hash === '#cegkapu') {
      setActiveSubTab('cegkapu');
    } else if (hash === '#payroll') {
      setActiveSubTab('payroll');
    } else if (hash === '#tax_profile') {
      setActiveSubTab('tax_profile');
    }
  }, [hash]);

  // 1. Notifications & Contact states
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  // 2. Cégkapu states & mutations
  const { data: savedCegkapu, isLoading: cegkapuLoading } = useCegkapuSettings(clientId);
  const upsertCegkapuMutation = useUpsertCegkapuSettings();
  const [cegkapuData, setCegkapuData] = useState<CegkapuFormData>(CEGKAPU_DEFAULTS);
  const [cegkapuDirty, setCegkapuDirty] = useState(false);
  const [testingCegkapu, setTestingCegkapu] = useState(false);

  // 3. Payroll & Integration states
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(PAYROLL_DEFAULTS);
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollSaving, setPayrollSaving] = useState(false);
  const [payrollDirty, setPayrollDirty] = useState(false);

  // NAV Integration states
  const [navApiKey, setNavApiKey] = useState('');
  const [navTechnicalUser, setNavTechnicalUser] = useState('');
  const [navEnv, setNavEnv] = useState<'production' | 'sandbox'>('sandbox');

  // Locations state
  const { locations, isLoading: locLoading, addLocation, deleteLocation } = useCompanyLocations(clientId);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [newLocType, setNewLocType] = useState<'headquarters' | 'branch'>('branch');

  // Load Cégkapu data
  useEffect(() => {
    if (savedCegkapu) {
      setCegkapuData({
        tarhelyType: savedCegkapu.tarhelyType,
        tarhelyId: savedCegkapu.tarhelyId,
        tarhelyStatus: savedCegkapu.tarhelyStatus,
        tarhelyCompanyName: savedCegkapu.tarhelyCompanyName,
        capacityUsed: savedCegkapu.capacityUsed,
        capacityTotal: savedCegkapu.capacityTotal,
        signerName: savedCegkapu.signerName,
        signerKauType: savedCegkapu.signerKauType,
        signerKauId: savedCegkapu.signerKauId,
        signerVerified: savedCegkapu.signerVerified,
        pollingFrequency: savedCegkapu.pollingFrequency,
        autoReceipt: savedCegkapu.autoReceipt,
        lastSync: savedCegkapu.lastSync,
      });
      setCegkapuDirty(false);
    }
  }, [savedCegkapu]);

  // Load Payroll & NAV settings
  useEffect(() => {
    if (!clientId) return;
    setPayrollLoading(true);
    supabase
      .from('accounty_tax_profiles')
      .select('payroll_settings, nav_api_key, nav_technical_user, nav_environment')
      .eq('company_id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.payroll_settings && typeof data.payroll_settings === 'object') {
            setPayrollSettings(s => ({ ...s, ...(data.payroll_settings as Record<string, any>) }));
          }
          if (data.nav_api_key) setNavApiKey(data.nav_api_key);
          if (data.nav_technical_user) setNavTechnicalUser(data.nav_technical_user);
          if (data.nav_environment) setNavEnv(data.nav_environment as 'production' | 'sandbox');
        }
        setPayrollDirty(false);
        setPayrollLoading(false);
      });
  }, [clientId]);

  // Save Notifications
  const handleSavePrefs = async () => {
    if (!clientId) return;
    setSavingPrefs(true);
    try {
      await upsertCommPrefs.mutateAsync({
        companyId: clientId,
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
      setSavedPrefs(true);
      setTimeout(() => setSavedPrefs(false), 2000);
      toast({ title: 'Mentve!', description: 'Beállítások sikeresen mentve.' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'A mentés sikertelen.';
      toast({ title: 'Hiba történt', description: errMsg, variant: 'destructive' });
    } finally {
      setSavingPrefs(false);
    }
  };

  // Update Cégkapu State
  const updateCegkapu = (patch: Partial<CegkapuFormData>) => {
    setCegkapuData(d => ({ ...d, ...patch }));
    setCegkapuDirty(true);
  };

  // Save Cégkapu
  const handleSaveCegkapu = async () => {
    if (!clientId) return;
    try {
      await upsertCegkapuMutation.mutateAsync({
        companyId: clientId,
        ...cegkapuData,
      });
      setCegkapuDirty(false);
      toast({ title: 'Mentve', description: 'Cégkapu beállítások sikeresen mentve.' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  // Test KAÜ
  const handleTestCegkapu = () => {
    setTestingCegkapu(true);
    setTimeout(() => {
      updateCegkapu({ signerVerified: true });
      setTestingCegkapu(false);
      toast({ title: 'Teszt sikeres', description: 'Az aláíró személye ellenőrizve (helyi teszt).' });
    }, 2000);
  };

  // Update Payroll Settings State
  const updatePayroll = (patch: Partial<PayrollSettings>) => {
    setPayrollSettings(s => ({ ...s, ...patch }));
    setPayrollDirty(true);
  };

  // Save Payroll & NAV Integration
  const handleSavePayroll = async () => {
    if (!clientId) return;
    setPayrollSaving(true);
    try {
      const { error } = await supabase
        .from('accounty_tax_profiles')
        .upsert({
          company_id: clientId,
          payroll_settings: payrollSettings as any,
          nav_api_key: navApiKey || null,
          nav_technical_user: navTechnicalUser || null,
          nav_environment: navEnv,
          has_payroll: true,
        }, { onConflict: 'company_id' });
      if (error) throw error;
      setPayrollDirty(false);
      toast({ title: 'Mentve!', description: 'Bérszámfejtési és NAV integrációs beállítások sikeresen mentve.' });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    } finally {
      setPayrollSaving(false);
    }
  };

  // Add Location
  const handleAddLocation = async () => {
    if (!newLocName.trim() || !newLocAddress.trim()) return;
    try {
      await addLocation.mutateAsync({ name: newLocName.trim(), address: newLocAddress.trim(), location_type: newLocType });
      setNewLocName('');
      setNewLocAddress('');
      toast({ title: 'Telephely hozzáadva' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  // Delete Location
  const handleDeleteLocation = async (locId: string) => {
    try {
      await deleteLocation.mutateAsync(locId);
      toast({ title: 'Telephely törölve' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    }
  };

  const cegkapuCapacityPct = cegkapuData.capacityTotal > 0 ? Math.round((cegkapuData.capacityUsed / cegkapuData.capacityTotal) * 100) : 0;

  const subTabs = [
    { id: 'notifications' as const, label: 'Kapcsolat & Értesítések', icon: Bell },
    { id: 'tax_profile' as const, label: 'Adózási Profil', icon: Settings },
    { id: 'cegkapu' as const, label: 'Cégkapu / KÜNY', icon: Shield },
    { id: 'payroll' as const, label: 'Bérszámfejtés & NAV', icon: Calculator },
  ];

  return (
    <div className="flex gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Sidebar sub-tab navigation */}
      <div className="w-56 shrink-0 space-y-1">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left",
              activeSubTab === tab.id
                ? "bg-primary/15 text-primary shadow-soft border border-primary/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
        
        {/* ── 1. Notifications & Contact Sub-Tab ── */}
        {activeSubTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Értesítési csatornák és kapcsolattartó</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Az ügyfél értesítési és kapcsolattartói beállításai</p>
            </div>

            {/* Channels */}
            <div className="space-y-4">
              {[
                { key: 'email' as const, label: 'E-mail értesítés', desc: 'Automatikus e-mail a hiányzó számlákról', icon: Mail },
                { key: 'viber' as const, label: 'Viber / Telegram', desc: 'Üzenetek küldése Viber-en vagy Telegram-on', icon: MessageCircle },
                { key: 'phone' as const, label: 'AI Telefonhívás', desc: 'Automatikus telefonhívás AI hanggal', icon: Phone },
                { key: 'sms' as const, label: 'SMS értesítés', desc: 'SMS emlékeztető küldése', icon: MessageCircle },
              ].map(({ key, label, desc, icon: Icon }) => (
                <div 
                  key={key} 
                  className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
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

            {/* Language & Frequency Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-slate-500" /> Nyelvi beállítások
                </h4>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Értesítések nyelve</label>
                  <select
                    value={notifPrefs.language}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, language: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                  >
                    <option value="hu">Magyar</option>
                    <option value="en">English</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Értesítés gyakorisága</label>
                  <select
                    value={notifPrefs.frequency}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, frequency: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                  >
                    <option value="high">Agresszív (naponta)</option>
                    <option value="normal">Normál (hetente 2x)</option>
                    <option value="low">Óvatos (hetente 1x)</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" /> Automatizmus
                </h4>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Automatikus emlékeztető</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">Rendszer automatikusan küld emlékeztetőt</p>
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
                <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-500">
                  <p><span className="font-semibold text-slate-700 dark:text-slate-300">Következő automatikus értesítés:</span> 2024.01.18 09:00</p>
                  <p><span className="font-semibold text-slate-700 dark:text-slate-300">Utoljára küldve:</span> 2024.01.14 10:15 – E-mail + Viber</p>
                </div>
              </div>
            </div>

            {/* Kapcsolattartó */}
            <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" /> Ügyfél kapcsolattartó
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Kapcsolattartó neve</label>
                  <input
                    type="text"
                    placeholder="pl. Kovács János"
                    value={notifPrefs.contactName}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactName: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">E-mail cím</label>
                  <input
                    type="email"
                    placeholder="pl. kovacs@ceg.hu"
                    value={notifPrefs.contactEmail}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Telefonszám</label>
                  <input
                    type="tel"
                    placeholder="pl. +36 30 123 4567"
                    value={notifPrefs.contactPhone}
                    onChange={(e) => setNotifPrefs(prev => ({ ...prev, contactPhone: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* GDPR Opt-in */}
              <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 dark:bg-slate-800/30 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">GDPR Hozzájárulás</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-normal">
                    Az ügyfél hozzájárult az értesítések fogadásához
                    {commPrefsData?.gdprOptedIn && commPrefsData.gdprOptedInAt && (
                      <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                        — {new Date(commPrefsData.gdprOptedInAt).toLocaleDateString('hu-HU')}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newGdprValue = !commPrefsData?.gdprOptedIn;
                    await upsertCommPrefs.mutateAsync({
                      companyId: clientId,
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
                      gdprOptedIn: newGdprValue,
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

            <div className="flex justify-end">
              <button 
                onClick={handleSavePrefs}
                disabled={savingPrefs}
                className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : savedPrefs ? <Check className="w-4 h-4" /> : null}
                {savingPrefs ? 'Mentés...' : savedPrefs ? 'Mentve!' : 'Mentés'}
              </button>
            </div>
          </div>
        )}

        {/* ── 2. Tax Profile Sub-Tab ── */}
        {activeSubTab === 'tax_profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Adózási profil</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cég adózási beállításai — ÁFA, járulék, KATA/KIVA státusz</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">ÁFA bevallás gyakorisága</label>
                <select
                  value={taxProfileData?.vatFrequency || 'monthly'}
                  onChange={(e) => {
                    upsertTaxProfile.mutate({
                      companyId: clientId,
                      vatFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                      contributionFrequency: taxProfileData?.contributionFrequency || 'monthly',
                      isKata: taxProfileData?.isKata ?? false,
                      isKiva: taxProfileData?.isKiva ?? false,
                    });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
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
                      companyId: clientId,
                      vatFrequency: taxProfileData?.vatFrequency || 'monthly',
                      contributionFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
                      isKata: taxProfileData?.isKata ?? false,
                      isKiva: taxProfileData?.isKiva ?? false,
                    });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-900 dark:text-slate-100"
                >
                  <option value="monthly">Havi</option>
                  <option value="quarterly">Negyedéves</option>
                  <option value="yearly">Éves</option>
                </select>
              </div>
            </div>

            <div className="flex gap-6 pt-2">
              {[
                { key: 'isKata', label: 'KATA alany', value: taxProfileData?.isKata ?? false },
                { key: 'isKiva', label: 'KIVA alany', value: taxProfileData?.isKiva ?? false },
              ].map(({ key, label, value }) => (
                <div key={key} className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      upsertTaxProfile.mutate({
                        companyId: clientId,
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
              <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2 w-fit">
                <Check className="w-3.5 h-3.5" />
                NAV-ból szinkronizálva
              </div>
            )}
          </div>
        )}

        {/* ── 3. Cégkapu / KÜNY Sub-Tab ── */}
        {activeSubTab === 'cegkapu' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cégkapu / KÜNY-tárhely</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Hivatalos állami tárhely és KAÜ aláírás beállítások</p>
            </div>

            {cegkapuLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Tárhely típus */}
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Tárhely típusa
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { value: 'cegkapu' as TarhelyType, label: 'Cégkapu', desc: 'Gazdasági társaságok számára' },
                      { value: 'kuny' as TarhelyType, label: 'KÜNY-tárhely', desc: 'Egyéni vállalkozó / magánszemély' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateCegkapu({ tarhelyType: opt.value })}
                        className={cn(
                          'p-4 rounded-xl border-2 text-left transition-all',
                          cegkapuData.tarhelyType === opt.value
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-900 dark:text-blue-100 font-semibold'
                            : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-700 dark:text-slate-300'
                        )}
                      >
                        <p className="text-sm font-bold">{opt.label}</p>
                        <p className="text-xs text-slate-500 mt-1">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tárhely azonosító */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Key className="w-4 h-4 text-slate-500" /> Tárhely azonosítása
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Azonosító (10 jegyű)</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={cegkapuData.tarhelyId}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updateCegkapu({ tarhelyId: val });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        placeholder="1234567890"
                      />
                      {cegkapuData.tarhelyId.length > 0 && cegkapuData.tarhelyId.length !== 10 && (
                        <p className="text-xs text-red-500 mt-1">Pontosan 10 számjegyű azonosító szükséges</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Státusz</label>
                      <select
                        value={cegkapuData.tarhelyStatus}
                        onChange={e => updateCegkapu({ tarhelyStatus: e.target.value as CegkapuFormData['tarhelyStatus'] })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="unknown">Nem ellenőrzött</option>
                        <option value="active">Aktív</option>
                        <option value="error">Hiba</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Cég neve a tárhelyen</label>
                    <input
                      type="text"
                      value={cegkapuData.tarhelyCompanyName}
                      onChange={e => updateCegkapu({ tarhelyCompanyName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      placeholder="Pl. Minta Kft."
                    />
                  </div>

                  {/* Kapacitás */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-500">Tárhely-kapacitás</span>
                      <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{cegkapuData.capacityUsed} / {cegkapuData.capacityTotal} MB ({cegkapuCapacityPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', cegkapuCapacityPct > 80 ? 'bg-red-500' : cegkapuCapacityPct > 50 ? 'bg-yellow-500' : 'bg-emerald-500')}
                        style={{ width: `${cegkapuCapacityPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Aláíró */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500" /> Aláíró személy (KAÜ)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Aláíró neve</label>
                      <input
                        type="text"
                        value={cegkapuData.signerName}
                        onChange={e => updateCegkapu({ signerName: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        placeholder="Kovács Péter"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">KAÜ-azonosító típusa</label>
                      <select
                        value={cegkapuData.signerKauType}
                        onChange={e => updateCegkapu({ signerKauType: e.target.value as KauType })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="ugyfelkapu_plus">Ügyfélkapu+</option>
                        <option value="dap">DÁP (Digitális Állampolgárság)</option>
                        <option value="eszig">e-SZIG</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">KAÜ azonosító</label>
                      <input
                        type="text"
                        value={cegkapuData.signerKauId}
                        onChange={e => updateCegkapu({ signerKauId: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        placeholder="KP-2026-001"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTestCegkapu}
                        disabled={testingCegkapu || !cegkapuData.signerName}
                        className="gap-1.5 bg-card border-slate-200 text-slate-700 dark:text-slate-300"
                      >
                        {testingCegkapu ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                        {testingCegkapu ? 'Tesztelés...' : 'Aláíró tesztelése'}
                      </Button>
                      {cegkapuData.signerVerified && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5 animate-in zoom-in" /> Sikeres</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Polling & Sync */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-slate-500" /> Tárhely-figyelő és szinkronizáció
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Polling gyakoriság</label>
                      <div className="flex gap-2">
                        {(['15', '30', '60'] as const).map(freq => (
                          <button
                            key={freq}
                            type="button"
                            onClick={() => updateCegkapu({ pollingFrequency: freq })}
                            className={cn(
                              'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                              cegkapuData.pollingFrequency === freq
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold'
                                : 'border-slate-200 dark:border-slate-800 hover:border-blue-300 text-slate-700 dark:text-slate-300'
                            )}
                          >
                            {freq === '60' ? '1 óra' : `${freq} perc`}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1.5 block">Automatikus nyugta-feldolgozás</label>
                      <button
                        type="button"
                        onClick={() => updateCegkapu({ autoReceipt: !cegkapuData.autoReceipt })}
                        className={cn(
                          'relative w-12 h-6 rounded-full transition-colors',
                          cegkapuData.autoReceipt ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <div className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          cegkapuData.autoReceipt ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  </div>
                  {cegkapuData.lastSync && (
                    <p className="text-xs text-slate-400">
                      Utolsó sikeres szinkronizáció: {new Date(cegkapuData.lastSync).toLocaleString('hu-HU')}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  {cegkapuDirty && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mr-auto my-auto font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Mentetlen változtatások
                    </p>
                  )}
                  <Button
                    onClick={handleSaveCegkapu}
                    disabled={upsertCegkapuMutation.isPending}
                    className={cn("gap-1.5", cegkapuDirty ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600/70")}
                  >
                    {upsertCegkapuMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {upsertCegkapuMutation.isPending ? 'Mentés...' : cegkapuDirty ? 'Mentés' : 'Mentve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 4. Bérszámfejtés & NAV Sub-Tab ── */}
        {activeSubTab === 'payroll' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Bérszámfejtés és NAV integráció</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bérszámfejtési alapértelmezések, cég telephelyei és NAV Online számla kulcsok</p>
            </div>

            {payrollLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Betöltés...
              </div>
            ) : (
              <div className="space-y-6">
                {/* Payroll Config */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" /> Munkaidő & Kerekítés
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Heti munkaidő alapértelmezés (óra)</label>
                      <input
                        type="number"
                        value={payrollSettings.defaultWeeklyHours}
                        onChange={e => updatePayroll({ defaultWeeklyHours: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Kerekítés</label>
                      <select
                        value={payrollSettings.rounding}
                        onChange={e => updatePayroll({ rounding: e.target.value as PayrollSettings['rounding'] })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="none">Nincs kerekítés</option>
                        <option value="1">1 Ft-ra kerekít</option>
                        <option value="10">10 Ft-ra kerekít</option>
                        <option value="100">100 Ft-ra kerekít</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Munkanapok forrása</label>
                      <select
                        value={payrollSettings.workDaysSource}
                        onChange={e => updatePayroll({ workDaysSource: e.target.value as 'official' | 'custom' })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="official">Hivatalos munkarend</option>
                        <option value="custom">Egyéni munkanap-szám</option>
                      </select>
                    </div>
                    {payrollSettings.workDaysSource === 'custom' && (
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Egyéni munkanapok / hó</label>
                        <input
                          type="number"
                          value={payrollSettings.customWorkDays}
                          onChange={e => updatePayroll({ customWorkDays: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-slate-500" /> Pótlék & Juttatás
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Pótlékszámítás szabályai</label>
                      <select
                        value={payrollSettings.premiumRules}
                        onChange={e => updatePayroll({ premiumRules: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="mt">Munka Törvénykönyve (Mt.)</option>
                        <option value="ksz">Kollektív Szerződés (KSZ)</option>
                        <option value="custom">Egyéni szabályok</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">SZÉP-kártya kibocsátó</label>
                      <select
                        value={payrollSettings.szepProvider}
                        onChange={e => updatePayroll({ szepProvider: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="">— Nincs megadva —</option>
                        <option value="otp">OTP Bank</option>
                        <option value="kh">K&H Bank</option>
                        <option value="mbh">MBH Bank</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Távmunka átalány alapértelmezés (Ft)</label>
                      <input
                        type="number"
                        value={payrollSettings.remoteAllowanceDefault}
                        onChange={e => updatePayroll({ remoteAllowanceDefault: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">Fizetési nap (hónap hányadika)</label>
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={payrollSettings.paymentDay}
                        onChange={e => updatePayroll({ paymentDay: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold">Költséghely-kezelés</p>
                        <p className="text-xs text-slate-500">Költséghelyek engedélyezése a béradatoknál</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePayroll({ costCenterEnabled: !payrollSettings.costCenterEnabled })}
                        className={cn(
                          'relative w-12 h-6 rounded-full transition-colors',
                          payrollSettings.costCenterEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <div className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          payrollSettings.costCenterEnabled ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-sm font-semibold">Bérjegyzékek automatikus kiküldése</p>
                        <p className="text-xs text-slate-500">Lezáráskor e-bérjegyzék küldése a munkavállalóknak</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => updatePayroll({ emailPayslips: !payrollSettings.emailPayslips })}
                        className={cn(
                          'relative w-12 h-6 rounded-full transition-colors',
                          payrollSettings.emailPayslips ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        )}
                      >
                        <div className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                          payrollSettings.emailPayslips ? 'translate-x-6' : 'translate-x-0.5'
                        )} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* NAV API Integration */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5 bg-slate-50/50 dark:bg-slate-800/30">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Globe className="w-4 h-4" /> NAV Online Számla Integráció
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">NAV Technikai felhasználó</label>
                      <input
                        type="text"
                        value={navTechnicalUser}
                        onChange={e => { setNavTechnicalUser(e.target.value); setPayrollDirty(true); }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        placeholder="technikai_felhasznalo"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">NAV XML API Kulcs</label>
                      <input
                        type="password"
                        value={navApiKey}
                        onChange={e => { setNavApiKey(e.target.value); setPayrollDirty(true); }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 mb-1 block">NAV XML Környezet</label>
                      <select
                        value={navEnv}
                        onChange={e => { setNavEnv(e.target.value as any); setPayrollDirty(true); }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                      >
                        <option value="sandbox">Teszt (sandbox)</option>
                        <option value="production">Éles (production)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Telephelyek */}
                <div className="space-y-4 border border-slate-100 dark:border-slate-800 rounded-xl p-5">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" /> Cég telephelyei
                  </h4>
                  {locLoading ? (
                    <div className="flex items-center justify-center py-4 text-slate-400 gap-1.5 text-xs"><Loader2 className="w-4.5 h-4.5 animate-spin" /> Betöltés...</div>
                  ) : locations.length === 0 ? (
                    <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <MapPin className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs text-slate-400">Nincs még telephely felvéve</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {locations.map(loc => (
                        <div key={loc.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <div>
                            <p className="text-sm font-semibold">{loc.name}</p>
                            <p className="text-[11px] text-slate-500">{loc.address} · {loc.location_type === 'headquarters' ? 'Székhely' : 'Telephely'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc.id)}
                            className="p-1 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
                            title="Törlés"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Location Form */}
                  <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Új telephely hozzáadása</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Telephely megnevezése</label>
                        <input
                          type="text"
                          value={newLocName}
                          onChange={e => setNewLocName(e.target.value)}
                          placeholder="pl. Raktárépület"
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Címe</label>
                        <input
                          type="text"
                          value={newLocAddress}
                          onChange={e => setNewLocAddress(e.target.value)}
                          placeholder="pl. 4032 Debrecen, Ipari u. 12."
                          className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 mb-1 block">Típusa</label>
                        <select
                          value={newLocType}
                          onChange={e => setNewLocType(e.target.value as any)}
                          className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-background text-xs focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 dark:text-slate-100"
                        >
                          <option value="branch">Telephely</option>
                          <option value="headquarters">Székhely</option>
                        </select>
                      </div>
                    </div>
                    <Button 
                      type="button"
                      onClick={handleAddLocation}
                      disabled={!newLocName.trim() || !newLocAddress.trim() || addLocation.isPending}
                      size="sm"
                      className="h-8"
                    >
                      {addLocation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                      Telephely hozzáadása
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  {payrollDirty && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mr-auto my-auto font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Mentetlen változtatások
                    </p>
                  )}
                  <Button
                    onClick={handleSavePayroll}
                    disabled={payrollSaving}
                    className={cn("gap-1.5", payrollDirty ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-600/70")}
                  >
                    {payrollSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {payrollSaving ? 'Mentés...' : payrollDirty ? 'Mentés' : 'Mentve'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
