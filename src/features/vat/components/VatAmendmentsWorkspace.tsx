import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  ShieldCheck,
  History,
  FileDiff,
  Calculator,
  ArrowRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Percent,
  Clock,
  Sparkles,
  Lock,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatThousands, type VatFrequency } from '../types';
import {
  fetchVatSnapshots,
  compareCurrentInvoicesWithSnapshot,
  createVatSnapshot,
  type AccountyVatSnapshot,
  type InvoiceDiffResult,
} from '../services/vatSnapshotService';
import {
  calculateSelfRevisionPenalty,
  calculateStatutoryDueDate,
  formatHuf,
} from '../utils/penaltyCalculator';
import { VatXmlExportModal } from './VatXmlExportModal';

interface VatAmendmentsWorkspaceProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: VatFrequency;
  lines?: any[];
  mLines?: any[];
  vatCalculationResult?: any;
}

export function VatAmendmentsWorkspace({
  selectedCompany,
  year,
  month,
  frequency,
  lines = [],
  mLines = [],
  vatCalculationResult,
}: VatAmendmentsWorkspaceProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSubTab, setActiveSubTab] = useState<'diff' | 'penalty' | 'snapshots'>('diff');
  const [xmlModalOpen, setXmlModalOpen] = useState(false);
  const [isSealing, setIsSealing] = useState(false);

  // 1. Fetch existing snapshots for this period
  const {
    data: snapshots = [],
    isLoading: isLoadingSnapshots,
    refetch: refetchSnapshots,
  } = useQuery<AccountyVatSnapshot[]>({
    queryKey: ['vat_snapshots', selectedCompany?.id, year, month, frequency],
    queryFn: () => fetchVatSnapshots(selectedCompany.id, year, month, frequency),
    enabled: !!selectedCompany?.id,
  });

  // 2. Compute on-demand diffs against the latest snapshot
  const {
    data: diffAnalysis,
    isLoading: isLoadingDiffs,
    refetch: refetchDiffs,
  } = useQuery({
    queryKey: ['vat_snapshot_diffs', selectedCompany?.id, year, month, frequency, snapshots.length],
    queryFn: () => compareCurrentInvoicesWithSnapshot(selectedCompany.id, year, month, frequency),
    enabled: !!selectedCompany?.id && snapshots.length > 0,
  });

  const latestSnapshot = snapshots[0] || null;
  const hasSnapshot = !!latestSnapshot;
  const diffs = useMemo(() => diffAnalysis?.diffs || [], [diffAnalysis?.diffs]);
  const hasDiffs = (diffAnalysis?.hasDifferences && diffs.length > 0) || false;
  const [calculationDate] = useState(() => new Date());

  // Aggregate difference numbers
  const diffTotals = useMemo(() => {
    let taxBaseDiff = 0;
    let taxAmountDiff = 0;
    let lateEntriesCount = 0;
    let modifiedCount = 0;
    let deletedCount = 0;

    diffs.forEach((d) => {
      taxBaseDiff += d.taxBaseDiff;
      taxAmountDiff += d.taxAmountDiff;
      if (d.changeType === 'late_entry') lateEntriesCount += 1;
      else if (d.changeType === 'modified') modifiedCount += 1;
      else if (d.changeType === 'deleted') deletedCount += 1;
    });

    return {
      taxBaseDiff,
      taxAmountDiff,
      lateEntriesCount,
      modifiedCount,
      deletedCount,
    };
  }, [diffs]);

  // Art. 211. § Self-revision penalty calculation
  const penaltyResult = useMemo(() => {
    if (!latestSnapshot) return null;

    const isRepeated = latestSnapshot.version_number > 1;

    return calculateSelfRevisionPenalty({
      year,
      month,
      periodYear: year,
      periodMonth: month,
      frequency,
      taxDifferenceHuf: diffTotals.taxAmountDiff,
      filingDate: calculationDate,
      selfRevisionDate: calculationDate,
      revisionOrder: isRepeated ? 2 : 1,
      isRepeatedRevision: isRepeated,
    });
  }, [latestSnapshot, year, month, frequency, diffTotals.taxAmountDiff, calculationDate]);

  // Handle sealing a new self-revision snapshot (e.g. v1.1, v1.2)
  const handleSealRevisionSnapshot = async () => {
    if (!selectedCompany?.id) return;
    setIsSealing(true);
    try {
      const nextVersionNumber = (latestSnapshot?.version_number || 1) + 1;
      await createVatSnapshot({
        companyId: selectedCompany.id,
        year,
        month,
        periodYear: year,
        periodMonth: month,
        frequency,
        versionNumber: nextVersionNumber,
        versionType: 'SELF_REVISION',
        versionLabel: `v1.${nextVersionNumber - 1} (${nextVersionNumber - 1}. Önellenőrzés)`,
        taxBasePayable: Number(vatCalculationResult?.taxBasePayable) || 0,
        taxPayable: Number(vatCalculationResult?.taxPayable) || 0,
        taxBaseDeductible: Number(vatCalculationResult?.taxBaseDeductible) || 0,
        taxDeductible: Number(vatCalculationResult?.taxDeductible) || 0,
        snapshotPayload: {
          vatCalculationResult: vatCalculationResult || {},
          lines,
          mLines,
          diffTotals,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ['vat_snapshots'] });
      await queryClient.invalidateQueries({ queryKey: ['vat_snapshot_diffs'] });
      toast({
        title: 'Önellenőrzési Snapshot zárolva',
        description: `Az új verzió (v1.${nextVersionNumber - 1}) mentésre került, a módosítási lista lezárult.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a zárolás során',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSealing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* ── Top Header Card ── */}
      <Card className="border border-border/80 shadow-sm bg-gradient-to-r from-card via-muted/20 to-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-xl border shadow-2xs',
                  !hasSnapshot
                    ? 'bg-muted/50 border-border text-muted-foreground'
                    : hasDiffs
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                )}
              >
                {hasDiffs ? (
                  <ShieldAlert className="h-6 w-6" />
                ) : (
                  <ShieldCheck className="h-6 w-6" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold">
                    Változásvédelem & Önellenőrzési Munkaterület
                  </CardTitle>
                  <Badge variant="outline" className="font-mono text-xs">
                    {year}. {frequency === 'H' ? `${month}. hó` : frequency === 'N' ? `Q${month}` : 'Éves'}
                  </Badge>
                  {hasSnapshot && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs font-mono border',
                        hasDiffs
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                      )}
                    >
                      {hasDiffs ? '⚠️ Önellenőrzésre vár' : '● Változatlan analitika'}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                  A zárolt ÁFA időszak utólagos bizonylat-módosításainak felügyelete, automatikus 1-kattintásos diff összehasonlító,
                  és az Art. (2017. évi CLI. tv. 211. §) szerinti önellenőrzési pótlék kalkulátor.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  refetchSnapshots();
                  refetchDiffs();
                }}
                className="gap-1.5 h-8 text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Frissítés
              </Button>
              {hasDiffs && (
                <Button
                  size="sm"
                  onClick={() => setXmlModalOpen(true)}
                  className="gap-1.5 h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  65H Helyesbítő XML
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {hasSnapshot && (
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium block">Aktuális Snapshot</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-bold font-mono text-foreground">
                    v{latestSnapshot.version_number}.0
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({(latestSnapshot.version_type || '').toLowerCase() === 'original' ? 'Eredeti beadás' : 'Önellenőrzés'})
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono block mt-0.5 truncate" title={latestSnapshot.snapshot_hash_sha256 || ''}>
                  SHA: {latestSnapshot.snapshot_hash_sha256 ? `${latestSnapshot.snapshot_hash_sha256.slice(0, 14)}...` : '—'}
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium block">Zárolt fizetendő ÁFA</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-lg font-bold font-mono text-foreground">
                    {formatThousands(latestSnapshot.tax_payable)} Ft
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Levonható: {formatThousands(latestSnapshot.tax_deductible)} Ft
                </span>
              </div>

              <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium block">Utólagos ÁFA eltérés</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span
                    className={cn(
                      'text-lg font-bold font-mono',
                      diffTotals.taxAmountDiff > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : diffTotals.taxAmountDiff < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {diffTotals.taxAmountDiff > 0 ? '+' : ''}
                    {formatThousands(diffTotals.taxAmountDiff)} Ft
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground block mt-0.5">
                  Adóalap: {diffTotals.taxBaseDiff > 0 ? '+' : ''}
                  {formatThousands(diffTotals.taxBaseDiff)} Ft
                </span>
              </div>

              <div
                className={cn(
                  'p-3 rounded-lg border shadow-2xs flex flex-col justify-between',
                  penaltyResult && penaltyResult.penaltyAmountHuf > 0
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                )}
              >
                <span className="text-[11px] font-medium block">Art. Önellenőrzési Pótlék</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-xl font-bold font-mono">
                    {penaltyResult ? formatHuf(penaltyResult.penaltyAmountHuf) : '0 Ft'}
                  </span>
                </div>
                <span className="text-[10px] opacity-80 block mt-0.5">
                  {penaltyResult ? `${penaltyResult.delayDays} nap késedelem (${penaltyResult.baseInterestRatePercent}% MNB)` : 'Nincs pótlékfizetési kötelezettség'}
                </span>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── If No Snapshot Exists Yet ── */}
      {!hasSnapshot && !isLoadingSnapshots && (
        <Card className="border border-dashed border-border/80 bg-muted/20">
          <CardContent className="py-12 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm font-bold text-foreground">
                Ehhez az ÁFA időszakhoz még nem készült lezárt Snapshot
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A változásvédelem és a diff-alapú önellenőrzési motor automatikusan aktiválódik, amint az ÁFA bevallás főlapján
                a <strong>„Beadva / Zárolás pecsét”</strong> gombra kattintva lezárja az eredeti bevallást (v1.0).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Main Work Area (Only when snapshot exists) ── */}
      {hasSnapshot && (
        <div className="space-y-4">
          {/* Sub-view switcher */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setActiveSubTab('diff')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  activeSubTab === 'diff'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <FileDiff className="w-3.5 h-3.5" />
                Önellenőrzési Diff Nézet
                {diffs.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0 bg-amber-500/20 text-amber-700">
                    {diffs.length}
                  </Badge>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('penalty')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  activeSubTab === 'penalty'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Calculator className="w-3.5 h-3.5" />
                Art. 211. § Pótlék Kalkulátor
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab('snapshots')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  activeSubTab === 'snapshots'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <History className="w-3.5 h-3.5" />
                Verziótörténet ({snapshots.length})
              </button>
            </div>

            {hasDiffs && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isSealing}
                onClick={handleSealRevisionSnapshot}
                className="gap-1.5 h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Lock className="w-3.5 h-3.5" />
                Önellenőrzési Snapshot Zárolása (v{latestSnapshot.version_number + 1}.0)
              </Button>
            )}
          </div>

          {/* ── Sub-tab 1: DIFF VIEW ── */}
          {activeSubTab === 'diff' && (
            <Card className="border border-border/80 shadow-sm overflow-hidden">
              <CardHeader className="py-3 px-4 bg-muted/20 border-b">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-bold flex items-center gap-2">
                      Eredeti Snapshot (v{latestSnapshot.version_number}.0) ⟷ Aktuális Könyvelési Állapot
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      A rendszer tételesen összevetette a zárolt bizonylatokat az adatbázis jelenlegi számláival.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> Utólagos: {diffTotals.lateEntriesCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> Módosult: {diffTotals.modifiedCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-600">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> Törölt/Storno: {diffTotals.deletedCount}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {diffs.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Tökéletes egyezés — Nincs utólagos eltérés
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      A lezárt időszakhoz nem rögzítettek új bizonylatot, és a korábbi számlák összege sem változott meg.
                      A bevallás stabil és auditbiztos.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 text-xs">
                          <TableHead className="w-28">Változás jellege</TableHead>
                          <TableHead>Számlaszám</TableHead>
                          <TableHead>Partner</TableHead>
                          <TableHead className="w-24">Irány</TableHead>
                          <TableHead className="text-right w-28">Eredeti Adóalap</TableHead>
                          <TableHead className="text-right w-28">Aktuális Adóalap</TableHead>
                          <TableHead className="text-right w-28">Adóalap Eltérés</TableHead>
                          <TableHead className="text-right w-28">ÁFA Eltérés</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {diffs.map((d, idx) => {
                          const isLate = d.changeType === 'late_entry';
                          const isMod = d.changeType === 'modified';
                          const isDel = d.changeType === 'deleted';

                          return (
                            <TableRow key={d.invoiceNumber + '_' + idx} className="text-xs hover:bg-muted/30">
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'text-[10px] font-semibold uppercase',
                                    isLate
                                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                      : isMod
                                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                      : 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                                  )}
                                >
                                  {isLate ? '+ Utólagos' : isMod ? '● Módosult' : '✕ Törölt/Storno'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-mono font-medium">
                                {d.invoiceNumber}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5">
                                  <p className="font-medium truncate max-w-[160px]">{d.partnerName || '—'}</p>
                                  <p className="text-[10px] font-mono text-muted-foreground">{d.partnerTaxNumber || '—'}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  {d.direction === 'OUTBOUND' ? 'Kimenő (Fizetendő)' : 'Bejövő (Levonható)'}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-muted-foreground">
                                {formatThousands(d.snapshotTaxBase)} Ft
                              </TableCell>
                              <TableCell className="text-right font-mono font-medium text-foreground">
                                {formatThousands(d.currentTaxBase)} Ft
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-mono font-semibold',
                                  d.taxBaseDiff > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : d.taxBaseDiff < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {d.taxBaseDiff > 0 ? '+' : ''}
                                {formatThousands(d.taxBaseDiff)} Ft
                              </TableCell>
                              <TableCell
                                className={cn(
                                  'text-right font-mono font-bold',
                                  d.taxAmountDiff > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : d.taxAmountDiff < 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-muted-foreground'
                                )}
                              >
                                {d.taxAmountDiff > 0 ? '+' : ''}
                                {formatThousands(d.taxAmountDiff)} Ft
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
          )}

          {/* ── Sub-tab 2: PENALTY CALCULATOR ── */}
          {activeSubTab === 'penalty' && penaltyResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border border-border/80 shadow-sm p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Törvényi Esedékesség</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-foreground">
                    {penaltyResult.dueDate}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Az érintett időszakra vonatkozó eredeti ÁFA bevallási és befizetési határidő (hétvégi eltolódással).
                  </p>
                </Card>

                <Card className="border border-border/80 shadow-sm p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs font-medium">Késedelem Időtartama</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400">
                    {penaltyResult.delayDays} nap
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Az esedékességet követő naptól ({penaltyResult.dueDate} óta) a mai önellenőrzési napig.
                  </p>
                </Card>

                <Card className="border border-border/80 shadow-sm p-4 space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Percent className="w-4 h-4" />
                    <span className="text-xs font-medium">Alkalmazott Kamatkulcs</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-foreground">
                    {(penaltyResult.baseInterestRatePercent * penaltyResult.multiplier).toFixed(2)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    MNB alapkamat ({penaltyResult.baseInterestRatePercent}%) {penaltyResult.multiplier * 100}%-a{' '}
                    ({penaltyResult.multiplier === 1.0 ? 'Ismételt önellenőrzés' : 'Első önellenőrzés'}).
                  </p>
                </Card>
              </div>

              {/* Detailed calculation breakdown card */}
              <Card className="border border-border/80 shadow-sm p-5 space-y-4 bg-muted/10">
                <div className="flex items-center justify-between border-b pb-3">
                  <h4 className="text-xs font-bold flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-primary" />
                    Önellenőrzési Pótlék Levezetése (Art. 211. §)
                  </h4>
                  <Badge variant="outline" className="text-xs font-mono">
                    2017. évi CLI. törvény
                  </Badge>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Pótlólagosan fizetendő ÁFA különbözet:</span>
                    <span className="font-mono font-bold text-foreground">
                      {formatThousands(Math.max(0, penaltyResult.taxDifferenceHuf))} Ft
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Alkalmazott számítási képlet:</span>
                    <span className="font-mono text-muted-foreground">
                      ÁFA különbözet × (Alapkamat × {penaltyResult.multiplier * 100}%) × (Késedelmi napok / 365)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 border-b border-border/40">
                    <span className="text-muted-foreground">Számítási levezetés:</span>
                    <span className="font-mono text-foreground">
                      {formatThousands(Math.max(0, penaltyResult.taxDifferenceHuf))} × {(penaltyResult.baseInterestRatePercent * penaltyResult.multiplier).toFixed(2)}% × ({penaltyResult.delayDays} / 365)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 pt-3">
                    <span className="font-semibold text-foreground text-sm">Fizetendő Önellenőrzési Pótlék:</span>
                    <span className="font-mono font-bold text-lg text-primary">
                      {formatHuf(penaltyResult.penaltyAmountHuf)}
                    </span>
                  </div>
                </div>

                {penaltyResult.taxDifferenceHuf <= 0 && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs">
                    ℹ️ Az önellenőrzés az adózó javára mutat eltérést vagy nem eredményez pótlólagos adófizetést,
                    így az Art. 211. § alapján önellenőrzési pótlékot nem kell fizetni!
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ── Sub-tab 3: SNAPSHOT HISTORY ── */}
          {activeSubTab === 'snapshots' && (
            <Card className="border border-border/80 shadow-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 text-xs">
                    <TableHead className="w-24">Verzió</TableHead>
                    <TableHead>Típus</TableHead>
                    <TableHead>Zárolás időpontja</TableHead>
                    <TableHead className="text-right">Fizetendő ÁFA</TableHead>
                    <TableHead className="text-right">Levonható ÁFA</TableHead>
                    <TableHead className="text-right">Egyenleg</TableHead>
                    <TableHead>Kriptográfiai SHA-256 Hash</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {snapshots.map((s) => (
                    <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-bold">
                        v{s.version_number}.0
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            s.version_type === 'ORIGINAL'
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          )}
                        >
                          {(s.version_type || '').toLowerCase() === 'original' ? 'Eredeti leadás' : 'Önellenőrzés'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString('hu-HU') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatThousands(s.tax_payable)} Ft
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatThousands(s.tax_deductible)} Ft
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {formatThousands(s.net_vat_position)} Ft
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]" title={s.snapshot_hash_sha256 || ''}>
                        {s.snapshot_hash_sha256 || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {/* ── ÁNYK 65H Export Dialog ── */}
      <VatXmlExportModal
        open={xmlModalOpen}
        onOpenChange={setXmlModalOpen}
        selectedCompany={selectedCompany}
        year={year}
        month={month}
        frequency={frequency}
        lines={lines}
        mLines={mLines}
        formKind="65"
      />
    </div>
  );
}
