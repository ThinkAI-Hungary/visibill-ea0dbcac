import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Brain, AlertTriangle, CheckCircle2, Zap, RefreshCw, Loader2, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';
import {
  usePayrollEmployees, usePayrollCycles, usePayrollCalculations,
  useTaxParameters, paramsToTaxParams,
  type PayrollEmployee, type PayrollEmployment, type PayrollCycle, type PayrollCalculation,
} from '@/hooks/usePayrollData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  runAnomalyRules,
  type Anomaly, type AnomalySeverity, type AnomalyInput,
  type EmploymentWithEmployee, type CalculationData,
} from '@/lib/payroll/anomalyEngine';

// ═══════════════════════════════════════════════════════════════
// HOOK: Fetch all employments across all assigned companies
// ═══════════════════════════════════════════════════════════════

function useAllEmployments(companyIds: string[]) {
  return useQuery({
    queryKey: ['anomaly', 'all-employments', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return [];
      const { data, error } = await supabase
        .from('accounty_employments')
        .select('*, accounty_employees!inner(first_name, last_name)')
        .in('company_id', companyIds)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []).map((row: any) => ({
        employmentId: row.id,
        employeeId: row.employee_id,
        employeeName: `${row.accounty_employees?.last_name || ''} ${row.accounty_employees?.first_name || ''}`.trim(),
        baseSalary: row.base_salary,
        weeklyHours: row.weekly_hours || 40,
        feorCode: row.feor_code,
        jobTitle: row.job_title,
        status: row.status,
        isInsured: row.is_insured ?? true,
        startDate: row.start_date,
        endDate: row.end_date,
      } satisfies EmploymentWithEmployee));
    },
    enabled: companyIds.length > 0,
    staleTime: 30_000,
  });
}

// ═══════════════════════════════════════════════════════════════
// HOOK: Fetch latest cycle calculations across all companies
// ═══════════════════════════════════════════════════════════════

function useLatestCalculations(companyIds: string[]) {
  return useQuery({
    queryKey: ['anomaly', 'latest-calculations', companyIds],
    queryFn: async () => {
      if (companyIds.length === 0) return { calculations: [] as CalculationData[], cycleLabel: '' };

      // Get latest cycle per company
      const { data: cycles, error: cycError } = await supabase
        .from('accounty_payroll_cycles')
        .select('id, company_id, year, month')
        .in('company_id', companyIds)
        .order('year', { ascending: false })
        .order('month', { ascending: false });

      if (cycError) throw cycError;
      if (!cycles || cycles.length === 0) return { calculations: [], cycleLabel: '' };

      // Take the most recent cycle per company
      const latestByCompany = new Map<string, typeof cycles[0]>();
      for (const c of cycles) {
        if (!latestByCompany.has(c.company_id)) latestByCompany.set(c.company_id, c);
      }
      const cycleIds = Array.from(latestByCompany.values()).map(c => c.id);
      const firstCycle = Array.from(latestByCompany.values())[0];
      const cycleLabel = firstCycle ? `${firstCycle.year}/${String(firstCycle.month).padStart(2, '0')}` : '';

      // Fetch calculations with employee names via employment join
      const { data: calcs, error: calcError } = await supabase
        .from('accounty_payroll_calculations')
        .select('*, accounty_employments!inner(id, employee_id, accounty_employees!inner(first_name, last_name))')
        .in('cycle_id', cycleIds);

      if (calcError) throw calcError;

      const mapped: CalculationData[] = (calcs || []).map((row: any) => ({
        employmentId: row.employment_id,
        employeeName: `${row.accounty_employments?.accounty_employees?.last_name || ''} ${row.accounty_employments?.accounty_employees?.first_name || ''}`.trim(),
        grossSalary: row.gross_salary || 0,
        szjaBase: row.szja_base || 0,
        szjaAmount: row.szja_amount || 0,
        tbAmount: row.tb_amount || 0,
        szochoAmount: row.szocho_amount || 0,
        netSalary: row.net_salary || 0,
        totalDeductions: row.total_deductions || 0,
        taxCredits: row.tax_credits || {},
        szochoCredits: row.szocho_credits || {},
      }));

      return { calculations: mapped, cycleLabel };
    },
    enabled: companyIds.length > 0,
    staleTime: 30_000,
  });
}

// ═══════════════════════════════════════════════════════════════
// SEVERITY CONFIG
// ═══════════════════════════════════════════════════════════════

