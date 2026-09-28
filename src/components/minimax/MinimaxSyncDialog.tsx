import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, AlertTriangle, Building2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu, hr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useTranslation } from 'react-i18next';

export interface MinimaxSyncProgress {
  currentChunk?: number;
  totalChunks?: number;
  totalInvoices?: number;
  statusText?: string;
}

interface MinimaxSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (
    dateFrom: string,
    dateTo: string,
    direction: 'BOTH' | 'OUTBOUND' | 'INBOUND',
    onProgress?: (progress: MinimaxSyncProgress) => void
  ) => Promise<void>;
  syncing: boolean;
  canSync: boolean;
  cooldownSeconds: number;
  formatCooldown: (s: number) => string;
}

type PresetKey = '30' | '60' | '90' | 'year' | null;

function getPresetDates(key: PresetKey): { from: Date; to: Date } {
  const to = new Date();
  if (key === 'year') {
    const from = new Date(to.getFullYear(), 0, 1);
    return { from, to };
  }
  const days = key === '30' ? 30 : key === '60' ? 60 : 90;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, to };
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

export const MinimaxSyncDialog: React.FC<MinimaxSyncDialogProps> = ({
  open,
  onOpenChange,
  onSync,
  syncing,
  canSync,
  cooldownSeconds,
  formatCooldown,
}) => {
  const { t, i18n } = useTranslation(['invoices', 'common']);
  const isHr = i18n.language?.startsWith('hr');
  const currentLocale = isHr ? hr : hu;
  const dateFormat = isHr ? 'dd.MM.yyyy.' : 'yyyy. MMM dd.';

  const presets = useMemo<{ key: PresetKey; label: string; days: number | null }[]>(
    () => [
      { key: '30', label: t('invoices:minimax_sync.preset_30', '30 nap'), days: 30 },
      { key: '60', label: t('invoices:minimax_sync.preset_60', '60 nap'), days: 60 },
      { key: '90', label: t('invoices:minimax_sync.preset_90', '90 nap'), days: 90 },
      { key: 'year', label: t('invoices:minimax_sync.preset_year', 'Teljes év'), days: null },
    ],
    [t]
  );

  const [activePreset, setActivePreset] = useState<PresetKey>('30');
  const [direction, setDirection] = useState<'BOTH' | 'OUTBOUND' | 'INBOUND'>('BOTH');
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [progress, setProgress] = useState<MinimaxSyncProgress | null>(null);

  const today = useMemo(() => new Date(), []);
  const totalDays = useMemo(() => daysBetween(dateFrom, dateTo), [dateFrom, dateTo]);
  const isValidRange = useMemo(() => dateFrom <= dateTo && totalDays <= 365, [dateFrom, dateTo, totalDays]);
  const isLargeRange = totalDays > 90;

  const handlePresetClick = useCallback((key: PresetKey) => {
    setActivePreset(key);
    const { from, to } = getPresetDates(key);
    setDateFrom(from);
    setDateTo(to);
  }, []);

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    if (!date) return;
    setDateFrom(date);
    setActivePreset(null);
    setDateFromOpen(false);
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    if (!date) return;
    setDateTo(date);
    setActivePreset(null);
    setDateToOpen(false);
  }, []);

  const handleStartSync = useCallback(async () => {
    setProgress({ statusText: t('invoices:minimax_sync.syncing_status', 'Minimax kapcsolat ellenőrzése...') });
    try {
      await onSync(formatDateStr(dateFrom), formatDateStr(dateTo), direction, (p) => {
        setProgress(p);
      });
    } finally {
      setProgress(null);
    }
  }, [onSync, dateFrom, dateTo, direction, t]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (syncing) return;
      if (newOpen) {
        setActivePreset('30');
        const d = new Date();
        d.setDate(d.getDate() - 30);
        setDateFrom(d);
        setDateTo(new Date());
        setProgress(null);
      }
      onOpenChange(newOpen);
    },
    [syncing, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={syncing ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={syncing ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
            <Building2 className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {t('invoices:minimax_sync.jurisdiction_badge', 'Horvát Lokalizáció')}
            </span>
          </div>
          <DialogTitle>{t('invoices:minimax_sync.dialog_title', 'Minimax Számlaszinkronizálás')}</DialogTitle>
          <DialogDescription>
            {t('invoices:minimax_sync.dialog_subtitle', 'Válaszd ki a dátumtartományt és a számlairányt a Minimax REST API-ból történő letöltéshez.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Irány választás */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('invoices:minimax_sync.direction_label', 'Számla irány')}
            </label>
            <RadioGroup
              value={direction}
              onValueChange={(val) => setDirection(val as any)}
              className="grid grid-cols-3 gap-2"
              disabled={syncing}
            >
              <div>
                <RadioGroupItem value="BOTH" id="dir_both" className="peer sr-only" />
                <Label
                  htmlFor="dir_both"
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-2.5 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-indigo-600 [&:has([data-state=checked])]:border-indigo-600 cursor-pointer text-center text-xs font-medium"
                >
                  {t('invoices:minimax_sync.dir_both', 'Mindkettő')}
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {t('invoices:minimax_sync.dir_both_desc', 'Kimenő + Bejövő')}
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="OUTBOUND" id="dir_out" className="peer sr-only" />
                <Label
                  htmlFor="dir_out"
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-2.5 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-indigo-600 [&:has([data-state=checked])]:border-indigo-600 cursor-pointer text-center text-xs font-medium"
                >
                  {t('invoices:minimax_sync.dir_outbound', 'Kimenő (Izlazni)')}
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {t('invoices:minimax_sync.dir_outbound_desc', 'Vevői számlák')}
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem value="INBOUND" id="dir_in" className="peer sr-only" />
                <Label
                  htmlFor="dir_in"
                  className="flex flex-col items-center justify-between rounded-lg border-2 border-muted bg-popover p-2.5 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-indigo-600 [&:has([data-state=checked])]:border-indigo-600 cursor-pointer text-center text-xs font-medium"
                >
                  {t('invoices:minimax_sync.dir_inbound', 'Bejövő (Ulazni)')}
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    {t('invoices:minimax_sync.dir_inbound_desc', 'Szállítói számlák')}
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Dátum gyorsgombok */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('invoices:minimax_sync.period_label', 'Időszak választás')}
            </label>
            <div className="flex gap-2">
              {presets.map(({ key, label }) => (
                <Button
                  key={key}
                  variant={activePreset === key ? 'default' : 'outline'}
                  size="sm"
                  className={cn("flex-1 text-xs", activePreset === key && "bg-indigo-600 hover:bg-indigo-700 text-white")}
                  onClick={() => handlePresetClick(key)}
                  disabled={syncing}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom date pickers */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('invoices:minimax_sync.date_from', 'Dátum -tól')}
              </label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9 text-xs',
                      !dateFrom && 'text-muted-foreground'
                    )}
                    disabled={syncing}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, dateFormat, { locale: currentLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={handleDateFromChange}
                    disabled={(d) => d > today}
                    locale={currentLocale}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t('invoices:minimax_sync.date_to', 'Dátum -ig')}
              </label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9 text-xs',
                      !dateTo && 'text-muted-foreground'
                    )}
                    disabled={syncing}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, dateFormat, { locale: currentLocale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={handleDateToChange}
                    disabled={(d) => d > today}
                    locale={currentLocale}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Large range warning */}
          {isLargeRange && isValidRange && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 p-2.5 rounded-lg border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {t('invoices:minimax_sync.large_range_warning', {
                  days: totalDays,
                  defaultValue: `${totalDays} napos tartomány — a szinkronizálás a számlák mennyiségétől függően eltarthat egy kis ideig.`,
                })}
              </span>
            </div>
          )}

          {/* Invalid range */}
          {!isValidRange && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {dateFrom > dateTo
                  ? t('invoices:minimax_sync.invalid_range_order', 'A kezdő dátum nem lehet későbbi, mint a záró dátum.')
                  : t('invoices:minimax_sync.invalid_range_max', 'Maximum 365 napos tartomány választható.')}
              </span>
            </div>
          )}

          {/* Progress indicator */}
          {syncing && (
            <div className="rounded-lg bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs text-indigo-950 dark:text-indigo-200">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="font-medium">
                  {progress?.statusText || t('invoices:minimax_sync.syncing_status', 'Minimax számlák letöltése és feldolgozása folyamatban...')}
                </span>
              </div>
              {typeof progress?.totalInvoices === 'number' && (
                <p className="text-[11px] text-muted-foreground pl-6">
                  {t('invoices:minimax_sync.invoices_progress', {
                    count: progress.totalInvoices,
                    defaultValue: `${progress.totalInvoices} számla feldolgozva eddig`,
                  })}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-col text-left min-w-[160px]">
            <span className="text-xs text-muted-foreground tabular-nums">
              {format(dateFrom, dateFormat, { locale: currentLocale })} → {format(dateTo, dateFormat, { locale: currentLocale })}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t('invoices:minimax_sync.days_selected', { days: totalDays, defaultValue: `${totalDays} nap kijelölve` })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={syncing}>
              {t('invoices:minimax_sync.cancel_btn', 'Mégse')}
            </Button>
            <Button
              size="sm"
              onClick={handleStartSync}
              disabled={syncing || !canSync || !isValidRange}
              className="min-w-[150px] justify-center bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('invoices:nav_sync.syncing', 'Szinkronizálás...')}
                </>
              ) : !canSync ? (
                t('invoices:nav_sync.wait_cooldown', {
                  time: formatCooldown(cooldownSeconds),
                  defaultValue: `Várj ${formatCooldown(cooldownSeconds)}`,
                })
              ) : (
                t('invoices:minimax_sync.start_sync_btn', 'Szinkronizálás indítása')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
