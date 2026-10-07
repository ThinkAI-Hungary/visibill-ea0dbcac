import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Banknote,
  CreditCard,
  Receipt,
  FileSpreadsheet,
  ArrowUpRight,
  Calculator,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { OpgTurnoverKpi, OpgDailySummary } from '@/types/opg';

interface OpgOverviewTabProps {
  kpi?: OpgTurnoverKpi;
  dailyTurnover: OpgDailySummary[];
  isLoading?: boolean;
  onSyncNow?: () => Promise<any>;
  isSyncing?: boolean;
  onBookAllPending: () => Promise<any>;
  isBookingPending?: boolean;
  onNavigateToTransactions: () => void;
  onNavigateToRegisters: () => void;
  onSeedDemoData?: () => Promise<any>;
}

export const OpgOverviewTab: React.FC<OpgOverviewTabProps> = ({
  kpi,
  dailyTurnover,
  isLoading = false,
  onSyncNow,
  isSyncing = false,
  onBookAllPending,
  isBookingPending = false,
  onNavigateToTransactions,
  onNavigateToRegisters,
  onSeedDemoData,
}) => {
  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const totalGross = kpi?.totalGross || 0;
  const cashPct = totalGross > 0 ? Math.round(((kpi?.totalCash || 0) / totalGross) * 100) : 0;
  const cardPct = totalGross > 0 ? Math.round(((kpi?.totalCard || 0) / totalGross) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Felső műveleti sáv & Értesítés függő tételekről */}
      {kpi && kpi.pendingCashBookingCount > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {kpi.pendingCashBookingCount} db készpénzes bizonylat vár házipénztári könyvelésre
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A beállításoknak megfelelően a készpénz forgalom beemelhető a kijelölt házipénztárba.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={onBookAllPending}
            disabled={isBookingPending}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
          >
            {isBookingPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Banknote className="h-4 w-4" />
            )}
            Összes könyvelése házipénztárba
          </Button>
        </div>
      )}

      {/* KPI Kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Teljes Forgalom */}
        <Card className="bg-card shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Összes OPG Forgalom
            </CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {fmtCurrency(totalGross)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{kpi?.transactionCount || 0} db nyugta</span>
              <span>•</span>
              <span>{kpi?.zReportCount || 0} db Z-zárás</span>
            </div>
          </CardContent>
        </Card>

        {/* 2. Készpénz Forgalom */}
        <Card className="bg-card shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Készpénz Forgalom
            </CardTitle>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-emerald-600">
              {fmtCurrency(kpi?.totalCash || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600">{cashPct}%</span>
              <span>a teljes forgalomból</span>
            </div>
          </CardContent>
        </Card>

        {/* 3. Bankkártyás Forgalom */}
        <Card className="bg-card shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Bankkártyás Forgalom
            </CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-blue-600">
              {fmtCurrency(kpi?.totalCard || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="font-semibold text-blue-600">{cardPct}%</span>
              <span>a teljes forgalomból</span>
            </div>
          </CardContent>
        </Card>

        {/* 4. Pénztárgépek & Állapot */}
        <Card className="bg-card shadow-sm border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Aktív Pénztárgépek
            </CardTitle>
            <Calculator className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-foreground">
              {kpi?.activeRegisterCount || 0} gép
            </div>
            <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3 w-3" /> NAV kapcsolat aktív
              </span>
              <button
                onClick={onNavigateToRegisters}
                className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
              >
                Kezelés <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Napi bontású összesítő táblázat */}
      <Card className="bg-card shadow-sm border">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Napi forgalmi kimutatás
              </CardTitle>
              <CardDescription>
                A napi forgalom megoszlása fizetési módonként és a lezárt bizonylatok száma.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              {dailyTurnover.length === 0 && onSeedDemoData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSeedDemoData}
                  className="gap-1.5 border-dashed h-8 text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Minta adatok generálása
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onNavigateToTransactions}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground h-8"
              >
                Összes tranzakció megtekintése <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {dailyTurnover.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Még nincs forgalmi adat a kiválasztott időszakban.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Dátum</TableHead>
                    <TableHead className="text-center">Nyugták</TableHead>
                    <TableHead className="text-center">Z-zárás</TableHead>
                    <TableHead className="text-right">Készpénz</TableHead>
                    <TableHead className="text-right">Bankkártya</TableHead>
                    <TableHead className="text-right font-bold">Napi Összesen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyTurnover.map((row) => (
                    <TableRow key={row.date} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-sm">
                        {new Date(row.date).toLocaleDateString('hu-HU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <Badge variant="outline">{row.receipt_count} db</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        {row.z_report_count > 0 ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20">
                            {row.z_report_count} db Z
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-600 font-medium">
                        {fmtCurrency(row.cash_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-blue-600 font-medium">
                        {fmtCurrency(row.card_total)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-foreground">
                        {fmtCurrency(row.gross_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
