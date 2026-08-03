import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Download, Send, Clock,
  Loader2, Database, Users, Eye, FileCode
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

const fmt = (n: number) => n.toLocaleString('hu-HU') + ' Ft';
const MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

export default function Filing2608Page() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');

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
    const totalSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);
    const totalNet = calculations.reduce((s, c) => s + (c.net_salary || 0), 0);
    const totalDeductions = calculations.reduce((s, c) => s + (c.total_deductions || 0), 0);

    return [
      { label: 'Biztosítottak száma', amount: calculations.length, isCnt: true },
      { label: 'Bruttó bér összesen', amount: totalGross },
      { label: 'Személyi jövedelemadó (SZJA 15%)', amount: totalSzja },
      { label: 'TB járulék (18,5%)', amount: totalTb },
      { label: 'Szociális hozzájárulási adó (SZOCHO 13%)', amount: totalSzocho },
      { label: 'Levonások összesen', amount: totalDeductions },
      { label: 'Nettó bér összesen', amount: totalNet },
      { label: 'Fizetendő közteher összesen', amount: totalSzja + totalTb + totalSzocho },
    ];
  }, [calculations]);

  // Build M-lap rows from calculations
  const mlapRows = useMemo(() => {
    return calculations.map((calc) => {
      const meta = calc.metadata as any;
      const emp = employees.find(e => e.id === meta?.employee_id);
      return {
        id: calc.id,
        name: meta?.employee_name || `${emp?.last_name || ''} ${emp?.first_name || ''}`.trim() || '–',
        tajNumber: emp?.taj_number || '–',
        grossSalary: calc.gross_salary || 0,
        szja: calc.szja_amount || 0,
        tb: calc.tb_amount || 0,
        szocho: calc.szocho_amount || 0,
        netSalary: calc.net_salary || 0,
        deductions: calc.total_deductions || 0,
      };
    });
  }, [calculations, employees]);

  const totalItems = mlapRows.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedMlapRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return mlapRows.slice(start, start + pageSize);
  }, [mlapRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [mlapRows.length]);

  const buildFilingXml = () => {
    const totalGross = calculations.reduce((s, c) => s + (c.gross_salary || 0), 0);
    const totalSzja = calculations.reduce((s, c) => s + (c.szja_amount || 0), 0);
    const totalTb = calculations.reduce((s, c) => s + (c.tb_amount || 0), 0);
    const totalSzocho = calculations.reduce((s, c) => s + (c.szocho_amount || 0), 0);

    return generateFiling08Xml({
      companyName: company?.name || '–',
      companyTaxNumber: company?.taxNumber || '00000000-0-00',
      companyAddress: '',
      year: selectedYear,
      month: selectedMonth,
      totalGrossSalary: totalGross,
      totalSzja,
      totalTb,
      totalSzocho,
      totalEho: 0,
      employees: mlapRows.map(m => {
        const emp = employees.find(e => `${e.last_name} ${e.first_name}`.trim() === m.name);
        return {
          tajNumber: m.tajNumber,
          taxId: '',
          lastName: m.name.split(' ')[0] || '',
          firstName: m.name.split(' ').slice(1).join(' ') || '',
          birthDate: '',
          mothersName: '',
          jobCode: '1101',
          insuranceStart: '',
          weeklyHours: 40,
          grossSalary: m.grossSalary,
          taxBase: m.grossSalary,
          szjaAmount: m.szja,
          tbBase: m.grossSalary,
          tbAmount: m.tb,
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
    toast({ title: 'XML letöltve', description: 'A 2608-as bevallás XML fájl letöltődött.' });
  };

  const handlePreview = async () => {
    setGenerating(true);
    try {
      const xml = buildFilingXml();

      // Check if a draft/generated filing already exists for this period (never overwrite submitted ones)
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
        // Update existing
        const { error } = await supabase
          .from('accounty_filings')
          .update({ xml_data: xml, status: 'generated' })
          .eq('id', existing.id);
        if (error) throw error;
        filingId = existing.id;
      } else {
        // Create new
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
      navigate(`/accounty/payroll/${companyId}/filings/${filingId}/workflow`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setGenerating(false);
    }
  };

  const handleNavSubmit = () => {
    toast({ title: 'Demo mód', description: 'A NAV beküldés éles környezetben az ÁNYK/ONYA integráción keresztül történik.' });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">2608-as bevallás</h1>
            <p className="text-sm text-slate-500">{company?.name || '–'} — Havi járulékbevallás</p>
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
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : calculations.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincs számfejtett adat a kiválasztott időszakra ({selectedYear}. {MONTHS[selectedMonth - 1]}).</p>
          <p className="text-xs text-slate-400">A bevallás a számfejtés véglegesítése után kerül generálásra.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Biztosítottak</p>
              <p className="text-2xl font-bold text-blue-600">{calculations.length}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Bruttó összesen</p>
              <p className="text-lg font-bold font-mono">{fmt(calculations.reduce((s, c) => s + (c.gross_salary || 0), 0))}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Fizetendő közteher</p>
              <p className="text-lg font-bold font-mono text-red-600">{fmt(calculations.reduce((s, c) => s + (c.szja_amount || 0) + (c.tb_amount || 0) + (c.szocho_amount || 0), 0))}</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-[10px] text-slate-400 uppercase font-bold">Nettó összesen</p>
              <p className="text-lg font-bold font-mono text-green-600">{fmt(calculations.reduce((s, c) => s + (c.net_salary || 0), 0))}</p>
            </div>
          </div>

          {/* A-lap */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-bold">A-lap — Munkáltatói összesítő</h2>
              <span className="text-xs text-slate-400">Időszak: {selectedYear}. {MONTHS[selectedMonth - 1]}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {alapData.map((row, i) => (
                  <tr key={i} className={cn(
                    'border-b border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    i === alapData.length - 1 && 'font-bold bg-slate-50/80 dark:bg-slate-900/50'
                  )}>
                    <td className="px-5 py-2.5 text-xs text-slate-600 dark:text-slate-400">{row.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs font-bold">
                      {row.isCnt ? `${row.amount} fő` : fmt(row.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* M-lapok */}
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-bold">M-lapok — Személyi bontás ({mlapRows.length} fő)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-5 py-2 text-xs font-bold text-slate-500 uppercase">Név</th>
                    <th className="text-left px-3 py-2 text-xs font-bold text-slate-500 uppercase">TAJ</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">Bruttó</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">SZJA</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">TB</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">SZOCHO</th>
                    <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 uppercase">Nettó</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMlapRows.map((m) => (
                    <React.Fragment key={m.id}>
                      <tr
                        className="border-b border-border/30 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                        onClick={() => setExpandedRow(expandedRow === m.id ? null : m.id)}
                      >
                        <td className="px-5 py-2.5 font-medium">{m.name}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{m.tajNumber}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(m.grossSalary)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-red-600">{fmt(m.szja)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-blue-600">{fmt(m.tb)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs text-violet-600">{fmt(m.szocho)}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-green-600">{fmt(m.netSalary)}</td>
                      </tr>
                      {expandedRow === m.id && (
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="grid grid-cols-4 gap-4 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">SZOCHO alap</p>
                                <p className="font-mono font-bold">{fmt(m.grossSalary)}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Családi kedv.</p>
                                <p className="font-mono font-bold text-emerald-600">0 Ft</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Munkanapok</p>
                                <p className="font-mono font-bold">22 nap</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Napi bér</p>
                                <p className="font-mono font-bold">{fmt(Math.round(m.grossSalary / 22))}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Totals */}
                  <tr className="border-t-2 border-border bg-slate-50/80 dark:bg-slate-900/50 font-bold">
                    <td className="px-5 py-2.5 text-xs">ÖSSZESEN</td>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{mlapRows.length} fő</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">{fmt(mlapRows.reduce((s, r) => s + r.grossSalary, 0))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-red-600">{fmt(mlapRows.reduce((s, r) => s + r.szja, 0))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-blue-600">{fmt(mlapRows.reduce((s, r) => s + r.tb, 0))}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs text-violet-600">{fmt(mlapRows.reduce((s, r) => s + r.szocho, 0))}</td>
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
            <Button variant="outline" className="gap-1.5" onClick={handleXmlExport}>
              <FileCode className="w-4 h-4" /> XML letöltés
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={handlePreview} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {generating ? 'Generálás...' : 'Előnézet & Beküldés'}
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={handleNavSubmit}><Send className="w-4 h-4" /> Beküldés NAV-nak (demo)</Button>
          </div>
        </>
      )}
    </div>
  );
}
