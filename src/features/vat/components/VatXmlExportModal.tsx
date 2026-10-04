import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Loader2, Phone, User, CheckCircle2, AlertCircle, AlertTriangle, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { generateVatReturnXml, formatAnykPhoneNumber } from '@/lib/vatReturnXml';
import { generateVatA60Xml, formatA60PhoneNumber } from '@/lib/vatA60Xml';
import type { A60Line } from '../types';

interface ContactOption {
  id: string;
  label: string;
  name: string;
  phone: string;
}

interface VatXmlExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompany: any;
  year: number;
  month: number;
  frequency: string;
  lines?: any[];
  mLines?: any[];
  formKind?: '65' | 'A60';
  a60Lines?: A60Line[];
  onSuccess?: () => void;
}

export function VatXmlExportModal({
  open,
  onOpenChange,
  selectedCompany,
  year,
  month,
  frequency,
  lines = [],
  mLines = [],
  formKind = '65',
  a60Lines = [],
  onSuccess,
}: VatXmlExportModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const { refreshCompanies } = useCompany();
  const { user } = useAuth();

  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string>('custom');
  const [representativeName, setRepresentativeName] = useState('');
  const [phone, setPhone] = useState('');
  const [saveToCompany, setSaveToCompany] = useState(true);
  const [selectedForm, setSelectedForm] = useState<'auto' | '2465' | '2565' | '2665'>('auto');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Build contact options dynamically when modal opens
  useEffect(() => {
    if (!open || !selectedCompany) return;

    let isMounted = true;
    setErrorMessage(null);
    setSelectedForm('auto');

    const loadContacts = async () => {
      const options: ContactOption[] = [];

      // 1. Céghez mentett alapértelmezett ügyintéző
      const compRepName = selectedCompany.representative_name?.trim();
      const compPhone = selectedCompany.phone?.trim();
      if (compRepName) {
        options.push({
          id: 'company_default',
          label: `📌 Cég alapértelmezett: ${compRepName}${compPhone ? ` (${compPhone})` : ''}`,
          name: compRepName,
          phone: compPhone || '',
        });
      }

      // 2. Bejelentkezett felhasználó profilja
      const authUserName = (user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || '').trim();
      if (authUserName && authUserName !== compRepName) {
        options.push({
          id: 'current_user',
          label: `👤 Saját profilom (${authUserName})`,
          name: authUserName,
          phone: compPhone || '',
        });
      }

      // 3. Cég tagjai a company_members táblából
      try {
        const { data: members } = await supabase
          .from('company_members')
          .select('user_id, profiles(name)')
          .eq('company_id', selectedCompany.id);

        if (members && members.length > 0) {
          members.forEach((m: any, idx: number) => {
            const memberName = m.profiles?.name?.trim();
            if (memberName && memberName !== compRepName && memberName !== authUserName) {
              options.push({
                id: `member_${m.user_id || idx}`,
                label: `👥 Munkatárs: ${memberName}`,
                name: memberName,
                phone: compPhone || '',
              });
            }
          });
        }
      } catch (err) {
        console.warn('[VatXmlExportModal] Could not fetch member profiles:', err);
      }

      if (!isMounted) return;

      setContactOptions(options);

      // Alapértelmezett kiválasztás
      if (options.length > 0) {
        const defaultChoice = options[0];
        setSelectedContactId(defaultChoice.id);
        setRepresentativeName(defaultChoice.name);
        setPhone(defaultChoice.phone);
      } else {
        setSelectedContactId('custom');
        setRepresentativeName('');
        setPhone(compPhone || '');
      }
    };

    loadContacts();

    return () => {
      isMounted = false;
    };
  }, [open, selectedCompany, user]);

  const isA60 = formKind === 'A60';
  const defaultFormCode = isA60 ? `${year % 100}A60` : `${year % 100}65`;
  const activeFormCode = isA60 ? `${year % 100}A60` : (selectedForm === 'auto' ? defaultFormCode : selectedForm);

  const a60Warnings = useMemo(() => {
    if (!isA60) return [];
    const msgs: string[] = [];
    if (frequency === 'E') {
      msgs.push('Az A60-as összesítő nyilatkozat éves (E) gyakorisággal az ÁNYK-ban nem nyújtható be (csak havi vagy negyedéves megengedett).');
    }
    const safeA60Lines = a60Lines || [];
    const ossCount = safeA60Lines.filter(l => (l.partner_vat_number || '').toUpperCase().startsWith('EU')).length;
    if (ossCount > 0) {
      msgs.push(`${ossCount} db technikai OSS (EU-előtagos) partner kimarad az XML-ből, mert nem EU tagállami adószám.`);
    }
    const missingTaxCount = safeA60Lines.filter(l => !l.partner_vat_number || l.partner_vat_number === '0').length;
    if (missingTaxCount > 0) {
      msgs.push(`${missingTaxCount} db partner nem rendelkezik érvényes közösségi adószámmal.`);
    }
    if (safeA60Lines.length === 0) {
      msgs.push('Nincs rögzített A60-as tétel ebben az időszakban (üres nyilatkozat kerül generálásra).');
    }
    return msgs;
  }, [isA60, frequency, a60Lines]);

  const handleContactPresetChange = (presetId: string) => {
    setSelectedContactId(presetId);
    if (presetId === 'custom') {
      // Keep existing inputs or clear for new input
      return;
    }

    const chosen = contactOptions.find((c) => c.id === presetId);
    if (chosen) {
      setRepresentativeName(chosen.name);
      if (chosen.phone) {
        setPhone(chosen.phone);
      }
    }
  };

  const handleDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const trimmedName = representativeName.trim();
    const formattedPhone = isA60 ? formatA60PhoneNumber(phone) : formatAnykPhoneNumber(phone);

    if (isA60 && frequency === 'E') {
      setErrorMessage('Az A60-as összesítő nyilatkozat éves (E) gyakorisággal nem nyújtható be az ÁNYK-ba.');
      return;
    }

    if (!trimmedName) {
      setErrorMessage(t('accounting:vat_return.export_modal.errors.name_required', 'Az ügyintéző neve kötelező az ÁNYK 0A főlaphoz!'));
      return;
    }

    if (!formattedPhone || formattedPhone.length < 8) {
      setErrorMessage(
        t(
          'accounting:vat_return.export_modal.errors.phone_required',
          isA60
            ? 'Kérlek adj meg egy érvényes telefonszámot (pl. 06 30 123 4567)!'
            : 'Kérlek adj meg egy érvényes telefonszámot (pl. +36 30 123 4567)!'
        )
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Mentés a companies táblába ha be van pipálva
      if (saveToCompany && selectedCompany.id) {
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            representative_name: trimmedName,
            phone: phone.trim(),
          })
          .eq('id', selectedCompany.id);

        if (updateError) {
          console.warn('[VatXmlExportModal] Company update warning:', updateError);
        } else {
          await refreshCompanies();
        }
      }

      if (isA60) {
        // A60 Közösségi összesítő nyilatkozat generálása
        generateVatA60Xml({
          companyName: selectedCompany.name || '',
          companyTaxNumber: selectedCompany.tax_number || '',
          companyAddress: selectedCompany.address || '',
          periodYear: year,
          periodMonth: month,
          frequency,
          representativeName: trimmedName,
          phone: formattedPhone,
          lines: a60Lines || [],
        });

        toast({
          title: t('accounting:vat_return.toasts.a60_xml_downloaded_title', 'ÁNYK A60 XML letöltve'),
          description: t('accounting:vat_return.toasts.a60_xml_downloaded_desc', {
            formCode: activeFormCode,
            defaultValue: `A ${activeFormCode} ÁNYK-kompatibilis XML fájl elkészült és letöltésre került.`,
          }),
        });
      } else {
        // 2. Sablon verzió felülbírálás meghatározása (65-ös ÁFA bevallás)
        const formIdOverride = selectedForm !== 'auto' ? selectedForm : undefined;
        const formVersionOverride = formIdOverride === '2465' ? '4.0' : undefined;

        // 3. XML generálás és automatikus letöltés
        generateVatReturnXml({
          companyName: selectedCompany.name || '',
          companyTaxNumber: selectedCompany.tax_number || '',
          companyAddress: selectedCompany.address || '',
          periodYear: year,
          periodMonth: month,
          frequency,
          representativeName: trimmedName,
          phone: formattedPhone,
          formIdOverride,
          formVersionOverride,
          lines,
          mLines,
        });

        toast({
          title: t('accounting:vat_return.toasts.xml_downloaded_title', 'ÁNYK XML letöltve'),
          description: t('accounting:vat_return.toasts.xml_downloaded_desc', {
            formCode: activeFormCode,
            defaultValue: `A ${activeFormCode} ÁNYK-kompatibilis XML fájl elkészült és letöltésre került.`,
          }),
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('[VatXmlExportModal] Export error:', err);
      setErrorMessage(err?.message || 'Hiba történt a generálás vagy mentés során.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border border-border">
        <form onSubmit={handleDownload}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <span>
                {isA60
                  ? `ÁNYK A60 Export (${activeFormCode}) — Ügyintéző kijelölése`
                  : t('accounting:vat_return.export_modal.title', 'ÁNYK XML Export — Ügyintéző kijelölése')}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {isA60
                ? 'Válaszd ki a mentett személyek közül, hogy ki szerepeljen ügyintézőként a NAV 26A60 közösségi összesítő nyilatkozat főlapján, vagy adj meg új adatokat.'
                : t(
                    'accounting:vat_return.export_modal.description',
                    'Válaszd ki a mentett személyek közül, hogy ki szerepeljen ügyintézőként a NAV 65A bevallás főlapján, vagy adj meg új adatokat.'
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {errorMessage && (
              <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2 text-xs text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* A60 figyelmeztetések */}
            {a60Warnings.length > 0 && (
              <div className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                  <span>Figyelmeztetés az A60 exporthoz:</span>
                </div>
                <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                  {a60Warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Kapcsolattartó / Ügyintéző Gyorsválasztó */}
            <div className="space-y-1.5 pb-2 border-b border-border/60">
              <Label htmlFor="contact-preset-select" className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <UserCheck className="w-3.5 h-3.5 text-primary" />
                <span>{t('accounting:vat_return.export_modal.preset_label', 'Ügyintéző kijelölése')}</span>
              </Label>
              <Select
                value={selectedContactId}
                onValueChange={handleContactPresetChange}
                disabled={isSubmitting}
              >
                <SelectTrigger id="contact-preset-select" className="h-9 text-xs">
                  <SelectValue placeholder="Válassz ügyintézőt..." />
                </SelectTrigger>
                <SelectContent>
                  {contactOptions.map((opt) => (
                    <SelectItem key={opt.id} value={opt.id} className="text-xs font-medium">
                      {opt.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="text-xs text-muted-foreground font-normal">
                    ➕ Új / Egyéni ügyintéző beírása
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ügyintéző neve */}
            <div className="space-y-1.5">
              <Label htmlFor="representative-name" className="text-xs font-medium flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('accounting:vat_return.export_modal.rep_name_label', 'Ügyintéző neve')}</span>
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="representative-name"
                value={representativeName}
                onChange={(e) => {
                  setRepresentativeName(e.target.value);
                  setSelectedContactId('custom');
                }}
                placeholder={t('accounting:vat_return.export_modal.rep_name_placeholder', 'pl. Surányi Pál vagy Jámbor Viktor')}
                className="h-9 text-xs"
                disabled={isSubmitting}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                {t('accounting:vat_return.export_modal.rep_name_help', 'A bevallás főlapjára (0A0001E007A) kerülő hivatalos kapcsolattartó.')}
              </p>
            </div>

            {/* Telefonszám */}
            <div className="space-y-1.5">
              <Label htmlFor="representative-phone" className="text-xs font-medium flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('accounting:vat_return.export_modal.phone_label', 'Telefonszám')}</span>
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="representative-phone"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setSelectedContactId('custom');
                }}
                placeholder={isA60 ? '06 30 123 4567' : '+36 30 123 4567'}
                className="h-9 text-xs font-mono"
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-muted-foreground">
                {isA60
                  ? 'A 26A60 főlapra (0A0001E008A) 06-os belföldi formátumban kerül (pl. 06301234567).'
                  : t('accounting:vat_return.export_modal.phone_help', 'Az ÁNYK főlapra (0A0001E008A) tisztított formátumban kerül (pl. 36301234567).')}
              </p>
            </div>

            {/* ÁNYK sablon verzió választó */}
            {!isA60 ? (
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="form-template-select" className="text-xs font-medium text-muted-foreground">
                  {t('accounting:vat_return.export_modal.template_label', 'ÁNYK sablon típusa')}
                </Label>
                <Select
                  value={selectedForm}
                  onValueChange={(val: any) => setSelectedForm(val)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="form-template-select" className="h-8 text-xs">
                    <SelectValue placeholder="Válassz sablont" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto" className="text-xs">
                      {t('accounting:vat_return.export_modal.template_auto', 'Automatikus')} ({defaultFormCode}A / {defaultFormCode}M)
                    </SelectItem>
                    <SelectItem value="2665" className="text-xs">
                      2665A / 2665M (2026-os ÁNYK sablon)
                    </SelectItem>
                    <SelectItem value="2565" className="text-xs">
                      2565A / 2565M (2025-ös ÁNYK sablon)
                    </SelectItem>
                    <SelectItem value="2465" className="text-xs">
                      2465A / 2465M v4.0 (2024-es ÁNYK referencia)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Nyomtatvány sablon:</span>
                <span className="font-mono font-semibold text-foreground">26A60 v3.0 (Közösségi összesítő)</span>
              </div>
            )}

            {/* Mentés a céghez checkbox */}
            <div className="flex items-center space-x-2 pt-2 border-t border-border/60">
              <Checkbox
                id="save-to-company"
                checked={saveToCompany}
                onCheckedChange={(checked) => setSaveToCompany(!!checked)}
                disabled={isSubmitting}
              />
              <Label
                htmlFor="save-to-company"
                className="text-xs text-muted-foreground font-normal cursor-pointer select-none leading-none"
              >
                {t(
                  'accounting:vat_return.export_modal.save_to_company',
                  'Mentés a vállalkozás alapértelmezett ügyintézőjeként'
                )}
              </Label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs h-8"
            >
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !representativeName.trim() || !phone.trim() || (isA60 && frequency === 'E')}
              className="text-xs h-8 gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('accounting:vat_return.export_modal.downloading', 'Generálás...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('accounting:vat_return.export_modal.save_and_download', 'Mentés & XML letöltés')}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
