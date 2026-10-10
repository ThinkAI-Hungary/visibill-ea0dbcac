import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ChevronDown,
  History,
  FileCheck2,
  ShieldAlert,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn, formatCurrency } from '@/lib/utils';
import {
  fetchVatSnapshots,
  compareCurrentInvoicesWithSnapshot,
  createVatSnapshot,
  type VatSnapshotRecord,
  type VatRevisionDiffSummary,
} from '../services/vatSnapshotService';

interface VatReturnVersionHeaderProps {
  className?: string;
  selectedCompany?: any;
  year: number;
  month: number;
  frequency: 'H' | 'N' | 'E';
  vatCalculationResult?: any;
  onJumpToAmendments?: () => void;
  onVersionChange?: (versionNum: number | null) => void;
  // Optional controlled overrides if provided by parent:
  snapshots?: VatSnapshotRecord[];
  selectedVersionNumber?: number | null; // null = latest/draft
  onSelectVersion?: (versionNum: number | null) => void;
  revisionSummary?: VatRevisionDiffSummary;
  isSubmittingSnapshot?: boolean;
  onSubmitSnapshot?: (versionLabel: string) => Promise<void>;
  onNavigateToAmendments?: () => void;
  taxPayable?: number;
  taxDeductible?: number;
}

export function VatReturnVersionHeader({
  className,
  selectedCompany,
  year,
  month,
  frequency,
  vatCalculationResult,
  onJumpToAmendments,
  onVersionChange,
  snapshots: snapshotsProp,
  selectedVersionNumber: selectedVersionNumberProp,
  onSelectVersion: onSelectVersionProp,
  revisionSummary: revisionSummaryProp,
  isSubmittingSnapshot: isSubmittingSnapshotProp,
  onSubmitSnapshot: onSubmitSnapshotProp,
  onNavigateToAmendments: onNavigateToAmendmentsProp,
  taxPayable: taxPayableProp,
  taxDeductible: taxDeductibleProp,
}: VatReturnVersionHeaderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [internalSelectedVersion, setInternalSelectedVersion] = useState<number | null>(null);
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);

  // 1. Fetch snapshots internally if not passed as prop
  const companyId = selectedCompany?.id;
  const { data: fetchedSnapshots = [] } = useQuery<VatSnapshotRecord[]>({
    queryKey: ['vat_snapshots', companyId, year, month, frequency],
    queryFn: () => (companyId ? fetchVatSnapshots(companyId, year, month, frequency) : Promise.resolve([])),
    enabled: !!companyId && !snapshotsProp,
  });

  const snapshots: VatSnapshotRecord[] = useMemo(() => {
    return snapshotsProp || fetchedSnapshots || [];
  }, [snapshotsProp, fetchedSnapshots]);

  // 2. Fetch diff summary internally if not passed as prop
  const { data: diffAnalysis } = useQuery({
    queryKey: ['vat_snapshot_diffs', companyId, year, month, frequency, snapshots.length],
    queryFn: () => (companyId ? compareCurrentInvoicesWithSnapshot(companyId, year, month, frequency) : Promise.resolve(null)),
    enabled: !!companyId && snapshots.length > 0 && !revisionSummaryProp,
  });

  const revisionSummary: VatRevisionDiffSummary = useMemo(() => {
    if (revisionSummaryProp) return revisionSummaryProp;
    if (!diffAnalysis) {
      return {
        hasRevisions: false,
        totalItemsCount: 0,
        totalTaxBaseDiff: 0,
        totalTaxAmountDiff: 0,
        totalPenaltyHuf: 0,
        items: [],
      };
    }
    const diffs = diffAnalysis.diffs || [];
    let taxBaseDiff = 0;
    let taxAmountDiff = 0;
    diffs.forEach((d: any) => {
      taxBaseDiff += d.taxBaseDiff || 0;
      taxAmountDiff += d.taxAmountDiff || 0;
    });
    return {
      hasRevisions: diffAnalysis.hasDifferences && diffs.length > 0,
      totalItemsCount: diffs.length,
      totalTaxBaseDiff: taxBaseDiff,
      totalTaxAmountDiff: taxAmountDiff,
      totalPenaltyHuf: 0,
      items: [],
    };
  }, [revisionSummaryProp, diffAnalysis]);

  const selectedVersionNumber = selectedVersionNumberProp !== undefined
    ? selectedVersionNumberProp
    : internalSelectedVersion;

  const handleSelectVersion = (versionNum: number | null) => {
    if (onSelectVersionProp) {
      onSelectVersionProp(versionNum);
    } else {
      setInternalSelectedVersion(versionNum);
    }
    onVersionChange?.(versionNum);
  };

  const isSubmittingSnapshot = isSubmittingSnapshotProp !== undefined
    ? isSubmittingSnapshotProp
    : internalIsSubmitting;

  const effectiveTaxPayable = 
    taxPayableProp ?? 
    (vatCalculationResult?.total_payable_tax !== undefined ? Number(vatCalculationResult.total_payable_tax) : undefined) ?? 
    (vatCalculationResult?.total_payable_vat !== undefined ? Number(vatCalculationResult.total_payable_vat) : undefined) ?? 
    0;
  const effectiveTaxDeductible = 
    taxDeductibleProp ?? 
    (vatCalculationResult?.total_deductible_tax !== undefined ? Number(vatCalculationResult.total_deductible_tax) : undefined) ?? 
    (vatCalculationResult?.total_deductible_vat !== undefined ? Number(vatCalculationResult.total_deductible_vat) : undefined) ?? 
    0;
  const effectiveTaxBasePayable = 
    (vatCalculationResult?.total_base_payable !== undefined ? Number(vatCalculationResult.total_base_payable) : undefined) ?? 
    (vatCalculationResult?.tax_base_payable !== undefined ? Number(vatCalculationResult.tax_base_payable) : undefined) ?? 
    0;
  const effectiveTaxBaseDeductible = 
    (vatCalculationResult?.total_base_deductible !== undefined ? Number(vatCalculationResult.total_base_deductible) : undefined) ?? 
    (vatCalculationResult?.tax_base_deductible !== undefined ? Number(vatCalculationResult.tax_base_deductible) : undefined) ?? 
    0;

  const handleNavigateToAmendments = onNavigateToAmendmentsProp || onJumpToAmendments || (() => {});

  const hasSnapshots = snapshots.length > 0;
  const latestSnapshot = hasSnapshots ? snapshots[snapshots.length - 1] : null;

  // Selected snapshot record
  const currentViewingSnapshot = selectedVersionNumber
    ? snapshots.find(s => s.version_number === selectedVersionNumber) || latestSnapshot
    : null;

  const isLocked = Boolean(currentViewingSnapshot || (hasSnapshots && selectedVersionNumber === null));
  const isViewingHistorical = selectedVersionNumber !== null;

  const periodLabel = frequency === 'H'
    ? `${year}. ${String(month).padStart(2, '0')}. hónap`
    : frequency === 'N'
    ? `${year}. Q${month}`
    : `${year}. év`;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    toast({
      title: 'SHA-256 Hash másolva',
      description: `${hash.slice(0, 16)}... a vágólapra másolva.`,
    });
  };

  const handleOpenLockDialog = () => {
    const nextVer = snapshots.length + 1;
    const defaultLabel = snapshots.length === 0
      ? `v1.0 (Eredeti beadás)`
      : `v1.${nextVer - 1} (${nextVer - 1}. Önellenőrzés)`;
    setSnapshotLabel(defaultLabel);
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (onSubmitSnapshotProp) {
      try {
        await onSubmitSnapshotProp(snapshotLabel);
        setConfirmModalOpen(false);
        toast({
          title: 'ÁFA-bevallás sikeresen zárolva',
          description: `${snapshotLabel} változtathatatlan kriptográfiai pecséttel rögzítve.`,
        });
      } catch (err: any) {
        toast({
          title: 'Hiba a zárolás során',
          description: err.message,
          variant: 'destructive',
        });
      }
      return;
    }

    if (!companyId) return;
    setInternalIsSubmitting(true);
    try {
      const nextVersionNum = snapshots.length + 1;
      const vType: 'ORIGINAL' | 'SELF_REVISION' = snapshots.length === 0 ? 'ORIGINAL' : 'SELF_REVISION';
      const vLabel = snapshotLabel.trim() || (snapshots.length === 0 ? 'v1.0 (Eredeti beadás)' : `v1.${nextVersionNum - 1} (${nextVersionNum - 1}. Önellenőrzés)`);

      await createVatSnapshot({
        companyId,
        year,
        month,
        frequency,
        versionNumber: nextVersionNum,
        versionType: vType,
        versionLabel: vLabel,
        taxBasePayable: Number(effectiveTaxBasePayable) || 0,
        taxPayable: Number(effectiveTaxPayable) || 0,
        taxBaseDeductible: Number(effectiveTaxBaseDeductible) || 0,
        taxDeductible: Number(effectiveTaxDeductible) || 0,
        snapshotPayload: vatCalculationResult || {},
      });

      await queryClient.invalidateQueries({ queryKey: ['vat_snapshots'] });
      await queryClient.invalidateQueries({ queryKey: ['vat_snapshot_diffs'] });
      setConfirmModalOpen(false);
      toast({
        title: 'ÁFA-bevallás sikeresen zárolva',
        description: `${snapshotLabel} változtathatatlan kriptográfiai pecséttel rögzítve.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a zárolás során',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* 1. Main Header Status & Version Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card border border-border/80 rounded-xl shadow-xs">
        {/* Left: Period & Status badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground tracking-tight">
              ÁFA BEVALLÁS: {periodLabel}
            </span>
          </div>

          {/* Status Badge */}
          {!hasSnapshots ? (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 gap-1.5 py-0.5">
              <Unlock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Tervezet (Szerkeszthető)</span>
            </Badge>
          ) : revisionSummary.hasRevisions && !isViewingHistorical ? (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1.5 py-0.5 animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Önellenőrzésre vár ({revisionSummary.totalItemsCount} eltérés)</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 gap-1.5 py-0.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Beadva / Zárolva (Írásvédett)</span>
            </Badge>
          )}

          {/* Hash snippet if locked */}
          {latestSnapshot && (
            <button
              type="button"
              onClick={() => copyHash(latestSnapshot.snapshot_hash_sha256)}
              className="hidden md:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-mono bg-muted/50 px-2 py-0.5 rounded border border-border/50"
              title="Kattintásra SHA-256 hash másolása"
            >
              <Copy className="w-3 h-3" />
              <span>SHA-256: {latestSnapshot.snapshot_hash_sha256.slice(0, 8)}...</span>
            </button>
          )}
        </div>

        {/* Right: Version Selector & Action button */}
        <div className="flex items-center gap-2">
          {/* Version Dropdown */}
          {hasSnapshots && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border/80">
                  <History className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {isViewingHistorical && currentViewingSnapshot
                      ? currentViewingSnapshot.version_label
                      : 'Aktuális állapot'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs">Bevallási verziók</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSelectVersion(null)}
                  className={cn(
                    'text-xs cursor-pointer justify-between',
                    selectedVersionNumber === null && 'font-semibold bg-accent text-accent-foreground'
                  )}
                >
                  <div className="flex flex-col">
                    <span>Aktuális munkapéldány</span>
                    <span className="text-[10px] text-muted-foreground">Élő számlák és kalkulációk</span>
                  </div>
                  {selectedVersionNumber === null && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                {snapshots.map(s => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleSelectVersion(s.version_number)}
                    className={cn(
                      'text-xs cursor-pointer justify-between',
                      selectedVersionNumber === s.version_number && 'font-semibold bg-accent text-accent-foreground'
                    )}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>{s.version_label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {s.submitted_at?.slice(0, 10)} | Poz: {formatCurrency(s.net_vat_position)}
                      </span>
                    </div>
                    {selectedVersionNumber === s.version_number && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Action button: Beadva / Zárolás */}
          <Button
            size="sm"
            variant={revisionSummary.hasRevisions ? 'default' : 'outline'}
            onClick={handleOpenLockDialog}
            disabled={isSubmittingSnapshot}
            className={cn(
              'h-8 text-xs gap-1.5 shadow-xs',
              revisionSummary.hasRevisions
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'text-foreground'
            )}
          >
            {isSubmittingSnapshot ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileCheck2 className="w-3.5 h-3.5" />
            )}
            <span>
              {!hasSnapshots
                ? 'Beadva / Véglegesítés'
                : revisionSummary.hasRevisions
                ? 'Önellenőrzés rögzítése'
                : 'Új pillanatkép mentése'}
            </span>
          </Button>
        </div>
      </div>

      {/* 2. Warning Banner when Revisions Exist */}
      {revisionSummary.hasRevisions && !isViewingHistorical && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-amber-500/10 border border-amber-300 dark:border-amber-800/80 rounded-xl text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>⚠️ {revisionSummary.totalItemsCount} tétel utólagos módosítás miatt önellenőrzésre vár!</strong>{' '}
              Adóalap változás: <span className="font-semibold">{formatCurrency(revisionSummary.totalTaxBaseDiff)}</span> |{' '}
              Fizetendő ÁFA különbözet:{' '}
              <span className="font-semibold">{formatCurrency(revisionSummary.totalTaxAmountDiff)}</span>
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleNavigateToAmendments}
            className="h-7 text-xs bg-white dark:bg-card border-amber-300 dark:border-amber-700 hover:bg-amber-50 text-amber-900 dark:text-amber-200 gap-1"
          >
            <span>Önellenőrzés & Diff megtekintése</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      )}

      {/* Confirm Lock Dialog */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-emerald-600" />
              <span>ÁFA Bevallás Zárolása & Snapshot</span>
            </DialogTitle>
            <DialogDescription>
              A véglegesítés változtathatatlan SHA-256 pecséttel rögzíti az aktuális ÁFA-analitikát és számlákat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/60 rounded-lg space-y-2 border border-border/50">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Időszak:</span>
                <span className="font-medium">{periodLabel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verzió címke:</span>
                <input
                  type="text"
                  value={snapshotLabel}
                  onChange={e => setSnapshotLabel(e.target.value)}
                  className="px-2 py-0.5 border rounded text-right font-medium bg-background"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fizetendő ÁFA:</span>
                <span className="font-semibold text-rose-600">{formatCurrency(effectiveTaxPayable)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Levonható ÁFA:</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(effectiveTaxDeductible)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1">
                <span className="font-semibold">Nettó ÁFA pozíció:</span>
                <span className="font-bold">{formatCurrency(effectiveTaxPayable - effectiveTaxDeductible)}</span>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              📌 <strong>Garanciális szabály:</strong> A rögzítés után a lezárt időszak számláit a rendszer írásvédettnek tekinti. Az utólagos módosítások az Önellenőrzési Medencébe kerülnek.
            </p>
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmModalOpen(false)}>
              Mégse
            </Button>
            <Button
              onClick={handleConfirmSubmit}
              disabled={isSubmittingSnapshot || !snapshotLabel.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
            >
              {isSubmittingSnapshot ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Zárolás megerősítése'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
