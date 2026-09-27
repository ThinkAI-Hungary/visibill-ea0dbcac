import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Send, Clock,
  Loader2, Database, Users, Eye, FileCode, CheckCircle2,
  AlertTriangle, CreditCard, Building2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import {
  usePayrollCycles, usePayrollCalculations, usePayrollEmployees
} from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/accounty';
import { useToast } from '@/hooks/use-toast';
import { generateFiling08Xml, downloadXml } from '@/lib/payroll/filingGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { FinancialPageSkeleton } from '@/components/ui/financial-skeleton';
import { FilingPreFlightDialog } from '@/components/accounty/filings/FilingPreFlightDialog';

const fmt = (n: number) => n.toLocaleString('hu-HU') + ' Ft';
const MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

export default function Filing2608Page() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Pre-flight dialog state
  const [preFlightOpen, setPreFlightOpen] = useState(false);
  const [preFlightAction, setPreFlightAction] = useState<'xml' | 'preview'>('xml');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');
  const [employments, setEmployments] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('accounty_employments')
      .select('*')
      .eq('company_id', companyId)
      .then(({ data }) => { if (data) setEmployments(data); });
  }, [companyId]);

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Find matching cycle
  const cycle = useMemo(
    () => cycles.find(c => c.year === selectedYear && c.month === selectedMonth),
    [cycles, selectedYear, selectedMonth]
  );

  const { data: calculations = [], isLoading } = usePayrollCalculations(cycle?.id || '');

  // Build A-lap summary from calculations
  const alapData = useMemo(() => {
    if (calculations.length === 0) return [];
    const totalGross = calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
    const totalSzja = calculations.reduce((s, c) => s + (c.szja_amount || 0), 0);
    const totalTb = calculations.reduce((s, c) => s + (c.tb_amount || 0), 0);
    const totalMinBase = calculations.reduce((s, c) => s + (c.min_base_employer_contribution || 0), 0);
    const totalSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);
    const totalNet = calculations.reduce((s, c) => s + (c.net_salary || 0), 0);
    const totalDeductions = calculations.reduce((s, c) => s + (c.total_deductions || 0), 0);

    return [
      { label: 'Biztosítottak száma', amount: calculations.length, isCnt: true },
      { label: 'Bruttó bér összesen', amount: totalGross },
      { label: 'Személyi jövedelemadó (SZJA 15%)', amount: totalSzja },
      { label: 'Levont TB járulék (18,5%)', amount: totalTb },
      ...(totalMinBase > 0 ? [{ label: 'Minimális járulékalap munkáltatói TB kiegészítés (Tbj. 27. §)', amount: totalMinBase }] : []),
      { label: 'Szociális hozzájárulási adó (SZOCHO 13%)', amount: totalSzocho },
      { label: 'Levonások összesen', amount: totalDeductions },
      { label: 'Nettó kifizetendő munkabér', amount: totalNet },
      { label: 'Összes NAV felé fizetendő közteher', amount: totalSzja + totalTb + totalMinBase + totalSzocho },
    ];
  }, [calculations]);

  // Build M-lap rows from calculations with statutory 4-way TB breakdown
  const mlapRows = useMemo(() => {
    return calculations.map((calc) => {
      const meta = calc.metadata as any;
      const emp = employees.find(e => e.id === meta?.employee_id || `${e.last_name} ${e.first_name}`.trim() === meta?.employee_name);
      const employment = employments.find(em => em.id === calc.employment_id);
      const tbAmount = calc.tb_amount || 0;

      return {
        id: calc.id,
        employmentId: calc.employment_id,
        name: meta?.employee_name || `${emp?.last_name || ''} ${emp?.first_name || ''}`.trim() || '–',
        tajNumber: emp?.taj_number || meta?.taj_number || '–',
        jobCode: employment?.job_code || '1101',
        jobSerialNumber: employment?.job_serial_number || 1,
        feor: employment?.feor_code || '4112',
        weeklyHours: employment?.weekly_hours || 40,
        insuranceStart: employment?.start_date || `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`,
        insuranceEnd: employment?.end_date || undefined,
        grossSalary: calc.gross_salary || 0,
        szja: calc.szja_amount || 0,
        tb: tbAmount,
        tbPension: calc.tb_pension ?? Math.round(tbAmount * (10 / 18.5)),
        tbHealthNature: calc.tb_health_nature ?? Math.round(tbAmount * (4 / 18.5)),
        tbHealthCash: calc.tb_health_cash ?? Math.round(tbAmount * (3 / 18.5)),
        tbLabor: calc.tb_labor ?? Math.round(tbAmount * (1.5 / 18.5)),
        minBaseDiff: calc.min_base_diff || 0,
        minBaseEmployerContribution: calc.min_base_employer_contribution || 0,
        insuredDays: calc.insured_days || 30,
        suspensionDays: calc.suspension_days || 0,
        szocho: calc.szocho_amount || 0,
        netSalary: calc.net_salary || 0,
        deductions: calc.total_deductions || 0,
      };
    });
  }, [calculations, employees, employments, selectedYear, selectedMonth]);

  const totalItems = mlapRows.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedMlapRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return mlapRows.slice(start, start + pageSize);
  }, [mlapRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [mlapRows.length]);

  // Total tax obligations for NAV accounts
  const totalGross = useMemo(() => calculations.reduce((s, c) => s + (c.gross_salary || 0), 0), [calculations]);
  const totalSzja = useMemo(() => calculations.reduce((s, c) => s + (c.szja_amount || 0), 0), [calculations]);
  const totalTb = useMemo(() => calculations.reduce((s, c) => s + (c.tb_amount || 0), 0), [calculations]);
  const totalMinBase = useMemo(() => calculations.reduce((s, c) => s + (c.min_base_employer_contribution || 0), 0), [calculations]);
  const totalSzocho = useMemo(() => calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0), [calculations]);
  const totalNavTax = totalSzja + totalTb + totalMinBase + totalSzocho;

  const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1;
  const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear;
  const dueDateText = `${nextYear}. ${MONTHS[nextMonth - 1]} 12.`;
  const dueDateIso = `${nextYear}-${String(nextMonth).padStart(2, '0')}-12`;

  const buildFilingXml = () => {
    return generateFiling08Xml({
      companyName: company?.name || '–',
      companyTaxNumber: company?.taxNumber || '00000000-0-00',
      companyAddress: company?.address || '',
      year: selectedYear,
      month: selectedMonth,
      totalGrossSalary: totalGross,
      totalSzja,
      totalTb: totalTb + totalMinBase,
      totalSzocho,
      totalEho: 0,
      employees: mlapRows.map(m => {
        const emp = employees.find(e => `${e.last_name} ${e.first_name}`.trim() === m.name);
        return {
          tajNumber: m.tajNumber,
          taxId: emp?.tax_id || '',
          lastName: m.name.split(' ')[0] || '',
          firstName: m.name.split(' ').slice(1).join(' ') || '',
          birthDate: emp?.birth_date || '',
          mothersName: emp?.mother_name || '',
          jobCode: m.jobCode,
          jobSerialNumber: m.jobSerialNumber,
          insuranceStart: m.insuranceStart,
          insuranceEnd: m.insuranceEnd,
          weeklyHours: m.weeklyHours,
          grossSalary: m.grossSalary,
          taxBase: m.grossSalary,
          szjaAmount: m.szja,
          tbBase: m.grossSalary,
          tbAmount: m.tb,
          tbPension: m.tbPension,
          tbHealthNature: m.tbHealthNature,
          tbHealthCash: m.tbHealthCash,
          tbLabor: m.tbLabor,
          minBaseDiff: m.minBaseDiff,
          minBaseEmployerContribution: m.minBaseEmployerContribution,
          insuredDays: m.insuredDays,
          suspensionDays: m.suspensionDays,
          szochoBase: m.grossSalary,
          szochoAmount: m.szocho,
          familyCreditUsed: 0,
          under25CreditUsed: 0,
          newMotherCreditUsed: 0,
          szochoCreditUsed: 0,
          netSalary: m.netSalary,
        };
      }),
      filingType: 'normal',
      submittedBy: 'eaisybooks rendszer',
      submittedAt: new Date().toISOString(),
    });
  };

  const handleXmlExport = () => {
    const xml = buildFilingXml();
    downloadXml(xml, `2608_${company?.name || 'ceg'}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xml`);
    toast({ title: 'XML letöltve', description: 'A 2608-as bevallás ÁNYK XML fájl sikeresen letöltődött.' });
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const xml = buildFilingXml();

      const { data: existing } = await supabase
        .from('accounty_filings')
        .select('id')
        .eq('company_id', companyId!)
        .eq('filing_type', '2608')
        .eq('period_year', selectedYear)
        .eq('period_month', selectedMonth)
        .in('status', ['draft', 'generated'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let filingId: string;

      if (existing) {
        const { error } = await supabase
          .from('accounty_filings')
          .update({ xml_data: xml, status: 'generated' })
          .eq('id', existing.id);
        if (error) throw error;
        filingId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from('accounty_filings')
          .insert({
            company_id: companyId,
            filing_type: '2608',
            period_year: selectedYear,
            period_month: selectedMonth,
            status: 'generated',
            xml_data: xml,
            channel: 'onya',
          })
          .select('id')
          .single();
        if (error) throw error;
        filingId = inserted.id;
      }

      queryClient.invalidateQueries({ queryKey: ['payroll', 'filings'] });
      navigate(`/eaisybooks/payroll/${companyId}/filings/${filingId}/workflow`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  // GIRO CSV Download for NAV taxes
  const handleDownloadGiroCsv = () => {
    const rows = [
      ['Megbízás azonosító', 'Kedvezményezett neve', 'NAV Számlaszám', 'Összeg (HUF)', 'Közlemény (Adószám + Adónem)', 'Esedékesség'],
      [
        `NAV-SZJA-${selectedYear}-${selectedMonth}`,
        'NAV Személyi jövedelemadó beszedési számla (290)',
        '10032000-06055950',
        totalSzja,
        `${company?.taxNumber || ''} SZJA ${selectedYear}.${String(selectedMonth).padStart(2, '0')}`,
        dueDateIso,
      ],
      [
        `NAV-TB-${selectedYear}-${selectedMonth}`,
        'NAV Társadalombiztosítási járulék beszedési számla (407)',
        '10032000-06055819',
        totalTb + totalMinBase,
        `${company?.taxNumber || ''} TB ${selectedYear}.${String(selectedMonth).padStart(2, '0')}`,
        dueDateIso,
      ],
      [
        `NAV-SZOCHO-${selectedYear}-${selectedMonth}`,
        'NAV Szociális hozzájárulási adó beszedési számla (258)',
        '10032000-06055912',
        totalSzocho,
        `${company?.taxNumber || ''} SZOCHO ${selectedYear}.${String(selectedMonth).padStart(2, '0')}`,
        dueDateIso,
      ],
    ];

    const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(';')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GIRO_NAV_${company?.name || 'ceg'}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'GIRO csomag letöltve', description: 'A NAV banki utalási adatok CSV formátumban letöltődtek.' });
  };

  const handleNavSubmit = () => {
    toast({ title: 'Demo mód', description: 'A NAV beküldés éles környezetben az ÁNYK/ONYA integráción keresztül történik.' });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 page-animate">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-primary rounded-lg shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">2608-as havi bevallás</h1>
            <p className="text-sm text-muted-foreground">{company?.name || '–'} — Havi adó- és járulékbevallás (A-lap & M-lapok)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))} className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))} className="px-3 py-2 rounded-lg border border-border bg-card text-sm">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <ExportButton
            filename={`2608_${company?.name || 'ceg'}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}`}
            headers={['Név', 'TAJ', 'Bruttó (Ft)', 'SZJA (Ft)', 'TB (Ft)', 'SZOCHO (Ft)', 'Nettó (Ft)']}
            getRows={() => mlapRows.map(r => [r.name, r.tajNumber, r.grossSalary, r.szja, r.tb, r.szocho, r.netSalary])}
            size="sm"
          />
        </div>
      </div>

      {isLoading ? (
        <FinancialPageSkeleton title="2608-as bevallás betöltése..." />
      ) : calculations.length === 0 ? (
        <div className="bg-card rounded-lg border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nincs számfejtett adat a kiválasztott időszakra ({selectedYear}. {MONTHS[selectedMonth - 1]}).</p>
          <p className="text-xs text-muted-foreground">A bevallás a számfejtés véglegesítése után kerül generálásra.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card rounded-lg border border-border p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Biztosítottak</p>
              <p className="text-2xl font-bold text-blue-600">{calculations.length}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Bruttó összesen</p>
              <p className="text-lg font-bold font-mono">{fmt(totalGross)}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Fizetendő NAV közteher</p>
              <p className="text-lg font-bold font-mono text-red-600">{fmt(totalNavTax)}</p>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 text-center">
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Nettó kifizetés</p>
              <p className="text-lg font-bold font-mono text-green-600">{fmt(calculations.reduce((s, c) => s + (c.net_salary || 0), 0))}</p>
            </div>
          </div>

          {/* NAV Tax Accounts & Payment List */}
          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">NAV Adófizetési Kötelezettségek (Közteher Utalási Lista)</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Esedékesség: {dueDateText}
                </span>
                <Button variant="outline" size="sm" onClick={handleDownloadGiroCsv} className="h-7 text-xs gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> GIRO Csomag Letöltése
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold">
                    <th className="px-5 py-2.5 text-left">Adónem megnevezése</th>
                    <th className="px-3 py-2.5 text-center font-mono">Adónem kód</th>
                    <th className="px-3 py-2.5 text-left font-mono">NAV Kincstári Számlaszám</th>
                    <th className="px-5 py-2.5 text-right">Fizetendő összeg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-foreground">Személyi jövedelemadó (SZJA)</td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold">290</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">10032000-06055950</td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold text-red-600">{fmt(totalSzja)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-foreground">
                      Társadalombiztosítási járulék (TB 18,5%{totalMinBase > 0 ? ' + min. alap kieg.' : ''})
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold">407</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">10032000-06055819</td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold text-blue-600">{fmt(totalTb + totalMinBase)}</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-2.5 font-medium text-foreground">Szociális hozzájárulási adó (SZOCHO 13%)</td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold">258</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">10032000-06055912</td>
                    <td className="px-5 py-2.5 text-right font-mono font-bold text-violet-600">{fmt(totalSzocho)}</td>
                  </tr>
                  <tr className="bg-muted/40 font-bold border-t-2 border-border">
                    <td className="px-5 py-2.5 text-xs">ÖSSZESEN NAV FELÉ UTALANDÓ</td>
                    <td className="px-3 py-2.5 text-center font-mono text-xs">3 tétel</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">NAV Elszámolási számlák</td>
                    <td className="px-5 py-2.5 text-right font-mono text-sm text-foreground">{fmt(totalNavTax)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* A-lap */}
          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold">A-lap — Munkáltatói összesítő</h2>
              <span className="text-xs text-muted-foreground">Időszak: {selectedYear}. {MONTHS[selectedMonth - 1]}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {alapData.map((row, i) => (
                  <tr key={i} className={cn(
                    'border-b border-border/30 hover:bg-muted/50',
                    i === alapData.length - 1 && 'font-bold bg-muted/40/80 dark:bg-card/50'
                  )}>
                    <td className="px-5 py-2.5 text-xs text-muted-foreground">{row.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">
                      {row.isCnt ? `${row.amount} fő` : fmt(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* M-lapok with detailed 4-way TB statutory breakdown */}
          <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold">M-lapok — Tételes egyéni bevallási tételek ({mlapRows.length} fő)</h2>
              <span className="text-xs text-muted-foreground">Kattints a sorra a 4-es TB bontásért és részletekért</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-5 py-2 text-xs font-bold text-muted-foreground uppercase">Név</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-muted-foreground uppercase">TAJ</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Bruttó</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">SZJA</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">TB (18.5%)</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">SZOCHO</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-muted-foreground uppercase">Nettó</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMlapRows.map((m) => (
                    <React.Fragment key={m.id}>
                      <tr
                        className="border-b border-border/30 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(expandedRow === m.id ? null : m.id)}
                      >
                        <td className="px-5 py-2.5 font-medium">
                          <div>{m.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {m.jobCode === '1115' ? 'Tartós megbízás' : 'Munkaviszony'} (Jogviszony #{m.jobSerialNumber})
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">{m.tajNumber}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(m.grossSalary)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-red-600">{fmt(m.szja)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-blue-600">{fmt(m.tb)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-violet-600">{fmt(m.szocho)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-green-600">{fmt(m.netSalary)}</td>
                      </tr>
                      {expandedRow === m.id && (
                        <tr className="bg-muted/30">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="space-y-3 page-animate slide-in-from-top-1 duration-200">
                              <p className="text-[11px] font-bold text-primary uppercase">
                                Törvényi TB 4-es felbontás & Bevallási adatok (2608 M-lap)
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">10% Nyugdíjbiztosítási:</span>
                                  <p className="font-mono font-bold text-blue-600">{fmt(m.tbPension)}</p>
                                </div>
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">4% Természetbeni egészségbizt.:</span>
                                  <p className="font-mono font-bold text-blue-600">{fmt(m.tbHealthNature)}</p>
                                </div>
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">3% Pénzbeli egészségbizt.:</span>
                                  <p className="font-mono font-bold text-blue-600">{fmt(m.tbHealthCash)}</p>
                                </div>
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">1,5% Munkaerőpiaci járulék:</span>
                                  <p className="font-mono font-bold text-blue-600">{fmt(m.tbLabor)}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">Biztosításban töltött napok:</span>
                                  <p className="font-mono font-bold">{m.insuredDays} nap</p>
                                </div>
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">Szünetelési napok (fiz. nélk.):</span>
                                  <p className="font-mono font-bold">{m.suspensionDays} nap</p>
                                </div>
                                <div className="bg-card p-2 rounded border border-border">
                                  <span className="text-[10px] text-muted-foreground">Minimális járulékalap diff. (Tbj. 27. §):</span>
                                  <p className="font-mono font-bold text-amber-600">
                                    {m.minBaseEmployerContribution > 0 ? `${fmt(m.minBaseDiff)} (Munkáltatói TB: ${fmt(m.minBaseEmployerContribution)})` : 'Nem érintett'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Totals */}
                  <tr className="border-t-2 border-border bg-muted/40 font-bold">
                    <td className="px-5 py-2.5 text-xs">ÖSSZESEN</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{mlapRows.length} fő</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(totalGross)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-red-600">{fmt(totalSzja)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-blue-600">{fmt(totalTb)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-violet-600">{fmt(totalSzocho)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-green-600">{fmt(mlapRows.reduce((s, r) => s + r.netSalary, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="border-t border-border px-4 py-3 bg-card">
                <UnifiedPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  pageSizeOptions={[10, 25, 50]}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setPreFlightAction('xml');
                setPreFlightOpen(true);
              }}
            >
              <FileCode className="w-4 h-4" /> XML ellenőrzés & letöltés
            </Button>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setPreFlightAction('preview');
                setPreFlightOpen(true);
              }}
              disabled={generating}
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {generating ? 'Generálás...' : 'Pre-flight ellenőrzés & Beküldés'}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={handleNavSubmit}><Send className="w-4 h-4" /> Beküldés NAV-nak (demo)</Button>
          </div>
        </>
      )}

      {/* Pre-Flight Quality Dialog */}
      <FilingPreFlightDialog
        open={preFlightOpen}
        onOpenChange={setPreFlightOpen}
        year={selectedYear}
        month={selectedMonth}
        companyName={company?.name || 'Munkáltató'}
        calculations={calculations}
        employees={employees}
        confirmLabel={preFlightAction === 'xml' ? '2608 XML Letöltése' : 'Tovább a beküldési munkafolyamathoz'}
        onConfirm={() => {
          if (preFlightAction === 'xml') {
            handleXmlExport();
          } else {
            handlePreview();
          }
        }}
      />
    </div>
  );
}
