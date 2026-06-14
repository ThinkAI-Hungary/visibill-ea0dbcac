import React, { useState, useMemo, useCallback } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { reportError } from '@/lib/errorReporter';
import {
  Users, Building2, FileText, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Search, LogOut, ArrowLeft, Shield,
  Bot, Coins, ArrowUpDown, ArrowUp, ArrowDown,
  Trophy, Zap, Calendar, X, Crown, Sun, Moon,
  AlertTriangle, Trash2, RefreshCw, RotateCcw, Receipt, Wallet, Landmark, BarChart3,
  Eye, Download, ExternalLink
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
    navInvoiceCount: number;
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

interface ErrorRow {
  id: string;
  created_at: string;
  source: string;
  source_label: string;
  error_category: string;
  error_category_label: string;
  error_message: string | null;
  file_name: string | null;
  file_url: string | null;
  company_id: string | null;
  company_name: string | null;
  user_id: string | null;
  user_name: string | null;
  context: Record<string, unknown> | null;
}

interface ErrorsData {
  totalErrors: number;
  last24hErrors: number;
  mostAffectedCompany: { id: string; name: string; errorCount: number } | null;
  mostAffectedUser: { id: string; name: string; errorCount: number } | null;
  topErrorCategory: { category: string; label: string; count: number } | null;
  totalRows: number;
  errors: ErrorRow[];
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

async function postManagementData(action: string, body: unknown) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const url = new URL(`${(supabase as any).supabaseUrl}/functions/v1/management-stats`);
  url.searchParams.set('action', action);

  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: (supabase as any).supabaseKey,
    },
    body: JSON.stringify(body),
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
// ─── Error Control Panel ─────────────────────────────
// ═══════════════════════════════════════════════════════
type ErrorSortCol = 'created_at' | 'source' | 'error_category';

function ErrorControlPanel({ onOpenCompany }: { onOpenCompany: (id: string) => void }) {
  const PAGE_SIZE = 25;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortCol, setSortCol] = useState<ErrorSortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<Array<{ source: string; id: string }>>([]);
  const [retrying, setRetrying] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const queryClient = useQueryClient();

  // Debounce search
  const searchTimerRef = useCallback((val: string) => {
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);
  useMemo(() => searchTimerRef(search), [search, searchTimerRef]);

  const toggleSort = useCallback((col: ErrorSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(0);
  }, [sortCol]);

  const { data, isLoading } = useQuery<ErrorsData>({
    queryKey: ['management-errors', page, PAGE_SIZE, sortCol, sortDir, debouncedSearch, filterCompanyId, filterSource, filterCategory, filterUserId, dateFrom, dateTo],
    queryFn: () => fetchManagementData('errors', {
      page: String(page), pageSize: String(PAGE_SIZE),
      sortBy: sortCol, sortDir, search: debouncedSearch,
      companyId: filterCompanyId, source: filterSource,
      category: filterCategory, userId: filterUserId, dateFrom, dateTo,
    }),
    staleTime: 15_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
  });

  const errRows = data?.errors || [];
  const totalRows = data?.totalRows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  const allPageSelected = errRows.length > 0 && errRows.every(r => selected.has(`${r.source}:${r.id}`));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allPageSelected) {
      errRows.forEach(r => next.delete(`${r.source}:${r.id}`));
    } else {
      errRows.forEach(r => next.add(`${r.source}:${r.id}`));
    }
    setSelected(next);
  };
  const toggleOne = (r: ErrorRow) => {
    const key = `${r.source}:${r.id}`;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelected(next);
  };

  const handleDelete = async (ids: Array<{ source: string; id: string }>) => {
    if (ids.length === 0) return;
    setDeleteTargets(ids);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (deleteTargets.length === 0) return;
    setDeleteModalOpen(false);
    setDeleting(true);
    try {
      await postManagementData('delete-errors', { ids: deleteTargets });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Delete errors failed:', error: e });
    } finally {
      setDeleting(false);
      setDeleteTargets([]);
    }
  };

  const handleBulkDelete = () => {
    const ids = [...selected].map(key => {
      const lastColon = key.lastIndexOf(':');
      const source = key.substring(0, lastColon);
      const id = key.substring(lastColon + 1);
      return { source, id };
    });
    handleDelete(ids);
  };

  const RETRYABLE_SOURCES = new Set(['invoice_uploads', 'transaction_uploads', 'gl_upload_notifications']);

  // Retry modal state
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same'); // 'same' | 'invoice' | 'payroll' | 'transaction' | 'gl'

  const PIPELINE_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode; queue?: string; category?: string | null }> = [
    { value: 'same', label: 'Eredeti pipeline (változatlan)', icon: <RotateCcw className="h-4 w-4 text-muted-foreground" /> },
    { value: 'invoice', label: 'Számla feldolgozás', icon: <Receipt className="h-4 w-4 text-emerald-500" />, queue: 'invoice_jobs', category: 'invoice' },
    { value: 'payroll', label: 'Bérjegyzék feldolgozás', icon: <Wallet className="h-4 w-4 text-amber-500" />, queue: 'invoice_jobs', category: 'payroll' },
    { value: 'transaction', label: 'Tranzakció feldolgozás', icon: <Landmark className="h-4 w-4 text-blue-500" />, queue: 'transaction_jobs', category: null },
    { value: 'gl', label: 'Főkönyvi besorolás', icon: <BarChart3 className="h-4 w-4 text-purple-500" />, queue: 'gl_classification_jobs', category: null },
  ];

  // All retryable sources can target any pipeline (the whole point is re-routing mistakes)
  const getPipelineOptionsForSource = (_source: string) => {
    return ['same', 'invoice', 'payroll', 'transaction', 'gl'];
  };

  // For mixed selections, find the intersection of available pipelines
  const availablePipelines = useMemo(() => {
    if (retryTargets.length === 0) return ['same'];
    const sources = new Set(retryTargets.map(t => t.source));
    if (sources.size === 1) {
      return getPipelineOptionsForSource([...sources][0]);
    }
    // Mixed sources — only 'same' is safe
    return ['same'];
  }, [retryTargets]);

  const openRetryModal = (ids: Array<{ source: string; id: string }>) => {
    const retryable = ids.filter(i => RETRYABLE_SOURCES.has(i.source));
    if (retryable.length === 0) {
      window.alert('A kijelölt hibák forrása nem támogatja az újraküldést.');
      return;
    }
    setRetryTargets(retryable);
    setRetryPipeline('same');
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (retryTargets.length === 0) return;
    setRetrying(true);
    setRetryModalOpen(false);
    try {
      const pipelineOverride = retryPipeline !== 'same'
        ? PIPELINE_OPTIONS.find(p => p.value === retryPipeline)
        : null;

      const result = await postManagementData('retry-errors', {
        ids: retryTargets,
        ...(pipelineOverride && {
          targetQueue: pipelineOverride.queue,
          targetCategory: pipelineOverride.category,
        }),
      });
      if (result.error) console.warn('Retry partial errors:', result.error);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors failed:', error: e });
    } finally {
      setRetrying(false);
      setRetryTargets([]);
    }
  };

  const handleBulkRetry = () => {
    const ids = [...selected].map(key => {
      const lastColon = key.lastIndexOf(':');
      const source = key.substring(0, lastColon);
      const id = key.substring(lastColon + 1);
      return { source, id };
    });
    openRetryModal(ids);
  };

  function ErrSortTh({ col, label }: { col: ErrorSortCol; label: string }) {
    const active = sortCol === col;
    return (
      <th
        className="py-2 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150 text-left"
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active
            ? sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    );
  }

  const sourceOptions = [
    { value: 'invoice_uploads', label: 'Számla' },
    { value: 'transaction_uploads', label: 'Tranzakció' },
    { value: 'report_uploads', label: 'Riport' },
    { value: 'gl_upload_notifications', label: 'Főkönyv' },
    { value: 'nav_sync_logs', label: 'NAV szinkron' },
    { value: 'bank_statement_uploads', label: 'Bankkivonat' },
    { value: 'app_error_logs', label: '── App hibák (mind) ──' },
    { value: 'app_error_logs:frontend', label: '   Frontend' },
    { value: 'app_error_logs:worker', label: '   Worker' },
    { value: 'app_error_logs:webhook', label: '   Mailgun webhook' },
    { value: 'app_error_logs:mailgun', label: '   Mailgun' },
    { value: 'app_error_logs:email_alias', label: '   Email alias' },
  ];

  const categoryOptions = [
    { value: 'classification_error', label: 'Nem beazonosítható' },
    { value: 'ocr_error', label: 'OCR hiba' },
    { value: 'extraction_error', label: 'Extrakciós hiba' },
    { value: 'duplicate_error', label: 'Duplikátum' },
    { value: 'api_error', label: 'API / DB hiba' },
    { value: 'empty_content', label: 'Üres tartalom' },
    { value: 'timeout_error', label: 'Időtúllépés' },
    { value: 'rate_limit_error', label: 'Rate limit' },
    // Frontend-specific categories
    { value: 'auth', label: 'Auth hiba' },
    { value: 'db_query', label: 'DB lekérdezés' },
    { value: 'api_call', label: 'API hívás' },
    { value: 'upload', label: 'Feltöltés (frontend)' },
    { value: 'validation', label: 'Validáció' },
    { value: 'navigation', label: 'Navigáció' },
    { value: 'unhandled', label: 'Nem kezelt hiba' },
    // Worker / Mailgun categories
    { value: 'worker', label: 'Worker hiba' },
    { value: 'webhook', label: 'Webhook hiba' },
    { value: 'mailgun', label: 'Mailgun hiba' },
    { value: 'email_alias', label: 'Email alias hiba' },
    { value: 'unknown', label: 'Egyéb' },
  ];

  const categoryColors: Record<string, string> = {
    classification_error: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
    ocr_error: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
    extraction_error: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25',
    duplicate_error: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25',
    api_error: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25',
    empty_content: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/25',
    timeout_error: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25',
    rate_limit_error: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/25',
    // Frontend-specific category colors
    auth: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
    db_query: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/25',
    api_call: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25',
    upload: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25',
    validation: 'bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/25',
    navigation: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/25',
    unhandled: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25',
    // Worker / Mailgun categories
    worker: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
    webhook: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/25',
    mailgun: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25',
    email_alias: 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25',
    unknown: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="space-y-0 animate-in fade-in duration-300">
      {/* ── Compact header: inline KPIs + distribution bar + filters ── */}
      <Card className="rounded-b-none border-b-0">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Row 1: KPI cards */}
            <div className="flex items-center gap-3">
            {/* KPI: Total errors */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-accent/30 border border-border shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-lg font-bold leading-none tabular-nums">{isLoading ? '...' : data?.totalErrors ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Összes hiba</p>
              </div>
            </div>

            {/* KPI: 24h */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-accent/30 border border-border shrink-0">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold leading-none tabular-nums">{isLoading ? '...' : data?.last24hErrors ?? 0}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">24h</p>
              </div>
            </div>

            {/* KPI: Most affected company */}
            {data?.mostAffectedCompany && (
              <button
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border shrink-0 hover:bg-accent/50 transition-colors text-left ${
                  filterCompanyId === data.mostAffectedCompany.id ? 'bg-primary/10 border-primary/30' : 'bg-accent/30 border-border'
                }`}
                onClick={() => {
                  const id = data.mostAffectedCompany!.id;
                  setFilterCompanyId(prev => prev === id ? '' : id);
                  setPage(0);
                }}
                title="Kattints a szűréshez"
              >
                <Building2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-xs font-semibold leading-tight">{data.mostAffectedCompany.name}</p>
                  <p className="text-[10px] text-muted-foreground">Legtöbb ({data.mostAffectedCompany.errorCount})</p>
                </div>
              </button>
            )}

            {/* KPI: Most affected user */}
            {data?.mostAffectedUser && (
              <button
                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg border shrink-0 hover:bg-accent/50 transition-colors text-left ${
                  filterUserId === data.mostAffectedUser.id ? 'bg-primary/10 border-primary/30' : 'bg-accent/30 border-border'
                }`}
                onClick={() => {
                  const id = data.mostAffectedUser!.id;
                  setFilterUserId(prev => prev === id ? '' : id);
                  setPage(0);
                }}
                title="Kattints a szűréshez"
              >
                <Users className="h-4 w-4 text-orange-500" />
                <div>
                  <p className="text-xs font-semibold leading-tight">{data.mostAffectedUser.name}</p>
                  <p className="text-[10px] text-muted-foreground">Legtöbb ({data.mostAffectedUser.errorCount})</p>
                </div>
              </button>
            )}
            </div>

            {/* Row 2: Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Keresés..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  className="pl-7 h-7 text-[11px] w-[160px]" />
              </div>
              <select value={filterSource} onChange={e => { setFilterSource(e.target.value); setPage(0); }}
                className="h-7 text-[11px] rounded-md border border-input bg-background px-2 min-w-[90px]">
                <option value="">Forrás ▾</option>
                {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={filterCompanyId} onChange={e => { setFilterCompanyId(e.target.value); setPage(0); }}
                className="h-7 text-[11px] rounded-md border border-input bg-background px-2 min-w-[90px]">
                <option value="">Cég ▾</option>
                {(() => {
                  const seen = new Map<string, string>();
                  errRows.forEach(r => { if (r.company_id && r.company_name) seen.set(r.company_id, r.company_name); });
                  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ));
                })()}
              </select>
              <select value={filterUserId} onChange={e => { setFilterUserId(e.target.value); setPage(0); }}
                className="h-7 text-[11px] rounded-md border border-input bg-background px-2 min-w-[90px]">
                <option value="">User ▾</option>
                {(() => {
                  const seen = new Map<string, string>();
                  errRows.forEach(r => { if (r.user_id && r.user_name) seen.set(r.user_id, r.user_name); });
                  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ));
                })()}
              </select>
              <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(0); }}
                className="h-7 text-[11px] rounded-md border border-input bg-background px-2 min-w-[90px]">
                <option value="">Típus ▾</option>
                {categoryOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {selected.size > 0 && (
                <>
                  <Button variant="destructive" size="sm" className="h-7 gap-1 text-[11px] px-2" disabled={deleting}
                    onClick={handleBulkDelete}>
                    <Trash2 className="h-3 w-3" />
                    {selected.size}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px] px-2 border-primary/30 text-primary hover:bg-primary/10" disabled={retrying}
                    onClick={handleBulkRetry}>
                    <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                    Újra
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table with severity strip ── */}
      <Card className="rounded-t-none">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]" role="table">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-1.5 px-2 w-7">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                      className="rounded border-border" />
                  </th>
                  <th className="py-1.5 px-1 w-6"></th>
                  <ErrSortTh col="created_at" label="Dátum" />
                  <th className="text-left py-1.5 px-3 font-medium">Cég</th>
                  <th className="text-left py-1.5 px-3 font-medium">User</th>
                  <ErrSortTh col="source" label="Forrás" />
                  <ErrSortTh col="error_category" label="Típus" />
                  <th className="text-left py-1.5 px-3 font-medium">Fájl</th>
                  <th className="text-left py-1.5 px-3 font-medium">Hibaüzenet</th>
                  <th className="py-1.5 px-2 w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {errRows.map(r => {
                  const isExpanded = expandedId === `${r.source}:${r.id}`;
                  const key = `${r.source}:${r.id}`;
                  return (
                    <React.Fragment key={key}>
                      <tr className={`hover:bg-accent/30 transition-colors duration-100 cursor-pointer ${
                        selected.has(key) ? 'bg-primary/5' : ''
                      }`}
                        onClick={() => setExpandedId(isExpanded ? null : key)}
                      >
                        <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(key)}
                            onChange={() => toggleOne(r)} className="rounded border-border" />
                        </td>
                        <td className="py-1.5 px-1">
                          <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                        <td className="py-1.5 px-3 tabular-nums whitespace-nowrap">
                          {new Date(r.created_at).toLocaleDateString('hu-HU', { month: '2-digit', day: '2-digit' })}
                          <span className="text-muted-foreground/50 ml-1">
                            {new Date(r.created_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="py-1.5 px-3">
                          {r.company_name ? (
                            <button className="text-foreground hover:text-primary transition-colors font-medium text-left truncate max-w-[140px] block"
                              onClick={e => { e.stopPropagation(); if (r.company_id) { setFilterCompanyId(r.company_id); setPage(0); } }}
                              title={`Szűrés: ${r.company_name}`}>
                              {r.company_name}
                            </button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 px-3">
                          {r.user_name ? (
                            <button className="text-foreground hover:text-primary transition-colors text-left truncate max-w-[120px] block text-[11px]"
                              onClick={e => { e.stopPropagation(); if (r.user_id) { setFilterUserId(r.user_id); setPage(0); } }}
                              title={`Szűrés: ${r.user_name}`}>
                              {r.user_name}
                            </button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 px-3">
                          <Badge variant="outline" className="text-[10px]">{r.source_label}</Badge>
                        </td>
                        <td className="py-1.5 px-3">
                          <Badge className={`text-[10px] ${categoryColors[r.error_category] || categoryColors.unknown}`}>
                            {r.error_category_label}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 max-w-[140px]" onClick={e => e.stopPropagation()}>
                          {r.file_url && r.file_name ? (
                            <button
                              className="group inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors duration-150 truncate max-w-full"
                              title={`Előnézet: ${r.file_name}`}
                              onClick={() => setPreviewFile({ url: r.file_url!, name: r.file_name! })}
                            >
                              <Eye className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                              <span className="truncate">{r.file_name}</span>
                            </button>
                          ) : (
                            <span className="text-foreground/50 truncate">{r.file_name || '—'}</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-foreground/50 truncate max-w-[200px]" title={r.error_message || ''}>
                          {r.error_message ? r.error_message.slice(0, 55) + (r.error_message.length > 55 ? '…' : '') : '—'}
                        </td>
                        <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {RETRYABLE_SOURCES.has(r.source) && (
                              <button className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Újraküldés feldolgozásra"
                                disabled={retrying}
                                onClick={() => openRetryModal([{ source: r.source, id: r.id }])}>
                                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                              </button>
                            )}
                            <button className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Hiba törlése"
                              onClick={() => handleDelete([{ source: r.source, id: r.id }])}>
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="bg-muted/20 border-t border-border px-6 py-4 animate-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Forrás tábla</p>
                                  <p className="text-foreground font-medium">{r.source}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Rekord ID</p>
                                  <p className="text-foreground font-mono text-xs">{r.id}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Felhasználó</p>
                                  <p className="text-foreground">{r.user_name || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Időpont</p>
                                  <p className="text-foreground tabular-nums">{new Date(r.created_at).toLocaleString('hu-HU')}</p>
                                </div>
                              </div>
                              <div>
                                <p className="text-muted-foreground text-xs mb-1">Teljes hibaüzenet</p>
                                <pre className="text-xs text-destructive/90 bg-destructive/5 border border-destructive/10 rounded-lg p-3 whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto">
                                  {r.error_message || 'Nincs hibaüzenet'}
                                </pre>
                              </div>
                              {r.context && Object.keys(r.context).length > 0 && (
                                <div className="mt-3">
                                  <p className="text-muted-foreground text-xs mb-1">Kontextus</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(r.context).map(([k, v]) => (
                                      <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50 border border-border text-xs">
                                        <span className="text-muted-foreground">{k}:</span>
                                        <span className="font-medium text-foreground">{String(v)}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {errRows.length === 0 && !isLoading && (
                  <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Nincs hiba találat</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {totalRows === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalRows)} / ${totalRows}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-2">{page + 1}/{totalPages}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Retry Pipeline Modal */}
      {retryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-md mx-4 shadow-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Újraküldés feldolgozásra
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {retryTargets.length} elem kerül újra feldolgozásra. Válaszd ki a cél pipeline-t:
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                {PIPELINE_OPTIONS.filter(p => availablePipelines.includes(p.value)).map(p => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-150 ${
                      retryPipeline === p.value
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border hover:border-primary/30 hover:bg-accent/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="retryPipeline"
                      value={p.value}
                      checked={retryPipeline === p.value}
                      onChange={() => setRetryPipeline(p.value)}
                      className="accent-primary"
                    />
                    <span className="flex items-center justify-center w-5 h-5 shrink-0">{p.icon}</span>
                    <span className="text-sm font-medium">{p.label}</span>
                  </label>
                ))}
              </div>
              {availablePipelines.length <= 1 && (
                <p className="text-xs text-muted-foreground/70 italic">
                  A kijelölt elemek forrása csak az eredeti pipeline-on küldhető újra.
                </p>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setRetryModalOpen(false)}>
                  Mégse
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleRetryConfirm}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Újraküldés ({retryTargets.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-sm mx-4 shadow-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-destructive" />
                Hibák törlése
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{deleteTargets.length}</span> hiba kerül törlésre (dismissed). Ez a művelet nem vonható vissza.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => { setDeleteModalOpen(false); setDeleteTargets([]); }}>
                  Mégse
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteConfirm}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Törlés ({deleteTargets.length})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (() => {
        const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
        const isPdf = ext === 'pdf';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
        const isCsv = ['csv', 'tsv'].includes(ext);
        const isExcel = ['xls', 'xlsx', 'xlsm'].includes(ext);

        return (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setPreviewFile(null)}
          >
            <div
              className="relative w-full max-w-5xl mx-4 h-[85vh] flex flex-col bg-card rounded-xl border border-border shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-medium truncate">{previewFile.name}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{ext.toUpperCase() || 'FILE'}</Badge>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Letöltés"
                    onClick={e => e.stopPropagation()}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Megnyitás új lapon"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <button
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={() => setPreviewFile(null)}
                    title="Bezárás"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden">
                {isPdf && (
                  <iframe
                    src={previewFile.url}
                    className="w-full h-full border-0"
                    title={`PDF előnézet: ${previewFile.name}`}
                  />
                )}
                {isImage && (
                  <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-black/20">
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  </div>
                )}
                {isCsv && (
                  <iframe
                    src={previewFile.url}
                    className="w-full h-full border-0 bg-white text-black"
                    title={`CSV előnézet: ${previewFile.name}`}
                  />
                )}
                {isExcel && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                    <FileText className="h-16 w-16 opacity-30" />
                    <p className="text-sm">Excel fájlok böngészőben nem jeleníthetők meg.</p>
                    <a
                      href={previewFile.url}
                      download={previewFile.name}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Download className="h-4 w-4" /> Letöltés
                    </a>
                  </div>
                )}
                {!isPdf && !isImage && !isCsv && !isExcel && (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                    <FileText className="h-16 w-16 opacity-30" />
                    <p className="text-sm">A fájl típusa ({ext || 'ismeretlen'}) nem jeleníthető meg előnézetben.</p>
                    <div className="flex gap-2">
                      <a
                        href={previewFile.url}
                        download={previewFile.name}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        <Download className="h-4 w-4" /> Letöltés
                      </a>
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" /> Megnyitás
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
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
  const view: 'overview' | 'company' | 'user' | 'errors' = (urlView === 'company' || urlView === 'user' || urlView === 'errors') ? urlView : 'overview';
  const selectedCompanyId = view === 'company' ? urlId : null;
  const selectedUserId = view === 'user' ? urlId : null;

  const [searchUser, setSearchUser] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

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
    for (const c of overview?.companies || []) m.set(c.id, { monthlyCostUsd: c.monthlyCostUsd, invoiceCount: c.invoiceCount, navInvoiceCount: c.navInvoiceCount, transactionCount: c.transactionCount, payrollCount: c.payrollCount });
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

  // ── Navigation (stable refs) ────────────────────
  const openCompany = useCallback((id: string) => { setSearchParams({ view: 'company', id }); }, [setSearchParams]);
  const openUser = useCallback((userId: string) => { setSearchParams({ view: 'user', id: userId }); }, [setSearchParams]);
  const openErrors = useCallback(() => { setSearchParams({ view: 'errors' }); }, [setSearchParams]);
  const goBack = useCallback(() => { setSearchParams({}); }, [setSearchParams]);

  // Auth guard — MUST be after all hooks to satisfy Rules of Hooks
  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // ── Title / subtitle derivation ─────────────────────
  const title = view === 'overview'
    ? 'Management Dashboard'
    : view === 'errors'
      ? 'Error Control Panel'
      : view === 'company'
        ? (selectedCompanyName || 'Cég részletek')
        : (selectedUserObj?.name || 'Felhasználó részletek');

  const subtitle = view === 'overview'
    ? 'eaisybill platform áttekintés'
    : view === 'errors'
      ? 'Feldolgozási hibák áttekintése'
      : view === 'company'
        ? 'Cég részletes adatai'
        : (selectedUserObj?.email || '');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* ── Header (sticky, backdrop-blur, border-b) ── */}
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
          <span className="absolute left-1/2 -translate-x-1/2 text-xl font-semibold tracking-[0.25em] uppercase
                           text-primary
                           select-none pointer-events-none hidden md:block"
            aria-hidden="true">EAISYBILL</span>
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
          <div className="space-y-8 page-animate">
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
              <Card
                className="cursor-pointer hover:bg-accent/30 transition-colors duration-150 border-destructive/20"
                onClick={openErrors}
                role="button" tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') openErrors(); }}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 border border-destructive/20 shrink-0">
                    <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">
                      {overviewLoading ? '...' : (overview as any)?.totalErrors ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">Feldolgozási hibák</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Felhasználók
                </CardTitle>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={searchUser}
                    onChange={e => setSearchUser(e.target.value)}
                    placeholder="Keresés név vagy email..."
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
                        <th className="text-left py-3 px-2 font-medium">Név</th>
                        <th className="text-center py-3 px-4 font-medium">Cégek</th>
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
                          <td colSpan={3} className="text-center py-8 text-muted-foreground text-sm">Nincs találat</td>
                        </tr>
                      ) : filteredUsers.map(u => {
                        const isExpanded = expandedUserId === u.user_id;
                        return (
                          <React.Fragment key={u.user_id}>
                            <tr
                              onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                              className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                         transition-colors duration-150 group"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              aria-label={`${u.name || u.email} kibontása`}
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
                              <tr>
                                <td colSpan={3} className="p-0">
                                  <div className="bg-muted/20 border-t border-border animate-in slide-in-from-top-1 duration-200">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground border-b border-border/50">
                                          <th className="text-left py-2 px-6 font-medium">Cég</th>
                                          <th className="text-left py-2 px-3 font-medium">Rang</th>
                                          <th className="text-center py-2 px-3 font-medium">Számlák</th>
                                          <th className="text-center py-2 px-3 font-medium">NAV</th>
                                          <th className="text-center py-2 px-3 font-medium">Tranzakciók</th>
                                          <th className="text-center py-2 px-3 font-medium">Bér/járulék</th>
                                          <th className="text-right py-2 px-6 font-medium">Havi költség</th>
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
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.invoiceCount ?? '—'}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.navInvoiceCount ?? '—'}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.transactionCount ?? '—'}</td>
                                              <td className="py-2.5 px-3 text-center tabular-nums text-muted-foreground">{stats?.payrollCount ?? '—'}</td>
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
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
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

        {/* ═══ ERRORS ═══ */}
        {view === 'errors' && (
          <ErrorControlPanel onOpenCompany={openCompany} />
        )}
      </main>
      </div>
    </div>
  );
}
