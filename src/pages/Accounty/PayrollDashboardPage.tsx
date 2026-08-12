import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Calculator, FileText, Calendar, Clock, TrendingUp,
  Plus, Search, ArrowUpRight, Banknote, UserPlus, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Building2, Settings, ChevronLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePayrollEmployees, usePayrollCycles, usePayrollFilings, useTaxParameters } from '@/hooks/usePayrollData';
import { formatAmount } from '@/lib/payroll/validators';
import { Breadcrumb } from '@/components/accounty/SharedComponents';
import { useAccountyClients } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';

// ── Animated number component ──
function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(value / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString('hu-HU')}</>;
}

// ── KPI Card component ──
function KpiCard({ title, value, subtitle, icon: Icon, accentColor = 'teal' }: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  accentColor?: string;
}) {
  const colorMap: Record<string, string> = {
    teal: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
    blue: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
    amber: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10',
    red: 'from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
    violet: 'from-violet-500/10 to-violet-600/5 dark:from-violet-500/20 dark:to-violet-600/10',
  };
  const iconColorMap: Record<string, string> = {
    teal: 'bg-accent text-primary',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600',
    amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600',
    violet: 'bg-violet-100 dark:bg-violet-900/50 text-violet-600',
  };

  return (
    <div className={cn(
      "relative overflow-hidden bg-gradient-to-br rounded-xl p-5 border border-border shadow-soft flex flex-col justify-between h-32",
      "hover:shadow-lg hover:scale-[1.02] transition-all duration-300 cursor-default group bg-card",
      colorMap[accentColor] || colorMap.teal
    )}>
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", iconColorMap[accentColor] || iconColorMap.teal)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Status badge ──
function CycleStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    data_collection: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    calculating: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
    calculated: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    documents: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    submitted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    closed: 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };
  const labels: Record<string, string> = {
    draft: 'Tervezet',
    data_collection: 'Adatbekérés',
    review: 'Ellenőrzés',
    calculating: 'Számfejtés...',
    calculated: 'Számfejtve',
    approved: 'Jóváhagyva',
    documents: 'Dokumentumok',
    submitted: 'Beküldve',
    closed: 'Lezárva',
  };

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider', styles[status] || styles.draft)}>
      {labels[status] || status}
    </span>
  );
}

// ── Month name helper ──
const MONTHS = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];

