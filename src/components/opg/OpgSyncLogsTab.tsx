import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Loader2,
  FileText,
} from 'lucide-react';
import type { OpgSyncLog } from '@/types/opg';

interface OpgSyncLogsTabProps {
  logs: OpgSyncLog[];
  isLoading?: boolean;
  onSyncNow: () => Promise<any>;
  isSyncing?: boolean;
}

export const OpgSyncLogsTab: React.FC<OpgSyncLogsTabProps> = ({
  logs,
  isLoading = false,
  onSyncNow,
  isSyncing = false,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs font-normal">
            <CheckCircle2 className="h-3 w-3" /> Sikeres
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1 text-xs font-normal">
            <AlertCircle className="h-3 w-3" /> Részleges
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 text-xs font-normal">
            <AlertCircle className="h-3 w-3" /> Sikertelen
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="secondary" className="gap-1 text-xs font-normal animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" /> Folyamatban
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const fmtDateTime = (isoString?: string | null) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return `${d.toLocaleDateString('hu-HU')} ${d.toLocaleTimeString('hu-HU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  };

  const getDuration = (start: string, end?: string | null) => {
    if (!end) return '-';
    const diffMs = new Date(end).getTime() - new Date(start).getTime();
    if (diffMs < 1000) return `${diffMs} ms`;
    return `${(diffMs / 1000).toFixed(1)} s`;
  };

  return (
    <div className="space-y-4">
      {/* Fejléc */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Szinkronizációs és Audit napló</h3>
          <p className="text-sm text-muted-foreground">
            A NAV OPG gépkapcsolat lekérdezéseinek, nyugta-letöltéseinek és hibáinak története.
          </p>
        </div>

        <Button onClick={onSyncNow} disabled={isSyncing} size="sm" className="gap-2">
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Szinkronizáció indítása most
        </Button>
      </div>

      {/* Napló táblázat */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <div className="p-12 text-center border rounded-xl bg-card">
          <History className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
          <h4 className="text-sm font-semibold">Még nem történt szinkronizáció</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Indítson egy szinkronizációt a NAV bizonylatok lekérdezéséhez.
          </p>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Indítás ideje</TableHead>
                <TableHead>Futásidő</TableHead>
                <TableHead>Érintett pénztárgép</TableHead>
                <TableHead>Státusz</TableHead>
                <TableHead className="text-center">Letöltve</TableHead>
                <TableHead className="text-center">Új bizonylat</TableHead>
                <TableHead className="text-center">Duplikátum kiszűrve</TableHead>
                <TableHead>Hibaüzenet</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-mono whitespace-nowrap">
                    {fmtDateTime(log.started_at)}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">
                    {getDuration(log.started_at, log.finished_at)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {log.cash_register ? (
                      <span className="font-medium">
                        {log.cash_register.name}{' '}
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ({log.cash_register.ap_code})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">Minden pénztárgép</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell className="text-center font-mono text-xs">
                    {log.records_fetched}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-semibold text-emerald-600">
                    +{log.records_new}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs text-muted-foreground">
                    {log.records_duplicated}
                  </TableCell>
                  <TableCell className="text-xs text-destructive max-w-xs truncate">
                    {log.error_message || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
