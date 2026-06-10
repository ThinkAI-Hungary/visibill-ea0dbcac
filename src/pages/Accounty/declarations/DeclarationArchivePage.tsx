import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Archive, Search, Download, Eye, Calendar, Filter,
  FileText, CheckCircle, Clock, AlertTriangle, Trash2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ArchivedDeclaration {
  id: string;
  employeeName: string;
  type: string;
  typeLabel: string;
  period: string;
  submittedAt: string;
  validFrom: string;
  validTo: string | null;
  status: 'active' | 'superseded' | 'withdrawn';
  amount?: string;
}

const MOCK_ARCHIVE: ArchivedDeclaration[] = [
  { id: '1', employeeName: 'Nagy Anna', type: 'family', typeLabel: 'Családi kedvezmény', period: '2026', submittedAt: '2026-01-10', validFrom: '2026-01-01', validTo: null, status: 'active', amount: '66 670 Ft/hó' },
  { id: '2', employeeName: 'Nagy Anna', type: 'family', typeLabel: 'Családi kedvezmény', period: '2025', submittedAt: '2025-01-08', validFrom: '2025-01-01', validTo: '2025-12-31', status: 'superseded', amount: '33 335 Ft/hó' },
  { id: '3', employeeName: 'Kiss Béla', type: 'first_marriage', typeLabel: 'Első házasok', period: '2026', submittedAt: '2026-03-15', validFrom: '2026-03-01', validTo: '2028-02-28', status: 'active', amount: '5 000 Ft/hó' },
  { id: '4', employeeName: 'Tóth Éva', type: 'under25', typeLabel: '25 év alattiak', period: '2025', submittedAt: '2025-01-05', validFrom: '2025-01-01', validTo: '2025-08-15', status: 'superseded', amount: 'SZJA mentes (bruttó átlagig)' },
  { id: '5', employeeName: 'Tóth Éva', type: 'under30_mother', typeLabel: '30 év alatti anyák', period: '2026', submittedAt: '2026-01-12', validFrom: '2026-01-01', validTo: null, status: 'active', amount: 'SZJA mentes (bruttó átlagig)' },
  { id: '6', employeeName: 'Szabó Péter', type: 'personal', typeLabel: 'Személyi kedvezmény', period: '2026', submittedAt: '2026-02-01', validFrom: '2026-02-01', validTo: null, status: 'active', amount: '66 670 Ft/hó' },
  { id: '7', employeeName: 'Szabó Péter', type: 'netak', typeLabel: 'NÉTAK', period: '2025', submittedAt: '2025-06-01', validFrom: '2025-06-01', validTo: '2025-12-31', status: 'withdrawn' },
  { id: '8', employeeName: 'Horváth Dávid', type: 'family', typeLabel: 'Családi kedvezmény', period: '2026', submittedAt: '2026-01-09', validFrom: '2026-01-01', validTo: null, status: 'active', amount: '133 340 Ft/hó' },
  { id: '9', employeeName: 'Horváth Dávid', type: 'family', typeLabel: 'Családi kedvezmény', period: '2025', submittedAt: '2025-01-10', validFrom: '2025-01-01', validTo: '2025-12-31', status: 'superseded', amount: '66 670 Ft/hó' },
  { id: '10', employeeName: 'Molnár Gábor', type: 'family', typeLabel: 'Családi kedvezmény', period: '2024', submittedAt: '2024-01-08', validFrom: '2024-01-01', validTo: '2024-12-31', status: 'superseded', amount: '33 335 Ft/hó' },
];

const TYPE_COLORS: Record<string, string> = {
  family: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  first_marriage: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  under25: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  under30_mother: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  personal: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  netak: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: 'Érvényes', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  superseded: { label: 'Felváltva', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  withdrawn: { label: 'Visszavonva', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
};

export default function DeclarationArchivePage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const filtered = MOCK_ARCHIVE.filter(d => {
    if (search && !d.employeeName.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && d.type !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    if (filterYear !== 'all' && d.period !== filterYear) return false;
    return true;
  });

  const years = [...new Set(MOCK_ARCHIVE.map(d => d.period))].sort().reverse();
  const types = [...new Set(MOCK_ARCHIVE.map(d => d.type))];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to={`/accounty/payroll/${id}/declarations`} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/25"><Archive className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Nyilatkozat-archívum</h1>
            <p className="text-sm text-slate-500">Korábbi és érvényes nyilatkozatok teljes előzménye</p>
          </div>
        </div>
        <Button variant="outline" className="gap-1.5"><Download className="w-4 h-4" /> Export (Excel)</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-emerald-600">{MOCK_ARCHIVE.filter(d => d.status === 'active').length}</p>
          <p className="text-xs text-slate-500">Érvényes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-slate-500">{MOCK_ARCHIVE.filter(d => d.status === 'superseded').length}</p>
          <p className="text-xs text-slate-500">Felváltva</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{MOCK_ARCHIVE.filter(d => d.status === 'withdrawn').length}</p>
          <p className="text-xs text-slate-500">Visszavonva</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{MOCK_ARCHIVE.length}</p>
          <p className="text-xs text-slate-500">Összesen</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Keresés név alapján..." className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-background text-sm" />
        </div>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="all">Minden év</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="all">Minden típus</option>
          {types.map(t => <option key={t} value={t}>{MOCK_ARCHIVE.find(d => d.type === t)?.typeLabel}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
          <option value="all">Minden státusz</option>
          <option value="active">Érvényes</option>
          <option value="superseded">Felváltva</option>
          <option value="withdrawn">Visszavonva</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Archivált nyilatkozatok ({filtered.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-slate-50/30">
              <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
              <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Típus</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Időszak</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Érvényesség</th>
              <th className="text-right px-3 py-2 text-xs font-bold text-slate-500">Összeg</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
              <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Beadva</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(dec => (
              <tr key={dec.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', dec.status !== 'active' && 'opacity-60')}>
                <td className="px-5 py-2.5 font-medium">{dec.employeeName}</td>
                <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', TYPE_COLORS[dec.type])}>{dec.typeLabel}</span></td>
                <td className="px-3 py-2.5 text-center text-xs font-mono">{dec.period}</td>
                <td className="px-3 py-2.5 text-center text-xs">{dec.validFrom} → {dec.validTo || '∞'}</td>
                <td className="px-3 py-2.5 text-right text-xs font-mono">{dec.amount || '—'}</td>
                <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_BADGE[dec.status].color)}>{STATUS_BADGE[dec.status].label}</span></td>
                <td className="px-3 py-2.5 text-center text-xs text-slate-400">{dec.submittedAt}</td>
                <td className="px-3 py-2.5">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Eye className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Download className="w-3 h-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-slate-400">Nincs találat a szűrési feltételeknek.</div>
        )}
      </div>
    </div>
  );
}