const SEV_CONFIG: Record<AnomalySeverity, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  critical: { label: 'Kritikus', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20', icon: AlertTriangle },
  warning: { label: 'Figyelmeztetés', color: 'text-yellow-700 dark:text-yellow-400', bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:border-yellow-500/20', icon: AlertTriangle },
  info: { label: 'Információ', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20', icon: Zap },
};

// ═══════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════

export default function AiAnomalyReportPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | AnomalySeverity>('all');
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Data fetching
  const { data: clients = [], isLoading: clientsLoading } = useAccountyClients();
  const companyIds = useMemo(() => clients.map(c => c.id), [clients]);

  const { data: employments = [], isLoading: empLoading, refetch: refetchEmp } = useAllEmployments(companyIds);
  const { data: calcData, isLoading: calcLoading, refetch: refetchCalc } = useLatestCalculations(companyIds);
  const calculations = calcData?.calculations || [];
  const cycleLabel = calcData?.cycleLabel || '';

  const { data: taxParamsRaw = {}, isLoading: taxLoading } = useTaxParameters(2026);
  const taxP = paramsToTaxParams(taxParamsRaw);

  const isLoading = clientsLoading || empLoading || calcLoading || taxLoading;

  // Run anomaly engine
  const anomalies = useMemo<Anomaly[]>(() => {
    if (isLoading || employments.length === 0) return [];

    const input: AnomalyInput = {
      employments,
      calculations,
      taxParams: {
        minimumWage: taxP.minimum_wage,
        guaranteedMinimum: taxP.guaranteed_minimum,
        szjaRate: taxP.szja_rate,
        tbRate: taxP.tb_rate,
        szochoRate: taxP.szocho_rate,
      },
    };

    return runAnomalyRules(input);
  }, [isLoading, employments, calculations, taxP]);

  // Apply resolved + filter + search
  const enriched = useMemo(() => {
    return anomalies.map(a => ({ ...a, resolved: resolvedIds.has(a.id) }));
  }, [anomalies, resolvedIds]);

  const filtered = useMemo(() => {
    return enriched.filter(a => {
      if (filter !== 'all' && a.severity !== filter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !a.affectedEmployees.join(' ').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [enriched, filter, searchQuery]);

  const stats = {
    critical: enriched.filter(a => a.severity === 'critical' && !a.resolved).length,
    warning: enriched.filter(a => a.severity === 'warning' && !a.resolved).length,
    info: enriched.filter(a => a.severity === 'info' && !a.resolved).length,
    resolved: enriched.filter(a => a.resolved).length,
  };

  const [scanning, setScanning] = useState(false);
  const handleScan = async () => {
    setScanning(true);
    await Promise.all([refetchEmp(), refetchCalc()]);
    setScanning(false);
  };

  const toggleResolved = (id: string) => {
    setResolvedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl shadow-lg shadow-purple-500/25"><Brain className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold">Anomália észlelés</h1>
            <p className="text-sm text-slate-500">
              Szabályalapú bérszámfejtési anomáliák felderítése
              {cycleLabel && <span className="ml-1 text-primary">· {cycleLabel}</span>}
              {!isLoading && <span className="ml-1">· {clients.length} cég, {employments.length} jogviszony</span>}
            </p>
          </div>
        </div>
        <Button onClick={handleScan} disabled={scanning || isLoading} className="gap-1.5 bg-purple-600 hover:bg-purple-700">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
          {scanning ? 'Elemzés...' : 'Újra elemzés'}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20 bg-card rounded-xl border border-border">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-purple-500" />
            <p className="text-sm text-slate-500">Adatok lekérdezése és elemzés...</p>
            <p className="text-xs text-slate-400">{clients.length} cég, jogviszonyok és számfejtések betöltése</p>
          </div>
        </div>
      )}

      {!isLoading && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
              <p className="text-xs text-slate-500">Kritikus</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
              <p className="text-xs text-slate-500">Figyelmeztetés</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.info}</p>
              <p className="text-xs text-slate-500">Információ</p>
            </div>
            <div className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">{stats.resolved}</p>
              <p className="text-xs text-slate-500">Megoldva</p>
            </div>
          </div>

          {/* Search + Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Keresés anomáliákban..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-card border-border h-9 text-sm"
              />
            </div>
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
              {[{ id: 'all' as const, label: 'Mind' }, { id: 'critical' as const, label: 'Kritikus' }, { id: 'warning' as const, label: 'Figyelmeztetés' }, { id: 'info' as const, label: 'Info' }].map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all', filter === f.id ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500')}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="py-16 text-center bg-card rounded-xl border border-border">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {anomalies.length === 0 ? 'Nincs anomália — minden rendben!' : 'Nincs találat a szűrőkkel'}
                </p>
                {anomalies.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1">
                    {employments.length} jogviszony és {calculations.length} számfejtés ellenőrizve, {7} szabály alapján.
                  </p>
                )}
              </div>
            ) : (
              filtered.map(anomaly => {
                const sev = SEV_CONFIG[anomaly.severity];
                return (
                  <div key={anomaly.id} className={cn('rounded-xl border p-5 space-y-3 transition-all', anomaly.resolved ? 'bg-slate-50 dark:bg-slate-900/30 border-border opacity-60' : sev.bg)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <sev.icon className={cn('w-5 h-5 mt-0.5 shrink-0', sev.color)} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-bold">{anomaly.title}</h3>
                            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', anomaly.severity === 'critical' ? 'bg-red-200 text-red-800' : anomaly.severity === 'warning' ? 'bg-yellow-200 text-yellow-800' : 'bg-blue-200 text-blue-800')}>{sev.label}</span>
                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded">{anomaly.category}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{anomaly.description}</p>
                        </div>
                      </div>
                      <button onClick={() => toggleResolved(anomaly.id)} className={cn('px-3 py-1 rounded-lg text-xs font-bold transition-colors shrink-0', anomaly.resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600 hover:bg-emerald-100 hover:text-emerald-700')}>
                        {anomaly.resolved ? ' Megoldva' : 'Megoldva'}
                      </button>
                    </div>
                    {!anomaly.resolved && (
                      <>
                        <div className="grid grid-cols-2 gap-3 pl-8 text-xs">
                          <div><span className="text-slate-400">Érintett:</span> <strong>{anomaly.affectedEmployees.join(', ')}</strong></div>
                          <div><span className="text-slate-400">Hatás:</span> <strong>{anomaly.potentialImpact}</strong></div>
                        </div>
                        <div className="pl-8 bg-white dark:bg-slate-900 rounded-lg p-3 text-sm border border-border/50">
                          <span className="text-[10px] text-emerald-600 font-bold uppercase">Javaslat:</span>
                          <p className="text-slate-700 dark:text-slate-300 mt-0.5">{anomaly.recommendation}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
