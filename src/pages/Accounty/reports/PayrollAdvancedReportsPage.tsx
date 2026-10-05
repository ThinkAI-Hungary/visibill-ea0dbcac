import React, { useState, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, TrendingUp, Users, DollarSign,
  PieChart, RefreshCw, Table, FileSpreadsheet, Database,
  Calendar, CheckCircle2, AlertTriangle, ExternalLink, ShieldCheck,
  Building2, Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/accounty';
import {
  usePayrollCycles,
  usePayrollEmployees,
  useCompanyEmployments,
  usePayrollCalculations,
  useCreateCycle,
  useRunBatchPayroll,
  payrollQueryKeys,
  type PayrollCalculation,
} from '@/hooks/usePayrollData';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

type ReportType =
  | 'salary_journal'
  | 'cost_analysis'
  | 'tax_summary'
  | 'headcount'
  | 'leave'
  | 'garnishment'
  | 'contributions'
  | 'custom';

const REPORT_TYPES: { id: ReportType; title: string; icon: React.ElementType; desc: string; color: string }[] = [
  { id: 'salary_journal', title: 'Bérnaplózás', icon: Table, desc: 'Feladás a főkönyvi könyvelésbe — automatikus exportformátum', color: 'from-blue-500 to-indigo-500' },
  { id: 'cost_analysis', title: 'Bérköltség analízis', icon: TrendingUp, desc: 'Költséghely/telephely/részleg szerinti költségbontás', color: 'from-emerald-500 to-teal-500' },
  { id: 'tax_summary', title: 'Közteher összesítő', icon: DollarSign, desc: 'SZJA, SZOCHO, TB járulékok havi összesítő', color: 'from-violet-500 to-purple-500' },
  { id: 'headcount', title: 'Létszámjelentés', icon: Users, desc: 'Telephelyenkénti és státusz szerinti létszámkimutatás', color: 'from-amber-500 to-orange-500' },
  { id: 'leave', title: 'Szabadságkeret kimutatás', icon: Calendar, desc: 'Munkavállaló szintű szabadság/betegszabadság összesítés', color: 'from-pink-500 to-rose-500' },
  { id: 'garnishment', title: 'Letiltások összesítő', icon: FileSpreadsheet, desc: 'Aktív letiltások és levonások kimutatása', color: 'from-red-500 to-red-600' },
  { id: 'contributions', title: 'Járulék ellenőrzés', icon: PieChart, desc: 'Minimálbér alapú járulékellenőrzés', color: 'from-cyan-500 to-blue-500' },
  { id: 'custom', title: 'Egyedi riport', icon: BarChart3, desc: 'Tetszőleges mezőválogatás és szűrőkkel', color: 'from-muted-foreground/80 to-muted-foreground' },
];

const MONTH_NAMES = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december'
];

function fmt(n: number | null | undefined): string {
  return `${Number(n || 0).toLocaleString('hu-HU')} Ft`;
}

function fmtNum(n: number | null | undefined): string {
  return Number(n || 0).toLocaleString('hu-HU');
}

