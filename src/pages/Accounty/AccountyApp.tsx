import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import AccountyWelcomeWizard from '@/components/accounty/AccountyWelcomeWizard';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List as ListIcon, 
  Kanban,
  Users, 
  FileText, 
  AlertTriangle,
  Clock,
  Building,
  User,
  Shield,
  UserCheck,
  Loader2,
  Database,
  X,
  CheckCircle,
  AlertCircle,
  Check,
  ChevronRight
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientData } from './types';
import { 
  useAccountyClients, 
  useAccountyKpis, 
  useUpdateKanbanStatus, 
  useAccountyMonthlyTrend, 
  useAccountyColleagueStats, 
  useAccountyAuditLog, 
  useAccountyPortalStats, 
  useUpdateClientOwner 
} from '@/hooks/accounty';
import { useAccountyRole } from './AccountyRoleContext';
import { seedAccountyAssignments } from '@/utils/seedAccounty';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { supabase } from '@/integrations/supabase/client';
import { BarChart2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';

import DashboardKpiView from '@/components/accounty/dashboard/DashboardKpiView';
import ClientGridView from '@/components/accounty/dashboard/ClientGridView';
import ClientListView from '@/components/accounty/dashboard/ClientListView';
import ClientKanbanView from '@/components/accounty/dashboard/ClientKanbanView';
import { KpiCard, CLIENT_COLORS } from '@/components/accounty/dashboard/DashboardShared';

const PayrollPortfolioPage = lazy(() => import('./PayrollPortfolioPage'));
const TaoPortfolioPage = lazy(() => import('./Tao/TaoPortfolioPage'));
const EvPortfolioDashboard = lazy(() => import('./Ev/EvPortfolioDashboard'));

export default function AccountyApp() {
  const { user } = useAuth();
  const { dateFrom, dateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'companies';

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (!tabParam) {
      const savedTab = localStorage.getItem('accounty-active-tab');
      if (savedTab && savedTab !== 'companies') {
        setSearchParams({ tab: savedTab }, { replace: true });
      }
    } else {
      localStorage.setItem('accounty-active-tab', tabParam);
    }
  }, [searchParams, setSearchParams]);

  const { toast } = useToast();
  const { data: supabaseClients, isLoading: clientsLoading, isError: clientsError, refetch: refetchClients } = useAccountyClients(dateFromFormatted, dateToFormatted);
  const { data: supabaseKpis } = useAccountyKpis(dateFromFormatted, dateToFormatted);
  const { data: monthlyTrendData } = useAccountyMonthlyTrend();
  const { data: colleagueStats } = useAccountyColleagueStats();
  const { data: auditLog } = useAccountyAuditLog(10);
  const { data: portalStats } = useAccountyPortalStats();
  const kanbanMutation = useUpdateKanbanStatus();
  const updateOwnerMutation = useUpdateClientOwner();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [ownerOverrides, setOwnerOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ClientData['status']>>({});
  const navigate = useNavigate();
  const { role, isAdmin } = useAccountyRole();

  // Keyboard shortcuts for power-user navigation
  useKeyboardShortcuts([
    { combo: { key: '1' }, handler: () => setViewMode('grid'), preventDefault: false, description: 'Rács nézet (1)' },
    { combo: { key: '2' }, handler: () => setViewMode('list'), preventDefault: false, description: 'Lista nézet (2)' },
    { combo: { key: '3' }, handler: () => setViewMode('kanban'), preventDefault: false, description: 'Kanban nézet (3)' },
  ]);

  // Widget order with localStorage persistence
  const DEFAULT_WIDGET_ORDER = ['kpi_cards', 'charts', 'monthly_trend', 'colleague_table', 'audit_log', 'automation_analytics'] as const;
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try { 
      const saved = localStorage.getItem('accounty-widget-order'); 
      let parsed = saved ? JSON.parse(saved) : [...DEFAULT_WIDGET_ORDER]; 
      if (Array.isArray(parsed) && !parsed.includes('automation_analytics')) {
        parsed.push('automation_analytics');
      }
      return parsed;
    } catch { return [...DEFAULT_WIDGET_ORDER]; }
  });
  const [editingLayout, setEditingLayout] = useState(false);
  useEffect(() => { localStorage.setItem('accounty-widget-order', JSON.stringify(widgetOrder)); }, [widgetOrder]);
  const moveWidget = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= widgetOrder.length) return;
    setWidgetOrder(prev => { const next = [...prev]; [next[idx], next[newIdx]] = [next[newIdx], next[idx]]; return next; });
  };

  // Map Supabase data → ClientData format for UI compatibility
  const clients: ClientData[] = useMemo(() => {
    if (!supabaseClients || supabaseClients.length === 0) return [];
    return supabaseClients.map((sc, idx): ClientData => ({
      id: sc.id,
      name: sc.name,
      taxNumber: sc.taxNumber || '',
      status: statusOverrides[sc.id] || sc.status,
      unprocessedCount: sc.unprocessedCount,
      missingCount: sc.missingCount,
      deadline: sc.deadlineDate
        ? new Date(sc.deadlineDate).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) + '.'
        : '–',
      deadlineDate: sc.deadlineDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      progress: sc.progress,
      colorHex: CLIENT_COLORS[idx % CLIENT_COLORS.length],
      assignedToMe: ownerOverrides[sc.id] 
        ? ownerOverrides[sc.id] === user?.id 
        : sc.assignedToMe,
      ownerId: ownerOverrides[sc.id] || sc.ownerId || '1',
      isMainAccountant: sc.isMainAccountant ?? false,
    }));
  }, [supabaseClients, ownerOverrides, statusOverrides, user?.id]);

  // KPIs from Supabase (fallback to 0)
  const kpis = useMemo(() => ({
    totalClients: supabaseKpis?.totalClients || 0,
    unprocessedInvoices: supabaseKpis?.unprocessedInvoices || 0,
    missingInvoices: supabaseKpis?.missingItems || 0,
    upcomingDeadlines: supabaseKpis?.upcomingDeadlines || 0,
  }), [supabaseKpis]);

  // Dynamic KPI stats for "Irodai KPI" view – computed from actual clients
  const dynamicKpiStats = useMemo(() => {
    const total = clients.length;
    const kritikus = clients.filter(c => c.status === 'Kritikus').length;
    const rendben = clients.filter(c => c.status === 'Rendben').length;
    const zarasiPct = total > 0 ? Math.round((rendben / total) * 100) : 0;
    return {
      zarasiSzazalek: zarasiPct,
      kritikusDb: kritikus,
      kiosztottLezart: `${total} / ${rendben}`,
    };
  }, [clients]);

  // Dynamic pie chart from actual client statuses
  const dynamicPieData = useMemo(() => {
    const rendben = clients.filter(c => c.status === 'Rendben').length;
    const feldolgozando = clients.filter(c => c.status === 'Feldolgozandó').length;
    const kritikus = clients.filter(c => c.status === 'Kritikus').length;
    return [
      { name: 'Rendben', value: rendben, color: 'hsl(173, 80%, 40%)' },
      { name: 'Feldolgozandó', value: feldolgozando, color: '#f59e0b' },
      { name: 'Kritikus', value: kritikus, color: '#ef4444' },
    ];
  }, [clients]);

  // Dynamic bar chart
  const dynamicBarData = useMemo(() => {
    const totalMissing = clients.reduce((sum, c) => sum + c.missingCount, 0);
    const totalUnprocessed = clients.reduce((sum, c) => sum + c.unprocessedCount, 0);
    return [
      { name: 'Hiányzó', value: totalMissing },
      { name: 'Feldolgozatlan', value: totalUnprocessed },
      { name: 'Rendben', value: clients.filter(c => c.status === 'Rendben').length },
    ];
  }, [clients]);

  const handleUpdateOwner = (clientId: string, ownerId: string) => {
    setOwnerOverrides(prev => ({ ...prev, [clientId]: ownerId }));
    const client = clients.find(c => c.id === clientId);
    const oldOwnerId = client?.ownerId || '1';
    updateOwnerMutation.mutate({
      companyId: clientId,
      newOwnerId: ownerId,
      oldOwnerId
    }, {
      onError: (err: Error) => {
        reportError({ type: 'db_query', component: 'AccountyApp', action: 'updateClientOwner', message: 'Hiba a könyvelő módosításakor', error: err });
        setOwnerOverrides(prev => {
          const next = { ...prev };
          delete next[clientId];
          return next;
        });
        toast({ title: 'Hiba', description: `Nem sikerült módosítani a könyvelőt: ${err.message || err}`, variant: 'destructive' });
      }
    });
  };

  const handleKanbanStatusChange = (clientId: string, newStatus: ClientData['status']) => {
    setStatusOverrides(prev => ({ ...prev, [clientId]: newStatus }));
    const sc = supabaseClients?.find(c => c.id === clientId);
    if (sc) {
      kanbanMutation.mutate({ assignmentId: sc.id, status: newStatus });
    }
  };

  const [viewScope, setViewScope] = useState<'all' | 'mine'>('all');
  const [showExecutiveAnalysis, setShowExecutiveAnalysis] = useState(false);

  // Inline invite code state
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned' | null>('idle');
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string; tax_number: string } | null>(null);
  const [isJoiningAsAccountant, setIsJoiningAsAccountant] = useState(false);
  const queryClientRef = useQueryClient();

  const scopedClients = useMemo(() => {
    return clients.filter(client => 
      viewScope === 'all' || client.isMainAccountant
    );
  }, [clients, viewScope]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scopedClients.filter(client => {
      const matchesSearch = !q || 
        client.name.toLowerCase().includes(q) || 
        client.taxNumber.includes(q);
      const matchesStatus = statusFilter === 'Minden' || client.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [scopedClients, searchQuery, statusFilter]);

  const mineCount = useMemo(() => clients.filter(c => c.isMainAccountant).length, [clients]);
  const allCount = clients.length;

  const { role: userRole } = useUserRole();
  const isSupportAdmin = userRole === 'support_admin';
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const showWizard = !clientsLoading
    && !wizardDismissed
    && !isSupportAdmin
    && localStorage.getItem('accounty-welcome-done') !== '1'
    && clients.length === 0;
  const [wizardActive, setWizardActive] = useState(false);
  useEffect(() => {
    if (showWizard && !wizardActive) setWizardActive(true);
  }, [showWizard]);

  if (clientsError) {
    return <AccountyErrorState message="Nem sikerült betölteni a portfólió adatait. Ellenőrizd az internetkapcsolatot." onRetry={() => refetchClients()} />;
  }

  if (clientsLoading) {
    return (
      <div className="w-full space-y-6 page-animate">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-lg p-5 border border-border h-32 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="w-9 h-9 bg-muted/60 rounded-lg" />
              </div>
              <div className="h-8 w-16 bg-muted rounded mt-8" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card rounded-lg border border-border overflow-hidden animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-1 w-full bg-muted" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted/60 rounded" />
                  </div>
                </div>
                <div className="h-1.5 w-full bg-muted/60 rounded-full" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 bg-muted/60 rounded" />
                  <div className="h-10 bg-muted/60 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const handleValidateCode = async () => {
    if (!inviteCode.trim()) return;
    setCodeStatus('validating');
    setLinkedCompany(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-partner-code', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.valid) {
        setCodeStatus('valid');
        setLinkedCompany(data.company);
      } else if (data?.error === 'token_expired') {
        setCodeStatus('expired');
      } else {
        setCodeStatus('invalid');
      }
    } catch (err) {
      reportError({ type: 'api_call', component: 'AccountyApp', action: 'error', message: 'Failed to validate partner code:', error: err });
      setCodeStatus('invalid');
    }
  };

  const handleJoinAsAccountant = async () => {
    if (!inviteCode.trim() || codeStatus !== 'valid') return;
    setIsJoiningAsAccountant(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-company-as-accountant', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.error === 'already_assigned') {
        setCodeStatus('already_assigned');
        return;
      }
      if (data?.error) {
        setCodeStatus('invalid');
        return;
      }
      queryClientRef.invalidateQueries({ queryKey: ['accounty-clients'] });
      queryClientRef.invalidateQueries({ queryKey: ['accounty-kpis'] });
      setInviteCode('');
      setCodeStatus(null);
    } catch (err) {
      reportError({ type: 'api_call', component: 'AccountyApp', action: 'error', message: 'Failed to join as accountant:', error: err });
      setCodeStatus('invalid');
    } finally {
      setIsJoiningAsAccountant(false);
    }
  };

  if (wizardActive && !wizardDismissed) {
    return (
      <AccountyWelcomeWizard
        onComplete={() => {
          localStorage.setItem('accounty-welcome-done', '1');
          setWizardDismissed(true);
          setWizardActive(false);
        }}
      />
    );
  }

  if (!clientsLoading && clients.length === 0) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-6">
        <Database className="w-12 h-12 text-muted-foreground/30" />
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-foreground">Nincs hozzárendelt ügyfél</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Rendeld hozzá magad az eaisybill cégeidhez, vagy add hozzá az ügyfeled meghívó kóddal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              const result = await seedAccountyAssignments();
              if (result && !('error' in result)) {
                window.location.reload();
              }
            }}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium text-sm transition-colors shadow-lg"
          >
            Hozzárendelés indítása (eaisybill cégek)
          </button>
          <button
            onClick={() => setShowInviteCode(!showInviteCode)}
            className={cn(
              "px-6 py-3 rounded-lg font-medium text-sm transition-all border shadow-soft",
              showInviteCode
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-card hover:bg-muted/20 text-foreground border-border"
            )}
          >
            Hozzáadás meghívó kóddal
          </button>
        </div>

        {showInviteCode && (
          <div className="w-full max-w-lg page-animate slide-in-from-top-4 duration-400">
            <div className="bg-card rounded-lg p-6 border border-border shadow-soft">
              <h2 className="text-xl font-bold text-foreground mb-1">Ügyfél hozzáadása meghívó kóddal</h2>
              <p className="text-sm text-muted-foreground mb-6">Írd be az ügyfeled eaisybill fiókjából generált meghívó kódot</p>
              
              <div className="bg-muted/20 dark:bg-muted/10 rounded-lg p-5 mb-6">
                <h3 className="font-semibold text-foreground mb-2">Így működik:</h3>
                <ol className="space-y-1.5 text-sm text-muted-foreground">
                  <li>1. Kérd meg az ügyfelet, hogy generáljon meghívó kódot az eaisybill Beállításokban</li>
                  <li>2. Írd be ide a kapott kódot és ellenőrizd</li>
                  <li>3. Ha érvényes, add hozzá az ügyfelet</li>
                </ol>
              </div>

              <div className="space-y-2 mb-6">
                <Label className="text-sm font-medium text-foreground">Meghívó kód</Label>
                <Input 
                  placeholder="pl. A1B2C3" 
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeStatus('idle'); setLinkedCompany(null); }}
                  className="bg-muted/10 border-border font-mono uppercase tracking-widest text-lg" 
                />
                {codeStatus === 'valid' && linkedCompany && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm mt-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 page-animate slide-in-from-top-2 duration-300">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Cég megtalálva: <strong>{linkedCompany.name}</strong> ({linkedCompany.tax_number})</span>
                  </div>
                )}
                {codeStatus === 'invalid' && (
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm mt-2 p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 page-animate duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Érvénytelen meghívó kód</span>
                  </div>
                )}
                {codeStatus === 'expired' && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 page-animate duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>A meghívó kód lejárt — kérj újat az ügyféltől!</span>
                  </div>
                )}
                {codeStatus === 'already_assigned' && (
                  <div className="flex items-center gap-2 text-primary text-sm mt-2 p-3 bg-muted/10 rounded-lg border border-border page-animate duration-200">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Ez a cég már hozzá van rendelve a fiókodhoz</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => { setShowInviteCode(false); setInviteCode(''); setCodeStatus('idle'); setLinkedCompany(null); }} className="border-border text-foreground">
                  Mégse
                </Button>
                {codeStatus === 'valid' ? (
                  <Button 
                    onClick={handleJoinAsAccountant} 
                    disabled={isJoiningAsAccountant}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                  >
                    {isJoiningAsAccountant ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hozzáadás...</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> Ügyfél hozzáadása</>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleValidateCode} 
                    disabled={!inviteCode.trim() || codeStatus === 'validating'}
                    className="px-6"
                  >
                    {codeStatus === 'validating' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ellenőrzés...</>
                    ) : (
                      'Kód ellenőrzése'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 page-animate">
      
      {/* Header section with Breadcrumb */}
      <PageHeader
        breadcrumbs={[
          { label: 'eaisyBooks', href: '/eaisybooks' },
          { label: 'Portfólió Menedzsment' }
        ]}
        title="Ügyfélportfólió & Irodai Áttekintés"
        description="Könyvelési ciklusok, hiányzó bizonylatok és irodai feladatok központi felügyelete"
        actions={
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
              {isAdmin ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  Irodavezető
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <UserCheck className="w-3.5 h-3.5 text-primary" />
                  {role === 'senior_könyvelő' ? 'Senior könyvelő' : role === 'asszisztens' ? 'Asszisztens' : 'Könyvelő'}
                </span>
              )}
            </div>
            <Link to="/eaisybooks/new-client">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 flex items-center gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Új ügyfél
              </Button>
            </Link>
          </div>
        }
      />

      {/* 1. Metric Pulse Bar (Kompakt 4 Kártya, interaktív szűrő funkcióval) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Zárási státusz kártya */}
        <div 
          onClick={() => setShowExecutiveAnalysis(prev => !prev)}
          className="group relative bg-card border border-border hover:border-amber-500/40 rounded-lg p-4 shadow-card hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-amber-400" />
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Zárási státusz (2026)</span>
            <Clock className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-foreground tracking-tight flex items-baseline gap-2">
              <span>{dynamicKpiStats.zarasiSzazalek}%</span>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                {dynamicKpiStats.zarasiSzazalek >= 100 ? 'Kész' : 'Folyamatban'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {dynamicKpiStats.kiosztottLezart} ügyfél lezárva
            </p>
          </div>
          <div className="text-[11px] font-medium text-primary flex items-center gap-1 group-hover:underline">
            <span>{showExecutiveAnalysis ? 'Elemzés elrejtése' : 'Vezetői elemzés megtekintése'}</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Kritikus ügyfelek kártya */}
        <div 
          onClick={() => {
            setStatusFilter(prev => prev === 'Kritikus' ? 'Minden' : 'Kritikus');
            if (activeTab !== 'companies') setSearchParams({ tab: 'companies' });
          }}
          className={cn(
            "group relative bg-card border rounded-lg p-4 shadow-card hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between",
            statusFilter === 'Kritikus' ? "border-red-500 ring-2 ring-red-500/20 bg-red-500/[0.02]" : "border-border hover:border-red-500/40"
          )}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-rose-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Kritikus ügyfelek</span>
            <AlertTriangle className="w-4 h-4 text-red-500 group-hover:animate-bounce" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 tracking-tight flex items-baseline gap-2">
              <span>{dynamicKpiStats.kritikusDb} db</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Azonnali beavatkozást igénylő
            </p>
          </div>
          <div className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1 group-hover:underline">
            <span>Kritikus cégek szűrése</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Kiosztott / Rendben kártya */}
        <div 
          onClick={() => {
            setStatusFilter(prev => prev === 'Rendben' ? 'Minden' : 'Rendben');
            if (activeTab !== 'companies') setSearchParams({ tab: 'companies' });
          }}
          className={cn(
            "group relative bg-card border rounded-lg p-4 shadow-card hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between",
            statusFilter === 'Rendben' ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/[0.02]" : "border-border hover:border-emerald-500/40"
          )}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Kiosztott / Rendben</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight flex items-baseline gap-2">
              <span>{clients.filter(c => c.status === 'Rendben').length} / {clients.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Aktív könyvelés rendben
            </p>
          </div>
          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 group-hover:underline">
            <span>Rendben lévő cégek</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>

        {/* Hiányzó számlák kártya */}
        <div 
          onClick={() => navigate('/eaisybooks/missing-invoices')}
          className="group relative bg-card border border-border hover:border-primary/40 rounded-lg p-4 shadow-card hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-teal-400" />
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Hiányzó számlák</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold text-foreground tracking-tight">
              <span>{kpis.missingInvoices} db</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Bizonylatpótlási teendő
            </p>
          </div>
          <div className="text-[11px] font-medium text-primary flex items-center gap-1 group-hover:underline">
            <span>Hiánypótlási lista megnyitása</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 2. Fused Unified Filter Bar (Egyetlen professzionális szűrősáv a 2 különálló tabsor helyett) */}
      <div className="bg-card border border-border rounded-lg p-2.5 sm:p-3 shadow-card flex flex-col lg:flex-row lg:items-center justify-between gap-3 sticky top-2 z-20 backdrop-blur-md bg-card/95">
        {/* Bal oldal: Felelős Scope és Kategóriák */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Felelős Scope Pill */}
          <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => setViewScope('all')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                viewScope === 'all'
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Összes ügyfél</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono text-muted-foreground">
                {allCount}
              </span>
            </button>
            <button
              onClick={() => setViewScope('mine')}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                viewScope === 'mine'
                  ? "bg-card text-foreground shadow-sm font-bold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <User className="w-3.5 h-3.5" />
              <span>Saját ügyfeleim</span>
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full font-mono text-muted-foreground">
                {mineCount}
              </span>
            </button>
          </div>

          <div className="hidden sm:block h-5 w-px bg-border/60 mx-0.5" />

          {/* Kategória / Szakmai Szűrő Chip-ek */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setSearchParams({ tab: 'companies' })}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap",
                activeTab === 'companies'
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border"
              )}
            >
              Minden cég
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'tao' })}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap",
                activeTab === 'tao'
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border"
              )}
            >
              TAO / KIVA
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'ev' })}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap",
                activeTab === 'ev'
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border"
              )}
            >
              EV & Egyéni
            </button>
            <button
              onClick={() => setSearchParams({ tab: 'payroll' })}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border whitespace-nowrap",
                activeTab === 'payroll'
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border"
              )}
            >
              Bérszámfejtés
            </button>
          </div>
        </div>

        {/* Jobb oldal: Keresés, Státusz, Nézetváltó, Vezetői Elemzés gomb */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {activeTab === 'companies' && (
            <>
              {/* Kereső */}
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cégnév vagy adószám..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 h-9 text-xs bg-background border-border focus-visible:ring-1 focus-visible:ring-primary"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Státusz szűrő */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-9 text-xs bg-background border-border gap-1 text-muted-foreground">
                  <Filter className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="Státusz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minden">Minden</SelectItem>
                  <SelectItem value="Rendben">Rendben</SelectItem>
                  <SelectItem value="Feldolgozandó">Feldolgozandó</SelectItem>
                  <SelectItem value="Kritikus">Kritikus</SelectItem>
                </SelectContent>
              </Select>

              {/* Nézetváltó */}
              <div className="flex items-center bg-muted/40 p-0.5 rounded-lg border border-border/60">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewMode('grid')}
                  title="Rács nézet (1)"
                  className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'grid' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Grid className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewMode('list')}
                  title="Lista nézet (2)"
                  className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'list' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <ListIcon className="w-3.5 h-3.5" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setViewMode('kanban')}
                  title="Kanban nézet (3)"
                  className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'kanban' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  <Kanban className="w-3.5 h-3.5" />
                </Button>
              </div>
            </>
          )}

          {/* Vezetői Elemzés Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExecutiveAnalysis(prev => !prev)}
            className={cn(
              "h-9 px-3 gap-1.5 text-xs font-semibold transition-all border",
              showExecutiveAnalysis
                ? "bg-primary/10 text-primary border-primary/40 shadow-sm"
                : "bg-background hover:bg-muted/40 text-foreground border-border"
            )}
          >
            <BarChart2 className={cn("w-3.5 h-3.5", showExecutiveAnalysis ? "text-primary" : "text-muted-foreground")} />
            <span>Vezetői Elemzés</span>
          </Button>
        </div>
      </div>

      {/* 3. Vezetői Elemzés Panel (Kinyitható / Becsukható) */}
      {showExecutiveAnalysis && (
        <div className="bg-card border border-primary/20 rounded-lg p-5 shadow-lg page-animate slide-in-from-top-3 duration-300 relative">
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Vezetői Statisztikák & Rendszerelemzés</h2>
                <p className="text-xs text-muted-foreground">Könyvelői kapacitás, havi trendek és automatizációs audit</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExecutiveAnalysis(false)}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <X className="w-4 h-4" />
              <span>Bezárás</span>
            </Button>
          </div>

          <DashboardKpiView
            clients={clients}
            dynamicKpiStats={dynamicKpiStats}
            portalStats={portalStats}
            editingLayout={editingLayout}
            setEditingLayout={setEditingLayout}
            widgetOrder={widgetOrder}
            moveWidget={moveWidget}
            dynamicBarData={dynamicBarData}
            dynamicPieData={dynamicPieData}
            monthlyTrendData={monthlyTrendData}
            colleagueStats={colleagueStats}
            auditLog={auditLog}
            isAdmin={isAdmin}
            dateFrom={dateFrom}
            dateTo={dateTo}
          />
        </div>
      )}

      {/* 4. Munkaterület a kiválasztott Tab alapján */}
      <Suspense fallback={
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground mt-2">Betöltés...</p>
        </div>
      }>
        {activeTab === 'companies' && (
          <div className="space-y-4">
            {/* Táblázat / Munkalap Fejléc Infó */}
            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <div className="flex items-center gap-2 font-medium">
                <span>Ügyfelek Munkalapja</span>
                <span>·</span>
                <span className="text-foreground font-semibold">
                  {filteredClients.length} cég megjelenítve ({allCount > 0 ? Math.round((filteredClients.length / allCount) * 100) : 0}%)
                </span>
              </div>
              {(searchQuery || statusFilter !== 'Minden' || viewScope !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('Minden');
                    setViewScope('all');
                  }}
                  className="text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <X className="w-3 h-3" />
                  <span>Szűrők visszaállítása</span>
                </button>
              )}
            </div>

            {viewMode === 'kanban' ? (
              <ClientKanbanView
                filteredClients={filteredClients}
                handleUpdateOwner={handleUpdateOwner}
                onStatusChange={handleKanbanStatusChange}
              />
            ) : viewMode === 'grid' ? (
              <ClientGridView
                filteredClients={filteredClients}
                handleUpdateOwner={handleUpdateOwner}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                setSearchQuery={setSearchQuery}
                setStatusFilter={setStatusFilter}
              />
            ) : (
              <ClientListView
                filteredClients={filteredClients}
                handleUpdateOwner={handleUpdateOwner}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
              />
            )}
          </div>
        )}

        {activeTab === 'payroll' && <PayrollPortfolioPage />}
        {activeTab === 'tao' && <TaoPortfolioPage />}
        {activeTab === 'ev' && <EvPortfolioDashboard />}
      </Suspense>
    </div>
  );
}
