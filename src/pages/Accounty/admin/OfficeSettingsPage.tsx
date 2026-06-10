import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building, Save, Shield, Bell, Globe, Lock, Clock,
  CreditCard, FileText, CheckCircle, AlertTriangle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface OfficeSettings {
  officeName: string;
  taxNumber: string;
  registrationNumber: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  accountingLicenseNumber: string;
  insurancePolicyNumber: string;
  language: string;
  timezone: string;
  fiscalYearEnd: string;
  defaultCurrency: string;
  twoFactor: boolean;
  sessionTimeout: number;
  passwordMinLength: number;
  autoBackup: boolean;
  auditRetention: number;
  emailNotifications: boolean;
  payrollDeadlineReminder: number;
  navApiKey: string;
  navEnvironment: string;
}

const INITIAL: OfficeSettings = {
  officeName: 'Accounty Könyvelőiroda Kft.',
  taxNumber: '12345678-2-41',
  registrationNumber: 'Cg.01-09-123456',
  address: '1052 Budapest, Váci utca 12. 3. emelet',
  phone: '+36 1 234 5678',
  email: 'iroda@accounty.hu',
  website: 'https://accounty.hu',
  accountingLicenseNumber: 'PM/2024/12345',
  insurancePolicyNumber: 'BIZT-2024-67890',
  language: 'hu',
  timezone: 'Europe/Budapest',
  fiscalYearEnd: '12-31',
  defaultCurrency: 'HUF',
  twoFactor: true,
  sessionTimeout: 30,
  passwordMinLength: 12,
  autoBackup: true,
  auditRetention: 10,
  emailNotifications: true,
  payrollDeadlineReminder: 3,
  navApiKey: 'nav-api-***-***-***',
  navEnvironment: 'production',
};

type Tab = 'general' | 'security' | 'notifications' | 'integrations';

export default function OfficeSettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [settings, setSettings] = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const update = (patch: Partial<OfficeSettings>) => setSettings(s => ({ ...s, ...patch }));

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000); }, 1500);
  };

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general', label: 'Általános', icon: Building },
    { id: 'security', label: 'Biztonság', icon: Shield },
    { id: 'notifications', label: 'Értesítések', icon: Bell },
    { id: 'integrations', label: 'Integrációk', icon: Globe },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <Link to="/accounty" className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="p-2.5 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl shadow-lg"><Building className="w-5 h-5 text-white" /></div>
        <div>
          <h1 className="text-2xl font-bold">Iroda beállítások</h1>
          <p className="text-sm text-slate-500">Rendszerszintű konfigurációk — {settings.officeName}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-medium transition-all', tab === t.id ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* General */}
      {tab === 'general' && (
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Cégadatok</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'officeName', label: 'Iroda neve' },
                { key: 'taxNumber', label: 'Adószám', mono: true },
                { key: 'registrationNumber', label: 'Cégjegyzékszám', mono: true },
                { key: 'address', label: 'Székhely cím' },
                { key: 'phone', label: 'Telefonszám', mono: true },
                { key: 'email', label: 'E-mail cím' },
                { key: 'website', label: 'Weboldal' },
                { key: 'accountingLicenseNumber', label: 'Könyvelői regisztrációs szám', mono: true },
                { key: 'insurancePolicyNumber', label: 'Felelősségbiztosítás száma', mono: true },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-slate-500 mb-1 block">{f.label}</label>
                  <input
                    type="text"
                    value={(settings as any)[f.key]}
                    onChange={e => update({ [f.key]: e.target.value })}
                    className={cn('w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-blue-500 outline-none', f.mono && 'font-mono')}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Regionális beállítások</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Nyelv</label>
                <select value={settings.language} onChange={e => update({ language: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="hu">🇭🇺 Magyar</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="de">🇩🇪 Deutsch</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Időzóna</label>
                <select value={settings.timezone} onChange={e => update({ timezone: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="Europe/Budapest">Europe/Budapest (CET)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Pénzügyi év vége</label>
                <input type="text" value={settings.fiscalYearEnd} onChange={e => update({ fiscalYearEnd: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" placeholder="12-31" />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Alapértelmezett pénznem</label>
                <select value={settings.defaultCurrency} onChange={e => update({ defaultCurrency: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                  <option value="HUF">HUF — Magyar Forint</option>
                  <option value="EUR">EUR — Euró</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security */}
      {tab === 'security' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Shield className="w-4 h-4" /> Biztonsági beállítások</h2>
          {[
            { key: 'twoFactor', label: 'Kétfaktoros hitelesítés (2FA)', desc: 'Minden felhasználónak kötelező Google Auth / SMS megerősítés', type: 'toggle' as const },
            { key: 'autoBackup', label: 'Automatikus biztonsági mentés', desc: 'Napi mentés külső tárhelyre — titkosított', type: 'toggle' as const },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              <div>
                <p className="text-sm font-bold">{item.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <button onClick={() => update({ [item.key]: !(settings as any)[item.key] })} className={cn('relative w-12 h-6 rounded-full transition-colors', (settings as any)[item.key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')}>
                <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', (settings as any)[item.key] ? 'translate-x-6' : 'translate-x-0.5')} />
              </button>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Munkamenet időtúllépés (perc)</label>
              <input type="number" value={settings.sessionTimeout} onChange={e => update({ sessionTimeout: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Jelszó minimális hossz</label>
              <input type="number" value={settings.passwordMinLength} onChange={e => update({ passwordMinLength: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Audit napló megőrzés (év)</label>
              <input type="number" value={settings.auditRetention} onChange={e => update({ auditRetention: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {tab === 'notifications' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Bell className="w-4 h-4" /> Értesítési beállítások</h2>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border">
            <div>
              <p className="text-sm font-bold">E-mail értesítések</p>
              <p className="text-xs text-slate-500">Rendszerüzenetek és figyelemfelhívások</p>
            </div>
            <button onClick={() => update({ emailNotifications: !settings.emailNotifications })} className={cn('relative w-12 h-6 rounded-full transition-colors', settings.emailNotifications ? 'bg-emerald-500' : 'bg-slate-300')}>
              <div className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', settings.emailNotifications ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Bérszámfejtési határidő emlékeztető (nap)</label>
            <input type="number" value={settings.payrollDeadlineReminder} onChange={e => update({ payrollDeadlineReminder: Number(e.target.value) })} className="w-full max-w-xs px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            <p className="text-[10px] text-slate-400 mt-1">Hány nappal a határidő előtt küldjön emlékeztetőt</p>
          </div>
        </div>
      )}

      {/* Integrations */}
      {tab === 'integrations' && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2"><Globe className="w-4 h-4" /> NAV integráció</h2>
          <div className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="w-4 h-4 inline mr-1" />
            Az API kulcs módosítása azonnali hatással van a NAV Online Számla és bevallás modulokra.
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">NAV API kulcs</label>
              <input type="password" value={settings.navApiKey} onChange={e => update({ navApiKey: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Környezet</label>
              <select value={settings.navEnvironment} onChange={e => update({ navEnvironment: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm">
                <option value="production">🟢 Production</option>
                <option value="sandbox">🟡 Sandbox (teszt)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Mentés...' : saved ? 'Mentve ✓' : 'Beállítások mentése'}
        </Button>
      </div>
    </div>
  );
}
