import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  FileCheck,
  Scale,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  Building2,
  Loader2,
} from 'lucide-react';
import { useGlReconciliation, useFxCashRevaluation } from '@/hooks/usePettyCashUpgrade';
import { fmtBalance } from './types';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PettyCashGlReconciliationPanelProps {
  companyId: string;
  year?: number;
  dateTo?: string;
  onOpenClosingDialog?: () => void;
}

export default function PettyCashGlReconciliationPanel({
  companyId,
  year,
  dateTo,
  onOpenClosingDialog,
}: PettyCashGlReconciliationPanelProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const [selectedYear, setSelectedYear] = useState<number>(() => year ?? new Date().getFullYear());
  const [showFxModal, setShowFxModal] = useState(false);

  const {
    data: recon,
    isLoading: isReconLoading,
    refetch: refetchRecon,
    isRefetching,
  } = useGlReconciliation(companyId, selectedYear, dateTo);

  const fxRevalMutation = useFxCashRevaluation();

  const handleRunFxReval = async (postToGl: boolean) => {
    try {
      const res = await fxRevalMutation.mutateAsync({
        companyId,
        year: selectedYear,
        postToGl,
      });

      if (postToGl) {
        toast({
          title: 'Sztv. 60. § Deviza átértékelés lekönyvelve!',
          description: `Generált vegyes bizonylatszám: ${res.voucher_number || 'VE'}, összeg: ${fmtBalance(res.total_revaluation_diff_huf, 'HUF')}`,
        });
        setShowFxModal(false);
        refetchRecon();
      } else {
        toast({
          title: 'Deviza átértékelési kalkuláció kész',
          description: `Várható átértékelési különbözet: ${fmtBalance(res.total_revaluation_diff_huf, 'HUF')}`,
        });
      }
    } catch (err: any) {
      toast({
        title: 'Átértékelési hiba',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const isMatched = recon?.is_reconciled;
  const hasDiscrepancy = recon && !recon.is_reconciled;

  return (
    <div className="space-y-6">
      {/* Header card with reconciliation summary */}
      <Card className="border border-border/80 shadow-sm bg-gradient-to-br from-card via-card to-muted/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg font-bold">
                  {t('pettyCash:gl_recon.title', 'Házipénztár Analitika ↔ Főkönyv (381/382) Egyezőség')}
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Valós idejű szinkron-ellenőrzés a pénztárkönyv és a 381 (HUF pénztár) / 382 (Valutapénztár) főkönyvi számlák között
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="w-28 h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => refetchRecon()}
                disabled={isReconLoading || isRefetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", (isReconLoading || isRefetching) && "animate-spin")} />
                {t('common:refresh', 'Újraegyeztetés')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20"
                onClick={() => {
                  setShowFxModal(true);
                  handleRunFxReval(false);
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Sztv. 60. § MNB Átértékelés
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status banner */}
          <div
            className={cn(
              "p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
              isMatched && "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200",
              hasDiscrepancy && "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200",
              !recon && "bg-muted/40 border-border"
            )}
          >
            <div className="flex items-center gap-3">
              {isMatched ? (
                <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              )}
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>
                    {isMatched
                      ? 'Tökéletes Főkönyvi Egyezőség (381/382 ↔ Pénztár)'
                      : 'Különbözet detektálva az Analitika és a Főkönyv között!'}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase font-bold",
                      isMatched
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/15 border-destructive/30 text-destructive font-bold"
                    )}
                  >
                    {isMatched ? '🟢 EGYEZŐ' : '🔴 ELTÉRÉS'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {recon?.status_message || 'Főkönyvi ellenőrzés folyamatban...'}
                </p>
              </div>
            </div>

            {hasDiscrepancy && onOpenClosingDialog && (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5 text-xs bg-amber-600 hover:bg-amber-500 text-white shrink-0"
                onClick={onOpenClosingDialog}
              >
                <FileCheck className="h-4 w-4" />
                Pénztárjelentés Zárása & Könyvelése
              </Button>
            )}
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-lg border border-border/70 bg-card/60 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Pénztáranalitika egyenlege
              </div>
              <div className="text-lg font-bold font-mono text-foreground">
                {recon ? fmtBalance(recon.analytics_total_huf, 'HUF') : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Valamennyi aktív forint- és valutakassza összege
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border/70 bg-card/60 space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Főkönyvi 381 & 382 Számlák egyenlege
              </div>
              <div className="text-lg font-bold font-mono text-foreground">
                {recon ? fmtBalance(recon.gl_total_huf, 'HUF') : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                general_ledger_entries (381* és 382* számlák)
              </div>
            </div>

            <div className={cn(
              "p-3.5 rounded-lg border space-y-1",
              recon && Math.abs(recon.discrepancy_huf) > 0
                ? "border-destructive/40 bg-destructive/5"
                : "border-emerald-500/30 bg-emerald-500/5"
            )}>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Nettó Különbözet (Analitika - Főkönyv)
              </div>
              <div className={cn(
                "text-lg font-bold font-mono",
                recon && Math.abs(recon.discrepancy_huf) > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {recon ? fmtBalance(recon.discrepancy_huf, 'HUF') : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {recon && Math.abs(recon.discrepancy_huf) === 0 ? 'Hézagmentes egyezőség' : 'Könyvelendő vagy rendezendő'}
              </div>
            </div>
          </div>

          {/* Registers detailed table */}
          {recon && recon.registers && recon.registers.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide">
                Pénztárankénti Bontás és Főkönyvi Hozzárendelés
              </div>
              <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="text-[11px]">
                      <TableHead>Pénztár / Kassza</TableHead>
                      <TableHead>Devizanem</TableHead>
                      <TableHead>Főkönyvi Számla</TableHead>
                      <TableHead className="text-right">Analitika Deviza</TableHead>
                      <TableHead className="text-right">Analitika (HUF)</TableHead>
                      <TableHead className="text-right">Főkönyv (HUF)</TableHead>
                      <TableHead className="text-right">Különbözet</TableHead>
                      <TableHead className="text-center">Állapot</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {recon.registers.map((r) => {
                      const diff = Number(r.diff_huf || 0);
                      const isOk = Math.abs(diff) < 1;
                      return (
                        <TableRow key={r.register_id} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-foreground">
                            {r.register_name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {r.currency}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {r.gl_account_code}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {fmtBalance(r.analytics_balance_fx, r.currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {fmtBalance(r.analytics_balance_huf, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {fmtBalance(r.gl_balance_huf, 'HUF')}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-bold",
                            isOk ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          )}>
                            {fmtBalance(diff, 'HUF')}
                          </TableCell>
                          <TableCell className="text-center">
                            {isOk ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                                Egyezik
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">
                                Különbözet
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Itemized discrepancy breakdown */}
          {recon && recon.itemized_discrepancies && recon.itemized_discrepancies.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold text-destructive uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                <span>Részletes Eltéréslista ({recon.itemized_discrepancies.length} db azonosított tétel)</span>
              </div>
              <div className="border border-destructive/30 rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader className="bg-destructive/5">
                    <TableRow className="text-[11px]">
                      <TableHead>Típus</TableHead>
                      <TableHead>Dátum</TableHead>
                      <TableHead>Hivatkozás / Leírás</TableHead>
                      <TableHead className="text-right">Összeg (HUF)</TableHead>
                      <TableHead>Javasolt Teendő</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {recon.itemized_discrepancies.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-destructive/5">
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
                            {item.discrepancy_type === 'unposted_entry'
                              ? 'Nem könyvelt analitika'
                              : item.discrepancy_type === 'direct_gl_posting'
                              ? 'Közvetlen főkönyvi tétel'
                              : 'Árfolyamkülönbözet'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">{item.date}</TableCell>
                        <TableCell className="font-medium text-foreground">{item.description}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {fmtBalance(item.amount_huf, 'HUF')}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[11px]">
                          {item.remedy_suggestion}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sztv. 60. § Foreign Currency Revaluation Modal */}
      <Dialog open={showFxModal} onOpenChange={setShowFxModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              Sztv. 60. § Év Végi Deviza Pénztár Átértékelés (MNB árfolyam)
            </DialogTitle>
            <DialogDescription className="text-xs">
              A Számviteli Törvény 60. § (2) bekezdése szerinti fordulónapi (december 31.) hivatalos MNB devizaárfolyamon történő kötelező átértékelés kalkulációja és főkönyvi lekönyvelése (976 / 876).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {fxRevalMutation.isPending ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                <p className="text-xs text-muted-foreground">Hivatalos MNB árfolyamok lekérdezése és átértékelés számítása...</p>
              </div>
            ) : fxRevalMutation.data ? (
              <div className="space-y-4">
                {/* Result header */}
                <div className={cn(
                  "p-3.5 rounded-lg border flex items-center justify-between",
                  fxRevalMutation.data.total_revaluation_diff_huf >= 0
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                    : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide">
                      Összesített Fordulónapi Árfolyamkülönbözet ({selectedYear}.12.31)
                    </div>
                    <div className="text-xl font-bold font-mono mt-0.5">
                      {fmtBalance(fxRevalMutation.data.total_revaluation_diff_huf, 'HUF')}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold py-1 px-2.5">
                    {fxRevalMutation.data.total_revaluation_diff_huf >= 0 ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-3.5 w-3.5" /> 976. Árfolyamnyereség
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive">
                        <TrendingDown className="h-3.5 w-3.5" /> 876. Árfolyamveszteség
                      </span>
                    )}
                  </Badge>
                </div>

                {/* Items table */}
                <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="text-[11px]">
                        <TableHead>Pénztár</TableHead>
                        <TableHead>Deviza egyenleg</TableHead>
                        <TableHead>Könyv szerinti érték</TableHead>
                        <TableHead>Fordulónapi MNB árfolyam</TableHead>
                        <TableHead>Átértékelt HUF</TableHead>
                        <TableHead className="text-right">Különbözet</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs">
                      {fxRevalMutation.data.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-semibold">{item.register_name}</TableCell>
                          <TableCell className="font-mono">{fmtBalance(item.currency_balance, item.currency)}</TableCell>
                          <TableCell className="font-mono">{fmtBalance(item.book_value_huf, 'HUF')}</TableCell>
                          <TableCell className="font-mono font-medium text-indigo-600 dark:text-indigo-400">
                            {item.official_mnb_rate} HUF
                          </TableCell>
                          <TableCell className="font-mono">{fmtBalance(item.revalued_huf, 'HUF')}</TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-bold",
                            item.diff_huf >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          )}>
                            {fmtBalance(item.diff_huf, 'HUF')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-[11px] text-muted-foreground p-2.5 rounded bg-muted/40 border border-border/40">
                  A gombra kattintva a rendszer automatikus <strong>VE (Vegyes) naplóbeli könyvelést</strong> generál, amely a 382 Valutapénztár egyenlegét a fordulónapi hivatalos MNB árfolyamra igazítja a 976 (pénzügyi műveletek egyéb bevételei) vagy 876 (pénzügyi műveletek egyéb ráfordításai) számlákkal szemben.
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowFxModal(false)}>
              {t('common:cancel', 'Mégse')}
            </Button>
            <Button
              variant="default"
              disabled={fxRevalMutation.isPending || !fxRevalMutation.data || fxRevalMutation.data.items?.length === 0}
              onClick={() => handleRunFxReval(true)}
              className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              {fxRevalMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <FileCheck className="h-4 w-4" />
              Átértékelés könyvelése a Főkönyvbe (VE Napló)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
