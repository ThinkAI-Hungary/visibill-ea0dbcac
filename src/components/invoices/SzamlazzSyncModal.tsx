import React, { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useSzamlazzStatus, useSyncSzamlazzOutbound, SzamlazzSyncResultItem } from '@/hooks/useSzamlazzSync';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldAlert,
  Loader2,
  StopCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface SzamlazzSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
}

type SyncPhase = 'idle' | 'running' | 'paused' | 'done' | 'error';

export const SzamlazzSyncModal: React.FC<SzamlazzSyncModalProps> = ({
  open,
  onOpenChange,
  companyId,
  companyName,
}) => {
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useSzamlazzStatus(companyId);
  const syncMutation = useSyncSzamlazzOutbound(companyId);

  const [phase, setPhase] = useState<SyncPhase>('idle');
  const [downloadedTotal, setDownloadedTotal] = useState(0);
  const [initialPending, setInitialPending] = useState(0);
  const [processedLog, setProcessedLog] = useState<SzamlazzSyncResultItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stopRequestedRef = useRef(false);

  const resetState = useCallback(() => {
    setPhase('idle');
    setDownloadedTotal(0);
    setInitialPending(0);
    setProcessedLog([]);
    setErrorMessage(null);
    stopRequestedRef.current = false;
  }, []);

  const handleClose = useCallback(() => {
    if (phase === 'running') {
      stopRequestedRef.current = true;
    }
    resetState();
    onOpenChange(false);
  }, [phase, onOpenChange, resetState]);

  const handleStartSync = useCallback(async () => {
    if (!status?.pendingCount) return;

    setPhase('running');
    setErrorMessage(null);
    stopRequestedRef.current = false;

    const startPending = initialPending || status.pendingCount;
    if (!initialPending) setInitialPending(startPending);

    let accumulatedDownloaded = downloadedTotal;

    try {
      while (!stopRequestedRef.current) {
        // Run batch of 10
        const result = await syncMutation.mutateAsync({ limit: 10 });
        accumulatedDownloaded += result.downloaded;
        setDownloadedTotal(accumulatedDownloaded);

        if (result.results && result.results.length > 0) {
          setProcessedLog((prev) => [...result.results, ...prev].slice(0, 50));
        }

        // If no more pending or stop requested
        if (result.remaining <= 0 || result.downloaded === 0 || stopRequestedRef.current) {
          break;
        }

        // Small pause between batches for smooth UI and API friendliness
        await new Promise((r) => setTimeout(r, 400));
      }

      await refetchStatus();

      if (stopRequestedRef.current) {
        setPhase('paused');
      } else {
        setPhase('done');
      }
    } catch (err: any) {
      console.error('Számlázz sync error:', err);
      setErrorMessage(err.message || 'Hiba történt a szinkronizáció során.');
      setPhase('error');
    }
  }, [status, initialPending, downloadedTotal, syncMutation, refetchStatus]);

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    setPhase('paused');
  }, []);

  const progressPercent = initialPending > 0
    ? Math.min(100, Math.round((downloadedTotal / initialPending) * 100))
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl p-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="p-6 pb-4 border-b bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600/10 dark:bg-blue-400/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                Számlázz.hu Kimenő Számlakép Szinkron
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                {companyName || 'Kiválasztott cég'} saját kiállítású kimenő számláinak hivatalos PDF számlaképe
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Status Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border bg-card/50 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-medium text-muted-foreground">Kimenő számlák</span>
              <span className="text-2xl font-bold text-foreground mt-1">
                {statusLoading ? '...' : status?.totalOutbound ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-lg border bg-card/50 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Számlaképpel</span>
              <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {statusLoading ? '...' : status?.withImageCount ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-lg border bg-card/50 flex flex-col items-center justify-center text-center">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Hiányzó kép</span>
              <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {statusLoading ? '...' : status?.pendingCount ?? 0}
              </span>
            </div>
          </div>

          {/* Missing Agent Key Warning */}
          {!statusLoading && !status?.hasAgentKey && (
            <div className="p-4 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-500/10 flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Nincs beállított Számlázz.hu Agent kulcs
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  A számlák automatikus letöltéséhez szükség van a Számlázz.hu Számla Agent kulcsra. Ezt az Integrációk menüpontban tudod megadni.
                </p>
                <div className="pt-2">
                  <Link
                    to="/integrations"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => onOpenChange(false)}
                  >
                    Megnyitás az Integrációkban
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* All Up to Date Banner */}
          {!statusLoading && status?.hasAgentKey && status.pendingCount === 0 && phase === 'idle' && (
            <div className="p-4 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/10 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-900 dark:text-emerald-200">
                  Minden kimenő számla rendelkezik számlaképpel!
                </p>
                <p className="text-xs text-muted-foreground">
                  Nincs letöltésre váró hiányzó bizonylat.
                </p>
              </div>
            </div>
          )}

          {/* Active Running / Paused Progress View */}
          {(phase === 'running' || phase === 'paused' || phase === 'done') && (
            <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium flex items-center gap-2">
                  {phase === 'running' && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                  {phase === 'paused' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  {phase === 'done' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {phase === 'running' ? 'Számlaképek letöltése folyamatban...' : phase === 'paused' ? 'Szinkron szüneteltetve' : 'Szinkronizáció befejeződött!'}
                </span>
                <span className="font-semibold text-xs text-muted-foreground">
                  {downloadedTotal} / {initialPending} ({progressPercent}%)
                </span>
              </div>

              <Progress value={progressPercent} className="h-2.5" />

              {/* Recent Log Items */}
              {processedLog.length > 0 && (
                <div className="pt-2">
                  <span className="text-xs font-medium text-muted-foreground block mb-1.5">
                    Legutóbb letöltött számlák:
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {processedLog.slice(0, 10).map((item, idx) => (
                      <div
                        key={`${item.invoiceNumber}-${idx}`}
                        className="text-xs p-1.5 rounded bg-background border flex items-center justify-between"
                      >
                        <span className="font-mono font-medium">{item.invoiceNumber}</span>
                        {item.success ? (
                          <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200">
                            Letöltve
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200">
                            {item.error || 'Nincs kép'}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {phase === 'error' && errorMessage && (
            <div className="p-3.5 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-500/10 text-sm text-red-600 dark:text-red-400">
              <p className="font-semibold text-xs">Hiba történt:</p>
              <p className="text-xs mt-0.5">{errorMessage}</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/10 gap-2 sm:gap-0 flex-row justify-between items-center">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            {phase === 'done' ? 'Bezárás' : 'Mégse'}
          </Button>

          <div className="flex items-center gap-2">
            {phase === 'running' && (
              <Button variant="outline" size="sm" onClick={handleStop} className="gap-1.5">
                <StopCircle className="h-4 w-4 text-amber-500" />
                Megállítás
              </Button>
            )}

            {phase === 'paused' && (
              <Button size="sm" onClick={handleStartSync} className="gap-1.5">
                <RefreshCw className="h-4 w-4" />
                Folytatás
              </Button>
            )}

            {(phase === 'idle' || phase === 'error') && status?.hasAgentKey && (status?.pendingCount ?? 0) > 0 && (
              <Button
                size="sm"
                onClick={handleStartSync}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Szinkronizálás indítása ({status?.pendingCount} db)
              </Button>
            )}

            {phase === 'done' && (
              <Button size="sm" onClick={handleClose} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Kész
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
export default SzamlazzSyncModal;
