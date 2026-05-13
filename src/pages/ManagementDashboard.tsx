import { useState, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Users, Building2, FileText, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Search, LogOut, ArrowLeft, Shield,
  Bot, Coins, ArrowUpDown, ArrowUp, ArrowDown,
  Trophy, Zap, Calendar, X, Crown, Sun, Moon
} from 'lucide-react';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  users: Array<{ id: string; user_id: string; name: string; email: string; created_at: string; companies: Array<{ id: string; name: string; role: string }> }>;
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

// â”€â”€â”€ API helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Role badge (semantic color tokens) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Skeleton shimmer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted/60 animate-shimmer ${className}`}
      role="status"
      aria-label="BetĂ¶ltĂ©sâ€¦"
    />
  );
}

// â”€â”€â”€ Stat Card (8dp spacing, semantic tokens, shimmer) â”€
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
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
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

// â”€â”€â”€ List row (44px min touch target, hover highlight) â”€
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

// â”€â”€â”€ Skeleton list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â”€â”€â”€ Section header with search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”€â”€â”€ LLM Cost Table (search, sort, pagination, date) â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    placeholderData: keepPreviousData,
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
          <Bot className="h-4 w-4 text-primary" aria-hidden="true" /> LLM kĂ¶ltsĂ©gek rĂ©szletezĂ©se
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {isLoading ? '...' : `${totalRows} rekord`}
          </span>
        </CardTitle>
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input placeholder="KeresĂ©s nĂ©v, fĂˇjl, modell..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-8 text-xs" aria-label="KeresĂ©s" />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-muted-foreground">TĂłl:</span>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }}
              className="h-8 text-xs w-[140px] pr-1" aria-label="DĂˇtum-tĂłl" />
            <span className="text-xs text-muted-foreground">Ig:</span>
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }}
              className="h-8 text-xs w-[140px] pr-1" aria-label="DĂˇtum-ig" />
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setPage(0); }}
              disabled={!dateFrom && !dateTo}
              className={`h-6 w-6 flex items-center justify-center rounded-md transition-colors duration-150 ${dateFrom || dateTo ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer' : 'text-muted-foreground/30 cursor-default'}`}
              aria-label="DĂˇtumszĹ±rĹ‘ tĂ¶rlĂ©se"
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
                <SortTh col="created_at" label="DĂˇtum" align="left" />
                <th className="text-left py-2 px-4 font-medium">NĂ©v</th>
                <th className="text-left py-2 px-4 font-medium">FĂˇjl</th>
                <th className="text-left py-2 px-4 font-medium">Model</th>
                <SortTh col="input_tokens" label="Input" />
                <SortTh col="output_tokens" label="Output" />
                <SortTh col="estimated_cost_usd" label="KĂ¶ltsĂ©g" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((d, i) => (
                <tr key={`${d.created_at}-${i}`} className="text-foreground/80 hover:bg-accent/30 transition-colors duration-150">
                  <td className="py-2 px-4 tabular-nums">{new Date(d.created_at).toLocaleDateString('hu-HU')}</td>
                  <td className="py-2 px-4 text-foreground/70 truncate max-w-[120px]">{d.user_name || 'â€”'}</td>
                  <td className="py-2 px-4 text-foreground/70 truncate max-w-[160px]" title={d.file_name || ''}>{d.file_name || 'â€”'}</td>
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
              {totalRows === 0 ? '0' : `${page * PAGE_SIZE + 1}â€“${Math.min((page + 1) * PAGE_SIZE, totalRows)} / ${totalRows}`}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0}
                onClick={() => setPage(p => p - 1)} aria-label="ElĹ‘zĹ‘ oldal">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">{page + 1}/{totalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)} aria-label="KĂ¶vetkezĹ‘ oldal">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  const [searchUser, setSearchUser] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // â”€â”€ Queries (auto-refresh: overview 60s, details 30s) â”€
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

  // â”€â”€ Company cost lookup (for expandable user rows) â”€â”€
  const companyCostMap = useMemo(() => {
    const m = new Map<string, { monthlyCostUsd: number; invoiceCount: number; transactionCount: number; payrollCount: number }>();
    for (const c of overview?.companies || []) m.set(c.id, { monthlyCostUsd: c.monthlyCostUsd, invoiceCount: c.invoiceCount, transactionCount: c.transactionCount, payrollCount: c.payrollCount });
    return m;
  }, [overview?.companies]);

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

  // â”€â”€ Navigation (stable refs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const openCompany = useCallback((id: string) => { setSearchParams({ view: 'company', id }); }, [setSearchParams]);
  const openUser = useCallback((userId: string) => { setSearchParams({ view: 'user', id: userId }); }, [setSearchParams]);
  const goBack = useCallback(() => { setSearchParams({}); }, [setSearchParams]);

  // Auth guard â€” MUST be after all hooks to satisfy Rules of Hooks
  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // â”€â”€ Title / subtitle derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const title = view === 'overview'
    ? 'Management Dashboard'
    : view === 'company'
      ? (selectedCompanyName || 'CĂ©g rĂ©szletek')
      : (selectedUserObj?.name || 'FelhasznĂˇlĂł rĂ©szletek');

  const subtitle = view === 'overview'
    ? 'Visibill platform ĂˇttekintĂ©s'
    : view === 'company'
      ? 'CĂ©g rĂ©szletes adatai'
      : (selectedUserObj?.email || '');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* â”€â”€ Header (sticky, backdrop-blur, border-b) â”€â”€ */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4 relative">
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
          <span className="absolute left-1/2 -translate-x-1/2 text-xl font-bold tracking-[0.25em] uppercase
                           bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent
                           select-none pointer-events-none hidden md:block"
            aria-hidden="true">VISIBILL</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" aria-label="TĂ©ma vĂˇltĂˇs"
              className="text-muted-foreground hover:text-foreground transition-colors duration-150"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark'
                ? <Sun className="h-4 w-4" aria-hidden="true" />
                : <Moon className="h-4 w-4" aria-hidden="true" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()} aria-label="KijelentkezĂ©s"
              className="text-muted-foreground hover:text-destructive gap-2 transition-colors duration-150">
              <LogOut className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">KijelentkezĂ©s</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* â•â•â• OVERVIEW â•â•â• */}
        {view === 'overview' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="FelhasznĂˇlĂłk"
                value={overview?.usersCount ?? 0} loading={overviewLoading} />
              <StatCard icon={Building2} label="RegisztrĂˇlt cĂ©gek"
                value={overview?.companiesCount ?? 0} loading={overviewLoading} />
              <StatCard icon={Coins} label="Havi Ă¶sszkĂ¶ltsĂ©g"
                value={overview ? `$${overview.llmOverview.totalMonthlyCostUsd.toFixed(4)}` : '$0'}
                loading={overviewLoading}
                sub={overview ? `In: ${(overview.llmOverview.totalMonthlyInputTokens / 1000).toFixed(1)}k Â· Out: ${(overview.llmOverview.totalMonthlyOutputTokens / 1000).toFixed(1)}k token` : undefined} />
              {overviewLoading ? (
                <StatCard icon={Trophy} label="LegdrĂˇgĂˇbb cĂ©g" value="..." loading />
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
                      <p className="text-xs text-muted-foreground">LegdrĂˇgĂˇbb cĂ©g</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5 tabular-nums">
                        Ă–ssz: ${overview.llmOverview.mostExpensiveCompany.totalCostUsd.toFixed(4)} Â· Havi: ${overview.llmOverview.mostExpensiveCompany.monthlyCostUsd.toFixed(4)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <StatCard icon={Trophy} label="LegdrĂˇgĂˇbb cĂ©g" value="â€”" sub="Nincs LLM kĂ¶ltsĂ©g" />
              )}
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" /> FelhasznĂˇlĂłk
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    placeholder="KeresĂ©s nĂ©v vagy email..."
                    className="pl-8 h-8 text-xs w-56 bg-background"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                        <th className="text-left py-3 px-5 font-medium w-8"></th>
                        <th className="text-left py-3 px-2 font-medium">NĂ©v</th>
                        <th className="text-center py-3 px-4 font-medium">CĂ©gek</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {overviewLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="py-3 px-5"><Skeleton className="h-4 w-4" /></td>
                            <td className="py-3 px-2"><Skeleton className="h-4 w-40" /></td>
                            <td className="py-3 px-4 text-center"><Skeleton className="h-5 w-8 mx-auto rounded-full" /></td>
                          </tr>
                        ))
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-muted-foreground text-sm">Nincs talĂˇlat</td>
                        </tr>
                      ) : filteredUsers.map(u => {
                        const isExpanded = expandedUserId === u.user_id;
                        return (
                          <>
                            <tr
                              key={u.user_id}
                              onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                              className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                         transition-colors duration-150 group"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              aria-label={`${u.name || u.email} kibontĂˇsa`}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedUserId(isExpanded ? null : u.user_id); } }}
                            >
                              <td className="py-3 px-5 w-8">
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </td>
                              <td className="py-3 px-2">
                                <div>
                                  <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                                    {u.name || 'N/A'}
                                  </span>
                                  <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                {u.companies.length > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full
                                    bg-primary/10 text-primary text-xs font-semibold border border-primary/20"
                                    title={u.companies.map(c => c.name).join(', ')}>
                                    {u.companies.length}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground italic text-xs">0</span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && u.companies.length > 0 && (
                              <tr key={`${u.user_id}-expand`}>
                                <td colSpan={3} className="p-0">
                                  <div className="bg-muted/20 border-t border-border animate-in slide-in-from-top-1 duration-200">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground border-b border-border/50">
                                          <th className="text-left py-2 px-6 font-medium">CĂ©g</th>
                                          <th className="text-left py-2 px-3 font-medium">Rang</th>
                                          <th className="text-center py-2 px-3 font-medium">SzĂˇmlĂˇk</th>
                                          <th className="text-center py-2 px-3 font-medium">TranzakciĂłk</th>
                                          <th className="text-center py-2 px-3 font-medium">BĂ©r/jĂˇrulĂ©k</th>
                                          <th className="text-right py-2 px-6 font-medium">Havi kĂ¶ltsĂ©g</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/30">
                                        {u.companies.map(c => {
                                          const stats = companyCostMap.get(c.id);
                                          return (
                                            <tr
                                              key={c.id}
                                              onClick={(e) => { e.stopPropagation(); openCompany(c.id); }}
                                              className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 group/company"
                                              role="button"
                                              tabIndex={0}
                                              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); openCompany(c.id); } }}
                                            >
                                              <td className="py-2.5 px-6">
                                                <span className="font-medium text-foreground group-hover/company:text-primary transition-colors duration-150 flex items-center gap-1.5">
                                                  {c.name}
                                                  <ChevronRight className="h-3 w-3 opacity-0 group-hover/company:opacity-100 transition-opacity" />
                                                </span>
                                              </td>
                                              <td className="py-2.5 px-3">{roleBadge(c.role)}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.invoiceCount ?? 'â€”'}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.transactionCount ?? 'â€”'}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.payrollCount ?? 'â€”'}</td>
                                              <td className="py-2.5 px-6 text-right tabular-nums font-medium text-foreground">
                                                ${(stats?.monthlyCostUsd ?? 0).toFixed(4)}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* â•â•â• COMPANY DETAIL â•â•â• */}
        {view === 'company' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={FileText} label="SzĂˇmlĂˇk Ă¶sszesen"
                value={companyDetail?.invoiceCount ?? 0} loading={companyLoading}
                sub={companyDetail ? `${companyDetail.submittedInvoiceCount} feltĂ¶ltĂ¶tt Â· ${companyDetail.navInvoiceCount} NAV` : undefined} />
              <StatCard icon={Users} label="Tagok"
                value={companyDetail?.members.length ?? 0} loading={companyLoading} />
              <StatCard icon={Coins} label="LLM kĂ¶ltsĂ©g (USD)"
                value={companyDetail ? `$${companyDetail.llmCosts.totalCostUsd.toFixed(4)}` : '$0'}
                loading={companyLoading}
                sub={companyDetail ? `${companyDetail.llmCosts.callCount} hĂ­vĂˇs Â· ${(companyDetail.llmCosts.totalTokens / 1000).toFixed(1)}k token` : undefined} />
              <StatCard icon={Clock} label="UtolsĂł aktivitĂˇs"
                loading={companyLoading}
                value={companyDetail?.lastActivity ? new Date(companyDetail.lastActivity.created_at).toLocaleDateString('hu-HU') : 'â€”'}
                sub={companyDetail?.lastActivity ? `${companyDetail.lastActivity.user_name} Â· ${companyDetail.lastActivity.action}` : 'Nincs aktivitĂˇs'} />
            </div>

            {/* Last activity */}
            {!companyLoading && companyDetail?.lastActivity && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" aria-hidden="true" /> UtolsĂł mĹ±velet rĂ©szletei
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                    {[
                      { label: 'MĹ±velet', value: companyDetail.lastActivity.action, bold: true },
                      { label: 'FĂˇjl', value: companyDetail.lastActivity.entity_name || companyDetail.lastActivity.entity },
                      { label: 'FelhasznĂˇlĂł', value: companyDetail.lastActivity.user_name },
                      { label: 'IdĹ‘pont', value: new Date(companyDetail.lastActivity.created_at).toLocaleString('hu-HU') },
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
                      <Users className="h-4 w-4 text-primary" aria-hidden="true" /> HozzĂˇrendelt felhasznĂˇlĂłk
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
                              <th className="text-left py-3 px-5 font-medium">NĂ©v</th>
                              <th className="text-left py-3 px-4 font-medium">Rang</th>
                              <th className="text-right py-3 px-5 font-medium">CsatlakozĂˇs dĂˇtuma</th>
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

        {/* â•â•â• USER DETAIL â•â•â• */}
        {view === 'user' && (() => {
          // Filter overview companies to only those this user belongs to
          const userCompanyIds = new Set((userDetail?.companies || []).map(c => c.id));
          const userCompanies = (overview?.companies || []).filter(c => userCompanyIds.has(c.id));

          return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <StatCard icon={Building2} label="CĂ©gekhez hozzĂˇrendelve"
              value={userDetail?.companyCount ?? 0} loading={userLoading} />

            {userLoading ? (
              <Card><CardContent className="p-6"><SkeletonList rows={3} /></CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" /> CĂ©gek
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 text-muted-foreground">
                          <th className="text-left py-3 px-5 font-medium">CĂ©g</th>
                          <th className="text-left py-3 px-4 font-medium">AdĂłszĂˇm</th>
                          <th className="text-left py-3 px-4 font-medium">Rang</th>
                          <th className="text-left py-3 px-4 font-medium">Tagok</th>
                          <th className="text-center py-3 px-4 font-medium">SzĂˇmla</th>
                          <th className="text-center py-3 px-4 font-medium">TranzakciĂłk</th>
                          <th className="text-center py-3 px-4 font-medium">BĂ©r/jĂˇrulĂ©k</th>
                          <th className="text-right py-3 px-5 font-medium">Havi kĂ¶ltsĂ©g</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {userCompanies.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">Nincs cĂ©g hozzĂˇrendelve</td>
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
                              aria-label={`${c.name} megnyitĂˇsa`}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCompany(c.id); } }}
                            >
                              <td className="py-3 px-5">
                                <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150">
                                  {c.name}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-muted-foreground tabular-nums text-xs">
                                {c.tax_number || 'â€”'}
                              </td>
                              <td className="py-3 px-4">
                                {roleBadge(userRole)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1.5">
                                  {visible.map((m, i) => {
                                    const cls = roleColors[m.role] || 'bg-muted text-muted-foreground border-border';
                                    return (
                                      <span key={i} className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full border ${cls}`}
                                        title={`${m.name} â€” ${m.role}`}>
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
