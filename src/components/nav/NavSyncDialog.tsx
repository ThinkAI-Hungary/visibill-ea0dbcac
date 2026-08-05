import React, { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export interface SyncProgress {
  currentChunk: number;
  totalChunks: number;
  totalInvoices: number;
}

interface NavSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSync: (dateFrom: string, dateTo: string, onProgress?: (progress: SyncProgress) => void) => Promise<void>;
  syncing: boolean;
  canSync: boolean;
  cooldownSeconds: number;
  formatCooldown: (s: number) => string;
}

type PresetKey = '30' | '60' | '90' | 'year' | null;

const PRESETS: { key: PresetKey; label: string; days: number | null }[] = [
  { key: '30', label: '30 nap', days: 30 },
  { key: '60', label: '60 nap', days: 60 },
  { key: '90', label: '90 nap', days: 90 },
  { key: 'year', label: 'Teljes év', days: null },
];

function getPresetDates(key: PresetKey): { from: Date; to: Date } {
  const to = new Date();
  if (key === 'year') {
    const from = new Date(to.getFullYear(), 0, 1); // jan 1
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

export const NavSyncDialog: React.FC<NavSyncDialogProps> = ({
  open,
  onOpenChange,
  onSync,
  syncing,
  canSync,
  cooldownSeconds,
  formatCooldown,
}) => {
  const [activePreset, setActivePreset] = useState<PresetKey>('30');
  const [dateFrom, setDateFrom] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);

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
    setActivePreset(null); // clear preset
    setDateFromOpen(false);
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    if (!date) return;
    setDateTo(date);
    setActivePreset(null);
    setDateToOpen(false);
  }, []);

  const handleSync = useCallback(async () => {
    setProgress({ currentChunk: 0, totalChunks: 0, totalInvoices: 0 });
    try {
      await onSync(formatDateStr(dateFrom), formatDateStr(dateTo), (p) => {
        setProgress(p);
      });
    } finally {
      setProgress(null);
    }
  }, [onSync, dateFrom, dateTo]);

  // Reset state when dialog opens
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (syncing) return; // don't close while syncing
    if (newOpen) {
      // Reset to default
      setActivePreset('30');
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setDateFrom(d);
      setDateTo(new Date());
      setProgress(null);
    }
    onOpenChange(newOpen);
  }, [syncing, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={syncing ? (e) => e.preventDefault() : undefined}
        onEscapeKeyDown={syncing ? (e) => e.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>NAV Szinkronizálás</DialogTitle>
          <DialogDescription>
            Válaszd ki a dátumtartományt a NAV számlák letöltéséhez
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preset buttons */}
          <div className="flex gap-2">
            {PRESETS.map(({ key, label }) => (
              <Button
                key={key}
                variant={activePreset === key ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => handlePresetClick(key)}
                disabled={syncing}
              >
                {label}
              </Button>
            ))}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">vagy egyéni tartomány</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Custom date pickers */}
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Dátum -tól</label>
              <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-start text-left font-normal h-9", !dateFrom && "text-muted-foreground")}
                    disabled={syncing}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateFrom, "yyyy. MMM dd.", { locale: hu })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={handleDateFromChange}
                    disabled={(d) => d > today}
                    locale={hu}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Dátum -ig</label>
              <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("w-full justify-start text-left font-normal h-9", !dateTo && "text-muted-foreground")}
                    disabled={syncing}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dateTo, "yyyy. MMM dd.", { locale: hu })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={handleDateToChange}
                    disabled={(d) => d > today}
                    locale={hu}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Warning for large ranges */}
          {isLargeRange && isValidRange && (
            <div className="flex items-start gap-2 text-xs text-yellow-500 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {totalDays} napos tartomány — a szinkronizálás több percig is eltarthat.
              </span>
            </div>
          )}

          {/* Range error */}
          {!isValidRange && (
            <div className="flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {dateFrom > dateTo
                  ? 'A kezdő dátum nem lehet későbbi, mint a záró dátum.'
                  : 'Maximum 365 napos tartomány választható.'
                }
              </span>
            </div>
          )}

          {/* Progress indicator */}
          {syncing && progress && (
            <div className="rounded-md bg-muted/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">
                  {progress.totalChunks > 0
                    ? `${progress.currentChunk}/${progress.totalChunks} köteg feldolgozva`
                    : 'Előkészítés...'}
                </span>
              </div>
              {progress.totalInvoices > 0 && (
                <p className="text-xs text-muted-foreground pl-6">
                  {progress.totalInvoices} számla eddig
                </p>
              )}
              {progress.totalChunks > 0 && (
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.round((progress.currentChunk / progress.totalChunks) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex flex-col text-left min-w-[160px]">
            <span className="text-xs text-muted-foreground tabular-nums">
              {format(dateFrom, "yyyy. MM. dd.", { locale: hu })} → {format(dateTo, "yyyy. MM. dd.", { locale: hu })}
            </span>
            <span className="text-xs text-muted-foreground">{totalDays} nap</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={syncing}>
              Mégse
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing || !canSync || !isValidRange}
              className="min-w-[140px] justify-center"
            >
              {syncing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Szinkronizálás...
                </>
              ) : !canSync ? (
                `Várj ${formatCooldown(cooldownSeconds)}`
              ) : (
                'Szinkronizálás'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
