import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, Calculator, CheckCircle, AlertTriangle, Download,
  Eye, Plus, Trash2, Users, Send, ChevronRight, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlapRow {
  key: string;
  label: string;
  amount: number;
  editable?: boolean;
}

interface MlapRow {
  id: string;
  name: string;
  tajNumber: string;
  grossSalary: number;
  szja: number;
  tbJarulék: number;
  szocho: number;
  familyBenefit: number;
  netSalary: number;
  workedDays: number;
}

const MOCK_A_LAP: AlapRow[] = [
  { key: 'headcount', label: 'Biztosítottak átlagos létszáma (fő)', amount: 42 },
  { key: 'gross_total', label: 'Bruttó bér összesen', amount: 15420000 },
  { key: 'szja_total', label: 'Levont SZJA összesen', amount: 2313000 },
  { key: 'tb_total', label: 'TB járulék összesen (18,5%)', amount: 2852700 },
  { key: 'szocho_total', label: 'SZOCHO összesen (13%)', amount: 2004600 },
  { key: 'family_benefit', label: 'Családi kedvezmény összesen', amount: 380000 },
  { key: 'szja_payable', label: 'Fizetendő SZJA (levont - kedvezmények)', amount: 1933000 },
  { key: 'tb_payable', label: 'Fizetendő TB járulék', amount: 2852700 },
  { key: 'szocho_payable', label: 'Fizetendő SZOCHO', amount: 2004600 },
];

const MOCK_M_LAPS: MlapRow[] = [
  { id: '1', name: 'Nagy Anna', tajNumber: '123 456 789', grossSalary: 450000, szja: 67500, tbJarulék: 83250, szocho: 58500, familyBenefit: 40000, netSalary: 299250, workedDays: 22 },
  { id: '2', name: 'Kiss Béla', tajNumber: '987 654 321', grossSalary: 380000, szja: 57000, tbJarulék: 70300, szocho: 49400, familyBenefit: 0, netSalary: 252700, workedDays: 22 },
  { id: '3', name: 'Tóth Éva', tajNumber: '111 222 333', grossSalary: 322800, szja: 48420, tbJarulék: 59718, szocho: 41964, familyBenefit: 0, netSalary: 214662, workedDays: 22 },
  { id: '4', name: 'Szabó Péter', tajNumber: '444 555 666', grossSalary: 520000, szja: 78000, tbJarulék: 96200, szocho: 67600, familyBenefit: 20000, netSalary: 345800, workedDays: 20 },
  { id: '5', name: 'Horváth Dávid', tajNumber: '777 888 999', grossSalary: 600000, szja: 90000, tbJarulék: 111000, szocho: 78000, familyBenefit: 0, netSalary: 399000, workedDays: 23 },
];

