import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useCompany } from '@/contexts/CompanyContext';
import {
  usePayroll471Reconciliation,
  useAutoMatchPayrollBank,
  useManualMatchPayrollPayout,
  useUnmatchPayrollPayout,
  type EmployeePayoutSummary,
} from '@/lib/payroll/payrollBankMatcher';
import { generateGiroPayrollXml, downloadGiroXmlFile, formatToIban } from '@/lib/payroll/giroXmlGenerator';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import {
  Scale,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  Link2,
  Unlink,
  Search,
  Sparkles,
  AlertCircle,
  Building2,
  Users,
  Wallet,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December',
];

interface PayrollReconciliationPageProps {
  embedded?: boolean;
}

export default function PayrollReconciliationPage({ embedded = false }: PayrollReconciliationPageProps = {}) {
  const { companyId } = useParams<{ companyId: string }>();
  const { selectedCompany } = useCompany();
  const { dateFrom } = useDateRange();
  const { toast } = useToast();

  const targetCompanyId = companyId || selectedCompany?.id;

  const [selectedYear, setSelectedYear] = useState<number>(() => dateFrom.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => dateFrom.getMonth() + 1);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERPAID'>('ALL');
  const [isGiroModalOpen, setIsGiroModalOpen] = useState(false);
  const [debtorIban, setDebtorIban] = useState('');
  const [executionDate, setExecutionDate] = useState(() => {
    const target = new Date(selectedYear, selectedMonth, 10);
    return target.toISOString().split('T')[0];
  });

  const [manualMatchItem, setManualMatchItem] = useState<EmployeePayoutSummary | null>(null);
  const [manualAmount, setManualAmount] = useState<string>('');

  const {
    data: recData,
    isLoading,
    refetch,
    isFetching,
  } = usePayroll471Reconciliation(targetCompanyId, selectedYear, selectedMonth);

  const autoMatchMutation = useAutoMatchPayrollBank();
  const manualMatchMutation = useManualMatchPayrollPayout();
  const unmatchMutation = useUnmatchPayrollPayout();

  const handleAutoMatch = async () => {
    if (!targetCompanyId) return;
    try {
      const res = await autoMatchMutation.mutateAsync({
        companyId: targetCompanyId,
        year: selectedYear,
        month: selectedMonth,
      });
      toast({
        title: 'Automatikus párosítás sikeres',
        description: `${res.matched_count} bérkifizetési tétel sikeresen párosítva a banki kivonatokkal.`,
      });
      refetch();
    } catch (err: unknown) {
      toast({
        title: 'Hiba a párosítás során',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba történt',
        variant: 'destructive',
      });
    }
  };

  const handleManualMatchSubmit = async () => {
    if (!targetCompanyId || !manualMatchItem || !recData?.cycle?.id) return;
    const amt = parseFloat(manualAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({
        title: 'Érvénytelen összeg',
        description: 'Kérjük adjon meg egy valós pozitív összeget!',
        variant: 'destructive',
      });
      return;
    }

    try {
      await manualMatchMutation.mutateAsync({
        companyId: targetCompanyId,
        cycleId: recData.cycle.id,
        calculationId: manualMatchItem.calculation_id,
        employeeId: manualMatchItem.employee_id,
        matchedAmount: amt,
        expectedAmount: manualMatchItem.total_payable,
      });
      toast({
        title: 'Kézi párosítás elmentve',
        description: `${manualMatchItem.employee_name} kifizetése rögzítve (${amt.toLocaleString('hu-HU')} Ft).`,
      });
      setManualMatchItem(null);
      setManualAmount('');
      refetch();
    } catch (err: unknown) {
      toast({
        title: 'Hiba a mentéskor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    }
  };

  const handleUnmatch = async (employee: EmployeePayoutSummary) => {
    if (!targetCompanyId || !recData?.cycle?.id) return;
    try {
      await unmatchMutation.mutateAsync(employee.calculation_id);
      toast({
        title: 'Párosítás feloldva',
        description: `${employee.employee_name} kifizetésének párosítása törölve lett.`,
      });
      refetch();
    } catch (err: unknown) {
      toast({
        title: 'Hiba a feloldáskor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    }
  };

  const handleGenerateGiro = () => {
    if (!recData?.employees) return;
    const unpaidOrPartial = recData.employees.filter(
      (e) => e.match_status === 'PENDING' || e.match_status === 'PARTIAL'
    );
    if (unpaidOrPartial.length === 0) {
      toast({
        title: 'Nincs kifizetendő tétel',
        description: 'Minden dolgozó ki van fizetve a választott hónapban.',
      });
      return;
    }

    const companyName = selectedCompany?.name || 'Visibill Ügyfél';
    const cleanDebtorIban = formatToIban(debtorIban || (selectedCompany as any)?.bank_account || 'HU000000000000000000000000');

    const payoutItems = unpaidOrPartial.map((emp) => ({
      employeeId: emp.employee_id,
      employeeName: emp.employee_name,
      bankAccount: emp.bank_account,
      netSalary: Math.max(0, emp.total_payable - emp.paid_amount),
      remittanceInfo: `Munkabér ${selectedYear}.${String(selectedMonth).padStart(2, '0')}`,
    }));

    try {
      const xmlString = generateGiroPayrollXml({
        companyName,
        companyTaxNumber: selectedCompany?.tax_number || undefined,
        debtorIban: cleanDebtorIban,
        executionDate,
        batchReference: `BER-${selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
        payoutItems,
      });

      downloadGiroXmlFile(xmlString, `GIRO_BER_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`);

      toast({
        title: 'GIRO XML sikeresen letöltve',
        description: `${payoutItems.length} dolgozó utalási tétele exportálva ISO 20022 formátumban.`,
      });
      setIsGiroModalOpen(false);
    } catch (err: unknown) {
      toast({
        title: 'Hiba a GIRO XML generálásakor',
        description: err instanceof Error ? err.message : 'Ismeretlen hiba',
        variant: 'destructive',
      });
    }
  };

  const reconciliation = recData?.reconciliation;
  const summary = recData?.payroll_summary;
  const stats = recData?.payout_stats;
  const discrepancies = recData?.discrepancies || [];
  const employees = recData?.employees || [];

  const totalPayable = (summary?.total_net || 0) + (summary?.total_commute || 0);
  const totalPaid = stats?.total_paid || 0;
  const remainingLiability = Math.max(0, totalPayable - totalPaid);

  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.bank_account && emp.bank_account.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'PAID') return emp.match_status === 'PAID';
    if (statusFilter === 'PENDING') return emp.match_status === 'PENDING' || emp.match_status === 'PARTIAL';
    if (statusFilter === 'OVERPAID') return emp.match_status === 'OVERPAID';
    return true;
  });

  return (
    <div className={cn("space-y-6 page-animate", embedded ? "pb-20" : "p-4 md:p-6 pb-32")}>
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={cn("font-bold tracking-tight text-foreground", embedded ? "text-xl" : "text-2xl")}>
              Bérkontroll & Banki Egyeztető
            </h1>
            {reconciliation?.is_balanced ? (
              <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Sztv. 471 Egyezik (0 Ft)
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                471 Záróegyenleg: {formatCurrencyLocale(reconciliation?.closing_balance || 0, 'HUF')}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Béranalitika ↔ Sztv. 471 Jövedelemelszámolási Főkönyv ↔ Banki/Pénztári kifizetések automatikus egyeztetése és kifizetés-audit
          </p>
        </div>

        {/* Period Selector and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Select */}
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Év" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Month Select */}
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Hónap" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((mName, idx) => (
                <SelectItem key={idx + 1} value={String(idx + 1)}>
                  {mName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Frissítés
          </Button>

          {/* Auto Bank Match */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleAutoMatch}
            disabled={autoMatchMutation.isPending}
            className="h-9 gap-1.5 shadow-sm"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            {autoMatchMutation.isPending ? 'Párosítás...' : 'Banki Párosítás'}
          </Button>

          {/* GIRO XML Modal Trigger */}
          <Button
            size="sm"
            onClick={() => setIsGiroModalOpen(true)}
            className="h-9 gap-1.5 bg-primary text-primary-foreground shadow"
          >
            <Download className="h-4 w-4" />
            GIRO XML Export
          </Button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: 471 Záróegyenleg */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              471. Főkönyvi Egyenleg
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
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Főkönyv és kifizetések egyensúlyban</span>
              ) : (
                <span>Könyvelési eltérés: {formatCurrencyLocale(reconciliation?.discrepancy_amount || 0, 'HUF')}</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Számfejtett Bérkötelezettség */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Számfejtett Kifizetendő
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrencyLocale(totalPayable, 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {summary?.employee_count || 0} fő (Nettó: {formatCurrencyLocale(summary?.total_net || 0, 'HUF')})
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Teljesített Kifizetés */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Teljesített Kifizetések
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">
              {formatCurrencyLocale(totalPaid, 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats?.paid_count || 0} tétel párosítva ({stats?.payout_ratio || 0}% lefedettség)
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Fennmaradó Kötelezettség */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Függő Bértartozás
            </CardTitle>
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              remainingLiability === 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}>
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold tracking-tight",
              remainingLiability > 0 && "text-rose-600 dark:text-rose-400"
            )}>
              {formatCurrencyLocale(remainingLiability, 'HUF')}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {remainingLiability === 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Minden dolgozó rendezve</span>
              ) : (
                <span>{stats?.pending_count || 0} munkavállaló kifizetésre vár</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discrepancy Alert Banner */}
      {discrepancies.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-200">
                Azonosított Eltérések és Könyvelési Kockázatok ({discrepancies.length} db)
              </CardTitle>
            </div>
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

      {/* Three-Way Reconciliation Audit Matrix */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Háromoldalú Bér-Főkönyvi Egyeztető Mátrix
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              Sztv. 471. Jövedelemelszámolás
            </Badge>
          </div>
          <CardDescription>
            A számfejtett béranalitika, a kettős könyvvitel (471 számla) és a banki pénzmozgások tételes egyezősége:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[30%]">Tétel / Számviteli Esemény</TableHead>
                  <TableHead className="text-right">1. Béranalitika (Havi Számfejtés)</TableHead>
                  <TableHead className="text-right">2. Főkönyv (471. számla)</TableHead>
                  <TableHead className="text-right">3. Bank / Pénztár (Pénzmozgás)</TableHead>
                  <TableHead className="text-right">Audit Különbség</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Row 1: Nyitó */}
                <TableRow>
                  <TableCell className="font-medium">
                    <span className="text-foreground">Nyitó egyenleg</span>
                    <p className="text-xs text-muted-foreground">Előző hónapról áthúzódó kötelezettség</p>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrencyLocale(reconciliation?.opening_balance || 0, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                    0 Ft
                  </TableCell>
                </TableRow>

                {/* Row 2: Havi előírás */}
                <TableRow>
                  <TableCell className="font-medium">
                    <span className="text-foreground">Tárgyhavi bérkötelezettség (Előírás)</span>
                    <p className="text-xs text-muted-foreground">T 541/551 — K 471 (Nettó bér + Térítések)</p>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-foreground">
                    {formatCurrencyLocale(totalPayable, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-foreground">
                    {formatCurrencyLocale(reconciliation?.credit_471 || 0, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    Math.abs(totalPayable - (reconciliation?.credit_471 || 0)) === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatCurrencyLocale(totalPayable - (reconciliation?.credit_471 || 0), 'HUF')}
                  </TableCell>
                </TableRow>

                {/* Row 3: Kifizetés */}
                <TableRow>
                  <TableCell className="font-medium">
                    <span className="text-foreground">Havi kifizetések (Teljesítés)</span>
                    <p className="text-xs text-muted-foreground">T 471 — K 384/381 (Bank / Pénztár utalások)</p>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-mono font-medium text-foreground">
                    {formatCurrencyLocale(reconciliation?.debit_471 || 0, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium text-foreground">
                    {formatCurrencyLocale(totalPaid, 'HUF')}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    Math.abs((reconciliation?.debit_471 || 0) - totalPaid) === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}>
                    {formatCurrencyLocale((reconciliation?.debit_471 || 0) - totalPaid, 'HUF')}
                  </TableCell>
                </TableRow>

                {/* Row 4: Záró egyenleg */}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell>
                    <span className="text-foreground">Záróegyenleg (Kötelezettség)</span>
                    <p className="text-xs text-muted-foreground font-normal">Nyitó + Előírás - Kifizetés</p>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrencyLocale(remainingLiability, 'HUF')}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono",
                    reconciliation?.closing_balance === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}>
                    {formatCurrencyLocale(reconciliation?.closing_balance || 0, 'HUF')}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {formatCurrencyLocale(totalPaid, 'HUF')}
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-bold",
                    reconciliation?.is_balanced
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}>
                    {formatCurrencyLocale(reconciliation?.discrepancy_amount || 0, 'HUF')}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employee List & Matching Detail */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Dolgozói Kifizetések & Banki Párosítás Részletező
              </CardTitle>
              <CardDescription>
                Tételes dolgozói kifizetések státusza, bankszámla adatai és analitika-bank párosítása
              </CardDescription>
            </div>

            {/* Filter and Search */}
            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Keresés névre, számlára..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Szűrés" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Összes dolgozó</SelectItem>
                  <SelectItem value="PAID">Kifizetve</SelectItem>
                  <SelectItem value="PENDING">Függő / Részleges</SelectItem>
                  <SelectItem value="OVERPAID">Túlfizetés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <LoadingSpinner size="lg" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Nincs megjeleníthető dolgozói kifizetés a kiválasztott szűrők alapján.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dolgozó Neve</TableHead>
                    <TableHead>Bankszámlaszám</TableHead>
                    <TableHead className="text-right">Számfejtett Nettó</TableHead>
                    <TableHead className="text-right">Teljesített Összeg</TableHead>
                    <TableHead className="text-right">Eltérés</TableHead>
                    <TableHead className="text-center">Párosítás Módja</TableHead>
                    <TableHead className="text-center">Státusz</TableHead>
                    <TableHead className="text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.employee_id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-medium text-foreground">
                        {emp.employee_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {emp.bank_account || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrencyLocale(emp.total_payable, 'HUF')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrencyLocale(emp.paid_amount, 'HUF')}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono text-xs font-semibold",
                        emp.difference === 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : emp.difference < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}>
                        {formatCurrencyLocale(emp.difference, 'HUF')}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.match_type ? (
                          <Badge variant="outline" className="font-mono text-[11px] gap-1">
                            <Link2 className="h-3 w-3 text-primary" />
                            {emp.match_type}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.match_status === 'PAID' && (
                          <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                            Kifizetve
                          </Badge>
                        )}
                        {emp.match_status === 'PARTIAL' && (
                          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                            Részleges
                          </Badge>
                        )}
                        {emp.match_status === 'OVERPAID' && (
                          <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400">
                            Túlfizetés
                          </Badge>
                        )}
                        {emp.match_status === 'PENDING' && (
                          <Badge variant="outline" className="border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-400">
                            Függőben
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.paid_amount > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnmatch(emp)}
                            className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1"
                          >
                            <Unlink className="h-3.5 w-3.5" />
                            Feloldás
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setManualMatchItem(emp);
                              setManualAmount(String(emp.total_payable));
                            }}
                            className="h-8 text-xs gap-1"
                          >
                            <Link2 className="h-3.5 w-3.5 text-primary" />
                            Kézi párosítás
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GIRO XML Export Dialog */}
      <Dialog open={isGiroModalOpen} onOpenChange={setIsGiroModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              GIRO XML Köteg Generálás (pain.001)
            </DialogTitle>
            <DialogDescription>
              ISO 20022 szabványú banki átutalási fájl generálása a tárgyhavi függő bérkifizetésekhez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Terhelendő Céges Bankszámla / IBAN:
              </label>
              <Input
                placeholder="HU00 0000 0000 0000 0000 0000"
                value={debtorIban}
                onChange={(e) => setDebtorIban(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                A vállalat GIRO/HCT formátumú terhelendő folyószámlája.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Teljesítés Kért Napja (Értéknap):
              </label>
              <Input
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between font-medium">
                <span>Függő dolgozók száma:</span>
                <span className="text-primary font-bold">
                  {employees.filter((e) => e.match_status !== 'PAID').length} fő
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Exportálandó kifizetés:</span>
                <span className="text-primary font-bold">
                  {formatCurrencyLocale(remainingLiability, 'HUF')}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGiroModalOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleGenerateGiro} className="gap-2 bg-primary">
              <FileCheck2 className="h-4 w-4" />
              XML Generálás & Letöltés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={!!manualMatchItem} onOpenChange={(open) => !open && setManualMatchItem(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Kézi Bérkifizetés Párosítás
            </DialogTitle>
            <DialogDescription>
              {manualMatchItem?.employee_name} ({formatCurrencyLocale(manualMatchItem?.total_payable || 0, 'HUF')})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Kifizetett / Jóváírt Összeg (Ft):
              </label>
              <Input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualMatchItem(null)}>
              Mégse
            </Button>
            <Button
              onClick={handleManualMatchSubmit}
              disabled={manualMatchMutation.isPending}
              className="bg-primary text-primary-foreground"
            >
              {manualMatchMutation.isPending ? 'Mentés...' : 'Párosítás Rögzítése'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