export default function PayrollAdvancedReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: clients } = useAccountyClients();
  const activeCompanyId = companyId || localStorage.getItem('accounty_selected_company_id') || clients?.[0]?.id || '';
  const company = useMemo(() => clients?.find(c => c.id === activeCompanyId), [clients, activeCompanyId]);

  const [selectedReport, setSelectedReport] = useState<ReportType>('salary_journal');
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isGenerating, setIsGenerating] = useState(false);

  const [selectedYear, selectedMonth] = useMemo(() => {
    const parts = period.split('-');
    return [parseInt(parts[0], 10), parseInt(parts[1], 10)];
  }, [period]);

  const periodFormatted = useMemo(() => {
    return `${selectedYear}. ${MONTH_NAMES[selectedMonth - 1] || selectedMonth}`;
  }, [selectedYear, selectedMonth]);

  // DB queries
  const { data: cycles = [] } = usePayrollCycles(activeCompanyId);
  const { data: employments = [] } = useCompanyEmployments(activeCompanyId);
  const { data: employees = [] } = usePayrollEmployees(activeCompanyId);

  const currentCycle = useMemo(() => {
    return cycles.find(c => c.year === selectedYear && c.month === selectedMonth);
  }, [cycles, selectedYear, selectedMonth]);

  const { data: calculations = [], isLoading: isLoadingCalcs } = usePayrollCalculations(currentCycle?.id || '');

  const createCycle = useCreateCycle();
  const runBatchPayroll = useRunBatchPayroll();

  // Combine calculations with employment and employee records
  const reportRows = useMemo(() => {
    if (!calculations || calculations.length === 0) return [];

    return calculations.map((calc: PayrollCalculation) => {
      const employment = employments.find(e => e.id === calc.employment_id);
      const employee = employees.find(
        emp => emp.id === employment?.employee_id || emp.id === (calc.metadata as any)?.employee_id
      );

      const name = employee
        ? `${employee.last_name} ${employee.first_name}`.trim()
        : ((calc.metadata as any)?.employee_name as string) || '–';

      const taxId = employee?.tax_id || '–';
      const tajNumber = employee?.taj_number || '–';
      const jobTitle = employment?.job_title || '–';
      const feorCode = employment?.feor_code || employment?.job_code || '–';
      const costCenter = employment?.cost_center || employment?.department || 'Általános / Nincs megadva';
      const department = employment?.department || '–';
      const employmentType = employment?.employment_type || 'Munkaviszony';
      const weeklyHours = employment?.weekly_hours || 40;
      const startDate = employment?.start_date || '–';
      const isPensioner = Boolean(employment?.is_pensioner);
      const baseSalary = Number(employment?.base_salary || 0);
      const salaryType = employment?.salary_type || 'monthly';

      const grossSalary = Number(calc.gross_salary || 0);
      const szjaBase = Number(calc.szja_base || grossSalary);
      const szjaAmount = Number(calc.szja_amount || 0);
      const tbAmount = Number(calc.tb_amount || 0);
      const szochoAmount = Number(calc.szocho_amount || 0);
      const netSalary = Number(calc.net_salary || 0);
      const totalDeductions = Number(calc.total_deductions || 0);

      const deductionsObj = (calc.deductions as any) || {};
      const garnishments = Number(deductionsObj.garnishments || 0);
      const advances = Number(deductionsObj.advances || 0);
      const otherDeductions = Number(deductionsObj.other || 0);

      const sickDays = Number(calc.sick_leave_days || (calc.metadata as any)?.sick_days || 0);
      const tappenzDays = Number(calc.tappenz_days || 0);
      const workedDays = Number((calc.metadata as any)?.commute_days || calc.insured_days || 21);

      return {
        calcId: calc.id,
        employmentId: calc.employment_id,
        employeeId: employee?.id || '',
        name,
        taxId,
        tajNumber,
        jobTitle,
        feorCode,
        costCenter,
        department,
        employmentType,
        weeklyHours,
        startDate,
        isPensioner,
        baseSalary,
        salaryType,
        grossSalary,
        szjaBase,
        szjaAmount,
        tbAmount,
        szochoAmount,
        netSalary,
        totalDeductions,
        garnishments,
        advances,
        otherDeductions,
        sickDays,
        tappenzDays,
        workedDays,
      };
    });
  }, [calculations, employments, employees]);

  // Aggregated totals across all rows
  const totals = useMemo(() => {
    return {
      gross: reportRows.reduce((sum, r) => sum + r.grossSalary, 0),
      net: reportRows.reduce((sum, r) => sum + r.netSalary, 0),
      szja: reportRows.reduce((sum, r) => sum + r.szjaAmount, 0),
      tb: reportRows.reduce((sum, r) => sum + r.tbAmount, 0),
      szocho: reportRows.reduce((sum, r) => sum + r.szochoAmount, 0),
      deductions: reportRows.reduce((sum, r) => sum + r.totalDeductions, 0),
      garnishments: reportRows.reduce((sum, r) => sum + r.garnishments, 0),
      advances: reportRows.reduce((sum, r) => sum + r.advances, 0),
      totalCost: reportRows.reduce((sum, r) => sum + r.grossSalary + r.szochoAmount, 0),
      headcount: reportRows.length,
    };
  }, [reportRows]);

  // Cost center aggregated breakdown
  const costCenterBreakdown = useMemo(() => {
    const map = new Map<string, {
      name: string;
      headcount: number;
      gross: number;
      szocho: number;
      totalCost: number;
    }>();

    reportRows.forEach(r => {
      const cc = r.costCenter || 'Általános';
      const existing = map.get(cc) || { name: cc, headcount: 0, gross: 0, szocho: 0, totalCost: 0 };
      existing.headcount += 1;
      existing.gross += r.grossSalary;
      existing.szocho += r.szochoAmount;
      existing.totalCost += (r.grossSalary + r.szochoAmount);
      map.set(cc, existing);
    });

    const totalCompanyCost = totals.totalCost || 1;
    return Array.from(map.values()).map(g => ({
      ...g,
      avgCost: Math.round(g.totalCost / Math.max(1, g.headcount)),
      pct: Math.round((g.totalCost / totalCompanyCost) * 100),
    }));
  }, [reportRows, totals.totalCost]);

  // Generate / Recalculate handler
  const handleGenerateReport = async () => {
    if (!activeCompanyId) {
      toast({
        variant: 'destructive',
        title: 'Hiba',
        description: 'Nincs kiválasztva cég.',
      });
      return;
    }

    if (employments.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nincs aktív jogviszony',
        description: 'A riport generálásához először rögzíts munkavállalót a céghez.',
      });
      return;
    }

    setIsGenerating(true);
    try {
      // 1. Ensure cycle exists
      let cycle = currentCycle;
      if (!cycle) {
        cycle = await createCycle.mutateAsync({
          company_id: activeCompanyId,
          year: selectedYear,
          month: selectedMonth,
        });
      }

      // 2. Run batch payroll to populate calculations
      await runBatchPayroll.mutateAsync({
        companyId: activeCompanyId,
        cycleId: cycle.id,
        year: selectedYear,
        month: selectedMonth,
      });

      // 3. Invalidate query cache
      await queryClient.invalidateQueries({ queryKey: payrollQueryKeys.cycles(activeCompanyId) });
      await queryClient.invalidateQueries({ queryKey: payrollQueryKeys.calculations(cycle.id) });

      const reportName = REPORT_TYPES.find(r => r.id === selectedReport)?.title || 'Riport';
      toast({
        title: 'Riport sikeresen legenerálva',
        description: `${reportName} adatai elkészültek a(z) ${periodFormatted} időszakra.`,
      });
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast({
        variant: 'destructive',
        title: 'Hiba a riport generálásakor',
        description: err.message || 'Nem sikerült legenerálni a riportot.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Export configuration for the currently selected report
  const exportConfig = useMemo(() => {
    const reportTitle = REPORT_TYPES.find(r => r.id === selectedReport)?.title || 'Riport';
    const filename = `${selectedReport}_${period}`;
    const companyName = company?.name || 'Cég';

    switch (selectedReport) {
      case 'salary_journal':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Alapbér (Ft)',
            'Bruttó bér (T 541 / K 471)',
            'SZJA levonás (T 471 / K 462)',
            'TB levonás (T 471 / K 473)',
            'Egyéb levonás / Letiltás',
            'Nettó kifizetendő (T 471 / K 384)',
            'SZOCHO (T 561 / K 463)',
            'Teljes bérköltség (Ft)'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.baseSalary,
            r.grossSalary,
            r.szjaAmount,
            r.tbAmount,
            r.totalDeductions,
            r.netSalary,
            r.szochoAmount,
            r.grossSalary + r.szochoAmount
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'landscape' as const,
          }
        };

      case 'cost_analysis':
        return {
          filename,
          headers: [
            'Költséghely / Részleg',
            'Létszám (fő)',
            'Összes Bruttó bér (Ft)',
            'Összes SZOCHO (Ft)',
            'Teljes bérköltség (Ft)',
            'Átlagos költség / fő (Ft)',
            'Részarány (%)'
          ],
          getRows: () => costCenterBreakdown.map(g => [
            g.name,
            g.headcount,
            g.gross,
            g.szocho,
            g.totalCost,
            g.avgCost,
            `${g.pct}%`
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'portrait' as const,
          }
        };

      case 'tax_summary':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Adóazonosító',
            'Bruttó bér (Ft)',
            'SZJA adóalap (Ft)',
            'Levont SZJA (Ft)',
            'TB járulékalap (Ft)',
            'Levont TB (Ft)',
            'SZOCHO alap (Ft)',
            'Fizetendő SZOCHO (Ft)',
            'Összes közteher (Ft)'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.taxId,
            r.grossSalary,
            r.szjaBase,
            r.szjaAmount,
            r.grossSalary,
            r.tbAmount,
            r.grossSalary,
            r.szochoAmount,
            r.szjaAmount + r.tbAmount + r.szochoAmount
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'landscape' as const,
          }
        };

      case 'headcount':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Munkakör',
            'FEOR-kód',
            'Foglalkoztatás jellege',
            'Heti óraszám',
            'Költséghely',
            'Belépés dátuma',
            'Nyugdíjas',
            'Státusz'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.jobTitle,
            r.feorCode,
            r.employmentType,
            `${r.weeklyHours} óra`,
            r.costCenter,
            r.startDate,
            r.isPensioner ? 'Igen' : 'Nem',
            'Aktív'
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'landscape' as const,
          }
        };

      case 'leave':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Ledolgozott napok',
            'Tárgyhavi szabadság (nap)',
            'Betegszabadság (nap)',
            'Táppénz (nap)',
            'Éves alapszabadság keret (nap)',
            'Hátralévő keret (nap)'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.workedDays,
            0,
            r.sickDays,
            r.tappenzDays,
            20,
            20
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'portrait' as const,
          }
        };

      case 'garnishment':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Adóazonosító',
            'Megállapított nettó (Ft)',
            'Bérletiltás (Ft)',
            'Bérfizetési előleg (Ft)',
            'Egyéb levonás (Ft)',
            'Összes levonás (Ft)',
            'Kifizetendő összeg (Ft)'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.taxId,
            r.netSalary + r.totalDeductions,
            r.garnishments,
            r.advances,
            r.otherDeductions,
            r.totalDeductions,
            r.netSalary
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'landscape' as const,
          }
        };

      case 'contributions':
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Munkakör & FEOR',
            'Alapbér (Ft)',
            'Minimálbér ref. (Ft)',
            'Minimális alap (30%) (Ft)',
            'Alkalmazott járulékalap (Ft)',
            'Kiegészítő járulék szükséges',
            'Státusz'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            `${r.jobTitle} (${r.feorCode})`,
            r.baseSalary,
            322800,
            96840,
            r.grossSalary,
            r.grossSalary < 96840 && !r.isPensioner ? 'Igen' : 'Nem',
            r.isPensioner ? 'Mentesített (Nyugdíjas)' : (r.grossSalary >= 96840 ? 'Megfelelő' : 'Kiegészítés szükséges')
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'portrait' as const,
          }
        };

      case 'custom':
      default:
        return {
          filename,
          headers: [
            'Munkavállaló',
            'Adóazonosító',
            'TAJ szám',
            'Munkakör',
            'FEOR',
            'Heti óra',
            'Költséghely',
            'Alapbér (Ft)',
            'Bruttó bér (Ft)',
            'Nettó bér (Ft)'
          ],
          getRows: () => reportRows.map(r => [
            r.name,
            r.taxId,
            r.tajNumber,
            r.jobTitle,
            r.feorCode,
            `${r.weeklyHours} óra`,
            r.costCenter,
            r.baseSalary,
            r.grossSalary,
            r.netSalary
          ]),
          pdfOptions: {
            title: reportTitle,
            subtitle: `Időszak: ${periodFormatted}`,
            companyName,
            period: periodFormatted,
            orientation: 'landscape' as const,
          }
        };
    }
  }, [selectedReport, period, periodFormatted, company?.name, reportRows, costCenterBreakdown]);

  const activeReportMeta = REPORT_TYPES.find(r => r.id === selectedReport);

  // Render individual report tables when calculations exist
  const renderActiveReportTable = () => {
    switch (selectedReport) {
      case 'salary_journal':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3 text-right">Alapbér</th>
                  <th className="px-3 py-3 text-right">Bruttó bér (T 541 / K 471)</th>
                  <th className="px-3 py-3 text-right">SZJA (T 471 / K 462)</th>
                  <th className="px-3 py-3 text-right">TB (T 471 / K 473)</th>
                  <th className="px-3 py-3 text-right">Levonások</th>
                  <th className="px-3 py-3 text-right">Nettó kifizetendő (T 471 / K 384)</th>
                  <th className="px-3 py-3 text-right">SZOCHO (T 561 / K 463)</th>
                  <th className="px-4 py-3 text-right">Teljes bérköltség</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => (
                  <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <div>{r.name}</div>
                      <div className="text-[10px] text-muted-foreground">{r.jobTitle}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(r.baseSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{fmt(r.grossSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">-{fmt(r.szjaAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">-{fmt(r.tbAmount)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(r.totalDeductions)}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">{fmt(r.netSalary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-purple-600 dark:text-purple-400">{fmt(r.szochoAmount)}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground">{fmt(r.grossSalary + r.szochoAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/70 font-semibold border-t-2 border-border text-foreground">
                <tr>
                  <td className="px-4 py-3">Összesen ({reportRows.length} fő)</td>
                  <td className="px-3 py-3 text-right font-mono">—</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">-{fmt(totals.szja)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">-{fmt(totals.tb)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.deductions)}</td>
                  <td className="px-3 py-3 text-right font-mono text-green-600 dark:text-green-400">{fmt(totals.net)}</td>
                  <td className="px-3 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{fmt(totals.szocho)}</td>
                  <td className="px-4 py-3 text-right font-mono text-primary font-bold">{fmt(totals.totalCost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case 'cost_analysis':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Költséghely / Részleg</th>
                  <th className="px-3 py-3 text-center">Létszám (fő)</th>
                  <th className="px-3 py-3 text-right">Összes Bruttó bér</th>
                  <th className="px-3 py-3 text-right">Összes SZOCHO</th>
                  <th className="px-3 py-3 text-right">Teljes bérköltség</th>
                  <th className="px-3 py-3 text-right">Átlagos költség / fő</th>
                  <th className="px-4 py-3 text-right">Részarány</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {costCenterBreakdown.map((g, idx) => (
                  <tr key={idx} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      {g.name}
                    </td>
                    <td className="px-3 py-3 text-center font-mono">{g.headcount} fő</td>
                    <td className="px-3 py-3 text-right font-mono text-foreground">{fmt(g.gross)}</td>
                    <td className="px-3 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{fmt(g.szocho)}</td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-foreground">{fmt(g.totalCost)}</td>
                    <td className="px-3 py-3 text-right font-mono text-muted-foreground">{fmt(g.avgCost)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-mono text-xs font-semibold">{g.pct}%</span>
                        <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, g.pct)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/70 font-semibold border-t-2 border-border text-foreground">
                <tr>
                  <td className="px-4 py-3">Összesen</td>
                  <td className="px-3 py-3 text-center font-mono">{totals.headcount} fő</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.szocho)}</td>
                  <td className="px-3 py-3 text-right font-mono text-primary font-bold">{fmt(totals.totalCost)}</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(Math.round(totals.totalCost / Math.max(1, totals.headcount)))}</td>
                  <td className="px-4 py-3 text-right font-mono">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case 'tax_summary':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3">Adóazonosító</th>
                  <th className="px-3 py-3 text-right">Bruttó bér</th>
                  <th className="px-3 py-3 text-right">SZJA alap</th>
                  <th className="px-3 py-3 text-right">Levont SZJA</th>
                  <th className="px-3 py-3 text-right">TB járulék</th>
                  <th className="px-3 py-3 text-right">Fizetendő SZOCHO</th>
                  <th className="px-4 py-3 text-right">Összes közteher</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => {
                  const employeeTotalTax = r.szjaAmount + r.tbAmount + r.szochoAmount;
                  return (
                    <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.taxId}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmt(r.grossSalary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(r.szjaBase)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">{fmt(r.szjaAmount)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">{fmt(r.tbAmount)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-purple-600 dark:text-purple-400">{fmt(r.szochoAmount)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{fmt(employeeTotalTax)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/70 font-semibold border-t-2 border-border text-foreground">
                <tr>
                  <td className="px-4 py-3">Összesen</td>
                  <td className="px-3 py-3">—</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono">—</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{fmt(totals.szja)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">{fmt(totals.tb)}</td>
                  <td className="px-3 py-3 text-right font-mono text-purple-600 dark:text-purple-400">{fmt(totals.szocho)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{fmt(totals.szja + totals.tb + totals.szocho)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case 'headcount':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3">Munkakör (FEOR)</th>
                  <th className="px-3 py-3">Foglalkoztatás jellege</th>
                  <th className="px-3 py-3 text-center">Heti óra</th>
                  <th className="px-3 py-3">Költséghely</th>
                  <th className="px-3 py-3">Kezdés</th>
                  <th className="px-3 py-3 text-center">Nyugdíjas</th>
                  <th className="px-4 py-3 text-center">Státusz</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => (
                  <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div className="text-foreground">{r.jobTitle}</div>
                      <div className="text-[10px] font-mono">FEOR: {r.feorCode}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {r.employmentType}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono">{r.weeklyHours} óra</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{r.costCenter}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.startDate}</td>
                    <td className="px-3 py-2.5 text-center">
                      {r.isPensioner ? (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">Igen</Badge>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Nem</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">
                        Aktív
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'leave':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3 text-center">Ledolgozott napok</th>
                  <th className="px-3 py-3 text-center">Tárgyhavi szabadság</th>
                  <th className="px-3 py-3 text-center">Betegszabadság (70%)</th>
                  <th className="px-3 py-3 text-center">Táppénz napok</th>
                  <th className="px-3 py-3 text-center">Éves keret (becsült)</th>
                  <th className="px-4 py-3 text-center">Hátralévő keret</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => (
                  <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-medium">{r.workedDays} nap</td>
                    <td className="px-3 py-2.5 text-center font-mono text-blue-600 dark:text-blue-400">0 nap</td>
                    <td className="px-3 py-2.5 text-center font-mono text-amber-600 dark:text-amber-400">{r.sickDays} nap</td>
                    <td className="px-3 py-2.5 text-center font-mono text-rose-600 dark:text-rose-400">{r.tappenzDays} nap</td>
                    <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">20 nap</td>
                    <td className="px-4 py-2.5 text-center font-mono font-bold text-green-600 dark:text-green-400">20 nap</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'garnishment':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3">Adóazonosító</th>
                  <th className="px-3 py-3 text-right">Megállapított nettó</th>
                  <th className="px-3 py-3 text-right">Letiltás / Levonás</th>
                  <th className="px-3 py-3 text-right">Bérfizetési előleg</th>
                  <th className="px-3 py-3 text-right">Egyéb levonás</th>
                  <th className="px-3 py-3 text-right">Összes levonás</th>
                  <th className="px-4 py-3 text-right">Kifizetendő összeg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => (
                  <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.taxId}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmt(r.netSalary + r.totalDeductions)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-rose-600 dark:text-rose-400">
                      {r.garnishments > 0 ? `-${fmt(r.garnishments)}` : '0 Ft'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-600 dark:text-amber-400">
                      {r.advances > 0 ? `-${fmt(r.advances)}` : '0 Ft'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">
                      {r.otherDeductions > 0 ? `-${fmt(r.otherDeductions)}` : '0 Ft'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                      {r.totalDeductions > 0 ? `-${fmt(r.totalDeductions)}` : '0 Ft'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">{fmt(r.netSalary)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/70 font-semibold border-t-2 border-border text-foreground">
                <tr>
                  <td className="px-4 py-3">Összesen</td>
                  <td className="px-3 py-3">—</td>
                  <td className="px-3 py-3 text-right font-mono">{fmt(totals.net + totals.deductions)}</td>
                  <td className="px-3 py-3 text-right font-mono text-rose-600 dark:text-rose-400">-{fmt(totals.garnishments)}</td>
                  <td className="px-3 py-3 text-right font-mono text-amber-600 dark:text-amber-400">-{fmt(totals.advances)}</td>
                  <td className="px-3 py-3 text-right font-mono">—</td>
                  <td className="px-3 py-3 text-right font-mono text-rose-600 dark:text-rose-400">-{fmt(totals.deductions)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-green-600 dark:text-green-400">{fmt(totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );

      case 'contributions':
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                <tr>
                  <th className="px-4 py-3">Munkavállaló</th>
                  <th className="px-3 py-3">Munkakör & FEOR</th>
                  <th className="px-3 py-3 text-right">Alapbér</th>
                  <th className="px-3 py-3 text-right">Minimálbér referencia</th>
                  <th className="px-3 py-3 text-right">Min. járulékalap (30%)</th>
                  <th className="px-3 py-3 text-right">Tényleges járulékalap</th>
                  <th className="px-4 py-3 text-center">Megfelelőség</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reportRows.map(r => {
                  const isCompliant = r.grossSalary >= 96840 || r.isPensioner;
                  return (
                    <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.jobTitle} ({r.feorCode})</td>
                      <td className="px-3 py-2.5 text-right font-mono">{fmt(r.baseSalary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(322800)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(96840)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold">{fmt(r.grossSalary)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {r.isPensioner ? (
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px]">
                            Mentesített (Nyugdíjas)
                          </Badge>
                        ) : isCompliant ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px] gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Megfelelő
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3" /> Min. alap kiegészítés
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );

      case 'custom':
      default:
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Egyedi riportépítő (Custom Report Builder)</h4>
                  <p className="text-xs text-muted-foreground">
                    Személyre szabott oszlopválogatás, szűrési feltételek és adatexport készítése az összes törzsadat mezőből.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => navigate(`${location.pathname}/custom`)}
              >
                <ExternalLink className="w-4 h-4" /> Riportkészítő megnyitása
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="px-4 py-3">Munkavállaló</th>
                    <th className="px-3 py-3">Adóazonosító</th>
                    <th className="px-3 py-3">TAJ szám</th>
                    <th className="px-3 py-3">Munkakör (FEOR)</th>
                    <th className="px-3 py-3 text-center">Heti óra</th>
                    <th className="px-3 py-3">Költséghely</th>
                    <th className="px-3 py-3 text-right">Alapbér</th>
                    <th className="px-3 py-3 text-right">Bruttó bér</th>
                    <th className="px-4 py-3 text-right">Nettó bér</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportRows.map(r => (
                    <tr key={r.calcId} className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.name}</td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.taxId}</td>
                      <td className="px-3 py-2.5 font-mono text-muted-foreground">{r.tajNumber}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.jobTitle} ({r.feorCode})</td>
                      <td className="px-3 py-2.5 text-center font-mono">{r.weeklyHours} óra</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{r.costCenter}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{fmt(r.baseSalary)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-foreground">{fmt(r.grossSalary)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-green-600 dark:text-green-400">{fmt(r.netSalary)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
    }
  };

  // Render KPI cards above active report
  const renderKpiCards = () => {
    if (reportRows.length === 0) return null;

    if (selectedReport === 'salary_journal' || selectedReport === 'custom') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Bruttó bérköltség (541)</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{fmt(totals.gross)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{totals.headcount} fő munkavállaló</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">SZJA levonás (462)</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">-{fmt(totals.szja)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">15% személyi jövedelemadó</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">TB járulék (473)</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">-{fmt(totals.tb)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">18.5% társadalombiztosítás</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Nettó kifizetés (471)</p>
            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400 mt-0.5">{fmt(totals.net)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Utalandó munkabér</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card col-span-2 md:col-span-1">
            <p className="text-[11px] font-medium text-muted-foreground">Teljes bérköltség</p>
            <p className="text-lg font-bold font-mono text-primary mt-0.5">{fmt(totals.totalCost)}</p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">+ {fmt(totals.szocho)} SZOCHO</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'cost_analysis') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Költséghelyek száma</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{costCenterBreakdown.length} db</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Rögzített részleg/egység</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Összes létszám</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{totals.headcount} fő</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aktív munkavállaló</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Teljes bérköltség</p>
            <p className="text-lg font-bold font-mono text-primary mt-0.5">{fmt(totals.totalCost)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Bruttó + SZOCHO</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Átlagköltség / fő</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">
              {fmt(Math.round(totals.totalCost / Math.max(1, totals.headcount)))}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Vállalati átlagos ráfordítás</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'tax_summary') {
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Összes közteher kötelezettség</p>
            <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              {fmt(totals.szja + totals.tb + totals.szocho)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">SZJA + TB + SZOCHO fizetendő</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">SZJA kötelezettség</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{fmt(totals.szja)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">NAV 10032000-01076034</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">TB járulék</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{fmt(totals.tb)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">18.5% levont egyéni járulék</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">SZOCHO kötelezettség</p>
            <p className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">{fmt(totals.szocho)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">13% munkáltatói teher</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'headcount') {
      const fullTime = reportRows.filter(r => r.weeklyHours >= 40).length;
      const partTime = reportRows.length - fullTime;
      const avgHours = Math.round(reportRows.reduce((s, r) => s + r.weeklyHours, 0) / Math.max(1, reportRows.length));

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Állományi létszám</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{reportRows.length} fő</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aktív jogviszonyos dolgozó</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Teljes munkaidős</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{fullTime} fő</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Heti 40 órás foglalkoztatás</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Részmunkaidős</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{partTime} fő</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Részmunkaidős állomány</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Átlagos heti munkaidő</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{avgHours} óra</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Dolgozónkénti átlag</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'leave') {
      const totalSick = reportRows.reduce((s, r) => s + r.sickDays, 0);
      const totalTappenz = reportRows.reduce((s, r) => s + r.tappenzDays, 0);
      const totalWorked = reportRows.reduce((s, r) => s + r.workedDays, 0);

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Ledolgozott napok</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{totalWorked} nap</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tárgyhavi összes munkanap</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Kivett szabadság</p>
            <p className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">0 nap</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Fizetett rendes szabadság</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Betegszabadság (70%)</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{totalSick} nap</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Munkáltatói teher</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Táppénzes napok</p>
            <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{totalTappenz} nap</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">TB ellátás</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'garnishment') {
      const garnishedCount = reportRows.filter(r => r.garnishments > 0).length;

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Érintett munkavállalók</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{garnishedCount} fő</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Aktív letiltással rendelkező</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Letiltások levonása</p>
            <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">{fmt(totals.garnishments)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Végrehajtói/bírósági letiltás</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Bérfizetési előlegek</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{fmt(totals.advances)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Havi előlegtörlesztés</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Levonások utáni nettó kifizetés</p>
            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400 mt-0.5">{fmt(totals.net)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Munkavállalóknak kiutalandó</p>
          </div>
        </div>
      );
    }

    if (selectedReport === 'contributions') {
      const compliantCount = reportRows.filter(r => r.grossSalary >= 96840 || r.isPensioner).length;
      const requiresMinBaseDiff = reportRows.filter(r => r.grossSalary < 96840 && !r.isPensioner).length;

      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Ellenőrzött jogviszonyok</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{reportRows.length} db</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Tbj. 27. § szerinti ellenőrzés</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Megfelelő bérezésű</p>
            <p className="text-lg font-bold font-mono text-green-600 dark:text-green-400 mt-0.5">{compliantCount} db</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Min. alap felett vagy mentesített</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">30%-os minimális alap küszöb</p>
            <p className="text-lg font-bold font-mono text-foreground mt-0.5">{fmt(96840)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Minimálbér (322 800 Ft) 30%-a</p>
          </div>
          <div className="p-3.5 rounded-lg border border-border bg-card">
            <p className="text-[11px] font-medium text-muted-foreground">Kiegészítendő jogviszonyok</p>
            <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">{requiresMinBaseDiff} db</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Munkáltatói kiegészítés szükséges</p>
          </div>
        </div>
      );
    }

    return null;
  };

  // Main Report Content Renderer
  const renderReportContent = () => {
    const reportTitle = activeReportMeta?.title || 'Riport';

    if (isLoadingCalcs) {
      return (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <RefreshCw className="w-8 h-8 mx-auto text-primary animate-spin" />
          <h3 className="text-base font-bold text-foreground">Riport adatok betöltése...</h3>
          <p className="text-xs text-muted-foreground">{periodFormatted} bérszámfejtési adatok lekérése</p>
        </div>
      );
    }

    // Empty state when no calculations exist for this period
    if (reportRows.length === 0) {
      return (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Database className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-bold text-foreground">{reportTitle}</h3>
            <p className="text-sm text-muted-foreground">
              Nincsenek riport adatok a kiválasztott időszakra ({periodFormatted}).
            </p>
            <p className="text-xs text-muted-foreground">
              {employments.length > 0
                ? `A céghez ${employments.length} aktív jogviszony van rögzítve. Kattints a Riport generálás gombra a bérszámfejtési kalkulációk lefuttatásához és a riport elkészítéséhez.`
                : 'A céghez jelenleg nincs rögzített aktív jogviszony. A riportokhoz először rögzíts munkavállalót.'}
            </p>
          </div>
          <div className="flex gap-2.5 justify-center pt-2">
            <Button
              onClick={handleGenerateReport}
              disabled={isGenerating || employments.length === 0}
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm"
            >
              <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
              {isGenerating ? 'Riport generálása folyamatban...' : 'Riport generálás'}
            </Button>
          </div>
        </div>
      );
    }

    // Data loaded: Render KPI Cards + Data Table + Actions
    return (
      <div className="space-y-4">
        {renderKpiCards()}

        <div className="bg-card rounded-lg border border-border shadow-xs overflow-hidden">
          <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{reportTitle}</span>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
                  {periodFormatted}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{activeReportMeta?.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateReport}
                disabled={isGenerating}
                className="gap-1.5 text-xs h-8"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
                {isGenerating ? 'Újraszámolás...' : 'Riport újragenerálása'}
              </Button>
              <ExportButton
                filename={exportConfig.filename}
                headers={exportConfig.headers}
                getRows={exportConfig.getRows}
                pdfOptions={exportConfig.pdfOptions}
                size="sm"
                className="h-8 text-xs gap-1.5"
              />
            </div>
          </div>

          {renderActiveReportTable()}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 page-animate pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Vissza"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg shadow-lg shadow-primary/20">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Riportok és kimutatások</h1>
            <p className="text-sm text-muted-foreground">
              {company?.name ? `${company.name} — ` : ''}Bérszámfejtési adatok elemzése és exportálása
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary outline-none"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateReport}
            disabled={isGenerating || employments.length === 0}
            className="gap-1.5 text-xs h-9"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isGenerating && "animate-spin")} />
            {isGenerating ? 'Generálás...' : reportRows.length > 0 ? 'Újragenerálás' : 'Riport generálás'}
          </Button>

          {reportRows.length > 0 && (
            <ExportButton
              filename={exportConfig.filename}
              headers={exportConfig.headers}
              getRows={exportConfig.getRows}
              pdfOptions={exportConfig.pdfOptions}
              size="sm"
              className="h-9 text-xs"
            />
          )}
        </div>
      </div>

      {/* 8 Report Type Selection Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {REPORT_TYPES.map(r => {
          const isSelected = selectedReport === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className={cn(
                'p-4 rounded-lg border-2 text-left transition-all hover:-translate-y-0.5 flex flex-col justify-between',
                isSelected
                  ? 'border-primary bg-primary/10 dark:bg-primary/10 shadow-md ring-1 ring-primary/20'
                  : 'border-border bg-card hover:border-primary/40'
              )}
            >
              <div>
                <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2.5 shadow-sm', r.color)}>
                  <r.icon className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-foreground">{r.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{r.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Report Content */}
      {renderReportContent()}
    </div>
  );
}
