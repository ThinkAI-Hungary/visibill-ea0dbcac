import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('accounty');
  const { pathname } = useLocation();
  const isHr = pathname.startsWith('/hr');
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
      toast({ title: t('client_profile.save_success_title'), description: t('client_profile.save_success_desc') });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : t('client_profile.save_error_desc');
      toast({ title: t('client_profile.save_error_title'), description: errMsg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 page-animate slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-6">
        {/* Cég adatok */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">{t('client_profile.company_data_title')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('client_profile.company_name')}</label>
              <p className="text-sm font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border">
                {client.name}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {isHr ? t('client_profile.tax_number_hr') : t('client_profile.tax_number')}
              </label>
              <p className="text-sm font-mono font-semibold text-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border">
                {client.taxNumber || '–'}
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('client_profile.visibill_id')}</label>
              <p className="text-xs font-mono text-muted-foreground bg-muted/20 px-3 py-2 rounded-lg border border-border">
                {client.id}
              </p>
            </div>
          </div>
        </div>

        {/* Kapcsolattartó */}
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">{t('client_profile.contact_person_title')}</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('client_profile.contact_name')}</label>
              <input
                type="text"
                value={notifPrefs.contactName}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, contactName: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t('client_profile.placeholder_name')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('client_profile.contact_email')}</label>
              <input
                type="email"
                value={notifPrefs.contactEmail}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, contactEmail: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t('client_profile.placeholder_email')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">{t('client_profile.contact_phone')}</label>
              <input
                type="tel"
                value={notifPrefs.contactPhone}
                onChange={(e) => setNotifPrefs({ ...notifPrefs, contactPhone: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={t('client_profile.placeholder_phone')}
              />
            </div>
            <Button
              onClick={handleSaveContact}
              disabled={saving}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : saved ? <Check className="w-4 h-4 mr-2" /> : null}
              {saved ? t('client_profile.saved') : t('client_profile.btn_save')}
            </Button>
          </div>
        </div>
      </div>

      {/* Tax profile summary */}
      {taxProfileData && (
        <div className="bg-card rounded-lg border border-border shadow-soft p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">{t('client_profile.tax_profile_summary_title')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/10 border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('client_profile.vat_type')}</p>
              <p className="text-sm font-semibold text-foreground">
                {taxProfileData.vatType === 'normal' ? t('client_profile.vat_type_normal') : taxProfileData.vatType === 'kata' ? t('client_profile.vat_type_kata') : taxProfileData.vatType}
              </p>
            </div>
            <div className="bg-muted/10 border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('client_profile.vat_freq')}</p>
              <p className="text-sm font-semibold text-foreground">
                {taxProfileData.vatFrequency === 'monthly' ? t('client_profile.vat_freq_monthly') : taxProfileData.vatFrequency === 'quarterly' ? t('client_profile.vat_freq_quarterly') : taxProfileData.vatFrequency === 'annual' ? t('client_profile.vat_freq_annual') : taxProfileData.vatFrequency}
              </p>
            </div>
            <div className="bg-muted/10 border border-border rounded-lg p-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{t('client_profile.local_tax')}</p>
              <p className="text-sm font-semibold text-foreground">
                {taxProfileData.localTaxLiable ? t('client_profile.yes') : t('client_profile.no')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
