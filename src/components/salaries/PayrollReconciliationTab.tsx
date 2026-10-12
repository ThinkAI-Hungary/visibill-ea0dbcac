import React from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { usePayroll471Reconciliation } from '@/lib/payroll/payrollBankMatcher';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  Building2,
  Users,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollReconciliationTabProps {
  onNavigateToPayouts?: () => void;
}

export const PayrollReconciliationTab: React.FC<PayrollReconciliationTabProps> = ({
  onNavigateToPayouts,
}) => {
  const { selectedCompany } = useCompany();
  const { dateFrom } = useDateRange();

  const companyId = selectedCompany?.id;
  const year = dateFrom.getFullYear();
  const month = dateFrom.getMonth() + 1;

  const { data: recData, isLoading, refetch, isFetching } = usePayroll471Reconciliation(
    companyId,
    year,
    month
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const reconciliation = recData?.reconciliation;
  const summary = recData?.payroll_summary;
  const stats = recData?.payout_stats;
  const discrepancies = recData?.discrepancies || [];

  const totalPayable = (summary?.total_net || 0) + (summary?.total_commute || 0);
  const totalPaid = stats?.total_paid || 0;
  const remainingLiability = Math.max(0, totalPayable - totalPaid);
  const payoutRatio = Math.min(100, Math.round(stats?.payout_ratio || 0));

  const [todayStr] = React.useState(() => new Date().toISOString().split('T')[0]);
  const deadlineDate = recData?.cycle?.payout_deadline || `${year}-${String(month + 1).padStart(2, '0')}-10`;
  const isPastDeadline = todayStr > deadlineDate;

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight">Havi Bérkontroll & Kintlevő Bértartozás</h2>
            {reconciliation?.is_balanced ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                471 Főkönyv Egyezik
              </Badge>
            ) : reconciliation?.closing_balance !== 0 ? (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Nyitott Bértartozás: {formatCurrencyLocale(reconciliation?.closing_balance || 0, 'HUF')}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400 gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Főkönyvi Eltérés
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {year}. {month}. havi számfejtési kötelezettségek, kifizetések és Sztv. 471. egyenleg ellenőrzése (Mt. 157. § határidő: {deadlineDate})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Frissítés
          </Button>
          {onNavigateToPayouts && (
            <Button
              size="sm"
              onClick={onNavigateToPayouts}
              className="gap-2 bg-primary text-primary-foreground shadow"
            >
              Kifizetések és GIRO
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Payout Ratio */}
        <Card className="relative overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kifizetettségi Arány
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              payoutRatio === 100
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {payoutRatio}%
            </div>
            <div className="mt-2 space-y-1">
              <Progress value={payoutRatio} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Kifizetve: {formatCurrencyLocale(totalPaid, 'HUF')}</span>
                <span>Összes: {formatCurrencyLocale(totalPayable, 'HUF')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Nyitott Bértartozás */}
        <Card className="relative overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Nyitott Bértartozás
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              remainingLiability === 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : isPastDeadline
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold tracking-tight",
              remainingLiability > 0 && isPastDeadline && "text-rose-600 dark:text-rose-400"
            )}>
              {formatCurrencyLocale(remainingLiability, 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {remainingLiability === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Minden dolgozó kifizetve</span>
              ) : isPastDeadline ? (
                <span className="text-rose-600 dark:text-rose-400 font-medium">Mt. 157. § határidő lejárt ({deadlineDate})</span>
              ) : (
                <span>Kifizetési határidő: {deadlineDate}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Adók és Levonások */}
        <Card className="relative overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Adók & Járulékok (NAV)
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrencyLocale((summary?.total_szja || 0) + (summary?.total_tb || 0) + (summary?.total_szocho || 0), 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              SZJA: {formatCurrencyLocale(summary?.total_szja || 0, 'HUF')} | TB: {formatCurrencyLocale(summary?.total_tb || 0, 'HUF')}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: 471 Főkönyvi Státusz */}
        <Card className="relative overflow-hidden border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              471 Főkönyvi Egyenleg
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              reconciliation?.is_balanced
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
            )}>
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrencyLocale(reconciliation?.closing_balance || 0, 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {reconciliation?.is_balanced ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Béranalitika ↔ Főkönyv 0 Ft eltérés</span>
              ) : (
                <span>Könyvelési eltérés: {formatCurrencyLocale(reconciliation?.discrepancy_amount || 0, 'HUF')}</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancy Warnings & Alerts */}
      {discrepancies.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-200">
                Figyelmeztetések és eltérések ({discrepancies.length} db)
              </CardTitle>
            </div>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              Az automatikus bérkontroll eltérést talált a számfejtett bérek és a banki teljesítések között:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {discrepancies.map((disc, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start justify-between rounded-lg p-3 text-sm border",
                  disc.severity === 'CRITICAL'
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium">
                    {disc.severity === 'CRITICAL' ? (
                      <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span>{disc.title}</span>
                    {disc.employee_name && (
                      <Badge variant="outline" className="text-xs">
                        {disc.employee_name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs opacity-90">{disc.message}</p>
                </div>
                <div className="text-right whitespace-nowrap pl-4">
                  <span className="font-semibold">
                    {formatCurrencyLocale(disc.diff_amount, 'HUF')}
                  </span>
                  <div className="text-[11px] opacity-75">
                    Elvárt: {formatCurrencyLocale(disc.expected_amount, 'HUF')}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3-Way Reconciliation Formula Box */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              3-Oldalú Béregyeztetési Mérleg (Sztv. 471. Kontroll)
            </CardTitle>
          </div>
          <CardDescription>
            Béranalitika ↔ 471. Jövedelemelszámolási Főkönyvi Számla ↔ Banki/Pénztári Kifizetések
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Step 1: Analitika */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                <span>1. Bérszámfejtési Analitika</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Dolgozók létszáma:</span>
                  <span className="font-medium text-foreground">{summary?.employee_count || 0} fő</span>
                </div>
                <div className="flex justify-between">
                  <span>Bruttó bér:</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(summary?.total_gross || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Nettó munkabér:</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(summary?.total_net || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Munkába járási térítés:</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(summary?.total_commute || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-foreground">
                  <span>Összes kifizetendő:</span>
                  <span className="text-primary">{formatCurrencyLocale(totalPayable, 'HUF')}</span>
                </div>
              </div>
            </div>

            {/* Step 2: Főkönyv 471 */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                <span>2. Főkönyvi Könyvelés (471)</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Nyitó kötelezettség (T/K):</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(reconciliation?.opening_balance || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Havi előírás (Kredit 471):</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(reconciliation?.credit_471 || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Havi kifizetés (Debet 471):</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(reconciliation?.debit_471 || 0, 'HUF')}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-foreground">
                  <span>471. Záróegyenleg:</span>
                  <span className={cn(
                    reconciliation?.closing_balance === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {formatCurrencyLocale(reconciliation?.closing_balance || 0, 'HUF')}
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3: Bank & Kifizetés */}
            <div className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-primary" />
                <span>3. Banki & Pénztári Teljesítés</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Párosított banki utalások:</span>
                  <span className="font-medium text-foreground">{stats?.paid_count || 0} tétel</span>
                </div>
                <div className="flex justify-between">
                  <span>Függő kifizetések:</span>
                  <span className="font-medium text-foreground">{stats?.pending_count || 0} tétel</span>
                </div>
                <div className="flex justify-between">
                  <span>Összes teljesített összeg:</span>
                  <span className="font-medium text-foreground">{formatCurrencyLocale(totalPaid, 'HUF')}</span>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-1.5 font-semibold text-foreground">
                  <span>Fennmaradó kifizetetlen:</span>
                  <span className={cn(
                    remainingLiability === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {formatCurrencyLocale(remainingLiability, 'HUF')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
