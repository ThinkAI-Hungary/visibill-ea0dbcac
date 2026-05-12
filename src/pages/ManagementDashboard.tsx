import { useState, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, Building2, FileText, Clock,
  ChevronRight, ChevronLeft, Search, LogOut, ArrowLeft, Shield,
  Bot, Coins, ArrowUpDown, ArrowUp, ArrowDown,
  Trophy, Zap, Calendar, X, Crown, Sun, Moon
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────
interface OverviewData {
  usersCount: number;
  companiesCount: number;
  companies: Array<{
    id: string; name: string; tax_number: string | null; created_at: string;
    members: Array<{ name: string; role: string }>;
    monthlyCostUsd: number;
    invoiceCount: number;
    transactionCount: number;
    payrollCount: number;
  }>;
  users: Array<{ id: string; user_id: string; name: string; email: string; created_at: string; companies: Array<{ name: string; role: string }> }>;
  llmOverview: {
    totalMonthlyCostUsd: number;
    totalMonthlyInputTokens: number;
    totalMonthlyOutputTokens: number;
    mostExpensiveCompany: {
      id: string; name: string; totalCostUsd: number; monthlyCostUsd: number;
    } | null;
  };
}

interface CompanyDetail {
  invoiceCount: number;
  submittedInvoiceCount: number;
  navInvoiceCount: number;
  members: Array<{
    user_id: string; name: string; email: string; role: string; joined_at: string;
  }>;
  lastActivity: {
    action: string; entity: string; entity_name: string; user_name: string; created_at: string;
  } | null;
  llmCosts: {
    totalCostUsd: number; totalTokens: number; callCount: number;
    totalRows: number;
    details: Array<{
      input_tokens: number; output_tokens: number; total_tokens: number;
      estimated_cost_usd: number; model_name: string; created_at: string;
      user_name?: string; file_name?: string | null;
    }>;
  };
}

interface UserDetail {
  companyCount: number;
  companies: Array<{ id: string; name: string; role: string }>;
}

// ─── API helpers ──────────────────────────────────────
async function fetchManagementData(action: string, params?: Record<string, string>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const url = new URL(`${(supabase as any).supabaseUrl}/functions/v1/management-stats`);
  url.searchParams.set('action', action);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: (supabase as any).supabaseKey,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Role badge (semantic color tokens) ───────────────
function roleBadge(role: string) {
  const map: Record<string, string> = {
    CEO: 'bg-amber-400/20 text-amber-900 dark:text-amber-300 border-amber-400/30',
    ADMIN: 'bg-info/15 text-info border-info/25',
  };
  const cls = map[role] || 'bg-muted text-muted-foreground border-border';
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge className={cls}>{role}</Badge>
      {role === 'CEO' && <Crown className="h-4 w-4 text-amber-400" />}
    </span>
  );
}

// ─── Skeleton shimmer ─────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted/60 animate-shimmer ${className}`}
      role="status"
      aria-label="Betöltés…"
    />
  );
}

// ─── Stat Card (8dp spacing, semantic tokens, shimmer) ─
function StatCard({ icon: Icon, label, value, sub, loading }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition-colors duration-200">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── List row (44px min touch target, hover highlight) ─
function ListRow({ primary, secondary, onClick, ariaLabel }: {
  primary: string; secondary: string; onClick: () => void; ariaLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="w-full flex items-center justify-between px-5 py-3 min-h-[44px]
                 hover:bg-accent/50 active:bg-accent/70
                 transition-colors duration-150 ease-out group text-left"
    >
      <div className="min-w-0 mr-3">
        <p className="text-sm font-medium text-foreground truncate">{primary}</p>
        <p className="text-[11px] text-muted-foreground truncate">{secondary}</p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground/40
                   group-hover:text-primary group-hover:translate-x-0.5
                   transition-all duration-150"
        aria-hidden="true"
      />
    </button>
  );
}

// ─── Skeleton list ────────────────────────────────────
function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between px-5 py-3">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-4 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Section header with search ───────────────────────
function SectionHeader({ icon: Icon, title, searchValue, onSearch, placeholder }: {
  icon: React.ElementType; title: string;
  searchValue: string; onSearch: (v: string) => void; placeholder: string;
}) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between gap-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2 shrink-0">
          <Icon className="h-4 w-4 text-primary" aria-hidden="true" /> {title}
        </CardTitle>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder={placeholder}
            value={searchValue}
            onChange={e => onSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
            aria-label={placeholder}
          />
        </div>
      </div>
    </CardHeader>
  );
}

