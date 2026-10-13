import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Save, Banknote, Settings2, FileText, CalendarClock, Loader2 } from 'lucide-react';
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
  const [name, setName] = useState(register?.name || '');
  const [location, setLocation] = useState(register?.location || '');
  const [currencies, setCurrencies] = useState<string[]>(register?.currencies || ['HUF']);
  const [closingMode, setClosingMode] = useState<'daily' | 'weekly' | 'decade' | 'monthly' | 'custom'>(register?.closing_mode || 'monthly');
  const [customDays, setCustomDays] = useState<number>(register?.custom_days || 30);
  const [cashLimit, setCashLimit] = useState<number>(register?.cash_limit ?? 1500000);
  const [limitAction, setLimitAction] = useState<'warn' | 'block'>(register?.limit_action || 'warn');
  const [receiptPolicy, setReceiptPolicy] = useState<'always' | 'when_no_document'>(register?.receipt_policy || 'when_no_document');
  const [approvalThreshold, setApprovalThreshold] = useState<number>(register?.approval_threshold ?? 200000);
  const [glAccount, setGlAccount] = useState<string>(register?.gl_account || '381');
  const [isSinglePersonMode, setIsSinglePersonMode] = useState<boolean>(register?.is_single_person_mode ?? false);

  const toggleCurrency = (cur: string) => {
    setCurrencies(prev => prev.includes(cur) ? prev.filter(c => c !== cur) : [...prev, cur]);
  };

  const handleSave = () => {
    onSave({
      ...(register ? { id: register.id } : {}),
      name: name.trim(),
      location: location.trim() || null,
      currencies,
      closing_mode: closingMode,
      custom_days: customDays,
      cash_limit: cashLimit,
      limit_action: limitAction,
      receipt_policy: receiptPolicy,
      approval_threshold: approvalThreshold,
      gl_account: glAccount.trim() || '381',
      is_single_person_mode: isSinglePersonMode,
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
          {t('pettyCash:registers_tab.dialog_desc', 'Törzsadatok, zárási gyakoriság és pénzkezelési szabályzati paraméterek (Sztv. 14. § (8)).')}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-5 py-2 text-xs">
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

          <div>
            <Label className="mb-1.5 block text-xs">{t('pettyCash:registers_tab.currencies_label', 'Kezelt valuták')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CURRENCIES.map(cur => (
                <button
                  key={cur}
                  type="button"
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-lg border transition-all',
                    currencies.includes(cur)
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm font-semibold'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                  )}
                  onClick={() => toggleCurrency(cur)}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Zárás és Keretösszeg Szabályzat */}
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
              <Label className="text-xs">{t('pettyCash:registers_tab.cash_limit_label', 'Készpénz keretösszeg (Ft)')}</Label>
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

        {/* Section 3: Bizonylati és Könyvelési Rend */}
        <div className="space-y-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
          <h4 className="font-semibold text-foreground text-sm flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-primary" />
            {t('pettyCash:registers_tab.section_accounting', 'Bizonylati és Könyvelési Beállítások')}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.receipt_policy_label', 'Pénztárbizonylat (BPB/KPB) szabályzat')}</Label>
              <Select value={receiptPolicy} onValueChange={(v) => setReceiptPolicy(v as any)}>
                <SelectTrigger className="h-9 mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="when_no_document">{t('pettyCash:registers_tab.receipt_policy_when_no_doc', 'Csak ha nincs alapbizonylat')}</SelectItem>
                  <SelectItem value="always">{t('pettyCash:registers_tab.receipt_policy_always', 'Minden tételhez kötelező BPB/KPB')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">{t('pettyCash:registers_tab.approval_threshold_label', 'Utalványozási összeghatár (Ft)')}</Label>
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
                placeholder="381" 
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
          disabled={saving || !name || currencies.length === 0}
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
