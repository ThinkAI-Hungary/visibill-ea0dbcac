import React from 'react';
import { AlertTriangle, RefreshCw, History, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AuditExportStalenessInfo } from '@/services/auditorExportService';

interface StalenessWarningBannerProps {
  stalenessInfo: AuditExportStalenessInfo | undefined;
  isLoading: boolean;
  onRefreshStaleness: () => void;
  onGenerateNewSnapshot: () => void;
  onViewDiffLog?: () => void;
}

export function StalenessWarningBanner({
  stalenessInfo,
  isLoading,
  onRefreshStaleness,
  onGenerateNewSnapshot,
  onViewDiffLog,
}: StalenessWarningBannerProps) {
  if (!stalenessInfo || !stalenessInfo.has_export || !stalenessInfo.is_stale) {
    return null;
  }

  const modifiedCount = stalenessInfo.modified_entries_count || 0;
  const lastVersion = stalenessInfo.last_export_version || 'Előző verzió';
  const lastExportDate = stalenessInfo.last_export_at
    ? new Date(stalenessInfo.last_export_at).toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-5 backdrop-blur-md shadow-lg shadow-amber-500/5 animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-amber-950 dark:text-amber-200">
                Figyelem: Az átadott könyvvizsgálói adatállomány elavult (Stale Data Alert)
              </h3>
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 font-mono text-xs">
                ISA 500 Audit Trail
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Az utolsó lezárt könyvvizsgálói export ({lastVersion} — {lastExportDate}) óta{' '}
              <strong className="text-foreground font-semibold">{modifiedCount} darab könyvelési tétel</strong> módosult,
              törlődött vagy újult meg. Az auditoroknak átadott fájl nem tükrözi a főkönyv jelenlegi állapotát!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshStaleness}
            disabled={isLoading}
            className="border-amber-500/30 hover:bg-amber-500/10 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Újraellenőrzés
          </Button>

          {onViewDiffLog && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewDiffLog}
              className="text-xs"
            >
              <History className="h-3.5 w-3.5 mr-1.5" />
              Eltérések naplója
            </Button>
          )}

          <Button
            size="sm"
            onClick={onGenerateNewSnapshot}
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm text-xs font-semibold"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Új verzió pillanatkép rögzítése
          </Button>
        </div>
      </div>
    </div>
  );
}
