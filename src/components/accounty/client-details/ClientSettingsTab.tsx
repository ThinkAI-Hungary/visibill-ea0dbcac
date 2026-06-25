import React, { useState } from 'react';
import { 
  Bell, Mail, MessageCircle, Phone, Globe, Clock, Settings, Check, Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpsertCommunicationPrefs, useUpsertTaxProfile } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';

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

export default function ClientSettingsTab({
  clientId,
  notifPrefs,
  setNotifPrefs,
  commPrefsData,
  taxProfileData,
}: ClientSettingsTabProps) {
  const { toast } = useToast();
  const upsertCommPrefs = useUpsertCommunicationPrefs();
  const upsertTaxProfile = useUpsertTaxProfile();

  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

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

  return (
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
      </div>

      {/* Nyelv & Gyakoriság */}
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
                <option value="hu"> Magyar</option>
                <option value="en"> English</option>
                <option value="de"> Deutsch</option>
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5 block">Értesítési frekvencia</label>
              <select
                value={notifPrefs.frequency}
                onChange={(e) => setNotifPrefs(prev => ({ ...prev, frequency: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="aggressive"> Agresszív (naponta)</option>
                <option value="normal"> Normál (hetente 2x)</option>
                <option value="gentle"> Óvatos (hetente 1x)</option>
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
        <div className="mt-4 p-4 rounded-xl border border-slate-100 dark:border-slate-800 dark:bg-slate-800/30">
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
                upsertCommPrefs.mutate({
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
            onClick={handleSavePrefs}
            disabled={savingPrefs}
            className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {savingPrefs ? <Loader2 className="w-4 h-4 animate-spin" /> : savedPrefs ? <Check className="w-4 h-4" /> : null}
            {savingPrefs ? 'Mentés...' : savedPrefs ? 'Mentve!' : 'Mentés'}
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
                    companyId: clientId,
                    vatFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
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
                    companyId: clientId,
                    vatFrequency: taxProfileData?.vatFrequency || 'monthly',
                    contributionFrequency: e.target.value as 'monthly' | 'quarterly' | 'yearly',
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
            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5" />
              NAV-ból szinkronizálva
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
