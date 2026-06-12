import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, Download, Filter, Calendar, TrendingUp,
  Users, DollarSign, PieChart, RefreshCw, Table, FileSpreadsheet, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ReportType = 'salary_journal' | 'cost_analysis' | 'tax_summary' | 'headcount' | 'leave' | 'garnishment' | 'contributions' | 'custom';

const REPORT_TYPES: { id: ReportType; title: string; icon: React.ElementType; desc: string; color: string }[] = [
  { id: 'salary_journal', title: 'Bérnaplózás', icon: Table, desc: 'Feladás a főkönyvi könyvelésbe — automatikus exportformátum', color: 'from-blue-500 to-indigo-500' },
  { id: 'cost_analysis', title: 'Bérköltség analízis', icon: TrendingUp, desc: 'Költséghely/telephely/részleg szerinti költségbontás', color: 'from-emerald-500 to-teal-500' },
  { id: 'tax_summary', title: 'Közteher összesítő', icon: DollarSign, desc: 'SZJA, SZOCHO, TB járulékok havi összesítő', color: 'from-violet-500 to-purple-500' },
  { id: 'headcount', title: 'Létszámjelentés', icon: Users, desc: 'Telephelyenkénti és státusz szerinti létszámkimutatás', color: 'from-amber-500 to-orange-500' },
  { id: 'leave', title: 'Szabadságkeret kimutatás', icon: Calendar, desc: 'Munkavállaló szintű szabadság/betegszabadság összesítés', color: 'from-pink-500 to-rose-500' },
  { id: 'garnishment', title: 'Letiltások összesítő', icon: FileSpreadsheet, desc: 'Aktív letiltások és levonások kimutatása', color: 'from-red-500 to-red-600' },
  { id: 'contributions', title: 'Járulék ellenőrzés', icon: PieChart, desc: 'Minimálbér alapú járulékellenőrzés', color: 'from-cyan-500 to-blue-500' },
  { id: 'custom', title: 'Egyedi riport', icon: BarChart3, desc: 'Tetszőleges mezőválogatás és szűrőkkel', color: 'from-slate-500 to-slate-600' },
];

export default function PayrollReportsPage2() {
  const { id } = useParams<{ id: string }>();
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [period, setPeriod] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'csv' | 'pdf'>('xlsx');

  const renderReportContent = () => {
    if (!selectedReport) return null;

    const reportTitle = REPORT_TYPES.find(r => r.id === selectedReport)?.title || '';

    // All reports show empty state until payroll data is processed
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
        <Database className="w-12 h-12 mx-auto text-slate-300" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">{reportTitle}</h3>
        <p className="text-sm text-slate-400">Nincsenek riport adatok a kiválasztott időszakra ({period}).</p>
        <p className="text-xs text-slate-400">A riportok a bérszámfejtés véglegesítése és zárása után generálhatók.</p>
        <div className="flex gap-2 justify-center mt-3">
          <Button variant="outline" className="gap-1.5 text-sm"><RefreshCw className="w-4 h-4" /> Riport generálás</Button>
          <Button variant="outline" className="gap-1.5 text-sm"><Download className="w-4 h-4" /> Export ({exportFormat.toUpperCase()})</Button>
        </div>
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
            <option value="xlsx">XLSX</option><option value="csv">CSV</option><option value="pdf">PDF</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {REPORT_TYPES.map(r => (
          <button key={r.id} onClick={() => setSelectedReport(r.id)} className={cn('p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5', selectedReport === r.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 shadow-lg' : 'border-border hover:border-indigo-300')}>
            <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2', r.color)}><r.icon className="w-4 h-4" /></div>
            <p className="text-xs font-bold">{r.title}</p>
            <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{r.desc}</p>
          </button>
        ))}
      </div>

      {renderReportContent()}
    </div>
  );
}
