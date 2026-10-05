import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  Save, 
  Loader2, 
  ShieldCheck, 
  Calculator, 
  FileText 
} from 'lucide-react';
import type { PettyCashRegister, DenominationRow, CashReport } from '../types';
import { WizardStep1Check } from './WizardStep1Check';
import { WizardStep2Denominations } from './WizardStep2Denominations';
import { WizardStep3Protocol } from './WizardStep3Protocol';
import { useFinalizeCashReport, useActiveCashReport, useEnsureOpenCashReport } from '@/hooks/useCashReports';
import { isPendingPettyCashInvoice } from '@/lib/pettyCashUtils';

interface CashClosingWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  registers: PettyCashRegister[];
  defaultRegisterId?: string;
}

const DEFAULT_HUF_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5];
const DEFAULT_EUR_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];

export function CashClosingWizardDialog({
  open,
  onOpenChange,
  companyId,
  registers,
  defaultRegisterId,
}: CashClosingWizardDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { user } = useAuth();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>(defaultRegisterId || registers[0]?.id || '');

  // Step 2 & 3 local state
  const [denomRows, setDenomRows] = useState<DenominationRow[]>([]);
  const [differenceReason, setDifferenceReason] = useState<string>('');
  const [differenceAction, setDifferenceAction] = useState<string>('booked_as_shortage');
  const [notes, setNotes] = useState<string>('');

  // Selected register object
  const activeRegister = useMemo(() => {
    return registers.find(r => r.id === selectedRegisterId) || registers[0];
  }, [registers, selectedRegisterId]);

  const [overrideCurrency, setOverrideCurrency] = useState<string | null>(null);
  const currency = overrideCurrency || activeRegister?.currencies?.[0] || 'HUF';

  // Reset override currency when register changes
  useEffect(() => {
    setOverrideCurrency(null);
  }, [selectedRegisterId]);

  // Ensure default register selection
  useEffect(() => {
    if (!selectedRegisterId && registers.length > 0) {
      setSelectedRegisterId(defaultRegisterId || registers[0].id);
    }
  }, [registers, defaultRegisterId, selectedRegisterId]);

  // Fetch or ensure active cash report for the register
  const { data: activeReport } = useActiveCashReport(companyId, selectedRegisterId);
  const ensureOpenReport = useEnsureOpenCashReport();
  const finalizeClosing = useFinalizeCashReport();

  // Reset steps & initialize denomination rows when opening
  useEffect(() => {
    if (open) {
      setStep(1);
      const denoms = currency === 'EUR' ? DEFAULT_EUR_DENOMINATIONS : DEFAULT_HUF_DENOMINATIONS;
      const rows = denoms.map(d => ({
        denomination: d,
        count: 0,
        subtotal: 0,
      }));
      setDenomRows(rows);
      setDifferenceReason('');
      setDifferenceAction('booked_as_shortage');
      setNotes('');
    }
  }, [open, selectedRegisterId, currency]);

  // Query opening balances configured for register
  const { data: configuredOpening = 0 } = useQuery({
    queryKey: ['cash-closing-reg-opening', companyId, selectedRegisterId, currency],
    queryFn: async () => {
      if (!companyId || !selectedRegisterId) return 0;
      const { data } = await supabase
        .from('petty_cash_opening_balances')
        .select('amount')
        .eq('register_id', selectedRegisterId)
        .eq('currency', currency)
        .maybeSingle();
      return Number(data?.amount) || 0;
    },
    enabled: open && !!companyId && !!selectedRegisterId,
  });

  // Query prior entries to compute initial balance before dateFrom
  const { data: priorSum = 0 } = useQuery({
    queryKey: ['cash-closing-prior-sum', companyId, selectedRegisterId, dateFromFormatted],
    queryFn: async () => {
      if (!companyId || !selectedRegisterId || !dateFromFormatted) return 0;
      const { data } = await supabase
        .from('petty_cash_entries')
        .select('amount')
        .eq('company_id', companyId)
        .eq('register_id', selectedRegisterId)
        .eq('currency', currency)
        .lt('entry_date', dateFromFormatted)
        .neq('status', 'cancelled');
      return (data || []).reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
    },
    enabled: open && !!companyId && !!selectedRegisterId,
  });

  // Query current period entries
  const { data: periodEntries = [] } = useQuery({
    queryKey: ['cash-closing-period-entries', companyId, selectedRegisterId, dateFromFormatted, dateToFormatted],
    queryFn: async () => {
      if (!companyId || !selectedRegisterId) return [];
      let q = supabase
        .from('petty_cash_entries')
        .select('*')
        .eq('company_id', companyId)
        .eq('register_id', selectedRegisterId)
        .eq('currency', currency)
        .neq('status', 'cancelled');

      if (dateFromFormatted) q = q.gte('entry_date', dateFromFormatted);
      if (dateToFormatted) q = q.lte('entry_date', dateToFormatted);

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!companyId && !!selectedRegisterId,
  });

  // Query pending approvals for this register
  const { data: pendingApprovalsCount = 0 } = useQuery({
    queryKey: ['cash-closing-pending-approvals', companyId, selectedRegisterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('id, invoice_type, fizetesi_mod')
        .eq('company_id', companyId)
        .eq('statusz', 'jovahagyasra_var')
        .in('invoice_type', ['penztarbizonylat', 'egyszerusitett_szla', 'penztargep_zaras']);
      if (error || !data) return 0;
      return data.filter(isPendingPettyCashInvoice).length;
    },
    enabled: open && !!companyId,
  });

  // Calculate accounting amounts
  const openingBalance = activeReport?.opening_balance ?? (configuredOpening + priorSum);
  const totalIncome = useMemo(() => {
    return periodEntries
      .filter(e => Number(e.amount) > 0)
      .reduce((acc, e) => acc + Number(e.amount), 0);
  }, [periodEntries]);

  const totalExpense = useMemo(() => {
    return periodEntries
      .filter(e => Number(e.amount) < 0)
      .reduce((acc, e) => acc + Math.abs(Number(e.amount)), 0);
  }, [periodEntries]);

  const bookClosingBalance = openingBalance + totalIncome - totalExpense;

  // Actual balance from denominations
  const actualBalance = useMemo(() => {
    return denomRows.reduce((acc, r) => acc + r.subtotal, 0);
  }, [denomRows]);

  const difference = actualBalance - bookClosingBalance;
  const isNegativeBalance = bookClosingBalance < 0;
  const cashLimit = activeRegister?.cash_limit ?? 1500000;
  const isLimitExceeded = bookClosingBalance > cashLimit;
  const limitAction = activeRegister?.limit_action || 'warn';

  // Navigation validation
  const canGoToStep2 = !isNegativeBalance && !(limitAction === 'block' && isLimitExceeded);
  const canFinalize = useMemo(() => {
    if (Math.abs(difference) > 0.01) {
      return differenceReason.trim().length >= 5 && !!differenceAction;
    }
    return true;
  }, [difference, differenceReason, differenceAction]);

  // Handle finalize submit
  const handleFinalize = async () => {
    try {
      // 1. If no active report exists yet, create one; otherwise ensure period & opening balance match
      let reportId = activeReport?.id;
      if (!reportId) {
        const ensured = await ensureOpenReport.mutateAsync({
          companyId,
          cashRegisterId: selectedRegisterId,
          periodStart: dateFromFormatted || new Date().toISOString().split('T')[0],
          periodEnd: dateToFormatted || new Date().toISOString().split('T')[0],
          openingBalance,
          currency,
        });
        reportId = ensured.id;
      } else {
        await supabase
          .from('cash_reports' as any)
          .update({
            period_start: dateFromFormatted || activeReport.period_start,
            period_end: dateToFormatted || activeReport.period_end,
            opening_balance: openingBalance,
            currency,
          })
          .eq('id', reportId);
      }

      // 2. Finalize closing via PostgreSQL RPC
      await finalizeClosing.mutateAsync({
        companyId,
        cashReportId: reportId,
        closingBalanceActual: actualBalance,
        denominationRows: denomRows,
        differenceReason: Math.abs(difference) > 0.01 ? differenceReason : undefined,
        differenceAction: Math.abs(difference) > 0.01 ? differenceAction : undefined,
        notes: notes || undefined,
        expectedBookBalance: bookClosingBalance,
      });

      toast({
        title: t('pettyCash:closing_wizard.toast_closed_title', 'Pénztár sikeresen lezárva!'),
        description: t('pettyCash:closing_wizard.toast_closed_desc', {
          name: activeRegister?.name,
          defaultValue: `A(z) ${activeRegister?.name} időszaki zárása és jegyzőkönyve archiválásra került.`,
        }),
      });

      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: t('pettyCash:closing_wizard.toast_error_title', 'Hiba a zárás során'),
        description: err.message || t('pettyCash:closing_wizard.toast_error_desc', 'Nem sikerült lezárni a pénztárjelentést.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-3xl max-h-[92vh] flex flex-col p-4 sm:p-6 gap-4">
        {/* Header */}
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {t('pettyCash:closing_wizard.dialog_title', 'Időszaki Pénztárzárás Varázsló')}
                <Badge variant="outline" className="text-xs bg-muted ml-1">
                  {t('pettyCash:closing_wizard.sztv_badge', 'Sztv. 165–168. §')}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t('pettyCash:closing_wizard.dialog_desc', 'Készpénzállomány egyeztetése, címletjegyzék rögzítése és zárási jegyzőkönyv készítése.')}
              </DialogDescription>
            </div>

            {/* Stepper indikátor */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <span className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                step === 1 ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"
              )}>
                {t('pettyCash:closing_wizard.step1_title', '1. Ellenőrzés')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                step === 2 ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"
              )}>
                {t('pettyCash:closing_wizard.step2_title', '2. Címletjegyzék')}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
              <span className={cn(
                "px-2.5 py-1 rounded-md transition-colors",
                step === 3 ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"
              )}>
                {t('pettyCash:closing_wizard.step3_title', '3. Jegyzőkönyv')}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto pr-1">
          {step === 1 && (
            <WizardStep1Check
              registers={registers}
              selectedRegisterId={selectedRegisterId}
              onSelectRegister={setSelectedRegisterId}
              periodStart={dateFromFormatted || '2026-01-01'}
              periodEnd={dateToFormatted || '2026-01-31'}
              openingBalance={openingBalance}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              bookClosingBalance={bookClosingBalance}
              currency={currency}
              onSelectCurrency={setOverrideCurrency}
              pendingApprovalsCount={pendingApprovalsCount}
              isNegativeBalance={isNegativeBalance}
              isLimitExceeded={isLimitExceeded}
              limitAction={limitAction}
              cashLimit={cashLimit}
            />
          )}

          {step === 2 && (
            <WizardStep2Denominations
              currency={currency}
              bookClosingBalance={bookClosingBalance}
              rows={denomRows}
              onChangeRows={setDenomRows}
              actualBalance={actualBalance}
              difference={difference}
            />
          )}

          {step === 3 && (
            <WizardStep3Protocol
              registerName={activeRegister?.name || t('pettyCash:closing_dialog.all_registers', 'Pénztár')}
              periodStart={dateFromFormatted || '2026-01-01'}
              periodEnd={dateToFormatted || '2026-01-31'}
              currency={currency}
              openingBalance={openingBalance}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              bookClosingBalance={bookClosingBalance}
              actualBalance={actualBalance}
              difference={difference}
              differenceReason={differenceReason}
              onChangeDifferenceReason={setDifferenceReason}
              differenceAction={differenceAction}
              onChangeDifferenceAction={setDifferenceAction}
              notes={notes}
              onChangeNotes={setNotes}
              cashierName={user?.user_metadata?.full_name || user?.email || t('pettyCash:closing_wizard.step3.cashier_label', 'Pénztáros')}
              isSinglePersonMode={activeRegister?.is_single_person_mode || false}
            />
          )}
        </div>

        {/* Footer controls */}
        <DialogFooter className="pt-3 border-t border-border/60 flex items-center justify-between sm:justify-between">
          <div>
            {step > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as any)}
                className="text-xs gap-1.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                {t('pettyCash:closing_wizard.btn_back', 'Vissza')}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              {t('pettyCash:closing_wizard.btn_cancel', 'Mégse')}
            </Button>

            {step < 3 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => (s + 1) as any)}
                disabled={step === 1 && !canGoToStep2}
                className="text-xs gap-1.5"
              >
                {t('pettyCash:closing_wizard.btn_next', 'Tovább')}
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleFinalize}
                disabled={!canFinalize || finalizeClosing.isPending}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                {finalizeClosing.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {t('pettyCash:closing_wizard.finalize_btn', 'Zárás véglegesítése és jegyzőkönyv generálása')}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