export default function Filing2608Page() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'a-lap' | 'm-lapok'>('a-lap');
  const [expandedM, setExpandedM] = useState<string | null>(null);

  const fmt = (n: number) => n.toLocaleString('hu-HU');
  const totalPayable = MOCK_A_LAP.filter(r => r.key.includes('payable')).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/filings`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg shadow-violet-500/25"><FileText className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">2608 — Havi járulékbevallás</h1>
            <p className="text-sm text-slate-500">Art. 50. § — 2026. május havi bevallás</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> XML export</Button>
          <Button variant="outline" className="gap-1.5"><Eye className="w-4 h-4" /> Előnézet</Button>
          <Button className="gap-1.5 bg-violet-600 hover:bg-violet-700"><Send className="w-4 h-4" /> Beküldés</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{MOCK_M_LAPS.length}</p>
          <p className="text-xs text-slate-500">Biztosított</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-lg font-bold font-mono">{fmt(MOCK_A_LAP.find(r => r.key === 'gross_total')!.amount)}</p>
          <p className="text-xs text-slate-500">Bruttó összesen</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-lg font-bold font-mono text-red-600">{fmt(totalPayable)}</p>
          <p className="text-xs text-slate-500">Fizetendő közterhek</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-lg font-bold font-mono text-emerald-600">{fmt(MOCK_A_LAP.find(r => r.key === 'family_benefit')!.amount)}</p>
          <p className="text-xs text-slate-500">Kedvezmények</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 w-fit">
        <button onClick={() => setTab('a-lap')} className={cn('px-4 py-2 rounded-md text-xs font-medium transition-all', tab === 'a-lap' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500')}>
          A-lap (Összesítő)
        </button>
        <button onClick={() => setTab('m-lapok')} className={cn('px-4 py-2 rounded-md text-xs font-medium transition-all', tab === 'm-lapok' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500')}>
          M-lapok ({MOCK_M_LAPS.length} fő)
        </button>
      </div>

      {/* A-lap */}
      {tab === 'a-lap' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">A-lap — Munkáltatói összesítő</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-slate-50/30">
                <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Megnevezés</th>
                <th className="text-right px-5 py-2 text-xs font-bold text-slate-500">Összeg (Ft)</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_A_LAP.map((row, i) => (
                <tr key={row.key} className={cn(
                  'border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                  row.key.includes('payable') && 'bg-blue-50/30 dark:bg-blue-500/5 font-bold'
                )}>
                  <td className="px-5 py-3">{row.label}</td>
                  <td className={cn('px-5 py-3 text-right font-mono', row.key.includes('payable') ? 'text-red-600 font-bold' : row.key === 'family_benefit' ? 'text-emerald-600' : '')}>{row.key === 'headcount' ? row.amount + ' fő' : fmt(row.amount) + ' Ft'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-violet-50 dark:bg-violet-500/10 font-bold">
                <td className="px-5 py-3 text-violet-800 dark:text-violet-300">Összes fizetendő közteher</td>
                <td className="px-5 py-3 text-right font-mono text-violet-800 dark:text-violet-300">{fmt(totalPayable)} Ft</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* M-lapok */}
      {tab === 'm-lapok' && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">M-lapok — Személyi bontás</h2>
            <span className="text-xs text-slate-500">{MOCK_M_LAPS.length} biztosított</span>
          </div>
          <div className="divide-y divide-border/50">
            {MOCK_M_LAPS.map(m => (
              <div key={m.id}>
                <button onClick={() => setExpandedM(expandedM === m.id ? null : m.id)} className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left">
                  {expandedM === m.id ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  <div className="flex-1">
                    <p className="text-sm font-bold">{m.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{m.tajNumber}</p>
                  </div>
                  <div className="grid grid-cols-4 gap-6 text-xs text-right">
                    <div><p className="text-slate-400">Bruttó</p><p className="font-mono font-bold">{fmt(m.grossSalary)}</p></div>
                    <div><p className="text-slate-400">SZJA</p><p className="font-mono text-red-500">-{fmt(m.szja)}</p></div>
                    <div><p className="text-slate-400">TB</p><p className="font-mono text-red-500">-{fmt(m.tbJarulék)}</p></div>
                    <div><p className="text-slate-400">Nettó</p><p className="font-mono font-bold text-emerald-600">{fmt(m.netSalary)}</p></div>
                  </div>
                </button>
                {expandedM === m.id && (
                  <div className="px-5 pb-4 pl-14 grid grid-cols-4 gap-4 text-xs bg-slate-50/50 dark:bg-slate-900/20">
                    <div><span className="text-slate-400">SZOCHO (13%)</span><p className="font-mono">{fmt(m.szocho)} Ft</p></div>
                    <div><span className="text-slate-400">Családi kedv.</span><p className="font-mono text-emerald-600">{m.familyBenefit > 0 ? `-${fmt(m.familyBenefit)} Ft` : '—'}</p></div>
                    <div><span className="text-slate-400">Munkanapok</span><p>{m.workedDays} nap</p></div>
                    <div><span className="text-slate-400">Napi bér</span><p className="font-mono">{fmt(Math.round(m.grossSalary / m.workedDays))} Ft</p></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-900/30 border-t border-border text-xs text-slate-500 flex justify-between">
            <span>Bruttó: {fmt(MOCK_M_LAPS.reduce((s, m) => s + m.grossSalary, 0))} Ft</span>
            <span>Nettó: {fmt(MOCK_M_LAPS.reduce((s, m) => s + m.netSalary, 0))} Ft</span>
          </div>
        </div>
      )}
    </div>
  );
}
