import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Save, Banknote, Settings2, FileText, CalendarClock, UserCheck, Shield, Paperclip, Loader2 } from 'lucide-react';
import type { PettyCashRegister } from './types';
import { COMMON_CURRENCIES } from './types';

export interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  register: PettyCashRegister | null;
  onSave: (r: Partial<PettyCashRegister>) => void | Promise<any>;
  saving: boolean;
}

interface RegisterDialogContentProps {
  register: PettyCashRegister | null;
  onClose: () => void;
  onSave: (r: Partial<PettyCashRegister>) => void | Promise<any>;
  saving: boolean;
}

function RegisterDialogContent({ register, onClose, onSave, saving }: RegisterDialogContentProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id || '';

  const [name, setName] = useState(register?.name || '');
  const [location, setLocation] = useState(register?.location || '');
  const [receiptPrefix, setReceiptPrefix] = useState(register?.receipt_prefix || '');
  const [selectedCurrency, setSelectedCurrency] = useState<string>(() => {
    if (register?.currencies && register.currencies.length > 0) {
      return register.currencies[0];
    }
    return 'HUF';
  });
  const [closingMode, setClosingMode] = useState<'daily' | 'weekly' | 'decade' | 'monthly' | 'custom'>(register?.closing_mode || 'monthly');
  const [customDays, setCustomDays] = useState<number>(register?.custom_days || 30);
  const [cashLimit, setCashLimit] = useState<number>(register?.cash_limit ?? 1500000);
  const [limitAction, setLimitAction] = useState<'warn' | 'block'>(register?.limit_action || 'warn');
  const [receiptPolicy, setReceiptPolicy] = useState<'always' | 'when_no_document'>(register?.receipt_policy || 'when_no_document');
  const [attachmentRequired, setAttachmentRequired] = useState<'mandatory' | 'when_no_document' | 'optional'>(
    register?.attachment_required || 'when_no_document'
  );
  const [valuationMethod, setValuationMethod] = useState<'average' | 'fifo'>(
    register?.valuation_method || 'average'
  );
  const [approvalThreshold, setApprovalThreshold] = useState<number>(register?.approval_threshold ?? 200000);
  const [glAccount, setGlAccount] = useState<string>(register?.gl_account || (selectedCurrency === 'HUF' ? '381' : '382'));
  const [isSinglePersonMode, setIsSinglePersonMode] = useState<boolean>(register?.is_single_person_mode ?? false);

  // Officers
  const [cashierUserId, setCashierUserId] = useState<string>(register?.cashier_user_id || 'none');
  const [controllerUserId, setControllerUserId] = useState<string>(register?.controller_user_id || 'none');
  const [authorizerUserId, setAuthorizerUserId] = useState<string>(register?.authorizer_user_id || 'none');

  // Fetch company members to populate officer dropdowns
  const { data: members = [] } = useQuery({
    queryKey: ['company_members_with_profiles', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: memberRows, error: mErr } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId);
      if (mErr) throw mErr;
      if (!memberRows || memberRows.length === 0) return [];

      const userIds = memberRows.map((m: any) => m.user_id);
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', userIds);
      if (pErr) throw pErr;

      return (profiles || []).map((p: any) => ({
        userId: p.user_id,
        name: p.name || p.email || p.user_id,
      }));
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });

  const handleSave = () => {
    onSave({
      ...(register ? { id: register.id } : {}),
      name: name.trim(),
      location: location.trim() || null,
      receipt_prefix: receiptPrefix.trim().toUpperCase() || null,
      currencies: [selectedCurrency],
      closing_mode: closingMode,
      custom_days: customDays,
      cash_limit: cashLimit,
      limit_action: limitAction,
      receipt_policy: receiptPolicy,
      attachment_required: attachmentRequired,
      valuation_method: valuationMethod,
      approval_threshold: approvalThreshold,
      gl_account: glAccount.trim() || (selectedCurrency === 'HUF' ? '381' : '382'),
      is_single_person_mode: isSinglePersonMode,
      cashier_user_id: cashierUserId !== 'none' ? cashierUserId : null,
      controller_user_id: controllerUserId !== 'none' ? controllerUserId : null,
      authorizer_user_id: authorizerUserId !== 'none' ? authorizerUserId : null,
    });
  };

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-primary" />
          {register ? t('pettyCash:registers_tab.dialog_title_edit', 'Pénztár és szabályzat szerkesztése') : t('pettyCash:registers_tab.dialog_title_new', 'Új pénztár létrehozása')}
        </DialogTitle>
        <DialogDescription>
          {t('pettyCash:registers_tab.dialog_desc', 'Törzsadatok, felelősök, sorszámozási prefix és pénzkezelési szabályzati paraméterek (Sztv. 14. § (8)).')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 text-xs">
        {/* Section 1: Alapadatok */}
        <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <Banknote className="w-4 h-4 text-primary" />
            {t('pettyCash:registers_tab.section_basic', 'Alapadatok')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.name_label', 'Pénztár megnevezése *')}</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder={t('pettyCash:registers_tab.name_placeholder', 'Központi forint pénztár')} className="h-9 mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.location_label', 'Helyszín / Telephely (opcionális)')}</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('pettyCash:registers_tab.location_placeholder', 'Budapest, Fő u. 1.')} className="h-9 mt-1 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Bizonylatszám egyedi prefix (opcionális)</Label>
              <Input
                value={receiptPrefix}
                onChange={e => setReceiptPrefix(e.target.value.toUpperCase())}
                placeholder="pl. GYOR (BPB-GYOR-2026-00001)"
                className="h-9 mt-1 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Telephelyi sorszámok megkülönböztetésére.</p>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs">{t('pettyCash:registers_tab.currency_label', 'Devizanem')}</Label>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Devizanem">
                {COMMON_CURRENCIES.slice(0, 6).map(cur => (
                  <button
                    key={cur}
                    type="button"
                    role="radio"
                    aria-checked={selectedCurrency === cur}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-lg border transition-all',
                      selectedCurrency === cur
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold ring-2 ring-primary/30'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                    )}
                    onClick={() => {
                      setSelectedCurrency(cur);
                      if (cur !== 'HUF' && glAccount === '381') {
                        setGlAccount('382');
                      } else if (cur === 'HUF' && glAccount === '382') {
                        setGlAccount('381');
                      }
                    }}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selectedCurrency !== 'HUF' && (
            <div className="p-2.5 bg-background rounded-lg border border-border/50">
              <Label className="text-xs font-medium">Valutakészlet Értékelése (Sztv. 60. §)</Label>
              <Select value={valuationMethod} onValueChange={(v: any) => setValuationMethod(v)}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="average">Átlagos beszerzési árfolyam (számviteli politika szerint)</SelectItem>
                  <SelectItem value="fifo">FIFO módszer (First-In, First-Out)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Section 2: Felelős Személyek Hozzárendelése */}
        <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <UserCheck className="w-4 h-4 text-primary" />
            Pénztári Felelős Személyek és Utalványozás
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Felelős pénztáros</Label>
              <Select value={cashierUserId} onValueChange={setCashierUserId}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue placeholder="Válassz pénztárost" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs kijelölve</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Pénztárellenőr</Label>
              <Select value={controllerUserId} onValueChange={setControllerUserId}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue placeholder="Válassz ellenőrt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs kijelölve</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Utalványozó személy</Label>
              <Select value={authorizerUserId} onValueChange={setAuthorizerUserId}>
                <SelectTrigger className="h-8 mt-1 text-xs">
                  <SelectValue placeholder="Válassz utalványozót" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs kijelölve</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 3: Zárás és Keretösszeg Szabályzat */}
        <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-primary" />
            {t('pettyCash:registers_tab.section_closing', 'Pénztárjelentés és Zárási Szabályzat')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.closing_mode_label', 'Zárási gyakoriság')}</Label>
              <Select value={closingMode} onValueChange={(v) => setClosingMode(v as any)}>
                <SelectTrigger className="h-9 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t('pettyCash:registers_tab.closing_mode_daily', 'Napi zárás (minden forgalmas nap)')}</SelectItem>
                  <SelectItem value="weekly">{t('pettyCash:registers_tab.closing_mode_weekly', 'Heti zárás (hétfő - vasárnap)')}</SelectItem>
                  <SelectItem value="decade">{t('pettyCash:registers_tab.closing_mode_decade', 'Dekád zárás (10 napos)')}</SelectItem>
                  <SelectItem value="monthly">{t('pettyCash:registers_tab.closing_mode_monthly', 'Havi zárás (hónap utolsó napja)')}</SelectItem>
                  <SelectItem value="custom">{t('pettyCash:registers_tab.closing_mode_custom', 'Egyedi ciklus')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closingMode === 'custom' && (
              <div>
                <Label className="text-xs">{t('pettyCash:registers_tab.custom_days_label', 'Egyedi ciklus hossza (nap)')}</Label>
                <Input 
                  type="number" 
                  value={customDays} 
                  onChange={e => setCustomDays(Number(e.target.value) || 30)} 
                  className="h-9 mt-1 text-xs" 
                />
              </div>
            )}

            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.cash_limit_label', 'Készpénz keretösszeg')}</Label>
              <Input 
                type="number" 
                value={cashLimit} 
                onChange={e => setCashLimit(Number(e.target.value) || 0)} 
                className="h-9 mt-1 text-xs font-mono" 
              />
            </div>

            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.limit_action_label', 'Kerettúllépési intézkedés')}</Label>
              <Select value={limitAction} onValueChange={(v) => setLimitAction(v as any)}>
                <SelectTrigger className="h-9 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warn">{t('pettyCash:registers_tab.limit_action_warn', 'Figyelmeztetés a jegyzőkönyvben')}</SelectItem>
                  <SelectItem value="block">{t('pettyCash:registers_tab.limit_action_block', 'Zárás tiltása (befizetés szükséges)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 4: Bizonylati és Könyvelési Rend */}
        <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            {t('pettyCash:registers_tab.section_accounting', 'Bizonylati és Könyvelési Beállítások')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Kötelező forrásdokumentum-csatolás</Label>
              <Select value={attachmentRequired} onValueChange={(v) => setAttachmentRequired(v as any)}>
                <SelectTrigger className="h-9 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory">Minden tételhez kötelező forrásdokumentum</SelectItem>
                  <SelectItem value="when_no_document">Csak ha nincs meglévő rendszerbizonylat</SelectItem>
                  <SelectItem value="optional">Opcionális csatolás</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.approval_threshold_label', 'Utalványozási összeghatár')}</Label>
              <Input 
                type="number" 
                value={approvalThreshold} 
                onChange={e => setApprovalThreshold(Number(e.target.value) || 0)} 
                className="h-9 mt-1 text-xs font-mono" 
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">{t('pettyCash:registers_tab.approval_threshold_hint', 'Efölötti kiadáshoz külön jóváhagyás kell.')}</p>
            </div>

            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.gl_account_label', 'Főkönyvi számlaszám')}</Label>
              <Input 
                value={glAccount} 
                onChange={e => setGlAccount(e.target.value)} 
                placeholder={selectedCurrency === 'HUF' ? '381' : '382'} 
                className="h-9 mt-1 text-xs font-mono" 
              />
            </div>

            <div className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border/50">
              <div className="space-y-0.5 pr-2">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="single-person-mode">
                  {t('pettyCash:registers_tab.single_person_mode_label', 'Egyszemélyes mód')}
                </Label>
                <p className="text-[10px] text-muted-foreground">{t('pettyCash:registers_tab.single_person_mode_hint', 'Pénztáros és ellenőr azonos személy lehet.')}</p>
              </div>
              <Switch 
                id="single-person-mode"
                checked={isSinglePersonMode} 
                onCheckedChange={setIsSinglePersonMode} 
              />
            </div>
          </div>
        </div>
      </div>

      <DialogFooter className="pt-2 border-t border-border/50">
        <Button variant="outline" size="sm" onClick={onClose}>{t('common:cancel', 'Mégse')}</Button>
        <Button 
          size="sm"
          onClick={handleSave}
          disabled={saving || !name.trim() || !selectedCurrency}
          className="gap-1.5"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('pettyCash:registers_tab.save', 'Beállítások mentése')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export function RegisterDialog({ open, onOpenChange, register, onSave, saving }: RegisterDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RegisterDialogContent
        key={register ? register.id : 'new-register'}
        register={register}
        onClose={() => onOpenChange(false)}
        onSave={onSave}
        saving={saving}
      />
    </Dialog>
  );
}

export default RegisterDialog;