// ═══════════════════════════════════════════════════════
// ─── LLM Cost Table (search, sort, pagination, date) ─
// ═══════════════════════════════════════════════════════
type LlmSortCol = 'created_at' | 'input_tokens' | 'output_tokens' | 'estimated_cost_usd';

interface LlmPageResult {
  llmCosts: {
    totalRows: number;
    details: Array<{
      input_tokens: number; output_tokens: number; total_tokens: number;
      estimated_cost_usd: number; model_name: string; created_at: string;
      user_name?: string; file_name?: string | null;
    }>;
  };
}

function LlmCostTable({ companyId }: { companyId: string }) {
  const PAGE_SIZE = 20;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortCol, setSortCol] = useState<LlmSortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Debounce search to avoid too many requests
  const searchTimerRef = useCallback((val: string) => {
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);

  // Update debounced search on search change
  useMemo(() => searchTimerRef(search), [search, searchTimerRef]);

  const toggleSort = useCallback((col: LlmSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(0);
  }, [sortCol]);

  // Server-side query
  const { data, isLoading } = useQuery<LlmPageResult>({
    queryKey: ['llm-costs', companyId, page, PAGE_SIZE, sortCol, sortDir, debouncedSearch, dateFrom, dateTo],
    queryFn: () => fetchManagementData('company-detail', {
      companyId,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy: sortCol,
      sortDir,
      search: debouncedSearch,
      dateFrom,
      dateTo,
    }),
    staleTime: 15_000,
    keepPreviousData: true,
  });

  const rows = data?.llmCosts?.details || [];
  const totalRows = data?.llmCosts?.totalRows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  function SortTh({ col, label, align = 'right' }: { col: LlmSortCol; label: string; align?: 'left' | 'right' }) {
    const active = sortCol === col;
    return (
      <th
        className={`py-2 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150 text-${align}`}
        onClick={() => toggleSort(col)}
        aria-sort={active ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
      >
        <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
          {label}
          {active
            ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" aria-hidden="true" /> LLM költségek részletezése
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isLoading ? '...' : `${totalRows} rekord`}
          </span>
        </CardTitle>
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input placeholder="Keresés név, fájl, modell..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-xs" aria-label="Keresés" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">Tól:</span>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="h-8 text-xs w-[140px] pr-1" aria-label="Dátum-tól" />
            <span className="text-xs text-muted-foreground">Ig:</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="h-8 text-xs w-[140px] pr-1" aria-label="Dátum-ig" />
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(0); }}
              disabled={!dateFrom && !dateTo}
              className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors duration-150 ${dateFrom || dateTo ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer' : 'text-muted-foreground/30 cursor-default'}`}
              aria-label="Dátumszűrő törlése"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table">
            <thead>
              <tr className="text-muted-foreground border-b border-border">
                <SortTh col="created_at" label="Dátum" align="left" />
                <th className="text-left py-2 px-4 font-medium">Név</th>
                <th className="text-left py-2 px-4 font-medium">Fájl</th>
                <th className="text-left py-2 px-4 font-medium">Model</th>
                <SortTh col="input_tokens" label="Input" />
                <SortTh col="output_tokens" label="Output" />
                <SortTh col="estimated_cost_usd" label="Költség" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((d, i) => (
                <tr key={`${d.created_at}-${i}`} className="text-foreground/80 hover:bg-accent/30 transition-colors duration-150">
                  <td className="py-2 px-4 tabular-nums">{new Date(d.created_at).toLocaleDateString('hu-HU')}</td>
                  <td className="py-2 px-4 text-foreground/70 truncate max-w-[120px]">{d.user_name || '—'}</td>
                  <td className="py-2 px-4 text-foreground/70 truncate max-w-[160px]" title={d.file_name || ''}>{d.file_name || '—'}</td>
                  <td className="py-2 px-4"><Badge variant="outline" className="text-[10px]">{d.model_name}</Badge></td>
                  <td className="text-right py-2 px-4 tabular-nums">{d.input_tokens.toLocaleString()}</td>
                  <td className="text-right py-2 px-4 tabular-nums">{d.output_tokens.toLocaleString()}</td>
                  <td className="text-right py-2 px-4 tabular-nums font-medium">${Number(d.estimated_cost_usd).toFixed(4)}</td>
                </tr>
              ))}
              {rows.length < PAGE_SIZE && Array.from({ length: PAGE_SIZE - rows.length }).map((_, i) => (
                <tr key={`empty-${i}`} className="pointer-events-none">
                  <td className="py-2 px-4">&nbsp;</td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                  <td className="py-2 px-4"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground tabular-nums">
              {totalRows === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalRows)} / ${totalRows}`}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0}
                onClick={() => setPage(p => p - 1)} aria-label="Előző oldal">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">{page + 1}/{totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)} aria-label="Következő oldal">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Main Component ──────────────────────────────────
// ═══════════════════════════════════════════════════════
export default function ManagementDashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  // Derive view state from URL
  const urlView = searchParams.get('view') as 'company' | 'user' | null;
  const urlId = searchParams.get('id');
  const view: 'overview' | 'company' | 'user' = (urlView === 'company' || urlView === 'user') ? urlView : 'overview';
  const selectedCompanyId = view === 'company' ? urlId : null;
  const selectedUserId = view === 'user' ? urlId : null;

  const [searchCompany, setSearchCompany] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [sortColumn, setSortColumn] = useState<'name' | 'monthlyCostUsd' | 'invoiceCount' | 'transactionCount' | 'payrollCount' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // ── Queries (auto-refresh: overview 60s, details 30s) ─
  const { data: overview, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ['management-overview'],
    queryFn: () => fetchManagementData('overview'),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: companyDetail, isLoading: companyLoading } = useQuery<CompanyDetail>({
    queryKey: ['management-company', selectedCompanyId],
    queryFn: () => fetchManagementData('company-detail', { companyId: selectedCompanyId! }),
    enabled: !!selectedCompanyId && view === 'company',
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: userDetail, isLoading: userLoading } = useQuery<UserDetail>({
    queryKey: ['management-user', selectedUserId],
    queryFn: () => fetchManagementData('user-detail', { userId: selectedUserId! }),
    enabled: !!selectedUserId && view === 'user',
    staleTime: 15_000,
  });

  // ── Filtered + sorted companies (memoised) ─────────
  const filteredCompanies = useMemo(() => {
    if (!overview?.companies) return [];
    let list = overview.companies;
    if (searchCompany.trim()) {
      const q = searchCompany.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) || (c.tax_number || '').includes(q)
      );
    }
    if (sortColumn) {
      list = [...list].sort((a, b) => {
        let cmp = 0;
        if (sortColumn === 'name') {
          cmp = a.name.localeCompare(b.name, 'hu');
        } else if (sortColumn === 'monthlyCostUsd') {
          cmp = a.monthlyCostUsd - b.monthlyCostUsd;
        } else if (sortColumn === 'invoiceCount') {
          cmp = a.invoiceCount - b.invoiceCount;
        } else if (sortColumn === 'transactionCount') {
          cmp = a.transactionCount - b.transactionCount;
        } else if (sortColumn === 'payrollCount') {
          cmp = a.payrollCount - b.payrollCount;
        }
        return sortDir === 'desc' ? -cmp : cmp;
      });
    }
    return list;
  }, [overview?.companies, searchCompany, sortColumn, sortDir]);

  const filteredUsers = useMemo(() => {
    if (!overview?.users) return [];
    if (!searchUser.trim()) return overview.users;
    const q = searchUser.toLowerCase();
    return overview.users.filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [overview?.users, searchUser]);

  const selectedCompanyName = overview?.companies.find(c => c.id === selectedCompanyId)?.name;
  const selectedUserObj = overview?.users.find(u => u.user_id === selectedUserId);

  // ── Navigation (stable refs) ────────────────────
  const openCompany = useCallback((id: string) => { setSearchParams({ view: 'company', id }); }, [setSearchParams]);
  const openUser = useCallback((userId: string) => { setSearchParams({ view: 'user', id: userId }); }, [setSearchParams]);
  const goBack = useCallback(() => { setSearchParams({}); }, [setSearchParams]);

  // Auth guard — MUST be after all hooks to satisfy Rules of Hooks
  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // ── Title / subtitle derivation ─────────────────────
  const title = view === 'overview'
    ? 'Management Dashboard'
    : view === 'company'
      ? (selectedCompanyName || 'Cég részletek')
      : (selectedUserObj?.name || 'Felhasználó részletek');

  const subtitle = view === 'overview'
    ? 'Visibill platform áttekintés'
    : view === 'company'
      ? 'Cég részletes adatai'
      : (selectedUserObj?.email || '');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* ── Header (sticky, backdrop-blur, border-b) ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {view !== 'overview' && (
              <Button variant="ghost" size="icon" onClick={goBack} aria-label="Vissza"
                className="text-muted-foreground hover:text-foreground mr-1 transition-colors duration-150">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <Shield className="h-7 w-7 text-primary shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight truncate">{title}</h1>
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" aria-label="Téma váltás"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark'
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} aria-label="Kijelentkezés"
              className="text-muted-foreground hover:text-destructive gap-2 transition-colors duration-150">
              <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Kijelentkezés</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* ═══ OVERVIEW ═══ */}
        {view === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Felhasználók"
                value={overview?.usersCount ?? 0} loading={overviewLoading} />
              <StatCard icon={Building2} label="Regisztrált cégek"
                value={overview?.companiesCount ?? 0} loading={overviewLoading} />
              <StatCard icon={Coins} label="Havi összköltség"
                value={overview ? `$${overview.llmOverview.totalMonthlyCostUsd.toFixed(4)}` : '$0'}
                loading={overviewLoading}
                sub={overview ? `In: ${(overview.llmOverview.totalMonthlyInputTokens / 1000).toFixed(1)}k · Out: ${(overview.llmOverview.totalMonthlyOutputTokens / 1000).toFixed(1)}k token` : undefined} />
              {overviewLoading ? (
                <StatCard icon={Trophy} label="Legdrágább cég" value="..." loading />
              ) : overview?.llmOverview.mostExpensiveCompany ? (
                <Card
                  className="cursor-pointer hover:bg-accent/30 transition-colors duration-150"
                  onClick={() => openCompany(overview.llmOverview.mostExpensiveCompany!.id)}
                  role="button" tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter') openCompany(overview.llmOverview.mostExpensiveCompany!.id); }}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-warning/10 border border-warning/20 shrink-0">
                      <Trophy className="h-6 w-6 text-warning" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{overview.llmOverview.mostExpensiveCompany.name}</p>
                      <p className="text-xs text-muted-foreground">Legdrágább cég</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 tabular-nums">
                        Össz: ${overview.llmOverview.mostExpensiveCompany.totalCostUsd.toFixed(4)} · Havi: ${overview.llmOverview.mostExpensiveCompany.monthlyCostUsd.toFixed(4)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <StatCard icon={Trophy} label="Legdrágább cég" value="—" sub="Nincs LLM költség" />
              )}
            </div>

            <Card>
              <Tabs defaultValue="companies">
                <div className="flex items-center justify-between border-b border-border px-5 pt-3 pb-0">
                  <TabsList className="bg-transparent p-0 h-auto gap-0">
                    <TabsTrigger value="companies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors duration-150">
                      <Building2 className="h-4 w-4 mr-2" />Cégek
                    </TabsTrigger>
                    <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground transition-colors duration-150">
                      <Users className="h-4 w-4 mr-2" />Felhasználók
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ── Cégek tab ── */}
                <TabsContent value="companies" className="mt-0">
                  <div className="flex items-center gap-4 px-5 py-2 border-b border-border bg-muted/30 text-[11px] text-muted-foreground">
                    <span className="font-medium uppercase tracking-wider">Jelmagyarázat:</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-400/50" />CEO
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 border border-blue-400/50" />Admin
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 border border-gray-400/50" />Employee
                    </span>
                    <div className="ml-auto">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={searchCompany}
                          onChange={e => setSearchCompany(e.target.value)}
                          placeholder="Keresés név vagy adószám..."
                          className="pl-8 h-7 text-xs w-52 bg-background"
                        />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs">
                        <th
                          className="text-left py-3 px-5 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150"
                          onClick={() => { if (sortColumn === 'name') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortColumn('name'); setSortDir('asc'); } }}
                          aria-sort={sortColumn === 'name' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                          <span className="inline-flex items-center gap-1">
                            Cég
                            {sortColumn === 'name'
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        </th>
                        <th className="text-left py-3 px-4 font-medium">Adószám</th>
                        <th className="text-left py-3 px-4 font-medium">Tagok</th>
                        <th
                          className="text-center py-3 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150"
                          onClick={() => { if (sortColumn === 'invoiceCount') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortColumn('invoiceCount'); setSortDir('desc'); } }}
                          aria-sort={sortColumn === 'invoiceCount' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            Számla
                            {sortColumn === 'invoiceCount'
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        </th>
                        <th
                          className="text-center py-3 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150"
                          onClick={() => { if (sortColumn === 'transactionCount') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortColumn('transactionCount'); setSortDir('desc'); } }}
                          aria-sort={sortColumn === 'transactionCount' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            Tranzakciók
                            {sortColumn === 'transactionCount'
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        </th>
                        <th
                          className="text-center py-3 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150"
                          onClick={() => { if (sortColumn === 'payrollCount') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortColumn('payrollCount'); setSortDir('desc'); } }}
                          aria-sort={sortColumn === 'payrollCount' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                          <span className="inline-flex items-center justify-center gap-1">
                            Bér/járulék
                            {sortColumn === 'payrollCount'
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        </th>
                        <th
                          className="text-right py-3 px-5 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150"
                          onClick={() => { if (sortColumn === 'monthlyCostUsd') { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); } else { setSortColumn('monthlyCostUsd'); setSortDir('desc'); } }}
                          aria-sort={sortColumn === 'monthlyCostUsd' ? sortDir === 'asc' ? 'ascending' : 'descending' : 'none'}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            Havi költség
                            {sortColumn === 'monthlyCostUsd'
                              ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                              : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {overviewLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="py-3 px-5"><Skeleton className="h-4 w-32" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-4 w-28" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-4 w-48" /></td>
                            <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                            <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                            <td className="py-3 px-4 text-center"><Skeleton className="h-4 w-10 mx-auto" /></td>
                            <td className="py-3 px-5 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredCompanies.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nincs találat</td>
                        </tr>
                      ) : filteredCompanies.map(c => (
                        <tr
                          key={c.id}
                          onClick={() => openCompany(c.id)}
                          className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                     transition-colors duration-150 group"
                          role="button"
                          tabIndex={0}
                          aria-label={`${c.name} megnyitása`}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCompany(c.id); } }}
                        >
                          <td className="py-3 px-5">
                            <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                              {c.name}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground tabular-nums text-xs">
                            {c.tax_number || '—'}
                          </td>
                          <td className="py-3 px-4">
                            {c.members.length > 0 ? (() => {
                              const MAX_VISIBLE = 4;
                              const visible = c.members.slice(0, MAX_VISIBLE);
                              const overflow = c.members.length - MAX_VISIBLE;
                              const roleColors: Record<string, string> = {
                                CEO: 'bg-amber-400/20 text-amber-900 dark:text-amber-300 border-amber-400/30',
                                ADMIN: 'bg-info/15 text-info border-info/25',
                              };
                              return (
                                <div className="flex flex-wrap gap-1.5">
                                  {visible.map((m, i) => {
                                    const cls = roleColors[m.role] || 'bg-muted text-muted-foreground border-border';
                                    return (
                                      <span key={i} className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${cls}`}
                                        title={`${m.name} — ${m.role}`}>
                                        {m.name}
                                      </span>
                                    );
                                  })}
                                  {overflow > 0 && (
                                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground"
                                      title={c.members.slice(MAX_VISIBLE).map(m => m.name).join(', ')}>
                                      +{overflow}
                                    </span>
                                  )}
                                </div>
                              );
                            })() : (
                              <span className="text-muted-foreground italic text-xs">Nincs tag</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                            {c.invoiceCount}
                          </td>
                          <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                            {c.transactionCount}
                          </td>
                          <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                            {c.payrollCount}
                          </td>
                          <td className="py-3 px-5 text-right tabular-nums font-medium text-foreground">
                            ${c.monthlyCostUsd.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  </CardContent>
                </TabsContent>

                {/* ── Felhasználók tab ── */}
                <TabsContent value="users" className="mt-0">
                  <div className="flex items-center gap-4 px-5 py-2 border-b border-border bg-muted/30 text-[11px] text-muted-foreground">
                    <span className="font-medium uppercase tracking-wider">Jelmagyarázat:</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-400/50" />CEO
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400 border border-blue-400/50" />Admin
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400 border border-gray-400/50" />Employee
                    </span>
                    <div className="ml-auto">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          value={searchUser}
                          onChange={e => setSearchUser(e.target.value)}
                          placeholder="Keresés név vagy email..."
                          className="pl-8 h-7 text-xs w-52 bg-background"
                        />
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                            <th className="text-left py-3 px-5 font-medium">Név</th>
                            <th className="text-left py-3 px-4 font-medium">Cég</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {overviewLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <tr key={i}>
                                <td className="py-3 px-5"><Skeleton className="h-4 w-32" /></td>
                                <td className="py-3 px-4"><Skeleton className="h-4 w-48" /></td>
                              </tr>
                            ))
                          ) : filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={2} className="text-center py-8 text-muted-foreground text-sm">Nincs találat</td>
                            </tr>
                          ) : filteredUsers.map(u => {
                            const roleColors: Record<string, string> = {
                              CEO: 'bg-amber-400/20 text-amber-900 dark:text-amber-300 border-amber-400/30',
                              ADMIN: 'bg-info/15 text-info border-info/25',
                            };
                            return (
                              <tr
                                key={u.user_id}
                                onClick={() => openUser(u.user_id)}
                                className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                           transition-colors duration-150 group"
                                role="button"
                                tabIndex={0}
                                aria-label={`${u.name || u.email} megnyitása`}
                                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openUser(u.user_id); } }}
                              >
                                <td className="py-3 px-5">
                                  <div>
                                    <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                                      {u.name || 'N/A'}
                                    </span>
                                    <p className="text-xs text-muted-foreground">{u.email}</p>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  {u.companies.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5">
                                      {u.companies.map((c, i) => {
                                        const cls = roleColors[c.role] || 'bg-muted text-black border-border';
                                        return (
                                          <span key={i} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${cls}`}
                                            title={`${c.name} — ${c.role}`}>
                                            {c.name}
                                            {c.role === 'CEO' && <span className="text-amber-500">👑</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground italic text-xs">Nincs cég</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        )}

        {/* ═══ COMPANY DETAIL ═══ */}
        {view === 'company' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={FileText} label="Számlák összesen"
                value={companyDetail?.invoiceCount ?? 0} loading={companyLoading}
                sub={companyDetail ? `${companyDetail.submittedInvoiceCount} feltöltött · ${companyDetail.navInvoiceCount} NAV` : undefined} />
              <StatCard icon={Users} label="Tagok"
                value={companyDetail?.members.length ?? 0} loading={companyLoading} />
              <StatCard icon={Coins} label="LLM költség (USD)"
                value={companyDetail ? `$${companyDetail.llmCosts.totalCostUsd.toFixed(4)}` : '$0'}
                loading={companyLoading}
                sub={companyDetail ? `${companyDetail.llmCosts.callCount} hívás · ${(companyDetail.llmCosts.totalTokens / 1000).toFixed(1)}k token` : undefined} />
              <StatCard icon={Clock} label="Utolsó aktivitás"
                loading={companyLoading}
                value={companyDetail?.lastActivity ? new Date(companyDetail.lastActivity.created_at).toLocaleDateString('hu-HU') : '—'}
                sub={companyDetail?.lastActivity ? `${companyDetail.lastActivity.user_name} · ${companyDetail.lastActivity.action}` : 'Nincs aktivitás'} />
            </div>

            {/* Last activity */}
            {!companyLoading && companyDetail?.lastActivity && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> Utolsó művelet részletei
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                    {[
                      { label: 'Művelet', value: companyDetail.lastActivity.action, bold: true },
                      { label: 'Fájl', value: companyDetail.lastActivity.entity_name || companyDetail.lastActivity.entity },
                      { label: 'Felhasználó', value: companyDetail.lastActivity.user_name },
                      { label: 'Időpont', value: new Date(companyDetail.lastActivity.created_at).toLocaleString('hu-HU') },
                    ].map(item => (
                      <div key={item.label}>
                        <p className="text-muted-foreground text-xs mb-1">{item.label}</p>
                        <p className={`text-foreground ${item.bold ? 'font-medium' : ''}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {companyLoading ? (
              <Card><CardContent className="p-6"><SkeletonList rows={3} /></CardContent></Card>
            ) : companyDetail && (
              <>
                {/* Members */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Hozzárendelt felhasználók
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {companyDetail.members.length === 0 ? (
                      <p className="text-muted-foreground text-sm py-8 text-center">Nincs tag</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" role="table">
                          <thead>
                            <tr className="border-b border-border text-muted-foreground text-xs">
                              <th className="text-left py-3 px-5 font-medium">Név</th>
                              <th className="text-left py-3 px-4 font-medium">Rang</th>
                              <th className="text-right py-3 px-5 font-medium">Csatlakozás dátuma</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {companyDetail.members.map(m => (
                              <tr key={m.user_id} className="hover:bg-accent/30 transition-colors duration-150">
                                <td className="py-3 px-5">
                                  <p className="font-medium text-foreground">{m.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{m.email}</p>
                                </td>
                                <td className="py-3 px-4">{roleBadge(m.role)}</td>
                                <td className="py-3 px-5 text-right tabular-nums text-muted-foreground text-xs">
                                  {new Date(m.joined_at).toLocaleDateString('hu-HU')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* LLM cost table (server-side paginated) */}
                {selectedCompanyId && (
                  <LlmCostTable companyId={selectedCompanyId} />
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ USER DETAIL ═══ */}
        {view === 'user' && (() => {
          // Filter overview companies to only those this user belongs to
          const userCompanyIds = new Set((userDetail?.companies || []).map(c => c.id));
          const userCompanies = (overview?.companies || []).filter(c => userCompanyIds.has(c.id));

          return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <StatCard icon={Building2} label="Cégekhez hozzárendelve"
              value={userDetail?.companyCount ?? 0} loading={userLoading} />

            {userLoading ? (
              <Card><CardContent className="p-6"><SkeletonList rows={3} /></CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" /> Cégek
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                          <th className="text-left py-3 px-5 font-medium">Cég</th>
                          <th className="text-left py-3 px-4 font-medium">Adószám</th>
                          <th className="text-left py-3 px-4 font-medium">Rang</th>
                          <th className="text-left py-3 px-4 font-medium">Tagok</th>
                          <th className="text-center py-3 px-4 font-medium">Számla</th>
                          <th className="text-center py-3 px-4 font-medium">Tranzakciók</th>
                          <th className="text-center py-3 px-4 font-medium">Bér/járulék</th>
                          <th className="text-right py-3 px-5 font-medium">Havi költség</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userCompanies.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nincs cég hozzárendelve</td>
                          </tr>
                        ) : userCompanies.map(c => {
                          const userRole = userDetail?.companies.find(uc => uc.id === c.id)?.role || '';
                          const MAX_VISIBLE = 3;
                          const visible = c.members.slice(0, MAX_VISIBLE);
                          const overflow = c.members.length - MAX_VISIBLE;
                          const roleColors: Record<string, string> = {
                            CEO: 'bg-amber-400/20 text-amber-900 dark:text-amber-300 border-amber-400/30',
                            ADMIN: 'bg-info/15 text-info border-info/25',
                          };
                          return (
                            <tr
                              key={c.id}
                              onClick={() => openCompany(c.id)}
                              className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                         transition-colors duration-150 group"
                              role="button"
                              tabIndex={0}
                              aria-label={`${c.name} megnyitása`}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCompany(c.id); } }}
                            >
                              <td className="py-3 px-5">
                                <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                                  {c.name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-muted-foreground tabular-nums text-xs">
                                {c.tax_number || '—'}
                              </td>
                              <td className="py-3 px-4">
                                {roleBadge(userRole)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {visible.map((m, i) => {
                                    const cls = roleColors[m.role] || 'bg-muted text-black border-border';
                                    return (
                                      <span key={i} className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${cls}`}
                                        title={`${m.name} — ${m.role}`}>
                                        {m.name}
                                      </span>
                                    );
                                  })}
                                  {overflow > 0 && (
                                    <span className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border border-border bg-muted/50 text-muted-foreground"
                                      title={c.members.slice(MAX_VISIBLE).map(m => m.name).join(', ')}>
                                      +{overflow}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                                {c.invoiceCount}
                              </td>
                              <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                                {c.transactionCount}
                              </td>
                              <td className="py-3 px-4 text-center tabular-nums text-muted-foreground">
                                {c.payrollCount}
                              </td>
                              <td className="py-3 px-5 text-right tabular-nums font-medium text-foreground">
                                ${c.monthlyCostUsd.toFixed(4)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          );
        })()}
      </main>
      </div>
    </div>
  );
}
