import React, { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import {
  CreditCard,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export const PayoutsTab: React.FC = () => {
  const { selectedCompany } = useCompany();
  const { dateFrom } = useDateRange();
  const { toast } = useToast();

  const companyId = selectedCompany?.id;
  const year = dateFrom.getFullYear();
  const month = dateFrom.getMonth() + 1;

  const [searchTerm, setSearchTerm] = useState('');
  const [isGiroModalOpen, setIsGiroModalOpen] = useState(false);
  const [debtorIban, setDebtorIban] = useState('');
  const [executionDate, setExecutionDate] = useState(() => {
    // Default to the 10th of next month (or today if already past)
    const target = new Date(year, month, 10);
    return target.toISOString().split('T')[0];
  });

  const [manualMatchItem, setManualMatchItem] = useState<EmployeePayoutSummary | null>(null);
  const [manualAmount, setManualAmount] = useState<string>('');

  const { data: recData, isLoading, refetch } = usePayroll471Reconciliation(companyId, year, month);
  const autoMatchMutation = useAutoMatchPayrollBank();
  const manualMatchMutation = useManualMatchPayrollPayout();
  const unmatchMutation = useUnmatchPayrollPayout();

  const employees = recData?.employees || [];
  const payoutStats = recData?.payout_stats || {
    total_paid: 0,
    paid_count: 0,
    pending_count: 0,
    discrepancy_count: 0,
    payout_ratio: 0,
  };
  const summary = recData?.payroll_summary || {
    total_net: 0,
    total_commute: 0,
  };
  const totalPayable = summary.total_net + summary.total_commute;

  const filteredEmployees = employees.filter(
    (e) =>
      e.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.bank_account.includes(searchTerm)
  );

  const handleRunAutoMatch = () => {
    if (!companyId) return;
    autoMatchMutation.mutate({ companyId, year, month });
  };

  const handleOpenGiroModal = () => {
    setIsGiroModalOpen(true);
  };

  const handleDownloadGiro = () => {
    if (!selectedCompany) return;

    const payoutItems = employees.map((emp) => ({
      employeeId: emp.employee_id,
      employeeName: emp.employee_name,
      bankAccount: emp.bank_account,
      netSalary: emp.total_payable,
      remittanceInfo: `Munkabér ${year}/${month.toString().padStart(2, '0')}`,
    }));

    const validCount = payoutItems.filter((i) => i.netSalary > 0 && i.bankAccount).length;
    if (validCount === 0) {
      toast({
        title: 'Nincs kifizethető tétel',
        description: 'Egyetlen dolgozónál sincs megadva érvényes bankszámlaszám vagy nettó bér.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const xml = generateGiroPayrollXml({
        companyName: selectedCompany.name,
        companyTaxNumber: selectedCompany.tax_number || undefined,
        debtorIban: debtorIban || 'HU000000000000000000000000',
        executionDate,
        batchReference: `BER-${year}-${month.toString().padStart(2, '0')}`,
        payoutItems,
      });

      downloadGiroXmlFile(xml, `BER_${selectedCompany.name.replace(/\s+/g, '_')}_${year}_${month}`);
      setIsGiroModalOpen(false);

      toast({
        title: 'GIRO bérköteg letöltve',
        description: `${validCount} db tétel sikeresen exportálva a netbanki feltöltéshez.`,
      });
    } catch (err: any) {
      toast({
        title: 'Export hiba',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleOpenManualMatch = (emp: EmployeePayoutSummary) => {
    setManualMatchItem(emp);
    setManualAmount(emp.total_payable.toString());
  };

  const handleSaveManualMatch = () => {
    if (!manualMatchItem || !companyId || !recData?.cycle?.id) return;
    const amount = parseFloat(manualAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Érvénytelen összeg',
        description: 'Kérlek adj meg egy pozitív kifizetett összeget.',
        variant: 'destructive',
      });
      return;
    }

    manualMatchMutation.mutate(
      {
        companyId,
        cycleId: recData.cycle.id,
        calculationId: manualMatchItem.calculation_id,
        employeeId: manualMatchItem.employee_id,
        matchedAmount: amount,
        expectedAmount: manualMatchItem.total_payable,
        notes: 'Kézzel rögzített kifizetés',
      },
      {
        onSuccess: () => {
          setManualMatchItem(null);
          refetch();
        },
      }
    );
  };

  const handleUnmatch = (calculationId: string) => {
    unmatchMutation.mutate(calculationId, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. Összefoglaló és Gyorsműveletek Kártya */}
      <Card className="border-primary/20 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <span>Bérkifizetések és Banki Bérutalási Köteg</span>
                <Badge variant="outline" className="text-xs font-mono ml-1">
                  {year}. {month.toString().padStart(2, '0')}.
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Kövesd a havi nettó bérek kifizetettségét, generálj banki GIRO XML köteget és párosítsd a kivonatot.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={handleRunAutoMatch}
                disabled={autoMatchMutation.isPending}
              >
                <Sparkles className={cn("h-3.5 w-3.5 text-primary", autoMatchMutation.isPending && "animate-spin")} />
                <span>{autoMatchMutation.isPending ? 'Párosítás folyamatban...' : 'Bankkivonat Automatikus Párosítása'}</span>
              </Button>

              <Button
                size="sm"
                className="gap-1.5 text-xs h-8 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleOpenGiroModal}
                disabled={employees.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Bérutalási Köteg (GIRO XML)</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
              <div className="text-[11px] font-medium text-muted-foreground">Összes Kifizetendő Nettó</div>
              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                {formatCurrencyLocale(totalPayable, 'HUF')}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{employees.length} fő munkavállaló</div>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 flex items-center justify-between">
                <span>Teljesítve (Bankkivonat)</span>
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrencyLocale(payoutStats.total_paid, 'HUF')}
              </div>
              <div className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-0.5">
                {payoutStats.paid_count} fő kifizetve ({payoutStats.payout_ratio}%)
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <span>Függőben Lévő Kifizetés</span>
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                {formatCurrencyLocale(Math.max(0, totalPayable - payoutStats.total_paid), 'HUF')}
              </div>
              <div className="text-[10px] text-amber-700/70 dark:text-amber-400/70 mt-0.5">
                {payoutStats.pending_count} fő utalásra vár
              </div>
            </div>

            <div className="p-3 rounded-lg bg-muted/40 border border-border/50">
              <div className="text-[11px] font-medium text-muted-foreground">Kifizetési Határidő</div>
              <div className="text-lg font-bold font-mono text-foreground mt-0.5">
                {recData?.cycle?.payout_deadline || 'Hó 10.'}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Mt. 157. § (1) bek. szerint</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Dolgozói Kifizetési Lista Táblázat */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck2 className="h-4 w-4 text-primary" />
                Munkavállalók Havi Kifizetési Listája
              </CardTitle>
              <CardDescription className="text-xs">
                A számfejtett nettó bérek és a bankkivonat tranzakcióinak egyeztetése
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Keresés névre vagy számlaszámra..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="py-12 text-center">
              <LoadingSpinner message="Kifizetési adatok betöltése..." />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nincs megjeleníthető munkabér a kiválasztott időszakban.
            </div>
          ) : (
            <div className="rounded-md border border-border/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50 text-[11px]">
                  <TableRow>
                    <TableHead>Munkavállaló Neve</TableHead>
                    <TableHead>Bankszámlaszám / IBAN</TableHead>
                    <TableHead className="text-right">Előírt Nettó</TableHead>
                    <TableHead className="text-right">Kifizetett Összeg</TableHead>
                    <TableHead className="text-center">Státusz</TableHead>
                    <TableHead className="text-center">Párosítás Módja</TableHead>
                    <TableHead className="text-center">Kifizetés Dátuma</TableHead>
                    <TableHead className="text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.calculation_id} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">
                        {emp.employee_name}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {emp.bank_account ? (
                          formatToIban(emp.bank_account)
                        ) : (
                          <span className="text-amber-500 italic text-[10px]">Hiányzó számlaszám</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrencyLocale(emp.total_payable, 'HUF')}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        <span
                          className={cn(
                            emp.paid_amount >= emp.total_payable
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : emp.paid_amount > 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {formatCurrencyLocale(emp.paid_amount, 'HUF')}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {emp.match_status === 'PAID' ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                            Teljesítve
                          </Badge>
                        ) : emp.match_status === 'OVERPAID' ? (
                          <Badge className="bg-red-500/15 text-red-600 border-red-500/30 text-[10px]">
                            Túlfizetés
                          </Badge>
                        ) : emp.match_status === 'PARTIAL' ? (
                          <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 text-[10px]">
                            Részben
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                            Függőben
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-[10px] text-muted-foreground font-mono">
                        {emp.match_type === 'AUTO_IBAN' ? (
                          <span className="text-emerald-600 flex items-center justify-center gap-1">
                            <Sparkles className="h-3 w-3" /> Auto IBAN
                          </span>
                        ) : emp.match_type === 'AUTO_NAME' ? (
                          <span className="text-blue-600 flex items-center justify-center gap-1">
                            <Sparkles className="h-3 w-3" /> Auto Név
                          </span>
                        ) : emp.match_type === 'MANUAL' ? (
                          <span className="text-purple-600 flex items-center justify-center gap-1">
                            <Link2 className="h-3 w-3" /> Kézi
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[11px] text-muted-foreground">
                        {emp.paid_date || '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {emp.paid_amount > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnmatch(emp.calculation_id)}
                            title="Párosítás feloldása"
                          >
                            <Unlink className="h-3 w-3 mr-1" />
                            Feloldás
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            onClick={() => handleOpenManualMatch(emp)}
                          >
                            <Link2 className="h-3 w-3 mr-1" />
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

      {/* 3. GIRO Export Modál */}
      <Dialog open={isGiroModalOpen} onOpenChange={setIsGiroModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-primary" />
              Bérutalási Köteg Letöltése (GIRO XML)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Szabványos ISO 20022 / GIRO HCT (pain.001.001.03) XML állomány készítése a netbankba történő feltöltéshez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium text-foreground block mb-1">Terhelendő Céges Számlaszám / IBAN</label>
              <Input
                placeholder="Pl. HU42 1177 3016 1234 5678 0000 0000..."
                value={debtorIban}
                onChange={(e) => setDebtorIban(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <span className="text-[10px] text-muted-foreground mt-0.5 block">
                A vállalat bankszámlája, amelyről az átutalás történik.
              </span>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Teljesítés Kért Dátuma</label>
              <Input
                type="date"
                value={executionDate}
                onChange={(e) => setExecutionDate(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>

            <div className="p-3 rounded-md bg-muted/50 border border-border/60 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Átutalásra kijelölt munkavállalók:</span>
                <span className="font-bold">{employees.filter((i) => i.total_payable > 0 && i.bank_account).length} fő</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Összes utalandó összeg:</span>
                <span className="font-bold font-mono text-primary">{formatCurrencyLocale(totalPayable, 'HUF')}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsGiroModalOpen(false)} className="text-xs h-8">
              Mégse
            </Button>
            <Button size="sm" onClick={handleDownloadGiro} className="text-xs h-8 bg-primary text-primary-foreground">
              <Download className="h-3.5 w-3.5 mr-1" />
              XML Fájl Letöltése
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Kézi Párosítás Modál */}
      <Dialog open={!!manualMatchItem} onOpenChange={(open) => !open && setManualMatchItem(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Kifizetés Kézi Rögzítése
            </DialogTitle>
            <DialogDescription className="text-xs">
              Rögzítsd a kifizetett összeget {manualMatchItem?.employee_name} részére.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-medium block mb-1 text-muted-foreground">Előírt Nettó Munkabér:</label>
              <div className="font-mono font-bold text-sm text-foreground">
                {formatCurrencyLocale(manualMatchItem?.total_payable || 0, 'HUF')}
              </div>
            </div>

            <div>
              <label className="font-medium block mb-1 text-foreground">Kifizetett Összeg (Ft):</label>
              <Input
                type="number"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                className="h-9 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setManualMatchItem(null)} className="text-xs h-8">
              Mégse
            </Button>
            <Button size="sm" onClick={handleSaveManualMatch} className="text-xs h-8 bg-primary text-primary-foreground">
              Rögzítés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
