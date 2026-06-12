import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Archive, Search, Download, Eye, Calendar, Filter,
  FileText, CheckCircle, Clock, AlertTriangle, Trash2, RotateCcw, Loader2, Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDeclarations, type Declaration } from '@/hooks/useAccountyData';

const TYPE_LABELS: Record<string, string> = {
  family: 'Családi kedvezmény', netak: 'NÉTAK', mothers: '30 év alatti anyák',
  young: '25 év alattiak', first_marriage: 'Első házasok', personal: 'Személyi kedvezmény',
};

const TYPE_COLORS: Record<string, string> = {
  family: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  first_marriage: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-400',
  young: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400',
  mothers: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400',
  personal: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  netak: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
};

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  active: { label: 'Érvényes', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
  expired: { label: 'Felváltva', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  archived: { label: 'Archivált', color: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400' },
  pending: { label: 'Függőben', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' },
};

export default function DeclarationArchivePage() {
  const { id } = useParams<{ id: string }>();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const { data: declarations, isLoading } = useDeclarations(id || '');
  const declList = declarations || [];

  const filtered = declList.filter(d => {
    if (search && !(d.data?.employeeName || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && d.type !== filterType) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    const declYear = d.validFrom ? new Date(d.validFrom).getFullYear().toString() : '';
    if (filterYear !== 'all' && declYear !== filterYear) return false;
    return true;
  });

  const years = [...new Set(declList.map(d => d.validFrom ? new Date(d.validFrom).getFullYear().toString() : ''))].filter(Boolean).sort().reverse();
  const types = [...new Set(declList.map(d => d.type))];

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

      {isLoading ? (
        <div className="flex items-center justify-center h-32 gap-2 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Betöltés...</div>
      ) : declList.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <Database className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm text-slate-500">Nincsenek archivált nyilatkozatok.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{declList.filter(d => d.status === 'active').length}</p><p className="text-xs text-slate-500">Érvényes</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-slate-500">{declList.filter(d => d.status === 'expired').length}</p><p className="text-xs text-slate-500">Lejárt</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold text-amber-500">{declList.filter(d => d.status === 'archived').length}</p><p className="text-xs text-slate-500">Archivált</p></div>
            <div className="bg-card rounded-xl border border-border p-4 text-center"><p className="text-2xl font-bold">{declList.length}</p><p className="text-xs text-slate-500">Összesen</p></div>
          </div>

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
              {types.map(t => <option key={t} value={t}>{TYPE_LABELS[t] || t}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 rounded-lg border border-border bg-background text-sm">
              <option value="all">Minden státusz</option>
              <option value="active">Érvényes</option><option value="expired">Lejárt</option><option value="revoked">Visszavont</option>
            </select>
          </div>

          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Archivált nyilatkozatok ({filtered.length})</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/30">
                  <th className="text-left px-5 py-2 text-xs font-bold text-slate-500">Munkavállaló</th>
                  <th className="text-left px-3 py-2 text-xs font-bold text-slate-500">Típus</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Év</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Státusz</th>
                  <th className="text-center px-3 py-2 text-xs font-bold text-slate-500">Beadva</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(dec => (
                  <tr key={dec.id} className={cn('border-b border-border/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', dec.status !== 'active' && 'opacity-60')}>
                    <td className="px-5 py-2.5 font-medium">{dec.data?.employeeName || '—'}</td>
                    <td className="px-3 py-2.5"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', TYPE_COLORS[dec.type] || 'bg-slate-100 text-slate-500')}>{TYPE_LABELS[dec.type] || dec.type}</span></td>
                    <td className="px-3 py-2.5 text-center text-xs font-mono">{dec.validFrom ? new Date(dec.validFrom).getFullYear() : '—'}</td>
                    <td className="px-3 py-2.5 text-center"><span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', STATUS_BADGE[dec.status]?.color)}>{STATUS_BADGE[dec.status]?.label}</span></td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-400">{dec.filedAt ? new Date(dec.filedAt).toLocaleDateString('hu-HU') : '—'}</td>
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
            {filtered.length === 0 && <div className="px-5 py-8 text-center text-sm text-slate-400">Nincs találat a szűrési feltételeknek.</div>}
          </div>
        </>
      )}
    </div>
  );
}
