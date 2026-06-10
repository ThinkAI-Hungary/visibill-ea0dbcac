import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Download, Filter, Calendar, TrendingUp,
  Users, DollarSign, PieChart, RefreshCw, Table, FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ReportType = 'salary_journal' | 'cost_analysis' | 'tax_summary' | 'headcount' | 'leave' | 'garnishment' | 'contributions' | 'custom';

const REPORT_TYPES: { id: ReportType; title: string; icon: React.ElementType; desc: string; color: string }[] = [
  { id: 'salary_journal', title: 'Bérnaplózás', icon: Table, desc: 'Feladás a főkönyvi könyvelésbe — automatikus exportformátum', color: 'from-blue-500 to-indigo-500' },
  { id: 'cost_analysis', title: 'Bérköltség analízis', icon: TrendingUp, desc: 'Költséghely/telephely/részleg szerinti költségbontás', color: 'from-emerald-500 to-teal-500' },
  { id: 'tax_summary', title: 'Közteher összesítő', icon: DollarSign, desc: 'SZJA, SZOCHO, TB járulékok havi összesítő', color: 'from-violet-500 to-purple-500' },
  { id: 'headcount', title: 'Létszámjelentés', icon: Users, desc: 'Telephelyenkénti és státusz szerinti létszámkimutatás', color: 'from-amber-500 to-orange-500' },
  { id: 'leave', title: 'Szabadságkeret kimutatás', icon: Calendar, desc: 'Munkavállaló szintű szabadság/betegszabadság összsítés', color: 'from-pink-500 to-rose-500' },
  { id: 'garnishment', title: 'Letiltások összesítő', icon: FileSpreadsheet, desc: 'Aktív letiltások és levonások kimutatása', color: 'from-red-500 to-red-600' },
  { id: 'contributions', title: 'Járulék ellenőrzés', icon: PieChart, desc: 'Minimálbér alapú járulékellenőrzés', color: 'from-cyan-500 to-blue-500' },
  { id: 'custom', title: 'Egyedi riport', icon: BarChart3, desc: 'Tetszőleges mezőválogatás és szűrőkkel', color: 'from-slate-500 to-slate-600' },
];

// Mock data for salary journal
const MOCK_JOURNAL = [
  { account: '5410', name: 'Alapbérek', debit: 2272800, credit: 0 },
  { account: '5420', name: 'Pótlékok, prémiumok', debit: 180000, credit: 0 },
  { account: '5610', name: 'Szociális hozzájárulási adó (13%)', debit: 318864, credit: 0 },
  { account: '4710', name: 'Nettó bér kötelezettség', debit: 0, credit: 1511412 },
  { account: '4620', name: 'SZJA kötelezettség', debit: 0, credit: 340920 },
  { account: '4630', name: 'TB járulék kötelezettség', debit: 0, credit: 420468 },
  { account: '4640', name: 'SZOCHO kötelezettség', debit: 0, credit: 318864 },
  { account: '3810', name: 'Bérszámla', debit: 0, credit: 180000 },
];

const MOCK_COST_ANALYSIS = [
  { costCenter: 'CC-100 Vezetőség', headcount: 3, gross: 1560000, szocho: 202800, total: 1762800 },
  { costCenter: 'CC-210 Bérszámfejtés', headcount: 6, gross: 2280000, szocho: 296400, total: 2576400 },
  { costCenter: 'CC-220 Főkönyvi könyvelés', headcount: 8, gross: 3200000, szocho: 416000, total: 3616000 },
  { costCenter: 'CC-230 Adótanácsadás', headcount: 4, gross: 2080000, szocho: 270400, total: 2350400 },
  { costCenter: 'CC-310 Szoftverfejlesztés', headcount: 4, gross: 2400000, szocho: 312000, total: 2712000 },
];

export default function PayrollReportsPage2() {
  const { id } = useParams<{ id: string }>();
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [period, setPeriod] = useState('2026-05');
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');

  const fmt = (n: number) => n.toLocaleString('hu-HU');

  const renderReportContent = () => {
    if (!selectedReport) return null;

    if (selectedReport === 'salary_journal') {
      return (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h3 className="text-sm font-bold">Bérnaplózás — {period}</h3>
            <Button variant="outline" size="sm" className="gap-1 text-xs"><Download className="w-3 h-3" /> Exportálás ({exportFormat.toUpperCase()})</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30">
                <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Főkönyvi szám</th>
                <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Megnevezés</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Tartozik</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Követel</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_JOURNAL.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-2 font-mono text-xs">{row.account}</td>
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{row.debit > 0 ? fmt(row.debit) : ''}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{row.credit > 0 ? fmt(row.credit) : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                <td colSpan={2} className="px-5 py-2 text-xs">Összesen</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{fmt(MOCK_JOURNAL.reduce((s, r) => s + r.debit, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{fmt(MOCK_JOURNAL.reduce((s, r) => s + r.credit, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
    }

    if (selectedReport === 'cost_analysis') {
      return (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h3 className="text-sm font-bold">Bérköltség analízis — {period}</h3>
            <Button variant="outline" size="sm" className="gap-1 text-xs"><Download className="w-3 h-3" /> Export</Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30">
                <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Költséghely</th>
                <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Létszám</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Bruttó bér</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">SZOCHO (13%)</th>
                <th className="text-right px-3 py-2 text-xs font-bold text-slate-500 text-blue-600">Összköltség</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_COST_ANALYSIS.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-5 py-2 font-medium">{row.costCenter}</td>
                  <td className="px-3 py-2 text-center">{row.headcount}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">{fmt(row.gross)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-red-500">{fmt(row.szocho)}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs font-bold text-blue-600">{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                <td className="px-5 py-2 text-xs">Összesen</td>
                <td className="px-3 py-2 text-center text-xs">{MOCK_COST_ANALYSIS.reduce((s, r) => s + r.headcount, 0)}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{fmt(MOCK_COST_ANALYSIS.reduce((s, r) => s + r.gross, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs text-red-500">{fmt(MOCK_COST_ANALYSIS.reduce((s, r) => s + r.szocho, 0))}</td>
                <td className="px-3 py-2 text-right font-mono text-xs font-bold text-blue-600">{fmt(MOCK_COST_ANALYSIS.reduce((s, r) => s + r.total, 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      );
    }

    // Generic "coming soon" for other reports
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{REPORT_TYPES.find(r => r.id === selectedReport)?.title}</h3>
        <p className="text-sm text-slate-400 mt-2">A riport generálás most készül...</p>
        <Button variant="outline" className="gap-1.5 mt-4"><RefreshCw className="w-4 h-4" /> Generálás</Button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25"><BarChart3 className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Riportok és kimutatások</h1>
            <p className="text-sm text-slate-500">Bérszámfejtési adatok elemzése és exportálása</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
          <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
            <option value="xlsx">XLSX</option>
            <option value="csv">CSV</option>
            <option value="pdf">PDF</option>
          </select>
        </div>
      </div>

      {/* Report grid */}
      <div className="grid grid-cols-4 gap-3">
        {REPORT_TYPES.map(r => (
          <button
            key={r.id}
            onClick={() => setSelectedReport(r.id)}
            className={cn(
              'p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5',
              selectedReport === r.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-lg' : 'border-border hover:border-indigo-300'
            )}
          >
            <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2', r.color)}>
              <r.icon className="w-4 h-4" />
            </div>
            <p className="text-xs font-bold">{r.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Report content */}
      {renderReportContent()}
    </div>
  );
}
