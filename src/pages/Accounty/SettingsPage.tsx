import React, { useState, useMemo, useEffect } from 'react';
import { 
  Settings, Building2, Mail, Phone, Bell, Shield, Users, Globe,
  Save, Check, Loader2, ChevronRight, AlertTriangle, Key, Clock,
  Coffee, CreditCard, Gift, Send
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyAccountants } from '@/hooks/useAccountyData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type SettingsTab = 'general' | 'notifications' | 'team' | 'cafeteria' | 'nav' | 'security';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: accountants } = useAccountyAccountants();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // General settings state
  const [officeName, setOfficeName] = useState('');
  const [officeEmail, setOfficeEmail] = useState(user?.email || '');
  const [officePhone, setOfficePhone] = useState('');
  const [officeAddress, setOfficeAddress] = useState('');

  // Notification defaults
  const [defaultChannels, setDefaultChannels] = useState({
    email: true,
    viber: false,
    sms: false,
    phone: false,
  });
  const [reminderFrequency, setReminderFrequency] = useState('normal');
  const [autoReminder, setAutoReminder] = useState(true);

  // Cafeteria settings
  const [cafeEnabled, setCafeEnabled] = useState(true);
  const [cafeAnnualBudget, setCafeAnnualBudget] = useState('600000');
  const [szepSzallas, setSzepSzallas] = useState('150000');
  const [szepVendeglatas, setSzepVendeglatas] = useState('150000');
  const [szepSzabadido, setSzepSzabadido] = useState('75000');
  const [cafeProvider, setCafeProvider] = useState('otp');
  const [cafeDeadline, setCafeDeadline] = useState('10');

  // NAV channel settings
  const [navApiKey, setNavApiKey] = useState('nav-***-***-***');
  const [navTechnicalUser, setNavTechnicalUser] = useState('TECH_USER_01');
  const [navSignatureKey, setNavSignatureKey] = useState('sig-***-***');
  const [navEnvironment, setNavEnvironment] = useState('production');
  const [navAutoSubmit, setNavAutoSubmit] = useState(false);
  const [navAnykPath, setNavAnykPath] = useState('C:\\ÁNYK\\abevjava');

  useEffect(() => {
    // Try load from local storage first
    try {
      const saved = localStorage.getItem('accounty_office_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.officeName) setOfficeName(parsed.officeName);
        if (parsed.officeEmail) setOfficeEmail(parsed.officeEmail);
        if (parsed.officePhone) setOfficePhone(parsed.officePhone);
        if (parsed.officeAddress) setOfficeAddress(parsed.officeAddress);
        if (parsed.defaultChannels) setDefaultChannels(parsed.defaultChannels);
        if (parsed.reminderFrequency) setReminderFrequency(parsed.reminderFrequency);
        if (parsed.autoReminder !== undefined) setAutoReminder(parsed.autoReminder);
      }
    } catch {}
    
    // Then override with Supabase user_metadata if available
    if (user?.user_metadata?.accounty_office_settings) {
      const meta = user.user_metadata.accounty_office_settings;
      if (meta.officeName) setOfficeName(meta.officeName);
      if (meta.officeEmail) setOfficeEmail(meta.officeEmail);
      if (meta.officePhone) setOfficePhone(meta.officePhone);
      if (meta.officeAddress) setOfficeAddress(meta.officeAddress);
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    
    const newSettings = {
      officeName,
      officeEmail,
      officePhone,
      officeAddress,
      defaultChannels,
      reminderFrequency,
      autoReminder
    };

    // Save to localStorage
    localStorage.setItem('accounty_office_settings', JSON.stringify(newSettings));

    // Save to Supabase (if we have auth)
    if (user) {
      await supabase.auth.updateUser({
        data: { accounty_office_settings: newSettings }
      });
    }

    setSaving(false);
    setSaved(true);
    toast({ title: '✅ Beállítások mentve', description: 'A módosítások sikeresen elmentve.' });
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id: 'general' as const, label: 'Általános', icon: Building2 },
    { id: 'notifications' as const, label: 'Értesítések', icon: Bell },
    { id: 'team' as const, label: 'Csapat', icon: Users },
    { id: 'cafeteria' as const, label: 'Cafeteria', icon: Coffee },
    { id: 'nav' as const, label: 'NAV csatorna', icon: Globe },
    { id: 'security' as const, label: 'Biztonság', icon: Shield },
  ];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Beállítások</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelő iroda beállítások és preferenciák</p>
      </div>

      <div className="flex gap-6">
        {/* Left: Tab navigation */}
        <div className="w-56 shrink-0 space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary/15 text-primary shadow-soft border border-primary/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Content */}
        <div className="flex-1 bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          {/* General */}
          {activeTab === 'general' && (
            <div key="general" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Iroda adatok</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelő iroda alapadatai</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Iroda neve</label>
                  <Input 
                    value={officeName} 
                    onChange={e => setOfficeName(e.target.value)} 
                    placeholder="Pl. Taxology Könyvelőiroda"
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</label>
                  <Input 
                    value={officeEmail} 
                    onChange={e => setOfficeEmail(e.target.value)} 
                    placeholder="iroda@example.com"
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefonszám</label>
                  <Input 
                    value={officePhone} 
                    onChange={e => setOfficePhone(e.target.value)} 
                    placeholder="+36 1 234 5678"
                    className="bg-card border-border"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cím</label>
                  <Input 
                    value={officeAddress} 
                    onChange={e => setOfficeAddress(e.target.value)} 
                    placeholder="1234 Budapest, Példa utca 1."
                    className="bg-card border-border"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">API kapcsolatok</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent dark:bg-accent flex items-center justify-center">
                        <Globe className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">NAV Online Számla</p>
                        <p className="text-xs text-slate-500">Automatikus számla szinkronizálás</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-accent dark:bg-accent text-accent-foreground dark:text-primary">Aktív</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                        <Key className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Bank integráció</p>
                        <p className="text-xs text-slate-500">Banki tranzakciók importálása</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">Konfigurálandó</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div key="notifications" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Értesítési beállítások</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Alapértelmezett értesítési csatornák és gyakoriság új ügyfelekhez</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Csatornák</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'email', label: 'E-mail', icon: Mail, desc: 'Automatikus email értesítések' },
                    { key: 'viber', label: 'Viber', icon: Phone, desc: 'Viber üzenetek küldése' },
                    { key: 'sms', label: 'SMS', icon: Phone, desc: 'SMS értesítések' },
                    { key: 'phone', label: 'AI Telefonhívás', icon: Phone, desc: 'Automatikus AI hívások' },
                  ].map(ch => (
                    <button
                      key={ch.key}
                      onClick={() => setDefaultChannels(prev => ({ ...prev, [ch.key]: !prev[ch.key as keyof typeof prev] }))}
                      className={cn(
                        "flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left",
                        defaultChannels[ch.key as keyof typeof defaultChannels]
                          ? "border-primary/30 dark:border-primary/40 bg-accent-subtle/50 dark:bg-accent"
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        defaultChannels[ch.key as keyof typeof defaultChannels]
                          ? "bg-accent dark:bg-accent"
                          : "bg-slate-100 dark:bg-slate-800"
                      )}>
                        <ch.icon className={cn("w-4 h-4", defaultChannels[ch.key as keyof typeof defaultChannels] ? "text-primary" : "text-slate-400")} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ch.label}</p>
                        <p className="text-xs text-slate-500">{ch.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Emlékeztető gyakoriság</h3>
                <div className="flex gap-3">
                  {[
                    { value: 'low', label: 'Alacsony', desc: 'Hetente 1x' },
                    { value: 'normal', label: 'Normál', desc: '3 naponta' },
                    { value: 'high', label: 'Magas', desc: 'Naponta' },
                  ].map(freq => (
                    <button
                      key={freq.value}
                      onClick={() => setReminderFrequency(freq.value)}
                      className={cn(
                        "flex-1 p-4 rounded-xl border-2 transition-all text-center",
                        reminderFrequency === freq.value
                          ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/20"
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{freq.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{freq.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReminder}
                  onChange={e => setAutoReminder(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Automatikus emlékeztetők</p>
                  <p className="text-xs text-slate-500">A rendszer automatikusan küld emlékeztetőket a beállított gyakoriságnak megfelelően</p>
                </div>
              </label>
            </div>
          )}

          {/* Team */}
          {activeTab === 'team' && (
            <div key="team" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Csapat</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Könyvelők és hozzáférések kezelése</p>
              </div>

              <div className="space-y-3">
                {(accountants || []).map((acc, idx) => (
                  <div key={acc.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white",
                        idx === 0 ? "bg-primary" : idx === 1 ? "bg-blue-600" : "bg-purple-600"
                      )}>
                        {acc.initial}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{acc.name}</p>
                        <p className="text-xs text-slate-500">{acc.clientCount} ügyfél hozzárendelve</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-accent dark:bg-accent text-accent-foreground dark:text-primary">Senior</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                ))}
                {(!accountants || accountants.length === 0) && (
                  <div className="text-center py-8 text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm">Még nincs csapattag regisztrálva</p>
                  </div>
                )}
              </div>

              <Button variant="outline" className="gap-2 w-full border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <Users className="w-4 h-4" />
                Új könyvelő meghívása
              </Button>
            </div>
          )}

          {/* Cafeteria */}
          {activeTab === 'cafeteria' && (
            <div key="cafeteria" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cafeteria beállítások</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">SZÉP-kártya és béren kívüli juttatások konfigurálása</p>
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={cafeEnabled} onChange={e => setCafeEnabled(e.target.checked)} className="w-4 h-4 rounded" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Cafeteria modul aktív</p>
                  <p className="text-xs text-slate-500">Béren kívüli juttatások kezelése a bérszámfejtésben</p>
                </div>
              </label>

              {cafeEnabled && (
                <>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Éves keret</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Éves cafeteria keret (Ft/fő)</label>
                        <Input value={cafeAnnualBudget} onChange={e => setCafeAnnualBudget(e.target.value)} className="bg-card border-border font-mono" />
                        <p className="text-[10px] text-slate-400">Szja tv. 71. § — évi 450 000 Ft kedvezményes</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Feltöltés napja (hónap)</label>
                        <Input value={cafeDeadline} onChange={e => setCafeDeadline(e.target.value)} className="bg-card border-border" />
                        <p className="text-[10px] text-slate-400">Hónap hányadik napjáig kell feltölteni</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2"><CreditCard className="w-4 h-4" /> SZÉP-kártya alszámlák</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Szálláshely', value: szepSzallas, setter: setSzepSzallas, max: '150 000', color: 'text-blue-600' },
                        { label: 'Vendéglátás', value: szepVendeglatas, setter: setSzepVendeglatas, max: '150 000', color: 'text-orange-600' },
                        { label: 'Szabadidő', value: szepSzabadido, setter: setSzepSzabadido, max: '75 000', color: 'text-emerald-600' },
                      ].map(sub => (
                        <div key={sub.label} className="space-y-2">
                          <label className={cn('text-xs font-bold', sub.color)}>{sub.label}</label>
                          <Input value={sub.value} onChange={e => sub.setter(e.target.value)} className="bg-card border-border font-mono" />
                          <p className="text-[10px] text-slate-400">Max: {sub.max} Ft/év (kedvezményes)</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">SZÉP-kártya szolgáltató</h3>
                    <div className="flex gap-3">
                      {[
                        { value: 'otp', label: 'OTP SZÉP', desc: 'OTP Cafeteria Kft.' },
                        { value: 'kh', label: 'K&H SZÉP', desc: 'K&H Csoportos SZÉP' },
                        { value: 'mkb', label: 'MBH SZÉP', desc: 'MBH Bank SZÉP' },
                      ].map(prov => (
                        <button key={prov.value} onClick={() => setCafeProvider(prov.value)}
                          className={cn('flex-1 p-4 rounded-xl border-2 transition-all text-center', cafeProvider === prov.value ? 'border-primary/30 bg-accent-subtle/50 dark:bg-accent' : 'border-border hover:border-slate-300')}>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{prov.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{prov.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300">
                    <Gift className="w-4 h-4 inline mr-1" />
                    <strong>2026-os szabályok:</strong> SZÉP-kártya juttatás kedvezményes közteherrel (15% SZJA + 13% SZOCHO) adható évi 450 000 Ft-ig. E felett a teljes közteher (15% SZJA + 13% SZOCHO a bruttósított összeg után) terheli a munkáltatót.
                  </div>
                </>
              )}
            </div>
          )}

          {/* NAV Channel */}
          {activeTab === 'nav' && (
            <div key="nav" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">NAV csatorna beállítások</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Online Számla API, bevallás-beküldés és ÁNYK integráció</p>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">NAV Online Számla API</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Technikai felhasználó</label>
                    <Input value={navTechnicalUser} onChange={e => setNavTechnicalUser(e.target.value)} className="bg-card border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Környezet</label>
                    <select value={navEnvironment} onChange={e => setNavEnvironment(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                      <option value="production">🟢 Éles (production)</option>
                      <option value="sandbox">🟡 Teszt (sandbox)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">API kulcs</label>
                    <Input type="password" value={navApiKey} onChange={e => setNavApiKey(e.target.value)} className="bg-card border-border font-mono" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500">Aláíró kulcs (XML signature)</label>
                    <Input type="password" value={navSignatureKey} onChange={e => setNavSignatureKey(e.target.value)} className="bg-card border-border font-mono" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">Bevallás-beküldés mód</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                        <Send className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">KR (Kormányzati API)</p>
                        <p className="text-xs text-slate-500">Közvetlen NAV beküldés XML-ben</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">Elsődleges</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                        <Globe className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">ÁNYK (Általános Nyomtatványkitöltő)</p>
                        <p className="text-xs text-slate-500">Offline kitöltő programmal — ABEV export</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-700">Tartalék</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500">ÁNYK telepítési útvonal</label>
                <Input value={navAnykPath} onChange={e => setNavAnykPath(e.target.value)} className="bg-card border-border font-mono text-xs" />
                <p className="text-[10px] text-slate-400">Csak ÁNYK módú beküldésnél szükséges</p>
              </div>

              <label className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={navAutoSubmit} onChange={e => setNavAutoSubmit(e.target.checked)} className="w-4 h-4 rounded" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Automatikus beküldés</p>
                  <p className="text-xs text-slate-500">Lezárt bevallások automatikus beküldése a NAV felé (KR csatornán)</p>
                </div>
              </label>

              <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                <strong>Figyelem:</strong> Az API kulcs és aláíró kulcs megváltoztatása azonnali hatással van az összes ügyfél bevallás-beküldésére.
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div key="security" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-border pb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Biztonság</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Jelszó, munkamenet és adatvédelem</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                      <Key className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Jelszó módosítás</p>
                      <p className="text-xs text-slate-500">Utolsó módosítás: ismeretlen</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs">Módosítás</Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Munkamenet időtúllépés</p>
                      <p className="text-xs text-slate-500">15 perc inaktivitás után automatikus kijelentkezés</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">15 perc</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent dark:bg-accent flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">GDPR megfelelőség</p>
                      <p className="text-xs text-slate-500">Adatkezelési nyilatkozat és hozzájárulás kezelés</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-accent dark:bg-accent text-accent-foreground dark:text-primary">Megfelelő</span>
                </div>
              </div>
            </div>
          )}

          {/* Save button */}
          <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "gap-2 transition-all",
                saved 
                  ? "bg-primary text-white hover:bg-primary/90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Mentés...</>
              ) : saved ? (
                <><Check className="w-4 h-4" /> Mentve!</>
              ) : (
                <><Save className="w-4 h-4" /> Mentés</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
