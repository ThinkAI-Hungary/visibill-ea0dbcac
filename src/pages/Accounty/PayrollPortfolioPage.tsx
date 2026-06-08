import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Search, Filter, ChevronRight, Users, FileText, CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

type CycleStatus = 'not_started' | 'data_request' | 'verification' | 'calculation' | 'documents' | 'sent' | 'closed';

const CYCLE_STATUS_CONFIG: Record<CycleStatus, { label: string; color: string; bg: string }> = {
  not_started: { label: 'Nincs indítva', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
  data_request: { label: 'Adatbekérés', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/30' },
  verification: { label: 'Ellenőrzés', color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
  calculation: { label: 'Számfejtés', color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  documents: { label: 'Dokumentumok', color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  sent: { label: 'Kiküldve', color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-900/30' },
  closed: { label: 'Lezárva', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
};

const FILING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_prepared: { label: 'Nem elkészítve', color: 'text-slate-400' },
  draft: { label: 'Tervezet', color: 'text-amber-600' },
  submitted: { label: 'Beküldve', color: 'text-blue-600' },
  accepted: { label: 'Elfogadva', color: 'text-green-600' },
  error: { label: 'Hibás', color: 'text-red-600' },
};

// Simulate payroll portfolio data from client list
function enrichClientWithPayrollStatus(client: any, idx: number) {
  const statuses: CycleStatus[] = ['not_started', 'data_request', 'verification', 'calculation', 'closed', 'closed', 'sent'];
  const filingStatuses = ['not_prepared', 'draft', 'submitted', 'accepted', 'accepted'];
  return {
    ...client,
    employeeCount: 5 + (idx * 3) % 20,
    cycleStatus: statuses[idx % statuses.length],
    missingData: idx % 3 === 0 ? (idx % 5) + 1 : 0,
    filingStatus: filingStatuses[idx % filingStatuses.length],
    paymentStatus: idx % 4 === 0 ? 'pending' : 'completed',
    nextDeadline: '2026-06-12',
  };
}

type FilterMode = 'all' | 'missing' | 'not_started' | 'no_filing';

export default function PayrollPortfolioPage() {
  const { data: clients = [] } = useAccountyClients();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const enrichedClients = useMemo(
    () => clients.map((c: any, i: number) => enrichClientWithPayrollStatus(c, i)),
    [clients]
  );

  const filtered = useMemo(() => {
    let list = enrichedClients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) => c.name.toLowerCase().includes(q) || c.taxNumber?.toLowerCase().includes(q));
    }
    if (filterMode === 'missing') list = list.filter((c: any) => c.missingData > 0);
    if (filterMode === 'not_started') list = list.filter((c: any) => c.cycleStatus === 'not_started');
    if (filterMode === 'no_filing') list = list.filter((c: any) => c.filingStatus === 'not_prepared');
    return list;
  }, [enrichedClients, searchQuery, filterMode]);

  const totalEmployees = enrichedClients.reduce((s: number, c: any) => s + c.employeeCount, 0);
  const closedCount = enrichedClients.filter((c: any) => c.cycleStatus === 'closed').length;
  const missingCount = enrichedClients.filter((c: any) => c.missingData > 0).length;

  const now = new Date();
  const monthName = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary to-indigo-600 rounded-xl shadow-lg shadow-primary/25">
            <Calculator className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bérszámfejtés áttekintés</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{monthName} — összes ügyfél bérszámfejtési státusza</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes foglalkoztatott</p>
          <p className="text-2xl font-bold text-primary">{totalEmployees}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Ciklusok lezárva</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-bold text-green-600">{closedCount}</p>
            <p className="text-xs text-slate-400 pb-1">/ {enrichedClients.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Hiányzó adatok</p>
          <p className={cn('text-2xl font-bold', missingCount > 0 ? 'text-red-600' : 'text-slate-400')}>{missingCount} ügyfélnél</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallási határidő</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Jún. 12.</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Becsült közterhek</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">~{(totalEmployees * 97000).toLocaleString('hu-HU')} Ft</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Keresés ügyfél neve, adószám..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-card border-border" />
        </div>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {([
            ['all', 'Mind'],
            ['missing', 'Hiányos'],
            ['not_started', 'Nem indított'],
            ['no_filing', 'Bevallás nélkül'],
          ] as [FilterMode, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setFilterMode(v)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', filterMode === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ügyfél</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Létszám</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ciklus státusz</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Hiányzó</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Bevallás</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Utalás</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    <Calculator className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    Nincs találat
                  </td>
                </tr>
              ) : (
                filtered.map((client: any) => {
                  const cs = CYCLE_STATUS_CONFIG[client.cycleStatus as CycleStatus] || CYCLE_STATUS_CONFIG.not_started;
                  const fs = FILING_STATUS_CONFIG[client.filingStatus] || FILING_STATUS_CONFIG.not_prepared;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link to={`/accounty/payroll/${client.companyId}`} className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">
                          {client.name}
                        </Link>
                        {client.taxNumber && <p className="text-[10px] text-slate-400 font-mono">{client.taxNumber}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{client.employeeCount}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-1 rounded-full text-xs font-semibold', cs.bg, cs.color)}>
                          {cs.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {client.missingData > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertTriangle className="w-3 h-3" />
                            {client.missingData}
                          </span>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', fs.color)}>{fs.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', client.paymentStatus === 'completed' ? 'text-green-600' : 'text-amber-600')}>
                          {client.paymentStatus === 'completed' ? 'Utalva' : 'Függőben'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/accounty/payroll/${client.companyId}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                        >
                          Megnyit <ChevronRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
