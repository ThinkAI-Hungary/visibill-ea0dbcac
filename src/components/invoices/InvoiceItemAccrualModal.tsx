import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CalendarClock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Trash2,
  Loader2,
  AlertCircle,
  Calendar,
  Landmark,
  Info,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/locale/formatters';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { extractDateRangeFromText, calculateAccrualSplit } from '@/lib/accrualMath';
import {
  createAccrualJournalEntry,
  getExistingAccrualForInvoice,
  deleteAccrualEntry,
} from '@/features/journals/services/accrualPostingService';

interface InvoiceLineItemLike {
  id: string;
  line_number?: number;
  line_description: string | null;
  net_amount: number | null;
  gross_amount?: number | null;
  gl_classifications?: Record<string, any> | null;
}

interface InvoiceItemAccrualModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InvoiceLineItemLike | null;
  invoiceId: string;
  invoiceNumber: string;
  currency?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  partnerId?: string | null;
  partnerName?: string | null;
  companyId: string;
  presetId: string;
  onSuccess?: () => void;
}

export function InvoiceItemAccrualModal({
  open,
  onOpenChange,
  item,
  invoiceId,
  invoiceNumber,
  currency = 'HUF',
  direction = 'INBOUND',
  partnerId,
  partnerName,
  companyId,
  presetId,
  onSuccess,
}: InvoiceItemAccrualModalProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [method, setMethod] = useState<'daily' | 'monthly'>('monthly');
  const [selectedAccrualGlId, setSelectedAccrualGlId] = useState<string>('');
  const [isAutoExtracted, setIsAutoExtracted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // 1. Fetch GL accounts for preset
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      return await fetchAllGlAccountsByPreset(presetId);
    },
    enabled: open && !!presetId,
  });

  // 2. Fetch existing accrual for this invoice if any
  const { data: existingAccrual, refetch: refetchExistingAccrual } = useQuery({
    queryKey: ['existingAccrual', invoiceId],
    queryFn: async () => {
      if (!invoiceId) return null;
      return await getExistingAccrualForInvoice(invoiceId);
    },
    enabled: open && !!invoiceId,
  });

  // Current item's assigned GL classification
  const itemClassification = useMemo(() => {
    if (!item?.gl_classifications || !presetId) return null;
    return item.gl_classifications[presetId] || Object.values(item.gl_classifications)[0] || null;
  }, [item, presetId]);

  const itemGlNumber = itemClassification?.gl_number || '';
  const itemGlAccountId = itemClassification?.gl_account_id || glAccounts.find(g => g.gl_number === itemGlNumber)?.id || '';

  // 3. Auto-populate dates and default accrual account when modal opens
  useEffect(() => {
    if (!open || !item) return;

    const extracted = extractDateRangeFromText(item.line_description);
    if (extracted) {
      setStartDate(extracted.startDate);
      setEndDate(extracted.endDate);
      setIsAutoExtracted(true);
    } else {
      const today = new Date().toISOString().substring(0, 10);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      setStartDate(today);
      setEndDate(nextYear.toISOString().substring(0, 10));
      setIsAutoExtracted(false);
    }
  }, [open, item]);

  // 4. Candidate accrual GL accounts for dropdown selector
  const accrualGlOptions = useMemo(() => {
    const targetPrefix = direction === 'INBOUND' ? '39' : '48';
    const filtered = glAccounts.filter(g => g.gl_number?.startsWith(targetPrefix));
    if (filtered.length > 0) return filtered;
    return direction === 'INBOUND'
      ? [{ id: 'fallback_392', gl_number: '392', short_name: 'Költségek aktív időbeli elhatárolása' }]
      : [{ id: 'fallback_481', gl_number: '481', short_name: 'Árbevételek passzív időbeli elhatárolása' }];
  }, [glAccounts, direction]);

  // Resolve default Accrual Account (392 for expense, 481 for revenue)
  useEffect(() => {
    if (accrualGlOptions.length === 0) return;
    if (!selectedAccrualGlId) {
      const preferred = accrualGlOptions.find(g => g.gl_number === '3921') ||
                        accrualGlOptions.find(g => g.gl_number === '392') ||
                        accrualGlOptions.find(g => g.gl_number === '4811') ||
                        accrualGlOptions.find(g => g.gl_number === '481') ||
                        accrualGlOptions[0];
      if (preferred) setSelectedAccrualGlId(preferred.id);
    }
  }, [accrualGlOptions, selectedAccrualGlId]);

  const selectedAccrualGlAccount = useMemo(() => {
    if (selectedAccrualGlId) {
      const found = accrualGlOptions.find(g => g.id === selectedAccrualGlId);
      if (found) return found;
    }
    return accrualGlOptions[0] || null;
  }, [accrualGlOptions, selectedAccrualGlId]);

  // 5. Live pro-rata calculation
  const splitResult = useMemo(() => {
    if (!item?.net_amount || !startDate || !endDate) return null;
    return calculateAccrualSplit({
      amount: Math.abs(item.net_amount),
      startDate,
      endDate,
      method,
      direction,
    });
  }, [item?.net_amount, startDate, endDate, method, direction]);

  const startYear = startDate ? startDate.substring(0, 4) : '';
  const endYear = endDate ? endDate.substring(0, 4) : '';

  // 6. Handle Save
  const handleSaveAccrual = async () => {
    if (!item || !splitResult || splitResult.accrualAmount <= 0) return;
    if (!selectedAccrualGlAccount) {
      toast({
        title: t('invoices:accrual_modal.toast_missing_gl', 'Hiányzó elhatárolási főkönyvi szám'),
        description: t('invoices:accrual_modal.toast_missing_gl_desc', 'Kérlek válassz ki egy elhatárolási számlát (pl. 392).'),
        variant: 'destructive',
      });
      return;
    }

    if (!itemGlAccountId) {
      toast({
        title: t('invoices:accrual_modal.toast_missing_item_gl', 'Hiányzó tétel kontírozás'),
        description: t('invoices:accrual_modal.toast_missing_item_gl_desc', 'A számlatételt először le kell kontírozni (főkönyvi számlaszám hozzárendelése szükséges).'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const isAie = splitResult.accrualType === 'AIE';
      const debitGlAccountId = isAie ? selectedAccrualGlAccount.id : itemGlAccountId;
      const debitGlNumber = isAie ? selectedAccrualGlAccount.gl_number : itemGlNumber;
      const creditGlAccountId = isAie ? itemGlAccountId : selectedAccrualGlAccount.id;
      const creditGlNumber = isAie ? itemGlNumber : selectedAccrualGlAccount.gl_number;

      await createAccrualJournalEntry({
        companyId,
        presetId,
        invoiceId,
        invoiceNumber,
        partnerId,
        partnerName,
        itemDescription: item.line_description || 'Számlatétel',
        accrualType: splitResult.accrualType,
        accrualDate: splitResult.accrualDate,
        reversalDate: splitResult.reversalDate,
        accrualAmount: splitResult.accrualAmount,
        debitGlAccountId,
        debitGlNumber,
        creditGlAccountId,
        creditGlNumber,
        currency,
        status: 'KONYVELT',
      });

      toast({
        title: t('invoices:accrual_modal.toast_success', 'Időbeli elhatárolás sikeresen lekönyvelve'),
        description: t('invoices:accrual_modal.toast_success_desc', {
          amount: formatCurrency(splitResult.accrualAmount, currency),
          date: splitResult.accrualDate,
          defaultValue: `${formatCurrency(splitResult.accrualAmount, currency)} összeg bejegyezve a Vegyes naplóba (${splitResult.accrualDate} fordulónappal).`,
        }),
      });

      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accrual_entries'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['existingAccrual', invoiceId] });

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: t('invoices:accrual_modal.toast_error', 'Hiba az elhatárolás mentésekor'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Handle Delete / Storno of existing accrual
  const handleDeleteAccrual = async () => {
    if (!existingAccrual) return;
    setIsDeleting(true);
    try {
      await deleteAccrualEntry(existingAccrual.id, existingAccrual.booked_journal_entry_id);
      toast({
        title: t('invoices:accrual_modal.toast_deleted', 'Időbeli elhatárolás törölve'),
        description: t('invoices:accrual_modal.toast_deleted_desc', 'A kapcsolódó vegyes napló tétel és nyilvántartási bejegyzés sikeresen törlődött.'),
      });
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['accrual_entries'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['existingAccrual', invoiceId] });
      refetchExistingAccrual();
      onSuccess?.();
    } catch (err: any) {
      toast({
        title: t('invoices:accrual_modal.toast_delete_error', 'Hiba a törlés során'),
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg md:max-w-xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-border/60 shadow-2xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                {t('invoices:accrual_modal.title', 'Időbeli elhatárolás rögzítése')}
                {direction === 'INBOUND' ? (
                  <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-600 border-purple-300">AIE</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-300">PIE</Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t('invoices:accrual_modal.invoice_number_prefix', 'Bizonylatszám:')} <span className="font-mono font-semibold text-foreground">{invoiceNumber}</span>
                {partnerName && <span> • {partnerName}</span>}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
          {/* Existing accrual alert if already recorded */}
          {existingAccrual && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    {t('invoices:accrual_modal.existing_accrual_title', 'Ezen a bizonylaton már van lekönyvelt elhatárolás!')}
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    {t('invoices:accrual_modal.existing_accrual_desc', {
                      amount: formatCurrency(existingAccrual.amount, currency),
                      date: existingAccrual.accrual_date,
                      defaultValue: `Összeg: ${formatCurrency(existingAccrual.amount, currency)} (Fordulónap: ${existingAccrual.accrual_date})`,
                    })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                disabled={isDeleting}
                onClick={handleDeleteAccrual}
                className="h-7 text-xs gap-1.5 shrink-0"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                {t('invoices:accrual_modal.btn_delete', 'Törlés')}
              </Button>
            </div>
          )}

          {/* Item Summary Card */}
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2 min-w-0 overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{t('invoices:accrual_modal.affected_item', 'Érintett számlatétel')}</span>
                <p className="font-medium text-xs leading-snug line-clamp-2 mt-0.5" title={item.line_description || ''}>
                  {item.line_description || t('invoices:accrual_modal.unknown_item', 'Ismeretlen tétel')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{t('invoices:accrual_modal.item_net', 'Tétel nettó')}</span>
                <p className="font-mono text-sm font-bold text-foreground">
                  {formatCurrency(item.net_amount || 0, currency)}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5 text-primary" />
                {t('invoices:accrual_modal.item_gl', 'Tétel főkönyve:')}
              </span>
              <span className="font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {itemGlNumber || t('invoices:accrual_modal.not_classified', 'Nincs kontírozva')}
              </span>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                {t('invoices:accrual_modal.service_period', 'Szolgáltatás időszaka (Kezdet – Vég)')}
              </Label>
              {isAutoExtracted && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-400/30">
                  <Sparkles className="w-3 h-3" /> {t('invoices:accrual_modal.auto_extracted', 'Szövegből felismerve')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t('invoices:accrual_modal.period_start', 'Időszak kezdete:')}</span>
                <DatePicker
                  value={startDate}
                  allowInput={true}
                  onChange={(val) => setStartDate(val || '')}
                  placeholder="ÉÉÉÉ-HH-NN"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{t('invoices:accrual_modal.period_end', 'Időszak vége:')}</span>
                <DatePicker
                  value={endDate}
                  allowInput={true}
                  onChange={(val) => setEndDate(val || '')}
                  placeholder="ÉÉÉÉ-HH-NN"
                />
              </div>
            </div>
          </div>

          {/* Method toggle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">{t('invoices:accrual_modal.calc_method', 'Kalkulációs módszer')}</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMethod('monthly')}
                className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  method === 'monthly'
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-background hover:bg-muted/40 border-border/60 text-muted-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {t('invoices:accrual_modal.method_monthly', 'Hónaparányos (hó)')}
              </button>
              <button
                type="button"
                onClick={() => setMethod('daily')}
                className={`flex items-center justify-center gap-2 p-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                  method === 'daily'
                    ? 'bg-primary/10 border-primary text-primary shadow-xs'
                    : 'bg-background hover:bg-muted/40 border-border/60 text-muted-foreground'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                {t('invoices:accrual_modal.method_daily', 'Exakt naparányos (nap)')}
              </button>
            </div>
          </div>

          {/* Live Calculation Results Card */}
          {splitResult && splitResult.hasCrossYearOverlap ? (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-3 min-w-0 overflow-hidden">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-purple-500/20">
                <span className="font-semibold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 text-purple-600" />
                  {t('invoices:accrual_modal.calc_result', 'Kalkuláció eredménye')}
                </span>
                <span className="font-mono text-muted-foreground text-[11px]">
                  {method === 'daily'
                    ? t('invoices:accrual_modal.days_total', { days: splitResult.totalDays, defaultValue: `${splitResult.totalDays} nap összesen` })
                    : t('invoices:accrual_modal.months_total', { months: splitResult.totalMonths, defaultValue: `${splitResult.totalMonths} hónap összesen` })}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs min-w-0">
                {/* Current year */}
                <div className="bg-background/80 p-2.5 rounded-lg border border-border/50 min-w-0">
                  <span className="text-[11px] text-muted-foreground block truncate">
                    {direction === 'INBOUND'
                      ? t('invoices:accrual_modal.current_year_cost', { year: startYear, defaultValue: `${startYear}. évi költség:` })
                      : t('invoices:accrual_modal.current_year_revenue', { year: startYear, defaultValue: `${startYear}. évi bevétel:` })}
                  </span>
                  <span className="font-mono text-base font-bold text-foreground block truncate">
                    {formatCurrency(splitResult.currentPeriodAmount, currency)}
                  </span>
                  <span className="text-[10px] text-muted-foreground block mt-0.5 truncate">
                    {method === 'daily'
                      ? t('invoices:accrual_modal.current_year_days', { days: splitResult.currentPeriodDays, year: startYear, defaultValue: `${splitResult.currentPeriodDays} nap (${startYear}. dec. 31-ig)` })
                      : t('invoices:accrual_modal.current_year_months', { months: splitResult.currentPeriodMonths, defaultValue: `${splitResult.currentPeriodMonths} hónap` })}
                  </span>
                </div>

                {/* Accrued / Next year */}
                <div className="bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/30 min-w-0">
                  <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold block truncate">
                    {t('invoices:accrual_modal.accrued_year_label', { year: endYear, defaultValue: `${endYear}. évi elhatárolás:` })}
                  </span>
                  <span className="font-mono text-base font-bold text-purple-700 dark:text-purple-300 block truncate">
                    {formatCurrency(splitResult.accrualAmount, currency)}
                  </span>
                  <span className="text-[10px] text-purple-600/80 dark:text-purple-400 block mt-0.5 truncate">
                    {method === 'daily'
                      ? t('invoices:accrual_modal.accrued_year_days', { days: splitResult.nextPeriodDays, year: endYear, defaultValue: `${splitResult.nextPeriodDays} nap (${endYear}. évre)` })
                      : t('invoices:accrual_modal.accrued_year_months', { months: splitResult.nextPeriodMonths, defaultValue: `${splitResult.nextPeriodMonths} hónap` })}
                  </span>
                </div>
              </div>

              {/* Accounting details & suggested accounts */}
              <div className="pt-2 border-t border-purple-500/20 space-y-2 text-xs min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('invoices:accrual_modal.turnover_date', 'Elhatárolási fordulónap:')}</span>
                  <span className="font-mono font-semibold">{splitResult.accrualDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t('invoices:accrual_modal.reversal_date', 'Feloldási dátum:')}</span>
                  <span className="font-mono font-semibold">{splitResult.reversalDate}</span>
                </div>

                {/* GL Selector for Accrual Account */}
                <div className="space-y-1.5 pt-1 min-w-0">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">{t('invoices:accrual_modal.accrual_gl_account', 'Elhatárolási főkönyvi számla:')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {direction === 'INBOUND' ? t('invoices:accrual_modal.aie_group', 'AIE (39-es számlacsoport)') : t('invoices:accrual_modal.pie_group', 'PIE (48-as számlacsoport)')}
                    </span>
                  </div>
                  <div className="relative min-w-0">
                    <select
                      value={selectedAccrualGlId}
                      onChange={(e) => setSelectedAccrualGlId(e.target.value)}
                      className="w-full h-8 text-xs font-mono font-medium px-2.5 py-1 rounded bg-background border border-border/80 text-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none truncate cursor-pointer shadow-xs"
                    >
                      {accrualGlOptions.map(g => (
                        <option key={g.id} value={g.id} className="font-mono text-xs">
                          {g.gl_number} — {g.short_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Visual Debit -> Credit Preview */}
                <div className="p-2.5 rounded-lg bg-background/90 border border-border/60 flex items-center justify-between font-mono text-xs mt-2 min-w-0 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-bold text-primary shrink-0">T:</span>
                    <span className="truncate">{direction === 'INBOUND' ? (selectedAccrualGlAccount?.gl_number || '392') : itemGlNumber}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mx-2" />
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="font-bold text-primary shrink-0">K:</span>
                    <span className="truncate">{direction === 'INBOUND' ? itemGlNumber : (selectedAccrualGlAccount?.gl_number || '481')}</span>
                  </div>
                  <Badge variant="secondary" className="ml-auto font-mono font-bold text-[11px] shrink-0">
                    {formatCurrency(splitResult.accrualAmount, currency)}
                  </Badge>
                </div>
              </div>
            </div>
          ) : splitResult && !splitResult.hasCrossYearOverlap ? (
            <div className="p-4 rounded-lg border border-border/60 bg-muted/10 text-center space-y-1">
              <Info className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-medium">{t('invoices:accrual_modal.no_overlap_title', 'A megadott időszak teljes egészében a tárgyévre esik.')}</p>
              <p className="text-[11px] text-muted-foreground">
                {t('invoices:accrual_modal.no_overlap_desc', 'Nem szükséges év végi időbeli elhatárolást képezni, mert nincs évváltó átnyúlás.')}
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border/50 shrink-0 flex-row items-center justify-between bg-muted/10">
          <div className="flex flex-col text-left">
            <span className="text-[11px] text-muted-foreground">{t('invoices:accrual_modal.accrual_amount_label', 'Elhatárolandó összeg:')}</span>
            <span className="font-mono text-sm font-bold text-purple-700 dark:text-purple-300 tabular-nums">
              {splitResult && splitResult.hasCrossYearOverlap
                ? formatCurrency(splitResult.accrualAmount, currency)
                : formatCurrency(0, currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t('invoices:accrual_modal.btn_cancel', 'Mégse')}
            </Button>
            <Button
              type="button"
              disabled={isSubmitting || !splitResult || !splitResult.hasCrossYearOverlap || splitResult.accrualAmount <= 0}
              onClick={handleSaveAccrual}
              className="min-w-[150px] gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-sm tabular-nums"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('invoices:accrual_modal.btn_submitting', 'Könyvelés...')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t('invoices:accrual_modal.btn_book', 'Elhatárolás könyvelése')}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