export default function PayrollDashboardPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: employees = [], isLoading: empLoading, isError: empError } = usePayrollEmployees(companyId || '');
  const { data: cycles = [], isLoading: cyclesLoading, isError: cyclesError } = usePayrollCycles(companyId || '');
  const { data: filings = [], isLoading: filingsLoading, isError: filingsError } = usePayrollFilings(companyId || '');
  const { data: taxParams } = useTaxParameters(2026);
  const { data: allClients, isLoading: clientLoading } = useAccountyClients();
  const currentClientName = allClients?.find(c => c.companyId === companyId)?.name || 'Cég';

  const isLoading = empLoading || cyclesLoading || filingsLoading;
  const isError = empError || cyclesError || filingsError;

  // ── KPIs ──
  const kpis = useMemo(() => {
    const activeEmployees = employees.filter(e => e.status === 'active').length;
    const pendingCycles = cycles.filter(c => !['closed', 'submitted'].includes(c.status)).length;
    const pendingFilings = filings.filter(f => !['submitted', 'accepted'].includes(f.status)).length;
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const hasCurrent = cycles.some(c => c.year === currentYear && c.month === currentMonth);

    return { activeEmployees, pendingCycles, pendingFilings, hasCurrent };
  }, [employees, cycles, filings]);

  // ── Recent cycles (last 6) ──
  const recentCycles = useMemo(() => cycles.slice(0, 6), [cycles]);

  // ── Filtered employees ──
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees.slice(0, 10);
    const q = searchQuery.toLowerCase();
    return employees.filter(e =>
      `${e.last_name} ${e.first_name}`.toLowerCase().includes(q) ||
      (e.taj_number && e.taj_number.includes(q)) ||
      (e.tax_id && e.tax_id.includes(q))
    ).slice(0, 10);
  }, [employees, searchQuery]);

  if (isError) {
    return <AccountyErrorState message="Nem sikerült betölteni a bérszámfejtési adatokat." onRetry={() => window.location.reload()} />;
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl p-5 border border-border h-32 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mt-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/accounty?tab=payroll');
              }
            }}
            className="flex items-center justify-center w-8 h-8 mt-1.5 shrink-0 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title="Vissza"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currentClientName}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Bérszámfejtés</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Foglalkoztatottak, havi ciklusok és bevallások kezelése</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate(`/accounty/payroll/${companyId}/settings`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Beállítások
          </Button>
          <Button
            onClick={() => navigate(`/accounty/payroll/${companyId}/employees/new`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Új foglalkoztatott
          </Button>
          <Button
            onClick={() => navigate(`/accounty/payroll/${companyId}/cycle/new`)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Új havi ciklus
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Aktív foglalkoztatottak"
          value={kpis.activeEmployees}
          icon={Users}
          accentColor="teal"
        />
        <KpiCard
          title="Nyitott ciklusok"
          value={kpis.pendingCycles}
          subtitle={kpis.hasCurrent ? 'Aktuális havi ciklus fut' : 'Nincs aktuális ciklus'}
          icon={Calculator}
          accentColor="blue"
        />
        <KpiCard
          title="Bevallások"
          value={kpis.pendingFilings}
          subtitle="Beküldésre váró"
          icon={FileText}
          accentColor="amber"
        />
        <KpiCard
          title="Minimálbér 2026"
          value={taxParams ? formatAmount(taxParams.minimum_wage) : '322 800 Ft'}
          icon={Banknote}
          accentColor="violet"
        />
      </div>

      {/* Main grid: Employees + Cycles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Foglalkoztatottak panel ── */}
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Foglalkoztatottak</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/accounty/payroll/${companyId}/employees`)}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              Összes <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="px-5 py-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Keresés név, TAJ, adóazonosító..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 dark:bg-background border-transparent text-sm h-9"
              />
            </div>
          </div>

          <div className="divide-y divide-border/50">
            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <Users className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                {employees.length === 0 ? 'Még nincsenek foglalkoztatottak' : 'Nincs találat'}
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${emp.id}`)}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {emp.last_name[0]}{emp.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {emp.last_name} {emp.first_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {emp.taj_number || 'TAJ: –'}
                    </p>
                  </div>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                    emp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    emp.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  )}>
                    {emp.status === 'active' ? 'Aktív' : emp.status === 'pending' ? 'Függő' : emp.status === 'terminated' ? 'Kilépett' : emp.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Havi ciklusok panel ── */}
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Havi ciklusok</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/accounty/payroll/${companyId}/cycle/new`)}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Új ciklus
            </Button>
          </div>

          <div className="divide-y divide-border/50">
            {recentCycles.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                Még nincs bérszámfejtési ciklus
              </div>
            ) : (
              recentCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  onClick={() => navigate(`/accounty/payroll/${companyId}/cycle/${cycle.id}`)}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                >
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase leading-none">
                      {MONTHS[cycle.month - 1]?.slice(0, 3)}
                    </span>
                    <span className="text-lg font-black text-blue-700 dark:text-blue-300 leading-none mt-0.5">
                      {cycle.year}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {cycle.year}. {MONTHS[cycle.month - 1]}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Step indicator */}
                      <div className="flex gap-0.5">
                        {Array.from({ length: 8 }, (_, i) => (
                          <div
                            key={i}
                            className={cn(
                              'w-3 h-1 rounded-full transition-colors',
                              i < cycle.current_step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {cycle.current_step}/8 lépés
                      </span>
                    </div>
                  </div>
                  <CycleStatusBadge status={cycle.status} />
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bevallások ── */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">NAV Bevallások</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/accounty/payroll/${companyId}/filings`)}
            className="text-xs text-primary font-semibold flex items-center gap-1"
          >
            Összes <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Típus</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Időszak</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Csatorna</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Státusz</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Beküldve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    Nincs bevallás
                  </td>
                </tr>
              ) : (
                filings.slice(0, 5).map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase">{f.filing_type}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {f.period_year}/{f.period_month ? String(f.period_month).padStart(2, '0') : f.period_quarter ? `Q${f.period_quarter}` : '–'}
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-600 dark:text-slate-300 uppercase">
                      {f.channel || '–'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        f.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40' :
                        f.status === 'submitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40' :
                        f.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/40' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800'
                      )}>
                        {({ draft: 'Tervezet', generated: 'Generálva', submitted: 'Beküldve', accepted: 'Elfogadva', rejected: 'Elutasítva', error: 'Hiba' } as Record<string, string>)[f.status] || f.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {f.submitted_at ? new Date(f.submitted_at).toLocaleDateString('hu-HU') : '–'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick info: Tax params */}
      {taxParams && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'SZJA', value: `${(taxParams.szja_rate * 100).toFixed(0)}%` },
            { label: 'TB', value: `${(taxParams.tb_rate * 100).toFixed(1)}%` },
            { label: 'SZOCHO', value: `${(taxParams.szocho_rate * 100).toFixed(0)}%` },
            { label: 'Minimálbér', value: formatAmount(taxParams.minimum_wage) },
            { label: 'Garantált bérmin.', value: formatAmount(taxParams.guaranteed_minimum) },
            { label: 'EHO/hó', value: formatAmount(taxParams.health_service_monthly) },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-lg border border-border/50 p-3 text-center">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { path: 'filings', icon: FileText, title: 'NAV Bevallások', desc: '08-as, M30 generálás', color: 'blue', action: 'Megnyitás' },
          { path: 'reports', icon: TrendingUp, title: 'Riportok', desc: 'Bérelőzmény, trendek', color: 'violet', action: 'Megtekintés' },
          { path: 'declarations', icon: FileText, title: 'Nyilatkozatok', desc: 'SZJA kedvezmények', color: 'teal', action: 'Megnyitás' },
          { path: 'documents', icon: FileText, title: 'Dokumentumok', desc: 'Bérjegyzék, utalás', color: 'blue', action: 'Megnyitás' },
          { path: 'year-end', icon: Calendar, title: 'Év végi feladatok', desc: 'M30, SZJA, szabadság', color: 'amber', action: 'Megnyitás' },
          { path: 'advanced-reports', icon: TrendingUp, title: 'Haladó riportok', desc: 'Anomália, egyéni riport', color: 'violet', action: 'Megnyitás' },
          { path: 'portal', icon: Building2, title: 'Ügyfélportál', desc: 'Adatbekérés, chat', color: 'amber', action: 'Megnyitás' },
          { path: 'tax-params', icon: Calculator, title: 'Paraméterek', desc: 'Adókulcsok, minimálbér', color: 'teal', action: 'Szerkesztés' },
          { path: 'settings', icon: Settings, title: 'Beállítások', desc: 'Cégspecifikus konfiguráció', color: 'slate', action: 'Megnyitás' },
          { path: 'employees', icon: Users, title: 'Foglalkoztatottak', desc: 'Adatok, jogviszonyok', color: 'blue', action: 'Összes' },
        ].map((card) => {
          const colorMap: Record<string, string> = {
            blue: 'bg-blue-100 dark:bg-blue-900/30',
            violet: 'bg-violet-100 dark:bg-violet-900/30',
            amber: 'bg-amber-100 dark:bg-amber-900/30',
            teal: 'bg-teal-100 dark:bg-teal-900/30',
            slate: 'bg-slate-200 dark:bg-slate-700/50',
          };
          const iconColorMap: Record<string, string> = {
            blue: 'text-blue-600', violet: 'text-violet-600', amber: 'text-amber-600', teal: 'text-teal-600', slate: 'text-slate-600',
          };
          return (
            <div
              key={card.path}
              onClick={() => navigate(`/accounty/payroll/${companyId}/${card.path}`)}
              className="bg-card rounded-xl border border-border shadow-soft p-5 hover:shadow-lg hover:border-primary/30 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorMap[card.color])}>
                  <card.icon className={cn('w-5 h-5', iconColorMap[card.color])} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{card.title}</p>
                  <p className="text-xs text-slate-500">{card.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary font-semibold mt-2">
                {card.action} <ArrowUpRight className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
