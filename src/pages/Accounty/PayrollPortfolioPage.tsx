import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Search, ChevronRight, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients, useAccountyCompanySummary } from '@/hooks/accounty';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

// ── Types ──

type CycleStatus = 'none' | 'draft' | 'data_collection' | 'review' | 'calculating' | 'calculated' | 'approved' | 'documents' | 'submitted' | 'closed';

const CYCLE_STATUS_CONFIG: Record<CycleStatus, { label: string; color: string; bg: string }> = {
  none:            { label: 'Nincs indítva',   color: 'text-slate-500',  bg: 'bg-slate-100 dark:bg-slate-800' },
  draft:           { label: 'Tervezet',        color: 'text-slate-600',  bg: 'bg-slate-100 dark:bg-slate-800' },
  data_collection: { label: 'Adatbekérés',     color: 'text-amber-600',  bg: 'bg-amber-50 dark:bg-amber-900/30' },
  review:          { label: 'Ellenőrzés',      color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/30' },
  calculating:     { label: 'Számfejtés…',     color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  calculated:      { label: 'Számfejtve',      color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  approved:        { label: 'Jóváhagyva',      color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  documents:       { label: 'Dokumentumok',    color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
  submitted:       { label: 'Kiküldve',        color: 'text-teal-600',   bg: 'bg-teal-50 dark:bg-teal-900/30' },
  closed:          { label: 'Lezárva',         color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/30' },
};

const FILING_STATUS_MAP: Record<string, { label: string; color: string }> = {
  none:      { label: 'Nem elkészítve', color: 'text-slate-400' },
  draft:     { label: 'Tervezet',       color: 'text-amber-600' },
  generated: { label: 'Generálva',      color: 'text-amber-600' },
  validated: { label: 'Validálva',      color: 'text-blue-600' },
  signed:    { label: 'Aláírva',        color: 'text-blue-600' },
  submitted: { label: 'Beküldve',       color: 'text-blue-600' },
  accepted:  { label: 'Elfogadva',      color: 'text-green-600' },
  error:     { label: 'Hibás',          color: 'text-red-600' },
};

interface PayrollRow {
  id: string;
  companyId: string;
  name: string;
  taxNumber: string;
  employeeCount: number;
  cycleStatus: CycleStatus;
  missingCount: number;
  criticalCount: number;
  filingStatus: string;
  paymentStatus: 'none' | 'pending' | 'completed';
}

// ── Real data hook ──

function usePayrollPortfolioData() {
  const { data: clients = [], isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useAccountyClients();
  // Reuse the same hook that MissingInvoicesPage uses for consistency
  const { data: companySummary = [], isLoading: summaryLoading, isError: summaryError } = useAccountyCompanySummary();

  const companyIds = useMemo(() => clients.map((c: any) => c.companyId).filter(Boolean), [clients]);

  const { data: payrollData, isLoading: payrollLoading, isError: payrollError } = useQuery({
    queryKey: ['payroll-portfolio-data', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return {};

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      // 1. Employee counts per company
      const { data: employees } = await supabase
        .from('accounty_employees')
        .select('company_id, status')
        .in('company_id', companyIds)
        .eq('status', 'active');

      const empCountMap: Record<string, number> = {};
      for (const e of (employees || [])) {
        empCountMap[e.company_id] = (empCountMap[e.company_id] || 0) + 1;
      }

      // 2. Current month payroll cycles
      const { data: cycles } = await supabase
        .from('accounty_payroll_cycles')
        .select('company_id, status')
        .in('company_id', companyIds)
        .eq('year', year)
        .eq('month', month);

      const cycleMap: Record<string, string> = {};
      for (const c of (cycles || [])) {
        cycleMap[c.company_id] = c.status || 'draft';
      }

      // 3. Current month filings (2608 — monthly declaration)
      const { data: filings } = await supabase
        .from('accounty_filings')
        .select('company_id, status, filing_type')
        .in('company_id', companyIds)
        .eq('period_year', year)
        .eq('period_month', month);

      const filingMap: Record<string, string> = {};
      for (const f of (filings || [])) {
        const current = filingMap[f.company_id];
        if (!current || f.filing_type === '2608') {
          filingMap[f.company_id] = f.status || 'draft';
        }
      }

      // 4. Payment status from cycle status
      const paymentMap: Record<string, string> = {};
      for (const c of (cycles || [])) {
        if (c.status === 'closed') paymentMap[c.company_id] = 'completed';
        else if (c.status === 'submitted') paymentMap[c.company_id] = 'pending';
      }

      return { empCountMap, cycleMap, filingMap, paymentMap };
    },
    enabled: companyIds.length > 0,
    staleTime: 30_000,
  });

  // Build missingCount map from companySummary (same source as MissingInvoicesPage)
  const summaryMap = useMemo(() => {
    const map: Record<string, { missing: number; critical: number }> = {};
    for (const cs of companySummary) {
      map[cs.companyId] = { missing: cs.missingCount, critical: cs.criticalCount };
    }
    return map;
  }, [companySummary]);

  const rows: PayrollRow[] = useMemo(() => {
    const d = payrollData || {} as any;
    return clients.map((c: any): PayrollRow => ({
      id: c.id,
      companyId: c.companyId,
      name: c.name,
      taxNumber: c.taxNumber || '',
      employeeCount: d.empCountMap?.[c.companyId] || 0,
      cycleStatus: (d.cycleMap?.[c.companyId] || 'none') as CycleStatus,
      missingCount: summaryMap[c.companyId]?.missing || 0,
      criticalCount: summaryMap[c.companyId]?.critical || 0,
      filingStatus: d.filingMap?.[c.companyId] || 'none',
      paymentStatus: (d.paymentMap?.[c.companyId] || 'none') as any,
    }));
  }, [clients, payrollData, summaryMap]);

  return { rows, isLoading: clientsLoading || payrollLoading || summaryLoading, isError: clientsError || summaryError || payrollError, refetch: refetchClients };
}

// ── Component ──

type FilterMode = 'all' | 'missing' | 'not_started' | 'no_filing';

export default function PayrollPortfolioPage() {
  const { rows, isLoading, isError, refetch } = usePayrollPortfolioData();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMode]);

  const filtered = useMemo(() => {
    let list = rows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.taxNumber?.toLowerCase().includes(q));
    }
    if (filterMode === 'missing') list = list.filter(c => c.missingCount > 0);
    if (filterMode === 'not_started') list = list.filter(c => c.cycleStatus === 'none' || c.cycleStatus === 'draft');
    if (filterMode === 'no_filing') list = list.filter(c => c.filingStatus === 'none');
    return list;
  }, [rows, searchQuery, filterMode]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (isError) {
    return <AccountyErrorState message="Nem sikerült betölteni a bérszámfejtési portfólió adatait." onRetry={() => refetch()} />;
  }

  const totalEmployees = rows.reduce((s, c) => s + c.employeeCount, 0);
  const closedCount = rows.filter(c => c.cycleStatus === 'closed').length;
  const missingCount = rows.filter(c => c.missingCount > 0).length;

  const now = new Date();
  const monthName = now.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
  const deadlineDay = `${now.toLocaleDateString('hu-HU', { month: 'short' })} 12.`;

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
            <p className="text-xs text-slate-400 pb-1">/ {rows.length}</p>
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Hiányzó adatok</p>
          <p className={cn('text-2xl font-bold', missingCount > 0 ? 'text-red-600' : 'text-slate-400')}>{missingCount} ügyfélnél</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Bevallási határidő</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{deadlineDay}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Ügyfelek</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{rows.length}</p>
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
              <tr className="border-b border-border dark:bg-slate-900/30">
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
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-slate-300" />
                    Betöltés…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-slate-400">
                    <Calculator className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                    {searchQuery || filterMode !== 'all' ? 'Nincs találat a szűrőkkel' : 'Nincs bérszámfejtési ügyfél'}
                  </td>
                </tr>
              ) : (
                paginated.map(client => {
                  const cs = CYCLE_STATUS_CONFIG[client.cycleStatus] || CYCLE_STATUS_CONFIG.none;
                  const fs = FILING_STATUS_MAP[client.filingStatus] || FILING_STATUS_MAP.none;
                  return (
                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <Link to={`/eaisybooks/payroll/${client.companyId}`} className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">
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
                        {client.missingCount > 0 ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                              {client.missingCount}
                            </span>
                            {client.criticalCount > 0 && (
                              <span className="text-[10px] text-red-500/70">{client.criticalCount} kritikus</span>
                            )}
                          </div>
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-400 mx-auto" />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold', fs.color)}>{fs.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('text-xs font-semibold',
                          client.paymentStatus === 'completed' ? 'text-green-600' :
                          client.paymentStatus === 'pending' ? 'text-amber-600' : 'text-slate-400'
                        )}>
                          {client.paymentStatus === 'completed' ? 'Utalva' :
                           client.paymentStatus === 'pending' ? 'Függőben' : '–'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/eaisybooks/payroll/${client.companyId}`}
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
        {totalPages > 1 && (
          <div className="border-t border-border px-4 py-3 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
