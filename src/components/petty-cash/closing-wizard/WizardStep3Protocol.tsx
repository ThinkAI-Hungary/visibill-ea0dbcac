import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { FileCheck2, AlertCircle, ShieldCheck, UserCheck, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtBalance } from '../types';

interface WizardStep3ProtocolProps {
  registerName: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  bookClosingBalance: number;
  actualBalance: number;
  difference: number;
  differenceReason: string;
  onChangeDifferenceReason: (v: string) => void;
  differenceAction: string;
  onChangeDifferenceAction: (v: string) => void;
  notes: string;
  onChangeNotes: (v: string) => void;
  cashierName: string;
  isSinglePersonMode: boolean;
}

export function WizardStep3Protocol({
  registerName,
  periodStart,
  periodEnd,
  currency,
  openingBalance,
  totalIncome,
  totalExpense,
  bookClosingBalance,
  actualBalance,
  difference,
  differenceReason,
  onChangeDifferenceReason,
  differenceAction,
  onChangeDifferenceAction,
  notes,
  onChangeNotes,
  cashierName,
  isSinglePersonMode,
}: WizardStep3ProtocolProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const hasDifference = Math.abs(difference) > 0.01;

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Összefoglaló jegyzőkönyv kártya */}
      <div className="p-3.5 bg-muted/30 rounded-xl border border-border/70 space-y-3">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground text-sm">{t('pettyCash:closing_wizard.step3.protocol_summary', 'Zárási Jegyzőkönyv Összefoglaló')}</span>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {registerName}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-muted-foreground block">{t('pettyCash:closing_wizard.step3.period_label', 'Időszak:')}</span>
            <span className="font-mono font-medium">{periodStart} - {periodEnd}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t('pettyCash:closing_wizard.step3.opening_label', 'Nyitó egyenleg:')}</span>
            <span className="font-mono font-semibold">{fmtBalance(openingBalance, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t('pettyCash:closing_wizard.step3.book_closing_label', 'Könyv szerinti záró:')}</span>
            <span className="font-mono font-semibold">{fmtBalance(bookClosingBalance, currency)}</span>
          </div>
          <div>
            <span className="text-muted-foreground block">{t('pettyCash:closing_wizard.step3.actual_closing_label', 'Tényleges záró:')}</span>
            <span className="font-mono font-bold text-foreground">{fmtBalance(actualBalance, currency)}</span>
          </div>
        </div>

        {hasDifference && (
          <div className="pt-2 border-t border-border/40 flex items-center justify-between">
            <span className="font-semibold text-foreground">{t('pettyCash:closing_wizard.step3.diff_label', 'Jegyzőkönyvezett eltérés:')}</span>
            <Badge variant="outline" className={cn(
              "font-mono font-bold text-xs",
              difference > 0 ? "border-blue-500/40 text-blue-600 bg-blue-500/10" : "border-destructive/40 text-destructive bg-destructive/10"
            )}>
              {difference > 0 ? `+${fmtBalance(difference, currency)} (${t('pettyCash:closing_wizard.step3.badge_surplus', 'Többlet')})` : `${fmtBalance(difference, currency)} (${t('pettyCash:closing_wizard.step3.badge_shortage', 'Hiány')})`}
            </Badge>
          </div>
        )}
      </div>

      {/* 2. Eltérés esetén indoklás és intézkedés */}
      {hasDifference && (
        <div className="space-y-3 p-3.5 rounded-xl border border-destructive/30 bg-destructive/5">
          <div className="flex items-center gap-1.5 text-destructive font-semibold text-xs">
            <AlertCircle className="w-4 h-4" />
            <span>{t('pettyCash:closing_wizard.step3.mandatory_diff_action', 'Kötelező eltérés indoklás és intézkedés (Sztv. 165. §)')}</span>
          </div>

          <div>
            <Label className="text-xs">
              {t('pettyCash:closing_wizard.step3.diff_cause_label', 'Eltérés indoklása *')} <span className="text-[10px] text-muted-foreground">{t('pettyCash:closing_wizard.step3.diff_cause_hint', '(Mi okozta a hiányt/többletet?)')}</span>
            </Label>
            <Textarea
              value={differenceReason}
              onChange={(e) => onChangeDifferenceReason(e.target.value)}
              placeholder={t('pettyCash:closing_wizard.step3.diff_cause_placeholder', 'pl. Pénztári kerekítések halmozódása, vagy téves visszajáró kiadás...')}
              className="mt-1 text-xs min-h-[60px]"
            />
          </div>

          <div>
            <Label className="text-xs">{t('pettyCash:closing_wizard.step3.action_type_label', 'Előírt intézkedés / Kezelés módja *')}</Label>
            <Select value={differenceAction} onValueChange={onChangeDifferenceAction}>
              <SelectTrigger className="h-9 mt-1 text-xs">
                <SelectValue placeholder={t('pettyCash:closing_wizard.step3.action_type_placeholder', 'Válassz intézkedést')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="booked_as_shortage">{t('pettyCash:closing_wizard.step3.action_shortage_gl', 'Hiányként lekönyvelendő (3681 ellenszámla)')}</SelectItem>
                <SelectItem value="booked_as_surplus">{t('pettyCash:closing_wizard.step3.action_surplus_gl', 'Többletként lekönyvelendő (4791 ellenszámla)')}</SelectItem>
                <SelectItem value="cashier_repays">{t('pettyCash:closing_wizard.step3.action_cashier_repay', 'Pénztáros azonnal megtéríti készpénzben')}</SelectItem>
                <SelectItem value="pending_investigation">{t('pettyCash:closing_wizard.step3.action_investigation', 'Kivizsgálás alatt, függőben tartva')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 3. Felelősök és Aláírások */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/20 rounded-xl border border-border/60">
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1 text-muted-foreground">
            <UserCheck className="w-3.5 h-3.5 text-primary" />
            {t('pettyCash:closing_wizard.step3.cashier_label', 'Kiállító / Pénztáros')}
          </Label>
          <div className="h-9 px-3 flex items-center bg-background border border-border rounded-md font-medium text-xs">
            {cashierName || t('pettyCash:closing_wizard.step3.current_user', 'Aktuális felhasználó')}
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1 text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            {t('pettyCash:closing_wizard.step3.auditor_label', 'Pénztári Ellenőr')}
          </Label>
          <div className="h-9 px-3 flex items-center justify-between bg-background border border-border rounded-md font-medium text-xs">
            <span>{isSinglePersonMode ? t('pettyCash:closing_wizard.step3.auditor_single', { name: cashierName, defaultValue: `${cashierName} (Egyszemélyes mód)` }) : t('pettyCash:closing_wizard.step3.auditor_default', 'Könyvelő / Ellenőr')}</span>
            {isSinglePersonMode && (
              <Badge variant="outline" className="text-[9px] bg-muted font-normal">
                {t('pettyCash:closing_wizard.step3.badge_single_approval', '1-fős jóváhagyás')}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* 4. Egyéb Megjegyzések */}
      <div>
        <Label className="text-xs">{t('pettyCash:closing_wizard.step3.protocol_notes_label', 'Zárási jegyzőkönyv egyéb megjegyzései (opcionális)')}</Label>
        <Textarea
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder={t('pettyCash:closing_wizard.step3.protocol_notes_placeholder', 'Ide rögzíthető bármilyen könyvelési vagy audit megjegyzés...')}
          className="mt-1 text-xs min-h-[50px]"
        />
      </div>
    </div>
  );
}
