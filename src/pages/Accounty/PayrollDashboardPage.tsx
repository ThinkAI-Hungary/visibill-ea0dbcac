import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Calculator, FileText, Calendar, Clock, TrendingUp,
  Plus, Search, ArrowUpRight, Banknote, UserPlus, ChevronRight,
  AlertTriangle, CheckCircle2, Loader2, Building2, Settings, ChevronLeft,
  Upload, Sparkles, Coins, LogOut, FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { usePayrollEmployees, usePayrollCycles, usePayrollFilings, useTaxParameters } from '@/hooks/usePayrollData';
import { formatAmount } from '@/lib/payroll/validators';
import { Breadcrumb } from '@/components/accounty/SharedComponents';
import { useAccountyClients } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { PayrollReconstructionDialog } from '@/components/accounty/payroll/PayrollReconstructionDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

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
      "relative overflow-hidden bg-gradient-to-br rounded-lg p-5 border border-border shadow-soft flex flex-col justify-between h-32",
      " transition-all duration-300 cursor-default group bg-card",
      colorMap[accentColor] || colorMap.teal
    )}>
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", iconColorMap[accentColor] || iconColorMap.teal)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Status badge ──
function CycleStatusBadge({ status, isHr }: { status: string; isHr?: boolean }) {
  const styles: Record<string, string> = {
    draft: 'bg-muted text-foreground/90 dark:bg-muted dark:text-foreground/90',
    data_collection: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    calculating: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
    calculated: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
    approved: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    documents: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-primary',
    submitted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    closed: 'bg-muted text-muted-foreground dark:bg-muted dark:text-foreground/90',
  };
  const labelsHu: Record<string, string> = {
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
  const labelsHr: Record<string, string> = {
    draft: 'Nacrt',
    data_collection: 'Prikupljanje podataka',
    review: 'Pregled',
    calculating: 'Obračunavanje...',
    calculated: 'Obračunato',
    approved: 'Odobreno',
    documents: 'Dokumenti',
    submitted: 'Poslano',
    closed: 'Zatvoreno',
  };
  const labels = isHr ? labelsHr : labelsHu;

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider', styles[status] || styles.draft)}>
      {labels[status] || status}
    </span>
  );
}

// ── Month name helper ──
const MONTHS_HU = ['Január', 'Február', 'Március', 'Április', 'Május', 'Június', 'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'];
const MONTHS_HR = ['Siječanj', 'Veljača', 'Ožujak', 'Travanj', 'Svibanj', 'Lipanj', 'Srpanj', 'Kolovoz', 'Rujan', 'Listopad', 'Studeni', 'Prosinac'];

