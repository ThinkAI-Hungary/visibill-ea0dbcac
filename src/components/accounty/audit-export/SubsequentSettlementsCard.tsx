import React, { useState } from 'react';
import {
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  generateSubsequentSettlementsExcel,
  downloadFile,
  type SubsequentSettlementsReport,
} from '@/services/auditorExportService';

interface SubsequentSettlementsCardProps {
  report: SubsequentSettlementsReport | undefined;
  isLoading: boolean;
  companyName: string;
  fiscalYear: number;
}

export function SubsequentSettlementsCard({
  report,
  isLoading,
  companyName,
  fiscalYear,
}: SubsequentSettlementsCardProps) {
  const { toast } = useToast();
  const [filterDirection, setFilterDirection] = useState<'ALL' | 'AR' | 'AP'>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'SETTLED' | 'PARTIALLY_SETTLED' | 'UNSETTLED'>('ALL');
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border/40 shadow-sm p-8 text-center bg-card/50 backdrop-blur-sm">
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">ISA 560 Utólagos pénzügyi rendezések kalkulációja...</p>
        </div>
      </Card>
    );
  }

  if (!report) {
    return null;
  }

  const { summary, items, year_end_date, cutoff_date } = report;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (filterDirection !== 'ALL' && item.direction !== filterDirection) return false;
    if (filterStatus !== 'ALL' && item.settlement_status !== filterStatus) return false;
    return true;
  });

  // Handle Excel download
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      const blob = await generateSubsequentSettlementsExcel(companyName, fiscalYear, report);
      const safeComp = companyName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      downloadFile(blob, `ISA_560_Utolagos_Rendezesek_${safeComp}_${fiscalYear}.xlsx`);

      toast({
        title: 'Sikeres ISA 560 exportálás',
        description: 'Excel kimutatás letöltve tételes rendezésekkel és auditori státuszokkal.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Hiba a letöltés során',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    } finally {
      setIsExportingExcel(false);
    }
  };

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
      <CardHeader className="bg-muted/10 border-b border-border/40 p-5 md:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <CardTitle className="text-xl font-bold tracking-tight">
                ISA 560: Mérlegfordulónap Utáni Pénzügyi Rendezések
              </CardTitle>
              <Badge variant="outline" className="border-teal-500/30 text-teal-700 dark:text-teal-300 font-semibold text-xs">
                Könyvvizsgálati Szabvány
              </Badge>
            </div>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              A {fiscalYear}. december 31-i nyitott követelések és kötelezettségek utólagos pénzügyi lefutása (április 30-ig)
            </CardDescription>
          </div>

          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={isExportingExcel || items.length === 0}
            className="bg-teal-700 hover:bg-teal-800 text-white shadow-sm text-xs h-9 font-semibold"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5" />
            {isExportingExcel ? 'Generálás...' : 'ISA 560 Kimutatás (.xlsx)'}
          </Button>
        </div>

        {/* 2 Main KPI Cards: AR vs AP Settlement Rate */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30">
          {/* Receivables (AR) */}
          <div className="bg-background/80 p-4 rounded-xl border border-teal-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <ArrowDownLeft className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Vevőkövetelések (AR)
                </span>
              </div>
              <Badge
                className={`text-xs font-bold ${
                  summary.receivables_settlement_rate >= 80
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
                variant="outline"
              >
                {summary.receivables_settlement_rate}% rendezve
              </Badge>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Nyitott Dec 31-én:</div>
                <div className="text-lg font-bold text-foreground">
                  {summary.total_receivables_open_dec31.toLocaleString('hu-HU')} Ft
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Befolyt április 30-ig:</div>
                <div className="text-base font-bold text-teal-600 dark:text-teal-400">
                  {summary.settled_receivables_subsequent.toLocaleString('hu-HU')} Ft
                </div>
              </div>
            </div>
          </div>

          {/* Payables (AP) */}
          <div className="bg-background/80 p-4 rounded-xl border border-blue-500/20 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Szállítói kötelezettségek (AP)
                </span>
              </div>
              <Badge
                className={`text-xs font-bold ${
                  summary.payables_settlement_rate >= 80
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}
                variant="outline"
              >
                {summary.payables_settlement_rate}% kifizetve
              </Badge>
            </div>

            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Nyitott Dec 31-én:</div>
                <div className="text-lg font-bold text-foreground">
                  {summary.total_payables_open_dec31.toLocaleString('hu-HU')} Ft
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Kifizetve április 30-ig:</div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                  {summary.settled_payables_subsequent.toLocaleString('hu-HU')} Ft
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6 space-y-4">
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setFilterDirection('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterDirection === 'ALL' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
              >
                Összes ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('AR')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterDirection === 'AR' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
              >
                Vevők ({items.filter((i) => i.direction === 'AR').length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('AP')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterDirection === 'AP' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
              >
                Szállítók ({items.filter((i) => i.direction === 'AP').length})
              </button>
            </div>

            <div className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/40">
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === 'ALL' ? 'bg-background shadow-xs text-foreground' : 'text-muted-foreground'
                }`}
              >
                Összes státusz
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('SETTLED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === 'SETTLED' ? 'bg-background shadow-xs text-emerald-600 font-bold' : 'text-muted-foreground'
                }`}
              >
                Rendezett
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('UNSETTLED')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterStatus === 'UNSETTLED' ? 'bg-background shadow-xs text-red-600 font-bold' : 'text-muted-foreground'
                }`}
              >
                Kétes / Rendezetlen
              </button>
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Vizsgálati intervallum:{' '}
            <strong className="text-foreground">
              {year_end_date} – {cutoff_date}
            </strong>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/40 overflow-hidden shadow-xs">
          <div className="overflow-x-auto max-h-[380px]">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/70 text-muted-foreground sticky top-0 z-10 backdrop-blur-md uppercase tracking-wider font-semibold border-b border-border/40">
                <tr>
                  <th className="py-2.5 px-3">Irány</th>
                  <th className="py-2.5 px-3">Számlaszám</th>
                  <th className="py-2.5 px-3">Partner neve</th>
                  <th className="py-2.5 px-3">Esedékesség</th>
                  <th className="py-2.5 px-3 text-right">Nyitott összeg (Dec 31)</th>
                  <th className="py-2.5 px-3 text-right">Rendezett összeg</th>
                  <th className="py-2.5 px-3 text-center">Fizetés dátuma</th>
                  <th className="py-2.5 px-3 text-center">Fizetési mód</th>
                  <th className="py-2.5 px-3 text-center">Audit Státusz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-muted-foreground">
                      Nincs megjeleníthető nyitott számla a választott szűrési feltételekkel.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.invoice_id}
                      className="hover:bg-muted/30 transition-colors duration-150 odd:bg-transparent even:bg-muted/10"
                    >
                      <td className="py-2 px-3 font-semibold">
                        {item.direction === 'AR' ? (
                          <span className="text-teal-600 dark:text-teal-400">Vevő</span>
                        ) : (
                          <span className="text-blue-600 dark:text-blue-400">Szállító</span>
                        )}
                      </td>
                      <td className="py-2 px-3 font-mono font-medium text-foreground">{item.invoice_number}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate" title={item.partner_name}>
                        {item.partner_name}
                      </td>
                      <td className="py-2 px-3 font-mono text-muted-foreground">{item.due_date}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                        {item.open_amount_dec31.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-medium text-teal-600 dark:text-teal-400">
                        {item.subsequent_settled_amount.toLocaleString('hu-HU')} Ft
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                        {item.last_settlement_date || '-'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono">
                          {item.settlement_method}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.settlement_status === 'SETTLED' ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                            Rendezett (100%)
                          </Badge>
                        ) : item.settlement_status === 'PARTIALLY_SETTLED' ? (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px] font-semibold">
                            Részben ({item.settlement_percentage}%)
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30 text-[11px] font-semibold">
                            Rendezetlen
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
