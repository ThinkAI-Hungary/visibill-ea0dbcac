import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Check } from 'lucide-react';
import { useUpsertCommunicationPrefs } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';

interface ClientProfileTabProps {
  clientId: string;
  client: { id: string; name: string; taxNumber: string };
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
  taxProfileData?: {
    vatType?: string | null;
    vatFrequency?: string | null;
    localTaxLiable?: boolean | null;
  } | null;
}

export default function ClientProfileTab({
  clientId,
  client,
  notifPrefs,
  setNotifPrefs,
  taxProfileData,
}: ClientProfileTabProps) {
  const { toast } = useToast();
  const upsertCommPrefs = useUpsertCommunicationPrefs();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveContact = async () => {
    if (!clientId) return;
    setSaving(true);
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
        autoReminder: notifPrefs.autoReminder,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({ title: 'Mentve!', description: 'Kapcsolattartó adatok sikeresen mentve.' });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'A mentés sikertelen.';
      toast({ title: 'Hiba történt', description: errMsg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
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
              onClick={handleSaveContact}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
              {saved ? 'Mentve!' : 'Adatok mentése'}
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
  );
}