export default function PayrollDashboardPage() {
  const { t, i18n } = useTranslation('accounty');
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const isHr = prefix === '/hr' || i18n.language === 'hr';
  const MONTHS = isHr ? MONTHS_HR : MONTHS_HU;
  const [searchQuery, setSearchQuery] = useState('');
  const [reconstructionOpen, setReconstructionOpen] = useState(false);
  const [exitModalOpen, setExitModalOpen] = useState(false);
  const [exitSearchQuery, setExitSearchQuery] = useState('');

  const { data: employees = [], isLoading: empLoading, isError: empError } = usePayrollEmployees(companyId || '');
  const { data: cycles = [], isLoading: cyclesLoading, isError: cyclesError } = usePayrollCycles(companyId || '');
  const { data: filings = [], isLoading: filingsLoading, isError: filingsError } = usePayrollFilings(companyId || '');
  const { dateFrom, dateFromFormatted, dateToFormatted } = useDateRange();
  const effectiveDateRange = dateRange || `${dateFromFormatted}_${dateToFormatted}`;
  const taxYear = dateFrom.getFullYear();
  const { data: taxParams } = useTaxParameters(taxYear);
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

  // ── Exit document candidate employees ──
  const exitCandidateEmployees = useMemo(() => {
    let list = [...employees];
    if (exitSearchQuery.trim()) {
      const q = exitSearchQuery.toLowerCase();
      list = list.filter(e =>
        `${e.last_name} ${e.first_name}`.toLowerCase().includes(q) ||
        (e.taj_number && e.taj_number.includes(q)) ||
        (e.tax_id && e.tax_id.includes(q))
      );
    }
    return list.sort((a, b) => {
      if (a.status === 'terminated' && b.status !== 'terminated') return -1;
      if (b.status === 'terminated' && a.status !== 'terminated') return 1;
      return `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, 'hu');
    });
  }, [employees, exitSearchQuery]);

  const handleOpenExitDocs = () => {
    if (employees.length === 0) {
      navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees`);
      return;
    }
    if (employees.length === 1) {
      navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${employees[0].id}/exit-docs`);
      return;
    }
    setExitSearchQuery('');
    setExitModalOpen(true);
  };

  if (isError) {
    return <AccountyErrorState message="Nem sikerült betölteni a bérszámfejtési adatokat." onRetry={() => window.location.reload()} />;
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 page-animate">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-lg p-5 border border-border h-32 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="w-9 h-9 bg-muted rounded-lg" />
              </div>
              <div className="h-8 w-16 bg-muted rounded mt-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 pb-32 page-animate">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate(`${prefix}/eaisybooks?tab=payroll`);
              }
            }}
            className="flex items-center justify-center w-8 h-8 mt-1.5 shrink-0 rounded-lg border border-border bg-card hover:bg-muted transition-colors shadow-sm"
            title={t('common.back')}
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              {clientLoading ? (
                <div className="h-3.5 w-32 bg-muted rounded animate-pulse" />
              ) : (
                <span className="text-xs font-semibold text-muted-foreground">{currentClientName}</span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('payroll_dashboard.title')}</h1>
            <p className="text-xs text-muted-foreground mt-1">{t('payroll_dashboard.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            onClick={() => setReconstructionOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-blue-500" />
            {t('payroll_dashboard.btn_reconstruction')}
          </Button>
          <Button
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/import`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t('payroll_dashboard.btn_import')}
          </Button>
          <Button
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/dividends`)}
            variant="outline"
            className="flex items-center gap-2 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
          >
            <Coins className="w-4 h-4 text-emerald-600" />
            {t('payroll_dashboard.btn_dividends')}
          </Button>
          <Button
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/settings`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {t('payroll_dashboard.btn_settings')}
          </Button>
          <Button
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/new`)}
            variant="outline"
            className="flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            {t('payroll_dashboard.btn_new_employee')}
          </Button>
          <Button
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/cycle/new`)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('payroll_dashboard.btn_new_cycle')}
          </Button>
        </div>
      </div>

      {/* Onboarding / Fast-Track Banner if 0 cycles */}
      {cycles.length === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 page-animate">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-md shadow-blue-500/20 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                {t('payroll_dashboard.banner_title')}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('payroll_dashboard.banner_desc')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/import`)}
              variant="outline"
              className="text-xs"
            >
              {t('payroll_dashboard.banner_btn_excel')}
            </Button>
            {!isHr && (
              <Button
                size="sm"
                onClick={() => setReconstructionOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs gap-1.5 shadow-sm shadow-blue-600/20"
              >
                <Sparkles className="w-3.5 h-3.5" /> {t('payroll_dashboard.banner_btn_xml')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title={t('payroll_dashboard.kpi_active_employees')}
          value={kpis.activeEmployees}
          icon={Users}
          accentColor="teal"
        />
        <KpiCard
          title={t('payroll_dashboard.kpi_open_cycles')}
          value={kpis.pendingCycles}
          subtitle={kpis.hasCurrent ? t('payroll_dashboard.kpi_active_cycle_running') : t('payroll_dashboard.kpi_no_active_cycle')}
          icon={Calculator}
          accentColor="blue"
        />
        <KpiCard
          title={t('payroll_dashboard.kpi_filings')}
          value={kpis.pendingFilings}
          subtitle={t('payroll_dashboard.kpi_filings_pending')}
          icon={FileText}
          accentColor="amber"
        />
        <KpiCard
          title={t('payroll_dashboard.kpi_minimum_wage', { year: taxYear || 2026 })}
          value={isHr ? '970,00 €' : (taxParams ? formatAmount(taxParams.minimum_wage) : '322 800 Ft')}
          icon={Banknote}
          accentColor="violet"
        />
      </div>

      {/* Main grid: Employees + Cycles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Foglalkoztatottak panel ── */}
        <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{t('payroll_dashboard.panel_employees_title')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees`)}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              {t('payroll_dashboard.panel_employees_all')} <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <div className="px-5 py-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('payroll_dashboard.panel_employees_search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/40 dark:bg-background border-transparent text-sm h-9"
              />
            </div>
          </div>

          <div className="divide-y divide-border/50">
            {filteredEmployees.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                {employees.length === 0 ? t('payroll_dashboard.panel_employees_empty') : t('payroll_dashboard.panel_employees_no_match')}
              </div>
            ) : (
              filteredEmployees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${emp.id}`)}
                  className="px-5 py-3.5 flex items-center gap-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                    {emp.last_name[0]}{emp.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {emp.last_name} {emp.first_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {emp.taj_number || 'TAJ: –'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Kilépő dokumentumok megtekintése"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${emp.id}/exit-docs`);
                    }}
                    className={cn(
                      "text-xs h-7 px-2.5 transition-all shrink-0",
                      emp.status === 'terminated'
                        ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-100 font-semibold"
                        : "text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-0 group-hover:opacity-100"
                    )}
                  >
                    <LogOut className="w-3 h-3 mr-1" />
                    {t('payroll_dashboard.panel_employees_exit_docs')}
                  </Button>
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0',
                    emp.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' :
                    emp.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                    emp.status === 'terminated' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' :
                    'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground'
                  )}>
                    {emp.status === 'active' ? t('payroll_dashboard.status_active') : emp.status === 'pending' ? t('payroll_dashboard.status_pending') : emp.status === 'terminated' ? t('payroll_dashboard.status_terminated') : emp.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Havi ciklusok panel ── */}
        <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{t('payroll_dashboard.panel_cycles_title')}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/cycle/new`)}
              className="text-xs text-primary font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> {t('payroll_dashboard.panel_cycles_new')}
            </Button>
          </div>

          <div className="divide-y divide-border/50">
            {recentCycles.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                {t('payroll_dashboard.panel_cycles_empty')}
              </div>
            ) : (
              recentCycles.map((cycle) => (
                <div
                  key={cycle.id}
                  onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/cycle/${cycle.id}`)}
                  className="px-5 py-4 flex items-center gap-4 hover:bg-muted/50 cursor-pointer transition-colors group"
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
                    <p className="text-sm font-semibold text-foreground">
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
                              i < cycle.current_step ? 'bg-primary' : 'bg-muted'
                            )}
                          />
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {t('payroll_dashboard.panel_cycles_step_count', { current: cycle.current_step, total: 8 })}
                      </span>
                    </div>
                  </div>
                  <CycleStatusBadge status={cycle.status} isHr={isHr} />
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Bevallások ── */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{t('payroll_dashboard.panel_filings_title')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/filings`)}
            className="text-xs text-primary font-semibold flex items-center gap-1"
          >
            Összes <ArrowUpRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{t('payroll_dashboard.th_type')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{t('payroll_dashboard.th_period')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{t('payroll_dashboard.th_channel')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{t('payroll_dashboard.th_status')}</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">{t('payroll_dashboard.th_submitted')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                    {t('payroll_dashboard.panel_filings_empty')}
                  </td>
                </tr>
              ) : (
                filings.slice(0, 5).map((f) => (
                  <tr key={f.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="text-sm font-semibold text-foreground uppercase">{f.filing_type}</span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground dark:text-foreground/90">
                      {f.period_year}/{f.period_month ? String(f.period_month).padStart(2, '0') : f.period_quarter ? `Q${f.period_quarter}` : '–'}
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground dark:text-foreground/90 uppercase">
                      {f.channel || '–'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                        f.status === 'accepted' ? 'bg-green-100 text-green-700 dark:bg-green-900/40' :
                        f.status === 'submitted' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40' :
                        f.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/40' :
                        'bg-muted text-muted-foreground dark:bg-muted'
                      )}>
                        {({ draft: 'Tervezet', generated: 'Generálva', submitted: 'Beküldve', accepted: 'Elfogadva', rejected: 'Elutasítva', error: 'Hiba' } as Record<string, string>)[f.status] || f.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">
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
      {isHr ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'MIO I. (1. stup)', value: '15%' },
            { label: 'MIO II. (2. stup)', value: '5%' },
            { label: 'Zdravstveno', value: '16.5%' },
            { label: 'Min. bruto plaća', value: '970,00 €' },
            { label: 'Osnovni odbitak', value: '600,00 €' },
            { label: 'Porez na dohodak', value: '20% / 30%' },
          ].map((item) => (
            <div key={item.label} className="bg-card rounded-lg border border-border/50 p-3 text-center">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-bold text-foreground mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      ) : taxParams ? (
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
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-bold text-foreground mt-1">{item.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {[
          { path: 'filings', icon: FileText, title: t('payroll_dashboard.quick_card_filings'), desc: t('payroll_dashboard.quick_card_filings_desc'), color: 'blue', action: t('payroll_dashboard.action_open') },
          { path: 'reports', icon: TrendingUp, title: t('payroll_dashboard.quick_card_reports'), desc: t('payroll_dashboard.quick_card_reports_desc'), color: 'violet', action: t('payroll_dashboard.action_view') },
          { path: 'declarations', icon: FileText, title: t('payroll_dashboard.quick_card_declarations'), desc: t('payroll_dashboard.quick_card_declarations_desc'), color: 'teal', action: t('payroll_dashboard.action_open') },
          { path: 'documents', icon: FileText, title: t('payroll_dashboard.quick_card_documents'), desc: t('payroll_dashboard.quick_card_documents_desc'), color: 'blue', action: t('payroll_dashboard.action_open') },
          { path: 'exit-docs', icon: LogOut, title: t('payroll_dashboard.quick_card_exit'), desc: t('payroll_dashboard.quick_card_exit_desc'), color: 'rose', action: t('payroll_dashboard.action_open'), isExitDocs: true },
          { path: 'year-end', icon: Calendar, title: t('payroll_dashboard.quick_card_year_end'), desc: t('payroll_dashboard.quick_card_year_end_desc'), color: 'amber', action: t('payroll_dashboard.action_open') },
          { path: 'advanced-reports', icon: TrendingUp, title: t('payroll_dashboard.quick_card_advanced_reports'), desc: t('payroll_dashboard.quick_card_advanced_reports_desc'), color: 'violet', action: t('payroll_dashboard.action_open') },
          { path: 'portal', icon: Building2, title: t('payroll_dashboard.quick_card_portal'), desc: t('payroll_dashboard.quick_card_portal_desc'), color: 'amber', action: t('payroll_dashboard.action_open') },
          { path: 'tax-params', icon: Calculator, title: t('payroll_dashboard.quick_card_tax_params'), desc: t('payroll_dashboard.quick_card_tax_params_desc'), color: 'teal', action: t('payroll_dashboard.action_edit') },
          { path: 'settings', icon: Settings, title: t('payroll_dashboard.quick_card_settings'), desc: t('payroll_dashboard.quick_card_settings_desc'), color: 'slate', action: t('payroll_dashboard.action_open') },
          { path: 'employees', icon: Users, title: t('payroll_dashboard.quick_card_employees'), desc: t('payroll_dashboard.quick_card_employees_desc'), color: 'blue', action: t('payroll_dashboard.panel_employees_all') },
        ].map((card) => {
          const colorMap: Record<string, string> = {
            blue: 'bg-blue-100 dark:bg-blue-900/30',
            violet: 'bg-violet-100 dark:bg-violet-900/30',
            amber: 'bg-amber-100 dark:bg-amber-900/30',
            teal: 'bg-teal-100 dark:bg-teal-900/30',
            rose: 'bg-rose-100 dark:bg-rose-900/30',
            slate: 'bg-muted/50',
          };
          const iconColorMap: Record<string, string> = {
            blue: 'text-blue-600',
            violet: 'text-violet-600',
            amber: 'text-amber-600',
            teal: 'text-teal-600',
            rose: 'text-rose-600',
            slate: 'text-muted-foreground',
          };
          return (
            <div
              key={card.path}
              onClick={() => {
                if ('isExitDocs' in card && card.isExitDocs) {
                  handleOpenExitDocs();
                } else {
                  navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/${card.path}`);
                }
              }}
              className="bg-card rounded-lg border border-border shadow-soft p-5 hover:border-primary/30 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorMap[card.color])}>
                  <card.icon className={cn('w-5 h-5', iconColorMap[card.color])} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{card.title}</p>
                  <p className="text-xs text-muted-foreground">{card.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-primary font-semibold mt-2">
                {card.action} <ArrowUpRight className="w-3 h-3" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 2026 Fast-Track Payroll Reconstruction Dialog */}
      <PayrollReconstructionDialog
        companyId={companyId || ''}
        companyName={currentClientName}
        open={reconstructionOpen}
        onOpenChange={setReconstructionOpen}
      />

      {/* Kilépő dokumentumok munkavállaló-választó modál */}
      <Dialog open={exitModalOpen} onOpenChange={setExitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400">
                <LogOut className="w-5 h-5" />
              </div>
              Kilépő dokumentumok
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Válaszd ki a munkavállalót, akinek a kilépő csomagját (Mt. 80. § igazolás, TB kiskönyv/igazolás, M30 jövedelemigazolás, szabadság-elszámolás, záró bérlap) meg szeretnéd tekinteni vagy ki szeretnéd nyomtatni.
            </DialogDescription>
          </DialogHeader>

          {employees.length > 5 && (
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Keresés név, adóazonosító, TAJ..."
                value={exitSearchQuery}
                onChange={(e) => setExitSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          )}

          <div className="max-h-72 overflow-y-auto divide-y divide-border/50 -mx-6 px-6 mt-2">
            {exitCandidateEmployees.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nincs megjeleníthető munkavállaló
              </div>
            ) : (
              exitCandidateEmployees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => {
                    setExitModalOpen(false);
                    navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${emp.id}/exit-docs`);
                  }}
                  className="py-3 px-3 rounded-lg flex items-center justify-between hover:bg-muted/60 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      emp.status === 'terminated'
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-primary/10 text-primary"
                    )}>
                      {emp.last_name[0]}{emp.first_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {emp.last_name} {emp.first_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {emp.job_title || 'Munkakör nincs megadva'} • TAJ: {emp.taj_number || '–'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase',
                      emp.status === 'terminated'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                        : emp.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground'
                    )}>
                      {emp.status === 'terminated' ? 'Kilépett' : emp.status === 'active' ? 'Aktív' : emp.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
