import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BarChart3, TrendingUp, Download,
  Users, Calendar, DollarSign, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/accounty/ExportButton';
import { cn } from '@/lib/utils';
import { usePayrollCycles, usePayrollEmployees, usePayrollFilings } from '@/hooks/usePayrollData';
import { useAccountyClients } from '@/hooks/useAccountyData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const MONTHS = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

function fmt(n: number): string {
  return n.toLocaleString('hu-HU');
}

interface MonthlyData {
  month: number;
  year: number;
  gross: number;
  net: number;
  szja: number;
  tb: number;
  szocho: number;
  employees: number;
}

export default function PayrollReportsPage() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: clients } = useAccountyClients();
  const { data: cycles = [] } = usePayrollCycles(companyId || '');
  const { data: employees = [] } = usePayrollEmployees(companyId || '');

  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // Fetch all calculations for this company's cycles in selected year
  const yearCycles = useMemo(() => cycles.filter(c => c.year === selectedYear), [cycles, selectedYear]);

  const { data: allCalcs = [] } = useQuery({
    queryKey: ['payroll', 'reports', companyId, selectedYear],
    queryFn: async () => {
      if (yearCycles.length === 0) return [];
      const cycleIds = yearCycles.map(c => c.id);
      const { data, error } = await supabase
        .from('accounty_payroll_calculations')
        .select('*')
        .in('cycle_id', cycleIds);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: yearCycles.length > 0,
    staleTime: 60_000,
  });

  // Build monthly data
  const monthlyData: MonthlyData[] = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const cycle = yearCycles.find(c => c.month === month);
      const calcs = cycle ? allCalcs.filter((c: any) => c.cycle_id === cycle.id) : [];

      return {
        month,
        year: selectedYear,
        gross: calcs.reduce((s: number, c: any) => s + (c.gross_salary || 0), 0),
        net: calcs.reduce((s: number, c: any) => s + (c.net_salary || 0), 0),
        szja: calcs.reduce((s: number, c: any) => s + (c.szja_amount || 0), 0),
        tb: calcs.reduce((s: number, c: any) => s + (c.tb_amount || 0), 0),
        szocho: calcs.reduce((s: number, c: any) => s + (c.szocho_amount || 0), 0),
        employees: calcs.length,
      };
    });
  }, [yearCycles, allCalcs, selectedYear]);

  // Yearly totals
  const yearTotals = useMemo(() => ({
    gross: monthlyData.reduce((s, m) => s + m.gross, 0),
    net: monthlyData.reduce((s, m) => s + m.net, 0),
    szja: monthlyData.reduce((s, m) => s + m.szja, 0),
    tb: monthlyData.reduce((s, m) => s + m.tb, 0),
    szocho: monthlyData.reduce((s, m) => s + m.szocho, 0),
    avgEmployees: Math.round(monthlyData.filter(m => m.employees > 0).reduce((s, m) => s + m.employees, 0) / Math.max(1, monthlyData.filter(m => m.employees > 0).length)),
  }), [monthlyData]);

  // Max value for chart scaling
  const maxGross = Math.max(...monthlyData.map(m => m.gross), 1);



  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bérelőzmény riportok</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{company?.name || '–'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            filename={`berelozmeny_${company?.name || 'riport'}_${selectedYear}`}
            headers={['Hónap', 'Létszám', 'Bruttó', 'SZJA', 'TB', 'SZOCHO', 'Nettó']}
            getRows={() => [
              ...monthlyData.map(m => [`${selectedYear}. ${MONTHS[m.month - 1]}`, m.employees, m.gross, m.szja, m.tb, m.szocho, m.net]),
              ['ÖSSZESEN', yearTotals.avgEmployees, yearTotals.gross, yearTotals.szja, yearTotals.tb, yearTotals.szocho, yearTotals.net],
            ]}
            size="sm"
          />
          {[2025, 2026, 2027].map(year => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all',
                selectedYear === year
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
              )}
            >
              {year}
            </button>
          ))}
        </div>
      </div>

      {/* Year summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Éves bruttó', value: yearTotals.gross, color: 'text-slate-900 dark:text-slate-100' },
          { label: 'Éves nettó', value: yearTotals.net, color: 'text-green-600' },
          { label: 'Éves SZJA', value: yearTotals.szja, color: 'text-red-600' },
          { label: 'Éves TB', value: yearTotals.tb, color: 'text-blue-600' },
          { label: 'Éves SZOCHO', value: yearTotals.szocho, color: 'text-violet-600' },
          { label: 'Átl. létszám', value: yearTotals.avgEmployees, color: 'text-teal-600', isCnt: true },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border border-border shadow-soft p-4">
            <p className="text-[10px] font-medium text-slate-500 uppercase">{item.label}</p>
            <p className={cn('text-lg font-bold mt-1 font-mono', item.color)}>
              {(item).isCnt ? item.value : `${fmt(item.value)} Ft`}
            </p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-card rounded-xl border border-border shadow-soft p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Havi bruttó / nettó trend</h2>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary/70" />
              <span className="text-slate-500">Bruttó</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-slate-500">Nettó</span>
            </div>
          </div>
        </div>

        <div className="flex items-end gap-1 h-48">
          {monthlyData.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end" style={{ height: '160px' }}>
                {/* Gross bar */}
                <div
                  className="flex-1 bg-primary/20 hover:bg-primary/30 rounded-t transition-all relative group"
                  style={{ height: `${Math.max(2, (m.gross / maxGross) * 100)}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {fmt(m.gross)} Ft
                  </div>
                </div>
                {/* Net bar */}
                <div
                  className="flex-1 bg-green-500/30 hover:bg-green-500/40 rounded-t transition-all relative group"
                  style={{ height: `${Math.max(2, (m.net / maxGross) * 100)}%` }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    {fmt(m.net)} Ft
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-medium text-slate-500">{MONTHS[m.month - 1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Havi részletes összesítő</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase">Hónap</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Létszám</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Bruttó</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">SZJA</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">TB</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">SZOCHO</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-slate-500 uppercase">Nettó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {monthlyData.map((m) => (
                <tr key={m.month} className={cn(
                  'hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors',
                  m.employees === 0 && 'opacity-40'
                )}>
                  <td className="px-5 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {selectedYear}. {MONTHS[m.month - 1]}
                  </td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-slate-600">{m.employees || '–'}</td>
                  <td className="px-5 py-3 text-right text-sm font-mono">{m.gross ? fmt(m.gross) : '–'}</td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-red-600">{m.szja ? fmt(m.szja) : '–'}</td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-blue-600">{m.tb ? fmt(m.tb) : '–'}</td>
                  <td className="px-5 py-3 text-right text-sm font-mono text-violet-600">{m.szocho ? fmt(m.szocho) : '–'}</td>
                  <td className="px-5 py-3 text-right text-sm font-bold font-mono text-green-600">{m.net ? fmt(m.net) : '–'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-slate-50/80 dark:bg-slate-900/50 font-bold">
                <td className="px-5 py-3 text-sm text-slate-900 dark:text-slate-100">ÖSSZESEN</td>
                <td className="px-5 py-3 text-right text-sm font-mono">{yearTotals.avgEmployees}</td>
                <td className="px-5 py-3 text-right text-sm font-mono">{fmt(yearTotals.gross)}</td>
                <td className="px-5 py-3 text-right text-sm font-mono text-red-600">{fmt(yearTotals.szja)}</td>
                <td className="px-5 py-3 text-right text-sm font-mono text-blue-600">{fmt(yearTotals.tb)}</td>
                <td className="px-5 py-3 text-right text-sm font-mono text-violet-600">{fmt(yearTotals.szocho)}</td>
                <td className="px-5 py-3 text-right text-sm font-mono text-green-600">{fmt(yearTotals.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
