import React, { useState, useMemo } from 'react';
import { 
  Settings, Building2, Mail, Phone, Bell, Shield, Users, Globe,
  Save, Check, Loader2, ChevronRight, AlertTriangle, Key, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyAccountants } from '@/hooks/useAccountyData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type SettingsTab = 'general' | 'notifications' | 'team' | 'security';

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

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      toast({ title: '✅ Beállítások mentve', description: 'A módosítások sikeresen elmentve.' });
      setTimeout(() => setSaved(false), 2000);
    }, 800);
  };

  const tabs = [
    { id: 'general' as const, label: 'Általános', icon: Building2 },
    { id: 'notifications' as const, label: 'Értesítések', icon: Bell },
    { id: 'team' as const, label: 'Csapat', icon: Users },
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
                  ? "bg-primary/15 text-primary shadow-sm border border-primary/20"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right: Content */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* General */}
          {activeTab === 'general' && (
            <div key="general" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
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
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-mail</label>
                  <Input 
                    value={officeEmail} 
                    onChange={e => setOfficeEmail(e.target.value)} 
                    placeholder="iroda@example.com"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Telefonszám</label>
                  <Input 
                    value={officePhone} 
                    onChange={e => setOfficePhone(e.target.value)} 
                    placeholder="+36 1 234 5678"
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cím</label>
                  <Input 
                    value={officeAddress} 
                    onChange={e => setOfficeAddress(e.target.value)} 
                    placeholder="1234 Budapest, Példa utca 1."
                    className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
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
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
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
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
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
                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
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
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
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

          {/* Security */}
          {activeTab === 'security' && (
            <div key="security" className="p-6 space-y-6 tab-content-enter">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
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
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex justify-end">
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
