/**
 * Reclassification Audit Log & 1-Click Rollback Tab
 * Számviteli törvény (Sztv.) 165-169. § szerinti szigorú audit napló
 * és 1-kattintásos visszagörgetési (V-STV stornó) motor.
 */

import React, { useState } from 'react';
import {
  RotateCcw,
  History,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Search,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  useReclassificationHistory,
  useRollbackReclassification,
} from '@/hooks/useTechnicalAccounting';
import { type ReclassificationRecord } from '@/services/technicalAccountingService';

interface ReclassificationAuditLogTabProps {
  companyId: string;
}

export const ReclassificationAuditLogTab: React.FC<ReclassificationAuditLogTabProps> = ({
  companyId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedForRollback, setSelectedForRollback] = useState<ReclassificationRecord | null>(null);
  const [rollbackReason, setRollbackReason] = useState('');

  const {
    data: history = [],
    isLoading,
    refetch,
    isFetching,
  } = useReclassificationHistory(companyId);

  const rollbackMutation = useRollbackReclassification();

  const filteredHistory = history.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      item.batch_number.toLowerCase().includes(term) ||
      (item.reason && item.reason.toLowerCase().includes(term)) ||
      (item.source_account?.gl_number && item.source_account.gl_number.includes(term)) ||
      (item.target_account?.gl_number && item.target_account.gl_number.includes(term)) ||
      item.status.toLowerCase().includes(term)
    );
  });

  const handleOpenRollback = (item: ReclassificationRecord) => {
    setSelectedForRollback(item);
    setRollbackReason(`Téves átvezetés visszagörgetése (${item.batch_number})`);
  };

  const handleConfirmRollback = async () => {
    if (!selectedForRollback) return;

    await rollbackMutation.mutateAsync({
      companyId,
      reclassificationId: selectedForRollback.id,
      reason: rollbackReason,
    });

    setSelectedForRollback(null);
    setRollbackReason('');
  };

  return (
    <div className="space-y-6">
      {/* Fejléc és Statisztikai összefoglaló */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-500" />
            Átvezetési Audit Napló és Bizonylattörténet
          </h3>
          <p className="text-sm text-muted-foreground">
            A számviteli törvény (Sztv.) előírásainak megfelelően minden technikai korrekció külön
            naplózott, ellenőrizhető és automatikusan sztornózható (V-STV generálás).
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Frissítés
        </Button>
      </div>

      {/* Szűrősáv és Metrikák */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-2 border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés bizonylatszám, főkönyvi szám vagy indoklás alapján..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Összes Átvezetés</div>
            <div className="text-2xl font-bold mt-1">{history.length} db</div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <div className="text-xs text-muted-foreground uppercase font-semibold">Visszagörgetett (Storno)</div>
            <div className="text-2xl font-bold mt-1 text-amber-500">
              {history.filter((h) => h.status === 'ROLLED_BACK').length} db
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Táblázat */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Rögzített Könyvelési Átvezetések</span>
            <Badge variant="outline" className="font-mono text-xs">
              {filteredHistory.length} rekord
            </Badge>
          </CardTitle>
          <CardDescription>
            Kattintson a 'Visszagörgetés' gombra, ha egy átvezetést számvitelileg helyesbítő ellentétes tétellel kíván érvényteleníteni.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <span>Audit napló betöltése...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="font-medium text-foreground">Nem található átvezetési bejegyzés.</p>
              <p className="text-sm mt-1">
                {searchTerm ? 'Nincs a szűrésnek megfelelő tétel.' : 'Még nem történt technikai átvezetés ebben a cégben.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Bizonylat / Kötegszám</TableHead>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Forrás Számla</TableHead>
                    <TableHead className="w-[40px] text-center"></TableHead>
                    <TableHead>Cél Számla</TableHead>
                    <TableHead className="text-right">Tételek</TableHead>
                    <TableHead className="text-right">Összeg</TableHead>
                    <TableHead>Indoklás</TableHead>
                    <TableHead className="text-center">Státusz</TableHead>
                    <TableHead className="text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((item) => {
                    const isRolledBack = item.status === 'ROLLED_BACK';

                    return (
                      <TableRow key={item.id} className={isRolledBack ? 'opacity-70 bg-muted/20' : ''}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-indigo-500" />
                            <span>{item.batch_number}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(item.created_at).toLocaleString('hu-HU')}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs">
                          {item.reclassification_date}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-mono font-medium">
                            {item.source_account?.gl_number || item.source_gl_account_id.slice(0, 8)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {item.source_account?.short_name || 'Forrás'}
                          </div>
                        </TableCell>

                        <TableCell className="text-center text-muted-foreground">
                          <ArrowRight className="h-3.5 w-3.5 inline-block" />
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {item.target_account?.gl_number || item.target_gl_account_id.slice(0, 8)}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                            {item.target_account?.short_name || 'Cél'}
                          </div>
                        </TableCell>

                        <TableCell className="text-right text-xs font-mono">
                          {item.affected_lines_count} db
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs font-bold">
                          {new Intl.NumberFormat('hu-HU', {
                            style: 'currency',
                            currency: item.currency || 'HUF',
                            maximumFractionDigits: 0,
                          }).format(item.total_amount)}
                        </TableCell>

                        <TableCell className="text-xs max-w-[200px] truncate" title={item.reason || ''}>
                          {item.reason || '-'}
                        </TableCell>

                        <TableCell className="text-center">
                          {isRolledBack ? (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px]">
                              <RotateCcw className="h-3 w-3" />
                              Sztornózva
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
                              <CheckCircle2 className="h-3 w-3" />
                              Könyvelt
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {isRolledBack ? (
                            <span className="text-[11px] text-muted-foreground italic">
                              {item.rolled_back_at
                                ? new Date(item.rolled_back_at).toLocaleDateString('hu-HU')
                                : 'Visszagörgetve'}
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenRollback(item)}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 h-7 text-xs gap-1"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Rollback
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Számviteli Garancia Tájékoztató Box */}
      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground">
            Sztv. 165–169. § Audit-védelem és Törlési Tilalom:
          </p>
          <p>
            A rendszer a könyvelt főkönyvi tételeket soha nem törli és nem módosítja felülírással. A
            „Visszagörgetés” (Rollback) művelet egy új, ellentétes előjelű technikai vegyes bizonylatot
            (V-STV) hoz létre azonos összegekkel és hivatkozásokkal, így az ellenőrzési nyomvonal (Audit
            Trail) 100%-ban megmarad a NAV és a könyvvizsgáló számára.
          </p>
        </div>
      </div>

      {/* Rollback Megerősítő Modal */}
      <Dialog
        open={!!selectedForRollback}
        onOpenChange={(open) => {
          if (!open) setSelectedForRollback(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Átvezetés Visszagörgetése (Rollback)
            </DialogTitle>
            <DialogDescription>
              A kiválasztott átvezetést a rendszer egy ellentétes előjelű sztornó bizonylattal (V-STV) fogja
              visszagörgetni.
            </DialogDescription>
          </DialogHeader>

          {selectedForRollback && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eredeti Bizonylatszám:</span>
                  <span className="font-mono font-bold">{selectedForRollback.batch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Érintett tételek száma:</span>
                  <span className="font-mono">{selectedForRollback.affected_lines_count} db</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Átvezetett Összeg:</span>
                  <span className="font-mono font-bold text-foreground">
                    {new Intl.NumberFormat('hu-HU', {
                      style: 'currency',
                      currency: selectedForRollback.currency || 'HUF',
                      maximumFractionDigits: 0,
                    }).format(selectedForRollback.total_amount)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  Sztornózás / Helyesbítés indoklása (Kötelező):
                </label>
                <Textarea
                  placeholder="Kérjük, adja meg a visszagörgetés okát a számviteli auditnyilvántartás számára..."
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="min-h-[80px] text-xs"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-300">
                <Info className="h-4 w-4 shrink-0" />
                <span>
                  A jóváhagyás után azonnal létrejön az automatikus V-STV bizonylat, és a számlaegyenlegek helyreállnak.
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedForRollback(null)}
              disabled={rollbackMutation.isPending}
            >
              Mégse
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmRollback}
              disabled={rollbackMutation.isPending || !rollbackReason.trim()}
              className="gap-1.5"
            >
              {rollbackMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Sztornózás folyamatban...
                </>
              ) : (
                <>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Sztornó Végrehajtása
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
