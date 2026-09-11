import React, { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';
import { Button } from '@/components/ui/button';
import { fetchManagementData } from './api/managementApi';
import { OverviewData, CompanyDetail, UserDetail } from './api/types';
import { ManagementOverview } from './components/overview/ManagementOverview';
import { CompanyDetailView } from './components/company/CompanyDetailView';
import { UserDetailView } from './components/user/UserDetailView';
import { ControlCenter } from './components/ControlCenter';
import { SuperadminPanel } from './components/superadmin/SuperadminPanel';
import TicketsPage from '@/pages/TicketsPage';
import { ThinkAiIcon } from '@/components/tickets/ThinkAiBadge';
import {
  ArrowLeft, Sun, Moon, LogOut, BarChart3, ShieldCheck, Zap, TicketCheck
} from 'lucide-react';

export function ManagementDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const { previewFile, openPreview, closePreview } = useFilePreview();

  // Derive view state from URL
  const urlView = searchParams.get('view') as 'company' | 'user' | 'errors' | 'permissions' | 'files' | 'superadmin' | 'tickets' | 'worker' | 'users' | null;
  const urlId = searchParams.get('id');
  const view = (urlView === 'superadmin' && user?.email === 'superadmin@thinkai.hu')
    ? 'superadmin'
    : (urlView === 'company' || urlView === 'user' || urlView === 'errors' || urlView === 'permissions' || urlView === 'files' || urlView === 'superadmin' || urlView === 'tickets' || urlView === 'worker' || urlView === 'users')
      ? urlView
      : 'overview';
  const selectedCompanyId = view === 'company' ? urlId : null;
  const selectedUserId = view === 'user' ? urlId : null;

  // ── Queries (auto-refresh: overview 60s, details 30s) ─
  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ['management-overview'],
    queryFn: () => fetchManagementData('overview'),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: false,
  });

  const { data: companyDetail, isLoading: companyLoading } = useQuery<CompanyDetail>({
    queryKey: ['management-company', selectedCompanyId],
    queryFn: () => fetchManagementData('company-detail', { companyId: selectedCompanyId! }),
    enabled: !!user && !!selectedCompanyId && view === 'company',
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const { data: userDetail, isLoading: userLoading } = useQuery<UserDetail>({
    queryKey: ['management-user', selectedUserId],
    queryFn: () => fetchManagementData('user-detail', { userId: selectedUserId! }),
    enabled: !!user && !!selectedUserId && view === 'user',
    staleTime: 15_000,
    retry: false,
  });

  // ── Company cost lookup (for expandable user rows) ──
  const companyCostMap = useMemo(() => {
    const m = new Map<string, { monthlyCostUsd: number; invoiceCount: number; navInvoiceCount: number; transactionCount: number; payrollCount: number }>();
    for (const c of overview?.companies || []) {
      m.set(c.id, {
        monthlyCostUsd: c.monthlyCostUsd,
        invoiceCount: c.invoiceCount,
        navInvoiceCount: c.navInvoiceCount,
        transactionCount: c.transactionCount,
        payrollCount: c.payrollCount,
      });
    }
    return m;
  }, [overview?.companies]);

  const selectedCompanyName = overview?.companies.find(c => c.id === selectedCompanyId)?.name;
  const selectedUserObj = overview?.users.find(u => u.user_id === selectedUserId);

  // ── Navigation (stable refs) ────────────────────
  const openOverview = useCallback(() => { setSearchParams({}); }, [setSearchParams]);
  const openCompany = useCallback((id: string) => { setSearchParams({ view: 'company', id }); }, [setSearchParams]);
  const openUser = useCallback((userId: string) => { setSearchParams({ view: 'user', id: userId }); }, [setSearchParams]);
  const openErrors = useCallback(() => { setSearchParams({ view: 'errors' }); }, [setSearchParams]);
  const openSuperadmin = useCallback(() => { setSearchParams({ view: 'superadmin' }); }, [setSearchParams]);
  const openTickets = useCallback(() => { setSearchParams({ view: 'tickets' }); }, [setSearchParams]);
  const openWorker = useCallback(() => { setSearchParams({ view: 'worker' }); }, [setSearchParams]);
  const goBack = useCallback(() => {
    if (view === 'company' || view === 'user') {
      setSearchParams({ view: 'users' });
    } else {
      setSearchParams({});
    }
  }, [view, setSearchParams]);

  // Auth guard — MUST be after all hooks to satisfy Rules of Hooks
  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // ── Title / subtitle derivation ─────────────────────
  const isControlCenter = view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users';
  const title = view === 'overview'
    ? 'Management Dashboard'
    : isControlCenter
      ? 'Control Center'
      : view === 'superadmin'
        ? 'Control Center'
        : view === 'tickets'
          ? 'Hibajegykezelés'
          : view === 'company'
            ? (selectedCompanyName || 'Cég részletek')
            : (selectedUserObj?.name || 'Felhasználó részletek');

  const subtitle = view === 'overview'
    ? 'eaisybill platform áttekintés'
    : (view === 'errors' || view === 'permissions' || view === 'superadmin' || view === 'files' || view === 'worker' || view === 'users')
      ? 'Hibák, jogosultságok és adatnézet'
      : view === 'tickets'
        ? 'Beérkezett ügyfél hibajegyek és support csevegés'
        : view === 'company'
          ? 'Cég részletes adatai'
          : (selectedUserObj?.email || '');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* ── Header (single consolidated bar: sticky, backdrop-blur, border-b) ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-1.5 relative gap-4">
          {/* Left: Brand or Detail view breadcrumb */}
          <div className="flex items-center gap-3 shrink-0">
            {(view === 'company' || view === 'user') ? (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={goBack} aria-label="Vissza"
                  className="text-muted-foreground hover:text-foreground h-7 w-7 transition-colors duration-150">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <ThinkAiIcon className="h-4.5 w-4.5" />
                <div className="min-w-0 max-w-[180px] sm:max-w-[260px]">
                  <h1 className="text-xs sm:text-sm font-bold tracking-tight truncate leading-tight">{title}</h1>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate leading-tight">{subtitle}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <ThinkAiIcon className="h-5 w-5" />
                <div className="flex items-center gap-1.5">
                  <span className="font-bold tracking-tight text-sm sm:text-base text-foreground">eaisyBill</span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Management
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Center: Főnavigáció tab bar */}
          {(view === 'overview' || view === 'errors' || view === 'permissions' || view === 'files' || view === 'superadmin' || view === 'tickets' || view === 'worker' || view === 'users' || view === 'company' || view === 'user') && (
            <nav className="flex items-center gap-0.5 bg-muted/40 p-0.5 rounded-lg border border-border/40 overflow-x-auto" aria-label="Főnavigáció">
              <button
                onClick={openOverview}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                  view === 'overview'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
                }`}
                aria-current={view === 'overview' ? 'page' : undefined}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Áttekintés
              </button>
              <button
                onClick={openErrors}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                  view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users' || view === 'company' || view === 'user'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
                }`}
                aria-current={view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users' || view === 'company' || view === 'user' ? 'page' : undefined}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Control Center
              </button>
              <button
                onClick={openSuperadmin}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                  view === 'superadmin'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
                }`}
                aria-current={view === 'superadmin' ? 'page' : undefined}
              >
                <Zap className="h-3.5 w-3.5" />
                Superadmin
              </button>
              <button
                onClick={openTickets}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap border ${
                  view === 'tickets'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
                }`}
                aria-current={view === 'tickets' ? 'page' : undefined}
              >
                <TicketCheck className="h-3.5 w-3.5" />
                Hibajegyek
              </button>
            </nav>
          )}

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" aria-label="Téma váltás"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150 h-8 w-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark'
                ? <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} aria-label="Kijelentkezés"
              className="text-muted-foreground hover:text-destructive gap-1.5 transition-colors duration-150 h-8 text-xs px-2.5">
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> <span className="hidden sm:inline">Kijelentkezés</span>
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ SUPERADMIN — full-height ═══ */}
      {view === 'superadmin' && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 animate-in fade-in duration-300">
          <SuperadminPanel overview={overview} />
        </div>
      )}

      {/* ═══ TICKETS ═══ */}
      {view === 'tickets' && (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          <main className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 py-6">
            <TicketsPage embeddedInManagement={true} managementUsers={overview?.users || []} />
          </main>
        </div>
      )}

      {/* ═══ Normal scrollable content ═══ */}
      {view !== 'superadmin' && view !== 'tickets' && (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
          <main className={`w-full max-w-7xl mx-auto px-6 ${isControlCenter ? 'pt-2.5 pb-8' : 'pt-3.5 pb-8'}`}>
            {/* ═══ OVERVIEW ═══ */}
            {view === 'overview' && (
              <ManagementOverview
                overview={overview}
                overviewLoading={overviewLoading}
                onOpenCompany={openCompany}
                onOpenWorker={openWorker}
                onOpenTickets={openTickets}
                onOpenErrors={openErrors}
                onOpenFilePreview={openPreview}
              />
            )}

            {/* ═══ COMPANY DETAIL ═══ */}
            {view === 'company' && (
              <CompanyDetailView
                companyId={selectedCompanyId || ''}
                companyDetail={companyDetail}
                companyLoading={companyLoading}
              />
            )}

            {/* ═══ USER DETAIL ═══ */}
            {view === 'user' && (
              <UserDetailView
                userDetail={userDetail}
                userLoading={userLoading}
                overview={overview}
                onOpenCompany={openCompany}
              />
            )}

            {/* ═══ CONTROL CENTER ═══ */}
            {(view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users') && (
              <ControlCenter
                initialTab={view as any}
                onOpenCompany={openCompany}
                allUsers={overview?.users || []}
                overviewLoading={overviewLoading}
                companyCostMap={companyCostMap}
              />
            )}
          </main>
        </div>
      )}

      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </div>
  );
}

export default ManagementDashboard;
