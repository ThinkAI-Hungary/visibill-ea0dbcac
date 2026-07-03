import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
import { useToast } from '@/hooks/use-toast';
import {
  Users, Building2, FileText, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Search, LogOut, ArrowLeft, Shield,
  Bot, Coins, ArrowUpDown, ArrowUp, ArrowDown,
  Trophy, Zap, Calendar, X, Crown, Sun, Moon,
  AlertTriangle, Trash2, RefreshCw, RotateCcw, Receipt, Wallet, Landmark, BarChart3,
  Eye, Download, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, Save, Check, Loader2, Pencil,
  ArrowLeftRight, BookOpen, Briefcase, Upload, AlertCircle, ClipboardList, CalendarClock, HardHat,
  CreditCard, User,
  Tags, FolderKanban, Package2, Truck, FileSpreadsheet, Scale, ScrollText, Gavel,
  TicketCheck, FolderOpen,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import TicketsPage from './TicketsPage';

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
    hasEaisyBooks: boolean;
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

// ─── Superadmin module data types ────────────────────
type SuperadminModuleKey =
  // eaisybill
  | 'invoices' | 'nav_invoices' | 'transactions' | 'gl_journal_entries'
  | 'salary' | 'petty_cash_entries' | 'uploads' | 'app_error_logs'
  | 'categories' | 'projects' | 'partners' | 'fixed_assets' | 'shipments' | 'annual_reports'
  // eaisyBooks
  | 'accounty_missing_items' | 'accounty_deadlines' | 'accounty_employees' | 'accounty_payroll_cycles'
  | 'accounty_assignments' | 'accounty_tax_profiles' | 'accounty_filings' | 'accounty_tao_yearly'
  | 'accounty_audit_log' | 'accounty_documents' | 'accounty_templates' | 'accounty_job_codes' | 'accounty_legal_updates';

interface SuperadminModuleData {
  module: string;
  totalCount: number;
  rows: Record<string, unknown>[];
  page: number;
  pageSize: number;
  error?: string;
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
      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          <div className="space-y-2.5 flex-1 overflow-hidden">
            <Skeleton className="h-7 w-2/3" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              {sub && <Skeleton className="h-2 w-3/4 opacity-50" />}
            </div>
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
            {isLoading ? <Skeleton className="h-4 w-16" /> : `${totalRows} rekord`}
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
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-${i}`}>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-2 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="py-2 px-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="py-2 px-4 text-right"><Skeleton className="h-4 w-12 ml-auto" /></td>
                    <td className="py-2 px-4 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground text-sm">Nincs adat a megadott szűréssel</td>
                </tr>
              ) : rows.map((d, i) => (
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
              {!isLoading && rows.length < PAGE_SIZE && Array.from({ length: PAGE_SIZE - rows.length }).map((_, i) => (
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
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
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

  const { toast } = useToast();

  const openRetryModal = (ids: Array<{ source: string; id: string }>) => {
    const retryable = ids.filter(i => RETRYABLE_SOURCES.has(i.source));
    if (retryable.length === 0) {
      toast({ title: 'Nem támogatott', description: 'A kijelölt hibák forrása nem támogatja az újraküldést.', variant: 'destructive' });
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
      if (result.error) reportError({ type: 'api_call', component: 'ManagementDashboard', action: 'warning', message: 'Retry partial errors', error: result.error });
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
    <div className="space-y-0 animate-in fade-in duration-300" style={{ maxWidth: '100%' }}>
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
                <div className="text-lg font-bold leading-none tabular-nums">{isLoading ? <Skeleton className="h-5 w-10 inline-block" /> : data?.totalErrors ?? 0}</div>
                <p className="text-[10px] text-muted-foreground mt-0.5">Összes hiba</p>
              </div>
            </div>

            {/* KPI: 24h */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-accent/30 border border-border shrink-0">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <div className="text-lg font-bold leading-none tabular-nums">{isLoading ? <Skeleton className="h-5 w-8 inline-block" /> : data?.last24hErrors ?? 0}</div>
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
              {totalRows > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-[11px] px-2 border-destructive/30 text-destructive hover:bg-destructive/10 ml-auto"
                  disabled={deleting || deletingAll}
                  onClick={() => setDeleteAllModalOpen(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Összes törlés ({totalRows})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Table with severity strip ── */}
      <Card className="rounded-t-none overflow-hidden">
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[11px]" style={{ tableLayout: 'fixed', minWidth: 900 }} role="table">
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
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`skel-${i}`}>
                      <td className="py-1.5 px-2"><Skeleton className="h-4 w-4" /></td>
                      <td className="py-1.5 px-1"><Skeleton className="h-3 w-3" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-1.5 px-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="py-1.5 px-2"><Skeleton className="h-4 w-8" /></td>
                    </tr>
                  ))
                ) : errRows.map(r => {
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
      {retryModalOpen && createPortal(
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
      , document.body)}
      {/* Delete Confirmation Modal */}
      {deleteModalOpen && createPortal(
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
      , document.body)}
      {/* Delete ALL confirmation modal */}
      {deleteAllModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <Card className="w-full max-w-sm mx-4 shadow-2xl border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Összes hiba törlése
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="font-semibold text-foreground">{totalRows}</span> hiba kerül törlésre / elutasításra az összes forrásból. Ez a művelet nem vonható vissza!
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={() => setDeleteAllModalOpen(false)}>
                  Mégse
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={deletingAll}
                  onClick={async () => {
                    setDeleteAllModalOpen(false);
                    setDeletingAll(true);
                    try {
                      await postManagementData('delete-all-errors', {});
                      setSelected(new Set());
                      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
                      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
                    } catch (e) {
                      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Delete all errors failed:', error: e });
                    } finally {
                      setDeletingAll(false);
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Összes törlés
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      , document.body)}
      {/* File Preview Modal */}
      {previewFile && createPortal((() => {
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
      })(), document.body)}
    </div>
  );
}

// ── DatePickerInput: custom toggle to avoid native indicator double-open bug ──
function DatePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = useRef(false);

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Keep focus on input → picker stays open
  };

  const handleButtonClick = () => {
    if (isOpen.current) {
      inputRef.current?.blur(); // Close picker
      isOpen.current = false;
    } else {
      (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
      isOpen.current = true;
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { isOpen.current = false; }}
        className="h-7 text-xs w-28 bg-background border border-input rounded-md px-2 pr-6 text-foreground
          [&::-webkit-calendar-picker-indicator]:hidden
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={handleButtonMouseDown}
        onClick={handleButtonClick}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Calendar className="h-3 w-3" />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── SuperadminPanel ─────────────────────────────────
// ═══════════════════════════════════════════════════════
const SUPERADMIN_MODULES: Array<{ key: SuperadminModuleKey; label: string; icon: React.ElementType; platform: 'eaisybill' | 'eaisybooks' }> = [
  // ── eaisybill ──
  { key: 'invoices',                 label: 'Számlák',            icon: FileText,       platform: 'eaisybill' },
  { key: 'nav_invoices',             label: 'NAV számlák',        icon: Landmark,       platform: 'eaisybill' },
  { key: 'transactions',             label: 'Tranzakciók',        icon: ArrowLeftRight, platform: 'eaisybill' },
  { key: 'gl_journal_entries',       label: 'Főkönyv',            icon: BookOpen,       platform: 'eaisybill' },
  { key: 'salary',                   label: 'Bér',                icon: Briefcase,      platform: 'eaisybill' },
  { key: 'petty_cash_entries',       label: 'Házipénztár',        icon: Wallet,         platform: 'eaisybill' },
  { key: 'categories',              label: 'Kategóriák',         icon: Tags,           platform: 'eaisybill' },
  { key: 'projects',                label: 'Projektek',          icon: FolderKanban,   platform: 'eaisybill' },
  { key: 'partners',                label: 'Partnertörzs',       icon: Users,          platform: 'eaisybill' },
  { key: 'fixed_assets',            label: 'TENY',               icon: Package2,       platform: 'eaisybill' },
  { key: 'shipments',               label: 'Fuvarok',            icon: Truck,          platform: 'eaisybill' },
  { key: 'annual_reports',          label: 'Beszámoló',          icon: FileSpreadsheet, platform: 'eaisybill' },
  { key: 'uploads',                  label: 'Feldolgozások',      icon: Upload,         platform: 'eaisybill' },
  { key: 'app_error_logs',           label: 'App hibák',          icon: AlertCircle,    platform: 'eaisybill' },
  // ── eaisyBooks ──
  { key: 'accounty_assignments',     label: 'Portfólió',          icon: Briefcase,      platform: 'eaisybooks' },
  { key: 'accounty_tax_profiles',    label: 'Adó profil',         icon: Scale,          platform: 'eaisybooks' },
  { key: 'accounty_missing_items',   label: 'Hiányzó dok.',       icon: ClipboardList,  platform: 'eaisybooks' },
  { key: 'accounty_deadlines',       label: 'Határidők',          icon: CalendarClock,  platform: 'eaisybooks' },
  { key: 'accounty_employees',       label: 'Alkalmazottak',      icon: HardHat,        platform: 'eaisybooks' },
  { key: 'accounty_payroll_cycles',  label: 'Bérszámfejtés',      icon: Coins,          platform: 'eaisybooks' },
  { key: 'accounty_filings',        label: 'Bevallások',         icon: ScrollText,     platform: 'eaisybooks' },
  { key: 'accounty_tao_yearly',     label: 'TAO',                icon: Landmark,       platform: 'eaisybooks' },
  { key: 'accounty_audit_log',      label: 'Audit napló',        icon: ShieldCheck,    platform: 'eaisybooks' },
  { key: 'accounty_documents',      label: 'Dokumentumok',       icon: FileText,       platform: 'eaisybooks' },
  { key: 'accounty_templates',      label: 'Sablonok',           icon: FileSpreadsheet, platform: 'eaisybooks' },
  { key: 'accounty_job_codes',      label: 'Jogviszonyok',       icon: BookOpen,       platform: 'eaisybooks' },
  { key: 'accounty_legal_updates',  label: 'Jogszabályok',       icon: Gavel,          platform: 'eaisybooks' },
];

const MODULE_COLUMNS: Record<SuperadminModuleKey, string[]> = {
  // eaisybill
  invoices:                ['kibocsatas_datuma', 'bizonylatsorszam', 'elado_nev', 'adoalap_osszesen', 'brutto_vegosszeg', 'invoice_type', 'invoice_direction', 'statusz'],
  nav_invoices:            ['invoice_issue_date', 'invoice_number', 'supplier_name', 'invoice_net_amount', 'invoice_gross_amount'],
  transactions:            ['transaction_date', 'amount', 'currency', 'description', 'type', 'match_type'],
  gl_journal_entries:      ['voucher_date', 'voucher_number', 'debit_account', 'credit_account', 'amount', 'partner_name'],
  salary:                  ['dátum', 'név', 'összeg', 'statusz', 'tipus'],
  petty_cash_entries:      ['entry_date', 'description', 'amount', 'currency', 'source_type'],
  categories:              ['name', 'icon', 'color', 'created_at'],
  projects:                ['name', 'project_code', 'project_type', 'client_name', 'status', 'budget', 'start_date', 'end_date'],
  partners:                ['name', 'tax_number', 'partner_type', 'email', 'address'],
  fixed_assets:            ['name', 'inventory_number', 'acquisition_value', 'purchase_date', 'status', 'depreciation_method'],
  shipments:               ['position_number', 'pickup_date', 'delivery_date', 'carrier_name', 'calculated_amount_huf', 'match_status'],
  annual_reports:          ['status', 'created_at', 'updated_at'],
  uploads:                 ['created_at', 'file_name', 'upload_type', 'processing_status', 'error_message'],
  app_error_logs:          ['created_at', 'component', 'error_type', 'message', 'severity'],
  // eaisyBooks
  accounty_assignments:    ['role', 'kanban_status', 'is_primary', 'is_main_accountant', 'assigned_at'],
  accounty_tax_profiles:   ['vat_frequency', 'contribution_frequency', 'is_kata', 'is_kiva', 'tax_group', 'has_payroll'],
  accounty_missing_items:  ['created_at', 'category', 'title', 'status', 'amount', 'item_date'],
  accounty_deadlines:      ['due_date', 'deadline_type', 'title', 'status', 'notes'],
  accounty_employees:      ['last_name', 'first_name', 'tax_id', 'birth_date', 'status'],
  accounty_payroll_cycles: ['year', 'month', 'status', 'current_step', 'created_at'],
  accounty_filings:        ['filing_type', 'period_year', 'period_month', 'status', 'channel', 'submitted_at'],
  accounty_tao_yearly:     ['tax_year', 'status', 'revenue', 'tax_base', 'calculated_tax', 'payable_tax'],
  accounty_audit_log:      ['created_at', 'user_name', 'action', 'entity_type', 'details'],
  accounty_documents:      ['title', 'doc_type', 'status', 'period', 'created_at'],
  accounty_templates:      ['name', 'category', 'is_active', 'version', 'updated_at'],
  accounty_job_codes:      ['code', 'name', 'is_insured', 'valid_from', 'is_active'],
  accounty_legal_updates:  ['title', 'source', 'published_at', 'implementation_status'],
};

const COL_LABELS: Record<string, string> = {
  // invoices (Hungarian column names)
  kibocsatas_datuma: 'Kelt', bizonylatsorszam: 'Bizonylat', elado_nev: 'Eladó',
  adoalap_osszesen: 'Nettó', brutto_vegosszeg: 'Bruttó', invoice_type: 'Típus',
  invoice_direction: 'Irány', statusz: 'Státusz', letrehozva: 'Létrehozva',
  // nav_invoices
  invoice_issue_date: 'Kiállítva', invoice_number: 'Számlasz.', supplier_name: 'Szállító',
  invoice_net_amount: 'Nettó', invoice_gross_amount: 'Bruttó', invoice_vat_amount: 'ÁFA',
  // transactions
  transaction_date: 'Dátum', amount: 'Összeg', currency: 'Deviza',
  description: 'Leírás', type: 'Típus', match_type: 'Párosítás',
  // gl_journal_entries
  voucher_date: 'Dátum', voucher_number: 'Bizonylat',
  debit_account: 'Tartozik szla', credit_account: 'Követel szla', partner_name: 'Partner',
  // salary (Hungarian)
  'dátum': 'Időszak', 'név': 'Alkalmazott', 'összeg': 'Összeg', tipus: 'Típus',
  // petty_cash_entries
  entry_date: 'Dátum', source_type: 'Forrás típusa',
  // categories / projects / partners
  name: 'Név', icon: 'Ikon', color: 'Szín',
  project_code: 'Kód', project_type: 'Típus', client_name: 'Ügyfél', budget: 'Költségkeret',
  start_date: 'Kezdés', end_date: 'Vég',
  tax_number: 'Adószám', partner_type: 'Partner típus', email: 'Email', address: 'Cím',
  // fixed_assets
  inventory_number: 'Leltári szám', acquisition_value: 'Bekerülési érték',
  purchase_date: 'Vásárlás', depreciation_method: 'Leírási mód',
  // shipments
  position_number: 'Pozíció', pickup_date: 'Felvétel', delivery_date: 'Kiszállítás',
  carrier_name: 'Fuvarozó', calculated_amount_huf: 'Összeg (HUF)',
  // uploads / errors
  created_at: 'Létrehozva', file_name: 'Fájlnév', upload_type: 'Feltöltés típusa',
  processing_status: 'Státusz', error_message: 'Hiba',
  updated_at: 'Módosítva',
  // app_error_logs
  component: 'Komponens', error_type: 'Hiba típus', message: 'Üzenetek', severity: 'Súlyosság', action: 'Akció',
  // eaisyBooks common
  category: 'Kategória', title: 'Megnevezés', status: 'Státusz', resolved_at: 'Megoldva',
  item_date: 'Dátum',
  due_date: 'Határidő', deadline_type: 'Típus', notes: 'Megjegyzés',
  first_name: 'Keresztnév', last_name: 'Vezetéknév', tax_id: 'Adóazonosító', birth_date: 'Születési dátum',
  year: 'Év', month: 'Hónap', current_step: 'Lépés',
  // accounty_assignments
  role: 'Szerep', kanban_status: 'Kanban', is_primary: 'Elsődleges', is_main_accountant: 'Fő könyvelő', assigned_at: 'Hozzárendelve',
  // accounty_tax_profiles
  vat_frequency: 'ÁFA gyakoriság', contribution_frequency: 'Járulék gyak.', is_kata: 'KATA', is_kiva: 'KIVA', tax_group: 'Adócsoport', has_payroll: 'Bérszámf.',
  nav_synced: 'NAV szinkr.',
  // accounty_filings
  filing_type: 'Bevallás típus', period_year: 'Év', period_month: 'Hónap', channel: 'Csatorna', submitted_at: 'Beküldve',
  // accounty_tao
  tax_year: 'Adóév', revenue: 'Árbevétel', tax_base: 'Adóalap', calculated_tax: 'Számított adó', payable_tax: 'Fizetendő adó', filing_status: 'Beadás státusz',
  // accounty_audit
  user_name: 'Felhasználó', entity_type: 'Entitás', details: 'Részletek',
  // accounty_documents
  doc_type: 'Dok. típus', period: 'Időszak',
  // accounty_templates
  is_active: 'Aktív', version: 'Verzió',
  // accounty_job_codes
  code: 'Kód', is_insured: 'Biztosított', valid_from: 'Érvényes',
  // accounty_legal_updates
  source: 'Forrás', published_at: 'Közzétéve', implementation_status: 'Implementáció', affected_modules: 'Érintett modulok',
};


const STATUS_KEYS = new Set(['processing_status', 'sync_status', 'matching_status', 'status']);

function fmtCell(key: string, val: unknown): React.ReactNode {
  if (val == null || val === '') return <span className="text-muted-foreground/40">—</span>;
  const s = String(val);
  if (STATUS_KEYS.has(key)) {
    const isOk = ['done', 'ok', 'matched', 'active', 'completed', 'processed', 'synced'].includes(s.toLowerCase());
    const isPending = ['pending', 'processing', 'in_progress'].includes(s.toLowerCase());
    const isErr = ['error', 'failed', 'unmatched'].includes(s.toLowerCase());
    const cls = isOk
      ? 'bg-success/15 text-success border-success/25'
      : isPending
        ? 'bg-warning/15 text-warning border-warning/25'
        : isErr
          ? 'bg-destructive/15 text-destructive border-destructive/25'
          : 'bg-muted text-muted-foreground border-border';
    return <Badge className={`${cls} text-[10px] px-1.5 py-0 font-semibold`}>{s}</Badge>;
  }
  // Date formatting
  if (/date|created_at|resolved_at|due_date|item_date/.test(key) && s.includes('T')) {
    return s.slice(0, 10);
  }
  // Amount formatting
  if (/amount|gross|net|balance|credit|debit|total/.test(key) && !isNaN(Number(val))) {
    return <span className="tabular-nums">{Number(val).toLocaleString('hu-HU')} Ft</span>;
  }
  // Truncate long strings
  if (s.length > 50) return <span title={s}>{s.slice(0, 48)}…</span>;
  return s;
}

function SuperadminPanel({ overview }: { overview: OverviewData | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ── Show toast on return from support mode exit ─────────────────
  useEffect(() => {
    if (searchParams.get('exit_toast') === '1') {
      toast({ title: 'Support mód befejezve', description: 'Sikeresen visszatértél a management nézetbe.' });
      // Clean up the exit_toast param from URL
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('exit_toast');
        return next;
      }, { replace: true });
    }
  }, []); // Run once on mount

  // ── URL-derived state (shareable / bookmarkable) ─────────────────
  const mode            = (searchParams.get('sa_mode') as 'company' | 'user') ?? 'company';
  const selectedCompanyId = searchParams.get('sa_company') || null;
  const selectedUserId    = searchParams.get('sa_user') || null;
  const activeModule      = (searchParams.get('sa_tab') as SuperadminModuleKey) ?? 'invoices';

  // ── Helpers: update URL while preserving existing params ─────────
  const setUrlParam = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v == null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');

  // ── Company mode: filter companies by name/tax_number ──
  const filteredCompanies = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return overview?.companies ?? [];
    return (overview?.companies ?? []).filter(c =>
      c.name.toLowerCase().includes(q) || (c.tax_number || '').includes(q)
    );
  }, [overview?.companies, searchQ]);

  // ── User mode: filter users by name/email ──
  const filteredUsers = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return overview?.users ?? [];
    return (overview?.users ?? []).filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [overview?.users, searchQ]);

  // ── User mode: companies belonging to selected user ──
  const userCompanies = useMemo(() => {
    if (!selectedUserId) return [];
    const user = overview?.users.find(u => u.user_id === selectedUserId);
    if (!user) return [];
    const ids = new Set(user.companies.map(c => c.id));
    return (overview?.companies ?? []).filter(c => ids.has(c.id));
  }, [selectedUserId, overview]);

  const selectedUser = overview?.users.find(u => u.user_id === selectedUserId);
  const selectedCompany = overview?.companies.find(c => c.id === selectedCompanyId);

  // ── Module data query (params built inside queryFn to avoid stale closure) ──
  const { data: moduleData, isFetching } = useQuery<SuperadminModuleData>({
    queryKey: ['superadmin-module', selectedCompanyId, activeModule, page, dateFrom, dateTo, moduleSearch],
    queryFn: () => {
      const p: Record<string, string> = {
        companyId: selectedCompanyId!,
        module: activeModule,
        page: String(page),
        pageSize: '25',
      };
      if (dateFrom) p.dateFrom = dateFrom;
      if (dateTo) p.dateTo = dateTo;
      if (moduleSearch) p.search = moduleSearch;
      return fetchManagementData('superadmin-module-data', p);
    },
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
    retry: false,
  });

  const totalPages = moduleData ? Math.ceil(moduleData.totalCount / 25) : 0;
  const cols = MODULE_COLUMNS[activeModule] ?? [];
  const modDef = SUPERADMIN_MODULES.find(m => m.key === activeModule);

  function handleSelectCompany(id: string) {
    // In user mode, preserve the selected user so the left panel keeps showing their companies
    setUrlParam({ sa_company: id, ...(mode === 'user' ? {} : { sa_user: null }) });
    setPage(1); setDateFrom(''); setDateTo(''); setModuleSearch('');
  }

  function handleSelectUser(userId: string) {
    const next = userId === selectedUserId ? null : userId;
    setUrlParam({ sa_user: next, sa_company: null });
    setPage(1); setDateFrom(''); setDateTo(''); setModuleSearch('');
  }

  function handleModuleSwitch(key: SuperadminModuleKey) {
    setUrlParam({ sa_tab: key });
    setPage(1); setModuleSearch('');
  }

  // Left panel: what to render in the list
  const isUserMode = mode === 'user';
  // In user mode, if a user is selected show their companies; otherwise show filtered users
  const showUserList = isUserMode && !selectedUserId;
  const showUserCompanies = isUserMode && !!selectedUserId;

  // ── Impersonation state ──
  const [impersonating, setImpersonating] = useState(false);

  // Check for active impersonation sessions
  const { data: activeImpersonation } = useQuery({
    queryKey: ['active-impersonation'],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('role', 'support_admin' as any)
        .limit(1)
        .maybeSingle();
      return data as { company_id: string } | null;
    },
    refetchInterval: 30_000,
  });

  const handleImpersonate = useCallback(async (companyId: string, companyName: string) => {
    setImpersonating(true);
    try {
      const { data, error } = await supabase.functions.invoke('impersonate-company', {
        body: { action: 'start', companyId },
      });

      if (error) throw new Error(error.message);

      // Navigate to eaisybill view on the same tab
      const url = `/${companyId}/this-month/invoices`;
      window.location.href = url;

      // Refresh the active impersonation query
      queryClient.invalidateQueries({ queryKey: ['active-impersonation'] });

    } catch (err) {
      reportError({
        type: 'api_call',
        component: 'SuperadminPanel',
        action: 'impersonation_start',
        message: `Failed to start impersonation for ${companyName}`,
        error: err,
      });
    } finally {
      setImpersonating(false);
    }
  }, [queryClient]);

  const handleStopImpersonation = useCallback(async (companyId: string) => {
    try {
      await supabase.functions.invoke('impersonate-company', {
        body: { action: 'stop', companyId },
      });
      queryClient.invalidateQueries({ queryKey: ['active-impersonation'] });
    } catch (err) {
      reportError({
        type: 'api_call',
        component: 'SuperadminPanel',
        action: 'impersonation_stop',
        message: 'Failed to stop impersonation',
        error: err,
      });
    }
  }, [queryClient]);

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      {/* ── Left panel: company list ── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/20">
        {/* Search + mode toggle */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => { setUrlParam({ sa_mode: 'company', sa_user: null, sa_company: null }); setSearchQ(''); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'company' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              }`}
            ><Building2 className="h-3.5 w-3.5" /> Cég</button>
            <button
              onClick={() => { setUrlParam({ sa_mode: 'user', sa_user: null, sa_company: null }); setSearchQ(''); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'user' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              }`}
            ><User className="h-3.5 w-3.5" /> Felhasználó</button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); }}
              placeholder={mode === 'company' ? 'Cég neve, adószám…' : 'Email, név…'}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {!overview ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : showUserList ? (
            // ── User list ──
            filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Nincs találat</div>
            ) : filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => handleSelectUser(u.user_id)}
                className="w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50"
              >
                <div className="text-sm font-semibold truncate">{u.name || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{u.email}</div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" /> {u.companies.length} cég</span>
                </div>
              </button>
            ))
          ) : showUserCompanies ? (
            // ── Selected user's companies ──
            <>
              <button
                onClick={() => handleSelectUser(selectedUserId!)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-xs text-primary hover:bg-primary/10 border-b border-border transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Vissza ({selectedUser?.name || selectedUser?.email})
              </button>
              {userCompanies.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">Ennek a felhasználónak nincs cége</div>
              ) : userCompanies.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 ${
                    selectedCompanyId === c.id ? 'bg-primary/10 border-l-2 border-l-primary pl-[10px]' : ''
                  }`}
                >
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.tax_number || '—'}</div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" /> {c.invoiceCount}</span>
                    <span className="flex items-center gap-0.5"><CreditCard className="h-3 w-3" /> {c.transactionCount}</span>
                    <span className="flex items-center gap-0.5"><Landmark className="h-3 w-3" /> {c.navInvoiceCount}</span>
                  </div>
                </button>
              ))}
            </>
          ) : (
            // ── Company list (company mode) ──
            filteredCompanies.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Nincs találat</div>
            ) : filteredCompanies.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectCompany(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 ${
                  selectedCompanyId === c.id ? 'bg-primary/10 border-l-2 border-l-primary pl-[10px]' : ''
                }`}
              >
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.tax_number || '—'}</div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" /> {c.invoiceCount}</span>
                  <span className="flex items-center gap-0.5"><CreditCard className="h-3 w-3" /> {c.transactionCount}</span>
                  <span className="flex items-center gap-0.5"><Landmark className="h-3 w-3" /> {c.navInvoiceCount}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedCompanyId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Building2 className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Válassz egy céget a bal oldali listából</p>
          </div>
        ) : (
          <>
            {/* Company header */}
            <div className="px-5 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">{selectedCompany?.name ?? '…'}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{selectedCompany?.tax_number || '—'}</span>
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      {selectedCompany?.members.length ?? 0} tag
                    </Badge>
                    <Badge className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-success/20">eaisybill</Badge>
                    {selectedCompany?.hasEaisyBooks && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-info/10 text-info border-info/20">eaisyBooks</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* ★ Impersonate button ★ */}
                  {activeImpersonation?.company_id === selectedCompanyId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => handleStopImpersonation(selectedCompanyId!)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Support mód aktív — Leállítás
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border-0"
                      onClick={() => selectedCompanyId && selectedCompany && handleImpersonate(selectedCompanyId, selectedCompany.name)}
                      disabled={impersonating || !!activeImpersonation}
                    >
                      {impersonating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {impersonating ? 'Csatlakozás...' : 'Megtekintés felhasználóként'}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUrlParam({ sa_company: null, sa_user: null })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Module nav — two platform rows */}
            <div className="border-b border-border">
              {/* ── eaisybill row ── */}
              <div className="flex items-center gap-0 border-b border-border/40 overflow-x-auto">
                <span className="shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-success bg-success/5 border-r border-border/40 select-none">
                  eaisybill
                </span>
                <div className="flex min-w-max">
                  {SUPERADMIN_MODULES.filter(m => m.platform === 'eaisybill').map(m => (
                    <button
                      key={m.key}
                      onClick={() => handleModuleSwitch(m.key)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
                        activeModule === m.key
                          ? 'bg-success/10 text-success border-b-2 border-success'
                          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* ── eaisyBooks row ── */}
              <div className={`flex items-center gap-0 overflow-x-auto transition-opacity ${
                selectedCompany?.hasEaisyBooks ? '' : 'opacity-30 pointer-events-none'
              }`}>
                <span className="shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-info bg-info/5 border-r border-border/40 select-none">
                  eaisyBooks
                </span>
                <div className="flex min-w-max">
                  {SUPERADMIN_MODULES.filter(m => m.platform === 'eaisybooks').map(m => (
                    <button
                      key={m.key}
                      onClick={() => handleModuleSwitch(m.key)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
                        activeModule === m.key
                          ? 'bg-info/10 text-info border-b-2 border-info'
                          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
                {!selectedCompany?.hasEaisyBooks && (
                  <span className="shrink-0 ml-auto pr-3 text-[10px] text-muted-foreground/60 italic select-none">
                    Nem elérhető
                  </span>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={moduleSearch}
                  onChange={e => { setModuleSearch(e.target.value); setPage(1); }}
                  placeholder="Keresés…"
                  className="pl-6 h-7 text-xs w-36 bg-background"
                />
              </div>
              <DatePickerInput value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
              <span className="text-muted-foreground text-xs">—</span>
              <DatePickerInput value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />


              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
                {modDef && <modDef.icon className="h-3.5 w-3.5" />}
                <strong className="text-foreground">{moduleData?.totalCount ?? '…'}</strong> rekord
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs" role="table">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr className="border-b border-border">
                    {cols.map(col => (
                      <th key={col} className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide whitespace-nowrap">
                        {COL_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isFetching ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {cols.map(col => (
                          <td key={col} className="py-2.5 px-3">
                            <Skeleton className={`h-3.5 ${col.includes('date') || col === 'amount' || col === 'year' || col === 'month' ? 'w-20' : col.includes('name') || col.includes('description') || col === 'message' ? 'w-40' : 'w-full'}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (moduleData?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="py-12 text-center text-muted-foreground">
                        Nincs adat ehhez a modulhoz
                      </td>
                    </tr>
                  ) : (moduleData?.rows ?? []).map((row, i) => (
                    <tr key={i} className="hover:bg-accent/40 transition-colors">
                      {cols.map(col => (
                        <td key={col} className="py-2 px-3 max-w-[200px] truncate">
                          {fmtCell(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
                <span className="text-xs text-muted-foreground">
                  {(page - 1) * 25 + 1}–{Math.min(page * 25, moduleData?.totalCount ?? 0)} / {moduleData?.totalCount} rekord
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon"
                        className="h-7 w-7 text-xs" onClick={() => setPage(p)}>{p}</Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
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
  const urlView = searchParams.get('view') as 'company' | 'user' | 'errors' | 'permissions' | 'files' | 'superadmin' | 'tickets' | null;
  const urlId = searchParams.get('id');
  const hasSuperadminParams = !!searchParams.get('sa_company') || !!searchParams.get('sa_mode');
  const view: 'overview' | 'company' | 'user' | 'errors' | 'permissions' | 'files' | 'superadmin' | 'tickets' =
    hasSuperadminParams
      ? 'superadmin'
      : (urlView === 'company' || urlView === 'user' || urlView === 'errors' || urlView === 'permissions' || urlView === 'files' || urlView === 'superadmin' || urlView === 'tickets')
        ? urlView
        : 'overview';
  const selectedCompanyId = view === 'company' ? urlId : null;
  const selectedUserId = view === 'user' ? urlId : null;

  const [searchUser, setSearchUser] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(0);
  const USER_PAGE_SIZE = 15;

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

  // Reset user page when search changes
  useEffect(() => { setUserPage(0); }, [searchUser]);

  const userTotalPages = Math.ceil(filteredUsers.length / USER_PAGE_SIZE);
  const paginatedUsers = useMemo(() =>
    filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE)
  , [filteredUsers, userPage]);

  const selectedCompanyName = overview?.companies.find(c => c.id === selectedCompanyId)?.name;
  const selectedUserObj = overview?.users.find(u => u.user_id === selectedUserId);

  // ── Navigation (stable refs) ────────────────────
  const openCompany = useCallback((id: string) => { setSearchParams({ view: 'company', id }); }, [setSearchParams]);
  const openUser = useCallback((userId: string) => { setSearchParams({ view: 'user', id: userId }); }, [setSearchParams]);
  const openErrors = useCallback(() => { setSearchParams({ view: 'errors' }); }, [setSearchParams]);
  const openSuperadmin = useCallback(() => { setSearchParams({ view: 'superadmin' }); }, [setSearchParams]);
  const openTickets = useCallback(() => { setSearchParams({ view: 'tickets' }); }, [setSearchParams]);
  const goBack = useCallback(() => { setSearchParams({}); }, [setSearchParams]);

  // Auth guard — MUST be after all hooks to satisfy Rules of Hooks
  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  // ── Title / subtitle derivation ─────────────────────
  const title = view === 'overview'
    ? 'Management Dashboard'
    : (view === 'errors' || view === 'permissions' || view === 'files')
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
    : (view === 'errors' || view === 'permissions' || view === 'superadmin' || view === 'files')
      ? 'Hibák, jogosultságok és adatnézet'
      : view === 'tickets'
        ? 'Beérkezett ügyfél hibajegyek és support csevegés'
        : view === 'company'
          ? 'Cég részletes adatai'
          : (selectedUserObj?.email || '');

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* ── Header (sticky, backdrop-blur, border-b) ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4 relative">
          <div className="flex items-center gap-3">
            {(view === 'company' || view === 'user') && (
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

        {/* ── Főnavigáció tab bar (áttekintés + control center + tickets) ── */}
        {(view === 'overview' || view === 'errors' || view === 'permissions' || view === 'files' || view === 'superadmin' || view === 'tickets') && (
          <div className="border-t border-border/40">
            <nav className="max-w-7xl mx-auto px-6 flex items-center gap-0.5 py-1.5" aria-label="Főnavigáció">
              <button
                onClick={goBack}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  view === 'overview'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                }`}
                aria-current={view === 'overview' ? 'page' : undefined}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Áttekintés
              </button>
              <button
                onClick={openErrors}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  view === 'errors' || view === 'permissions' || view === 'files'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                }`}
                aria-current={view === 'errors' || view === 'permissions' || view === 'files' ? 'page' : undefined}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Control Center
              </button>
              <button
                onClick={openSuperadmin}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  view === 'superadmin'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                }`}
                aria-current={view === 'superadmin' ? 'page' : undefined}
              >
                <Zap className="h-3.5 w-3.5" />
                Superadmin
              </button>
              <button
                onClick={openTickets}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  view === 'tickets'
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-transparent'
                }`}
                aria-current={view === 'tickets' ? 'page' : undefined}
              >
                <TicketCheck className="h-3.5 w-3.5" />
                Hibajegyek
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* ═══ SUPERADMIN — full-height, outside the scroll wrapper ═══ */}
      {view === 'superadmin' && (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 animate-in fade-in duration-300">
          <SuperadminPanel overview={overview} />
        </div>
      )}

      {/* ═══ TICKETS — full-height/scrollable support console ═══ */}
      {view === 'tickets' && (
        <div className="flex-1 overflow-y-auto">
          <main className="w-full max-w-7xl mx-auto px-6 py-8">
            <TicketsPage embeddedInManagement={true} />
          </main>
        </div>
      )}

      {/* ═══ Normal scrollable content (overview / errors / permissions / files / company / user) ═══ */}
      {view !== 'superadmin' && view !== 'tickets' && (
      <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
      <main className="w-full max-w-7xl mx-auto px-6 py-8">
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
                <StatCard icon={Trophy} label="Legdrágább cég" value="..." loading sub="..." />
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

              {overviewLoading ? (
                <StatCard icon={AlertTriangle} label="Feldolgozási hibák" value="..." loading />
              ) : (
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
                        {(overview as any)?.totalErrors ?? '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">Feldolgozási hibák</p>
                    </div>
                  </CardContent>
                </Card>
              )}
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
                  <table className="w-full text-sm" role="table" style={{ tableLayout: 'fixed' }}>
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                        <th className="text-left py-3 px-5 font-medium" style={{ width: 40 }}></th>
                        <th className="text-left py-3 px-2 font-medium">Név</th>
                        <th className="text-center py-3 px-4 font-medium" style={{ width: 80 }}>Cégek</th>
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
                      ) : paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-8 text-muted-foreground text-sm">Nincs találat</td>
                        </tr>
                      ) : paginatedUsers.map(u => {
                        const isExpanded = expandedUserId === u.user_id;
                        return (
                          <React.Fragment key={u.user_id}>
                            <tr
                              onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                              className="cursor-pointer hover:bg-accent/50 active:bg-accent/70
                                         transition-colors duration-150 group h-[52px]"
                              role="button"
                              tabIndex={0}
                              aria-expanded={isExpanded}
                              aria-label={`${u.name || u.email} kibontása`}
                              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedUserId(isExpanded ? null : u.user_id); } }}
                            >
                              <td className="py-3 px-5 w-8">
                                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </td>
                              <td className="py-3 px-2 overflow-hidden">
                                <div>
                                  <span className="font-medium text-foreground group-hover:text-primary transition-colors duration-150 block truncate">
                                    {u.name || 'N/A'}
                                  </span>
                                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
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
                      {!overviewLoading && paginatedUsers.length > 0 && paginatedUsers.length < USER_PAGE_SIZE &&
                        Array.from({ length: USER_PAGE_SIZE - paginatedUsers.length }).map((_, i) => (
                          <tr key={`empty-${i}`} className="pointer-events-none">
                            <td className="py-3 px-5">&nbsp;</td>
                            <td className="py-3 px-2 overflow-hidden">
                              <div>
                                <span className="block text-sm invisible">&nbsp;</span>
                                <p className="text-xs invisible">&nbsp;</p>
                              </div>
                            </td>
                            <td className="py-3 px-4"></td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
                {!overviewLoading && userTotalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-2.5 border-t border-border">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {filteredUsers.length === 0 ? '0' : `${userPage * USER_PAGE_SIZE + 1}–${Math.min((userPage + 1) * USER_PAGE_SIZE, filteredUsers.length)} / ${filteredUsers.length}`}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={userPage === 0}
                        onClick={() => setUserPage(p => p - 1)} aria-label="Előző oldal">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground tabular-nums px-2">{userPage + 1}/{userTotalPages}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={userPage >= userTotalPages - 1}
                        onClick={() => setUserPage(p => p + 1)} aria-label="Következő oldal">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
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

        {/* ═══ CONTROL CENTER ═══ */}
        {(view === 'errors' || view === 'permissions' || view === 'files') && (
          <ControlCenter initialTab={view as 'errors' | 'permissions' | 'files'} onOpenCompany={openCompany} allUsers={overview?.users || []} />
        )}
      </main>
      </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Control Center (tabs: Hibák / Jogosultságok) ────
// ═══════════════════════════════════════════════════════
type ControlCenterTab = 'errors' | 'permissions' | 'files';

interface ControlCenterUser {
  user_id: string;
  name: string;
  email: string;
}

function ControlCenter({ initialTab, onOpenCompany, allUsers }: { initialTab: ControlCenterTab; onOpenCompany: (id: string) => void; allUsers: ControlCenterUser[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = initialTab;

  const setTab = (newTab: ControlCenterTab) => {
    setSearchParams({ view: newTab });
  };

  return (
    <div className="space-y-6 page-animate overflow-hidden">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-xl w-fit border border-border/50">
        <button
          onClick={() => setTab('errors')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border
            ${tab === 'errors'
              ? 'bg-background text-foreground shadow-sm border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
            }`}
          style={{ minWidth: 110 }}
        >
          <AlertTriangle className="h-4 w-4" />
          Hibák
        </button>
        <button
          onClick={() => setTab('permissions')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border
            ${tab === 'permissions'
              ? 'bg-background text-foreground shadow-sm border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
            }`}
          style={{ minWidth: 155 }}
        >
          <ShieldCheck className="h-4 w-4" />
          Jogosultságok
        </button>
        <button
          onClick={() => setTab('files')}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border
            ${tab === 'files'
              ? 'bg-background text-foreground shadow-sm border-border/60'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
            }`}
          style={{ minWidth: 110 }}
        >
          <FolderOpen className="h-4 w-4" />
          Fájlok
        </button>
      </div>

      {/* Tab content — ensures all tabs fill the same width to prevent layout shift */}
      <div className="w-full overflow-hidden">
        <div className="w-full" style={{ minWidth: 900 }}>
          {tab === 'errors' && <ErrorControlPanel onOpenCompany={onOpenCompany} />}
          {tab === 'permissions' && <PermissionsPanel allUsers={allUsers} />}
          {tab === 'files' && <FilesPanel allUsers={allUsers} />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Files Panel ──────────────────────────────────────
// ═══════════════════════════════════════════════════════
interface FileRow {
  id: string;
  source_table: string;
  file_type_label: string;
  company_id: string | null;
  company_name: string | null;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  file_url: string | null;
  upload_status: string | null;
  processing_status: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string | null;
}

interface FilesData {
  totalRows: number;
  files: FileRow[];
  stats: {
    totalCount: number;
    successCount: number;
    errorCount: number;
    pendingCount: number;
  };
}

type FileSortCol = 'created_at' | 'file_name' | 'file_size' | 'company_name' | 'user_name' | 'processing_status';

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileExtBadge(fileName: string) {
  const ext = (fileName.split('.').pop() || '').toUpperCase();
  const colors: Record<string, string> = {
    PDF: 'bg-destructive/10 text-destructive border-destructive/25',
    XML: 'bg-warning/10 text-warning border-warning/25',
    CSV: 'bg-success/10 text-success border-success/25',
    XLSX: 'bg-info/10 text-info border-info/25',
  };
  const cls = colors[ext] || 'bg-muted text-muted-foreground border-border';
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold font-mono ${cls}`}>{ext || '?'}</span>;
}

function processingStatusBadge(status: string | null) {
  if (!status) return <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>;
  const map: Record<string, string> = {
    done: 'bg-success/10 text-success border-success/25',
    completed: 'bg-success/10 text-success border-success/25',
    error: 'bg-destructive/10 text-destructive border-destructive/25',
    failed: 'bg-destructive/10 text-destructive border-destructive/25',
    processing: 'bg-warning/10 text-warning border-warning/25',
    pending: 'bg-muted text-muted-foreground border-border',
  };
  const labels: Record<string, string> = {
    done: 'kész', 
    completed: 'kész',
    error: 'hiba', 
    failed: 'hiba',
    processing: 'folyamat', 
    pending: 'várakozik',
    ignored: 'kihagyva',
    processed: 'feldolgozva'
  };
  const cls = map[status] || 'bg-muted text-muted-foreground border-border';
  return <Badge className={`text-[10px] border ${cls} w-20 justify-center`}>{labels[status] || status}</Badge>;
}

function fileTypeBadge(label: string, sourceTable: string) {
  const colors: Record<string, string> = {
    invoice: 'bg-primary/10 text-primary border-primary/25',
    transaction: 'bg-info/10 text-info border-info/25',
    bank: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    report: 'bg-warning/10 text-warning border-warning/25',
  };
  const cls = colors[sourceTable] || 'bg-muted text-muted-foreground border-border';
  return <Badge className={`text-[10px] border ${cls} w-20 justify-center`}>{label}</Badge>;
}

function FilesPanel({ allUsers }: { allUsers: ControlCenterUser[] }) {
  const PAGE_SIZE = 25;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortCol, setSortCol] = useState<FileSortCol>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [filterCompanyId, setFilterCompanyId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [filterFileType, setFilterFileType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string } | null>(null);
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  // Debounce search
  const searchTimerRef = useCallback((val: string) => {
    const t = setTimeout(() => setDebouncedSearch(val), 300);
    return () => clearTimeout(t);
  }, []);
  useMemo(() => searchTimerRef(search), [search, searchTimerRef]);

  const toggleSort = useCallback((col: FileSortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
    setPage(1);
  }, [sortCol]);

  const { data, isLoading, isFetching } = useQuery<FilesData>({
    queryKey: ['management-files', page, PAGE_SIZE, sortCol, sortDir, debouncedSearch, filterCompanyId, filterUserId, filterFileType, filterStatus, dateFrom, dateTo],
    queryFn: () => fetchManagementData('files', {
      page: String(page), pageSize: String(PAGE_SIZE),
      sortBy: sortCol, sortDir,
      search: debouncedSearch,
      companyId: filterCompanyId,
      userId: filterUserId,
      fileType: filterFileType,
      status: filterStatus,
      dateFrom, dateTo,
    }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const fileRows = data?.files || [];
  const totalRows = data?.totalRows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const stats = data?.stats;

  const SortIcon = ({ col }: { col: FileSortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="h-3 w-3 opacity-40 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 text-primary ml-1 inline" />
      : <ArrowDown className="h-3 w-3 text-primary ml-1 inline" />;
  };

  // Build company options from allUsers (deduped companies)
  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of allUsers) {
      for (const c of (u as any).companies || []) {
        if (c.id && !seen.has(c.id)) seen.set(c.id, c.name);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allUsers]);

  // User options filtered by company
  const userOptions = useMemo(() => {
    if (!filterCompanyId) return allUsers;
    return allUsers.filter((u: any) => u.companies?.some((c: any) => c.id === filterCompanyId));
  }, [allUsers, filterCompanyId]);

  const resetFilters = () => {
    setSearch(''); setDebouncedSearch('');
    setFilterCompanyId(''); setFilterUserId('');
    setFilterFileType(''); setFilterStatus('');
    setDateFrom(''); setDateTo('');
    setPage(1);
  };

  const hasActiveFilters = search || filterCompanyId || filterUserId || filterFileType || filterStatus || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                {isFetching ? <Skeleton className="h-7 w-12" /> : <p className="text-xl font-bold tabular-nums">{(stats?.totalCount ?? totalRows)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">Összes fájl</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-success/10 border border-success/20 shrink-0">
              <Check className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                {isFetching ? <Skeleton className="h-7 w-12" /> : <p className="text-xl font-bold tabular-nums text-success">{(stats?.successCount ?? 0)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">Sikeresen feldolgozva</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                {isFetching ? <Skeleton className="h-7 w-12" /> : <p className="text-xl font-bold tabular-nums text-destructive">{(stats?.errorCount ?? 0)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">Feldolgozási hiba</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-warning/10 border border-warning/20 shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                {isFetching ? <Skeleton className="h-7 w-12" /> : <p className="text-xl font-bold tabular-nums text-warning">{(stats?.pendingCount ?? 0)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">Folyamatban</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Fájlnév keresése…"
                className="pl-8 h-8 text-xs w-52 bg-background"
                id="files-search"
              />
            </div>

            {/* Company Search Combobox */}
            <Popover open={companySearchOpen} onOpenChange={setCompanySearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={companySearchOpen}
                  className="h-8 text-xs justify-between min-w-[180px] font-normal"
                >
                  <span className="truncate">
                    {filterCompanyId
                      ? companyOptions.find((c) => c[0] === filterCompanyId)?.[1]
                      : "Minden cég"}
                  </span>
                  <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cég keresése..." className="h-8" />
                  <CommandList>
                    <CommandEmpty>Nincs találat.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setFilterCompanyId("");
                          setFilterUserId("");
                          setPage(1);
                          setCompanySearchOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            filterCompanyId === "" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Minden cég
                      </CommandItem>
                      {companyOptions.map(([id, name]) => (
                        <CommandItem
                          key={id}
                          value={name}
                          onSelect={() => {
                            setFilterCompanyId(id);
                            setFilterUserId("");
                            setPage(1);
                            setCompanySearchOpen(false);
                          }}
                          className="text-xs"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3 w-3",
                              filterCompanyId === id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* User Search Combobox */}
            <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={userSearchOpen}
                  className="h-8 text-xs justify-between min-w-[180px] font-normal"
                >
                  <span className="truncate">
                    {filterUserId
                      ? userOptions.find((u) => u.user_id === filterUserId)?.name || 
                        userOptions.find((u) => u.user_id === filterUserId)?.email
                      : "Minden felhasználó"}
                  </span>
                  <ChevronDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Felhasználó keresése..." className="h-8" />
                  <CommandList>
                    <CommandEmpty>Nincs találat.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value=""
                        onSelect={() => {
                          setFilterUserId("");
                          setPage(1);
                          setUserSearchOpen(false);
                        }}
                        className="text-xs"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3 w-3",
                            filterUserId === "" ? "opacity-100" : "opacity-0"
                          )}
                        />
                        Minden felhasználó
                      </CommandItem>
                      {userOptions.map((u) => (
                        <CommandItem
                          key={u.user_id}
                          value={u.name || u.email || ""}
                          onSelect={() => {
                            setFilterUserId(u.user_id);
                            setPage(1);
                            setUserSearchOpen(false);
                          }}
                          className="text-xs"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-3 w-3",
                              filterUserId === u.user_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {u.name || u.email}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {/* File type filter */}
            <select
              value={filterFileType}
              onChange={e => { setFilterFileType(e.target.value); setPage(1); }}
              className="h-8 text-xs bg-background border border-input rounded-md px-2 text-foreground"
              id="files-type-filter"
            >
              <option value="">Minden típus</option>
              <option value="invoice">📄 Számla</option>
              <option value="transaction">💳 Tranzakció</option>
              <option value="bank">🏦 Bankkivonat</option>
              <option value="report">📊 Riport</option>
            </select>

            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="h-8 text-xs bg-background border border-input rounded-md px-2 text-foreground"
              id="files-status-filter"
            >
              <option value="">Minden állapot</option>
              <option value="done">✓ Kész</option>
              <option value="error">✗ Hiba</option>
              <option value="processing">⏳ Folyamat</option>
              <option value="pending">⏳ Várakozik</option>
            </select>

            {/* Date range */}
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1); }}
              className="h-8 text-xs bg-background w-36"
              id="files-date-from"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1); }}
              className="h-8 text-xs bg-background w-36"
              id="files-date-to"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
                Szűrők törlése
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {isLoading ? <Skeleton className="h-4 w-16 inline-block" /> : `${totalRows} rekord`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                  <th className="text-left py-2.5 px-4 font-medium w-10"></th>
                  <th className="text-left py-2.5 px-2 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('file_name')}>
                    Fájlnév <SortIcon col="file_name" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium">Típus</th>
                  <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('company_name')}>
                    Cég <SortIcon col="company_name" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('user_name')}>
                    User <SortIcon col="user_name" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('created_at')}>
                    Feltöltve <SortIcon col="created_at" />
                  </th>
                  <th className="text-right py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('file_size')}>
                    Méret <SortIcon col="file_size" />
                  </th>
                  <th className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-foreground" onClick={() => toggleSort('processing_status')}>
                    Állapot <SortIcon col="processing_status" />
                  </th>
                  <th className="text-right py-2.5 px-4 font-medium">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-8" /></td>
                      <td className="py-3 px-2"><Skeleton className="h-4 w-48" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-3 text-right"><Skeleton className="h-4 w-14 ml-auto" /></td>
                      <td className="py-3 px-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="py-3 px-4"></td>
                    </tr>
                  ))
                ) : fileRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nincs találat
                    </td>
                  </tr>
                ) : fileRows.map(row => {
                  const isExpanded = expandedId === row.id;
                  return (
                    <React.Fragment key={`${row.source_table}-${row.id}`}>
                      <tr
                        className={`hover:bg-accent/40 transition-colors duration-150 cursor-pointer ${isExpanded ? 'bg-accent/20' : ''}`}
                        onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        role="button"
                        tabIndex={0}
                        aria-expanded={isExpanded}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(isExpanded ? null : row.id); } }}
                      >
                        <td className="py-2.5 px-4">
                          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                        <td className="py-2.5 px-2 max-w-[220px]">
                          <div className="flex items-center gap-2">
                            {fileExtBadge(row.file_name)}
                            <span className="text-xs font-medium truncate" title={row.file_name}>{row.file_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          {fileTypeBadge(row.file_type_label, row.source_table)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="text-xs text-foreground">{row.company_name || '—'}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {row.user_name ? (
                            <button 
                              className="text-foreground hover:text-primary transition-colors text-left truncate max-w-[120px] block text-[11px] font-bold"
                              onClick={e => { e.stopPropagation(); if (row.user_id) { setFilterUserId(row.user_id); setPage(0); } }}
                              title={`Szűrés: ${row.user_name}`}
                            >
                              {row.user_name}
                            </button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                          {formatFileSize(row.file_size)}
                        </td>
                        <td className="py-2.5 px-3">
                          {processingStatusBadge(row.processing_status)}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex justify-end gap-1">
                            {row.file_url && (
                              <>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Megtekintés"
                                  onClick={e => { e.stopPropagation(); setPreviewFile({ url: row.file_url!, name: row.file_name }); }}
                                  aria-label="Megtekintés"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Letöltés"
                                  onClick={async (e) => { 
                                    e.stopPropagation(); 
                                    try {
                                      const response = await fetch(row.file_url!);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = row.file_name;
                                      document.body.appendChild(a);
                                      a.click();
                                      window.URL.revokeObjectURL(url);
                                      document.body.removeChild(a);
                                    } catch (err) {
                                      window.open(row.file_url!, '_blank');
                                    }
                                  }}
                                  aria-label="Letöltés"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row: error message + details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-0">
                            <div className="bg-muted/20 border-t border-border/50 px-10 py-3 animate-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 text-xs">
                                <div><span className="text-muted-foreground">Forrástábla: </span><span className="font-mono">{row.source_table}_uploads</span></div>
                                <div><span className="text-muted-foreground">Upload státusz: </span><span>{row.upload_status || '—'}</span></div>
                                <div><span className="text-muted-foreground">MIME típus: </span><span className="font-mono">{row.file_type || '—'}</span></div>
                                <div><span className="text-muted-foreground">Frissítve: </span><span>{row.updated_at ? new Date(row.updated_at).toLocaleString('hu-HU') : '—'}</span></div>
                              </div>
                              {row.error_message && (
                                <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/8 border border-destructive/20 px-3 py-2">
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                                  <span className="text-xs text-destructive">{row.error_message}</span>
                                </div>
                              )}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground tabular-nums">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalRows)} / {totalRows} rekord
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(1)} disabled={page === 1} aria-label="Első">
                  <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Előző">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pNum = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                  return pNum <= totalPages ? (
                    <Button
                      key={pNum}
                      variant={pNum === page ? 'default' : 'outline'}
                      size="icon"
                      className="h-7 w-7 text-xs"
                      onClick={() => setPage(pNum)}
                      aria-label={`${pNum}. oldal`}
                      aria-current={pNum === page ? 'page' : undefined}
                    >
                      {pNum}
                    </Button>
                  ) : null;
                })}
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Következő">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(totalPages)} disabled={page === totalPages} aria-label="Utolsó">
                  <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Preview Dialog */}
      <Dialog open={!!previewFile} onOpenChange={(open) => !open && setPreviewFile(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="text-sm font-medium flex items-center justify-between pr-8">
              <span className="truncate">{previewFile?.name}</span>
              <div className="flex gap-2 shrink-0 ml-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1.5"
                  onClick={() => window.open(previewFile?.url, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Megnyitás új lapon
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 bg-muted/20 relative">
            {previewFile && (
              previewFile.url.toLowerCase().includes('.pdf') || previewFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe 
                  src={`${previewFile.url}#toolbar=1`} 
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (previewFile.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/) ? (
                <div className="w-full h-full flex items-center justify-center p-4">
                  <img 
                    src={previewFile.url} 
                    alt={previewFile.name} 
                    className="max-w-full max-h-full object-contain shadow-lg rounded-sm"
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                  <FileText className="h-12 w-12 opacity-20" />
                  <p className="text-sm text-center px-8">Ez a fájltípus nem tekinthető meg előnézetben.<br/>Kérjük, töltsd le vagy nyisd meg új lapon.</p>
                  <Button onClick={() => window.open(previewFile.url, '_blank')}>Megnyitás új lapon</Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Permissions Panel ───────────────────────────────
// ═══════════════════════════════════════════════════════
interface UserPermissionsData {
  userId: string;
  email: string;
  name: string;
  profileRole: string;
  isSupportAdmin: boolean;
  eaisybill: Array<{
    companyId: string;
    companyName: string;
    role: string;
    modules: Array<{ module: string; canRead: boolean; canWrite: boolean; isOverride: boolean }>;
  }>;
  accounty: Array<{
    firmId: string;
    firmName: string;
    companyId: string;
    companyName: string;
    role: string;
    modules: Array<{ module: string; canRead: boolean; canWrite: boolean; isOverride: boolean }>;
  }>;
}

const MODULE_LABELS: Record<string, string> = {
  // eaisyBill
  dashboard: 'Irányítópult', categories: 'Kategóriák', projects: 'Projektek', partners: 'Partnertörzs',
  invoices: 'Számlák', receivables: 'Kintlévőség', transactions: 'Tranzakciók', petty_cash: 'Házipénztár',
  general_ledger: 'Főkönyv', profit_loss: 'Eredménykimutatás', balance_sheet: 'Mérleg',
  annual_report: 'Beszámoló', vat_return: 'ÁFA Bevallás',
  salaries: 'Bérek/járulékok', working_time: 'Munkaidő', fixed_assets: 'TENY',
  integrations: 'Integrációk', exchange_rates: 'Árfolyamok', upload: 'Feltöltés', tickets: 'Hibajegyek',
  settings: 'Beállítások',
  shipments: 'Fuvarok', shipment_import: 'Excel Import', shipment_matching: 'Matching',
  // eaisyBooks
  portfolio: 'Portfólió', missing_invoices: 'Hiányzó számlák', tax_calendar: 'Adó naptár',
  reports: 'Riportok', approval_queue: 'Jóváhagyó rendszer', alerts: 'Riasztások',
  nav_deadlines: 'NAV határidők', payroll: 'Bérszámfejtés', onboarding: 'Onboarding',
  tao: 'TAO / KIVA',
  admin_audit: 'Audit napló', admin_gdpr: 'GDPR', admin_templates: 'Sablonok',
  admin_job_codes: 'Jogviszonykódok', admin_tax_params: 'Adómértékek',
  admin_legal: 'Jogszabály-frissítések', admin_office: 'Irodai beállítások',
  admin_permissions: 'Jogosultságkezelő', admin_accountants: 'Könyvelők kezelése',
  ai_assistant: 'AI Asszisztens', help: 'Segítség', profile: 'Profil',
};

function PermissionsPanel({ allUsers }: { allUsers: ControlCenterUser[] }) {
  const [searchUser, setSearchUser] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedUserId = searchParams.get('userId') || null;

  const setSelectedUserId = useCallback((userId: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (userId) {
      nextParams.set('userId', userId);
    } else {
      nextParams.delete('userId');
    }
    setSearchParams(nextParams);
  }, [searchParams, setSearchParams]);

  const [pendingChanges, setPendingChanges] = useState<Map<string, { canRead: boolean; canWrite: boolean }>>(new Map());
  const [isSupportAdmin, setIsSupportAdmin] = useState<boolean>(false);

  React.useEffect(() => {
    setPendingChanges(new Map());
    setSelectedEbCompany(null);
    setSelectedAbFirm(null);
  }, [selectedUserId]);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [selectedEbCompany, setSelectedEbCompany] = useState<string | null>(null);
  const [selectedAbFirm, setSelectedAbFirm] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'eaisybill' | 'accounty'>('eaisybill');
  const queryClient = useQueryClient();

  const filteredUsers = useMemo(() => {
    if (!searchUser.trim()) return allUsers;
    const q = searchUser.toLowerCase();
    return allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [allUsers, searchUser]);

  // Fetch selected user's permissions
  const { data: userPerms, isLoading: permsLoading } = useQuery<UserPermissionsData>({
    queryKey: ['management-user-permissions', selectedUserId],
    queryFn: () => fetchManagementData('user-permissions', { userId: selectedUserId! }),
    enabled: !!selectedUserId,
    staleTime: 30_000,
  });

  React.useEffect(() => {
    if (userPerms) {
      setIsSupportAdmin(userPerms.isSupportAdmin);
    }
  }, [userPerms]);

  const handleToggle = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', currentValue: boolean) => {
    const nextVal = !currentValue;
    
    setPendingChanges(prev => {
      const next = new Map(prev);
      const readKey = `${platform}:${companyOrFirmId}:${moduleName}:canRead`;
      const writeKey = `${platform}:${companyOrFirmId}:${moduleName}:canWrite`;

      // Find original DB values for both fields
      const currentMod = userPerms?.eaisybill.find(c => c.companyId === companyOrFirmId)?.modules.find(m => m.module === moduleName)
        || userPerms?.accounty.find(a => a.firmId === companyOrFirmId)?.modules.find(m => m.module === moduleName);
      const origRead = currentMod?.canRead ?? true;
      const origWrite = currentMod?.canWrite ?? true;
      const effectiveRead = prev.get(readKey)?.canRead ?? origRead;
      const effectiveWrite = prev.get(writeKey)?.canWrite ?? origWrite;

      let newRead = effectiveRead;
      let newWrite = effectiveWrite;

      if (field === 'canRead' && !nextVal) {
        // Turning off read → also turn off write
        newRead = false;
        newWrite = false;
      } else if (field === 'canWrite' && nextVal) {
        // Turning on write → also turn on read
        newRead = true;
        newWrite = true;
      } else if (field === 'canRead') {
        // Turning on read only
        newRead = true;
      } else {
        // Turning off write only
        newWrite = false;
      }

      // Only keep entries that actually differ from the original DB value
      if (newRead !== origRead) {
        next.set(readKey, { canRead: newRead, canWrite: newWrite });
      } else {
        next.delete(readKey);
      }
      if (newWrite !== origWrite) {
        next.set(writeKey, { canRead: newRead, canWrite: newWrite });
      } else {
        next.delete(writeKey);
      }

      return next;
    });
  };

  const getEffectiveValue = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', originalValue: boolean): boolean => {
    const key = `${platform}:${companyOrFirmId}:${moduleName}:${field}`;
    const pending = pendingChanges.get(key);
    if (pending) return pending[field];
    return originalValue;
  };

  const isChanged = (platform: string, companyOrFirmId: string, moduleName: string, field: 'canRead' | 'canWrite', originalValue: boolean): boolean => {
    const key = `${platform}:${companyOrFirmId}:${moduleName}:${field}`;
    return pendingChanges.has(key);
  };

  const handleSave = async () => {
    if (!selectedUserId || !userPerms || (pendingChanges.size === 0 && isSupportAdmin === userPerms.isSupportAdmin)) return;
    setSaving(true);
    setSaveMessage(null);

    // Group changes by platform + company/firm
    const grouped = new Map<string, { platform: string; companyId?: string; firmId?: string; perms: Array<{ module: string; canRead: boolean; canWrite: boolean }> }>();

    for (const [key] of pendingChanges) {
      const [platform, entityId, moduleName, field] = key.split(':');
      const groupKey = `${platform}:${entityId}`;

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          platform,
          companyId: platform === 'eaisybill' ? entityId : undefined,
          firmId: platform === 'accounty' ? entityId : undefined,
          perms: [],
        });
      }

      // Find the original module data
      let originalCanRead = true;
      let originalCanWrite = true;

      if (platform === 'eaisybill') {
        const comp = userPerms.eaisybill.find(e => e.companyId === entityId);
        const mod = comp?.modules.find(m => m.module === moduleName);
        if (mod) { originalCanRead = mod.canRead; originalCanWrite = mod.canWrite; }
      } else {
        const firm = userPerms.accounty.find(a => a.firmId === entityId);
        const mod = firm?.modules.find(m => m.module === moduleName);
        if (mod) { originalCanRead = mod.canRead; originalCanWrite = mod.canWrite; }
      }

      const effectiveRead = getEffectiveValue(platform, entityId, moduleName, 'canRead', originalCanRead);
      const effectiveWrite = getEffectiveValue(platform, entityId, moduleName, 'canWrite', originalCanWrite);

      // Check if module is already in the group's perms
      const group = grouped.get(groupKey)!;
      const existing = group.perms.find(p => p.module === moduleName);
      if (existing) {
        existing.canRead = effectiveRead;
        existing.canWrite = effectiveWrite;
      } else {
        group.perms.push({ module: moduleName, canRead: effectiveRead, canWrite: effectiveWrite });
      }
    }

    let totalErrors = 0;

    if (isSupportAdmin !== userPerms.isSupportAdmin) {
      const result = await postManagementData('update-permissions', {
        userId: selectedUserId,
        isSupportAdmin,
      });
      if (result.error) totalErrors++;
    }

    for (const [, group] of grouped) {
      const result = await postManagementData('update-permissions', {
        userId: selectedUserId,
        platform: group.platform,
        companyId: group.companyId,
        firmId: group.firmId,
        permissions: group.perms,
      });
      if (result.error) totalErrors++;
    }

    setSaving(false);
    setPendingChanges(new Map());

    if (totalErrors === 0) {
      setSaveMessage('✅ Mentve!');
      queryClient.invalidateQueries({ queryKey: ['management-user-permissions', selectedUserId] });
    } else {
      setSaveMessage('⚠️ Néhány módosítás nem sikerült');
    }

    setTimeout(() => setSaveMessage(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
      {/* ── User list (left column) ── */}
      <Card className="h-fit lg:max-h-[calc(100vh-240px)] lg:overflow-y-auto">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Felhasználók
          </CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              placeholder="Keresés..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/40">
            {filteredUsers.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nincs találat</p>
            )}
            {filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => setSelectedUserId(u.user_id)}
                className={`w-full text-left px-4 py-3 transition-colors duration-150 hover:bg-accent/30 border-l-2
                  ${selectedUserId === u.user_id ? 'bg-primary/10 border-primary' : 'border-transparent'}`}
              >
                <p className="text-sm font-medium truncate">{u.name || '—'}</p>
                <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Permission matrix (right column) ── */}
      <div className="space-y-4 w-full overflow-hidden">
        {!selectedUserId && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Válassz ki egy felhasználót a jogosultságok megtekintéséhez</p>
            </CardContent>
          </Card>
        )}

        {selectedUserId && permsLoading && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-48" />
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-10 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {selectedUserId && userPerms && !permsLoading && (
          <>
            {/* User info header */}
            <Card>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="font-semibold">{userPerms.name}</p>
                    <p className="text-xs text-muted-foreground">{userPerms.email}</p>
                    <Badge variant="outline" className="mt-1 text-[10px]">{userPerms.profileRole}</Badge>
                  </div>
                  
                  {/* Vertical separator */}
                  <div className="h-8 w-px bg-border/60" />

                  {/* Support admin switch */}
                  <div className="flex items-center gap-2 bg-accent/20 px-3 py-1.5 rounded-lg border border-border/40">
                    <Switch
                      id="support-admin-toggle"
                      checked={isSupportAdmin}
                      onCheckedChange={setIsSupportAdmin}
                    />
                    <label htmlFor="support-admin-toggle" className="text-xs font-medium cursor-pointer select-none">
                      Support munkatárs (Globális hozzáférés)
                    </label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {saveMessage && (
                    <span className="text-xs font-medium text-primary animate-in fade-in">{saveMessage}</span>
                  )}
                  {(() => {
                    const totalPending = pendingChanges.size + (isSupportAdmin !== userPerms.isSupportAdmin ? 1 : 0);
                    return (
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={totalPending === 0 || saving}
                        className="gap-2"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Mentés {totalPending > 0 && `(${totalPending})`}
                      </Button>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Platform pill toggle */}
            {(userPerms.eaisybill.length > 0 || userPerms.accounty.length > 0) && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border/40">
                  {userPerms.eaisybill.length > 0 && (
                    <button
                      onClick={() => setSelectedPlatform('eaisybill')}
                      style={{ width: 140 }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                        ${selectedPlatform === 'eaisybill'
                          ? 'bg-primary/15 text-primary border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
                        }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      eaisyBill
                    </button>
                  )}
                  {userPerms.accounty.length > 0 && (
                    <button
                      onClick={() => setSelectedPlatform('accounty')}
                      style={{ width: 140 }}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 border
                        ${selectedPlatform === 'accounty'
                          ? 'bg-primary/15 text-primary border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent'
                        }`}
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      eaisyBooks
                    </button>
                  )}
                </div>

                {/* Company dropdown (right side of pills) */}
                {selectedPlatform === 'eaisybill' && userPerms.eaisybill.length > 1 && (
                  <select
                    value={selectedEbCompany || userPerms.eaisybill[0]?.companyId}
                    onChange={e => setSelectedEbCompany(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer text-foreground"
                    style={{ colorScheme: 'dark' }}
                  >
                    {userPerms.eaisybill.map(c => (
                      <option key={c.companyId} value={c.companyId}>{c.companyName} ({c.role})</option>
                    ))}
                  </select>
                )}
                {selectedPlatform === 'accounty' && userPerms.accounty.length > 1 && (
                  <select
                    value={selectedAbFirm || `${userPerms.accounty[0]?.firmId}__${userPerms.accounty[0]?.companyId}`}
                    onChange={e => setSelectedAbFirm(e.target.value)}
                    className="text-xs bg-background border border-border rounded-lg px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer text-foreground"
                    style={{ colorScheme: 'dark' }}
                  >
                    {userPerms.accounty.map(a => (
                      <option key={`${a.firmId}__${a.companyId}`} value={`${a.firmId}__${a.companyId}`}>
                        {a.firmName} · {a.companyName} ({a.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Active platform content */}
            {selectedPlatform === 'eaisybill' && userPerms.eaisybill.length > 0 && (() => {
              const ebId = selectedEbCompany || userPerms.eaisybill[0]?.companyId;
              const ebComp = userPerms.eaisybill.find(c => c.companyId === ebId) || userPerms.eaisybill[0];
              return ebComp ? (
                <ModuleMatrix
                  key={ebComp.companyId}
                  title={ebComp.companyName}
                  subtitle={`Szerepkör: ${ebComp.role}`}
                  platform="eaisybill"
                  entityId={ebComp.companyId}
                  modules={ebComp.modules}
                  getEffectiveValue={getEffectiveValue}
                  isChanged={isChanged}
                  onToggle={handleToggle}
                />
              ) : null;
            })()}

            {selectedPlatform === 'accounty' && userPerms.accounty.length > 0 && (() => {
              const abId = selectedAbFirm || `${userPerms.accounty[0]?.firmId}__${userPerms.accounty[0]?.companyId}`;
              const abEntry = userPerms.accounty.find(a => `${a.firmId}__${a.companyId}` === abId) || userPerms.accounty[0];
              return abEntry ? (
                <ModuleMatrix
                  key={`${abEntry.firmId}-${abEntry.companyId}`}
                  title={abEntry.firmName}
                  subtitle={`Szerepkör: ${abEntry.role} · Ügyfél: ${abEntry.companyName}`}
                  platform="accounty"
                  entityId={abEntry.firmId}
                  modules={abEntry.modules}
                  getEffectiveValue={getEffectiveValue}
                  isChanged={isChanged}
                  onToggle={handleToggle}
                />
              ) : null;
            })()}

            {userPerms.eaisybill.length === 0 && userPerms.accounty.length === 0 && (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-sm text-muted-foreground">Ez a felhasználó nincs hozzárendelve egyetlen céghez sem.</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Module Matrix (reusable per-company permission grid) ─────
const PLATFORM_MODULE_GROUPS: Record<string, Record<string, { label: string; group: string }>> = {
  eaisybill: {
    dashboard: { label: 'Irányítópult', group: 'Áttekintés' },
    categories: { label: 'Kategóriák', group: 'Áttekintés' },
    projects: { label: 'Projektek', group: 'Áttekintés' },
    partners: { label: 'Partnertörzs', group: 'Áttekintés' },
    invoices: { label: 'Számlák', group: 'Pénzügyek' },
    receivables: { label: 'Kintlévőség', group: 'Pénzügyek' },
    transactions: { label: 'Tranzakciók', group: 'Pénzügyek' },
    petty_cash: { label: 'Házipénztár', group: 'Pénzügyek' },
    general_ledger: { label: 'Főkönyv', group: 'Könyvelés' },
    profit_loss: { label: 'Eredménykimutatás', group: 'Könyvelés' },
    balance_sheet: { label: 'Mérleg', group: 'Könyvelés' },
    annual_report: { label: 'Beszámoló', group: 'Könyvelés' },
    vat_return: { label: 'ÁFA Bevallás', group: 'Könyvelés' },
    salaries: { label: 'Bérek/járulékok', group: 'HR & Eszközök' },
    working_time: { label: 'Munkaidő', group: 'HR & Eszközök' },
    fixed_assets: { label: 'TENY', group: 'HR & Eszközök' },
    exchange_rates: { label: 'Árfolyamok', group: 'Rendszer' },
    upload: { label: 'Feltöltés', group: 'Rendszer' },
    tickets: { label: 'Hibajegyek', group: 'Rendszer' },
    integrations: { label: 'Integrációk', group: 'Rendszer' },
    settings: { label: 'Beállítások', group: 'Rendszer' },
    shipments: { label: 'Fuvarok', group: 'Szállítmányozás' },
    shipment_import: { label: 'Excel Import', group: 'Szállítmányozás' },
    shipment_matching: { label: 'Matching', group: 'Szállítmányozás' },
  },
  accounty: {
    portfolio: { label: 'Portfólió', group: 'Áttekintés' },
    missing_invoices: { label: 'Hiányzó számlák', group: 'Áttekintés' },
    tax_calendar: { label: 'Adó naptár', group: 'Áttekintés' },
    reports: { label: 'Riportok', group: 'Riportok' },
    approval_queue: { label: 'Jóváhagyó rendszer', group: 'Riportok' },
    alerts: { label: 'Riasztások', group: 'Riportok' },
    nav_deadlines: { label: 'NAV határidők', group: 'Riportok' },
    payroll: { label: 'Bérszámfejtés', group: 'Pénzügyek' },
    tao: { label: 'TAO / KIVA', group: 'Pénzügyek' },
    settings: { label: 'Beállítások', group: 'Pénzügyek' },
    admin_audit: { label: 'Audit napló', group: 'Rendszer' },
    admin_gdpr: { label: 'GDPR', group: 'Rendszer' },
    admin_templates: { label: 'Sablonok', group: 'Rendszer' },
    admin_job_codes: { label: 'Jogviszonykódok', group: 'Rendszer' },
    admin_tax_params: { label: 'Adómértékek', group: 'Rendszer' },
    admin_legal: { label: 'Jogszabály-frissítések', group: 'Rendszer' },
    admin_office: { label: 'Irodai beállítások', group: 'Rendszer' },
    admin_permissions: { label: 'Jogosultságkezelő', group: 'Rendszer' },
    admin_accountants: { label: 'Könyvelők kezelése', group: 'Rendszer' },
    onboarding: { label: 'Onboarding', group: 'Rendszer' },
    ai_assistant: { label: 'AI Asszisztens', group: 'AI & Segítség' },
    help: { label: 'Segítség', group: 'AI & Segítség' },
    profile: { label: 'Profil', group: 'AI & Segítség' },
    tickets: { label: 'Hibajegyek', group: 'AI & Segítség' },
  }
};

function ModuleMatrix({
  title,
  subtitle,
  platform,
  entityId,
  modules,
  getEffectiveValue,
  isChanged,
  onToggle,
}: {
  title: string;
  subtitle: string;
  platform: string;
  entityId: string;
  modules: Array<{ module: string; canRead: boolean; canWrite: boolean; isOverride: boolean }>;
  getEffectiveValue: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', original: boolean) => boolean;
  isChanged: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', original: boolean) => boolean;
  onToggle: (platform: string, entityId: string, module: string, field: 'canRead' | 'canWrite', current: boolean) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return modules;
    const q = searchQuery.toLowerCase();
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    return modules.filter(mod => {
      const info = groupInfo[mod.module];
      const label = info?.label || MODULE_LABELS[mod.module] || mod.module;
      return label.toLowerCase().includes(q) || mod.module.toLowerCase().includes(q);
    });
  }, [modules, searchQuery, platform]);

  const groupedModules = useMemo(() => {
    const groups: Record<string, typeof modules> = {};
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    
    filteredModules.forEach(mod => {
      const info = groupInfo[mod.module];
      const groupName = info?.group || 'Egyéb';
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(mod);
    });
    
    return groups;
  }, [filteredModules, platform]);

  const handleBulkToggleGroup = (groupName: string, field: 'canRead' | 'canWrite', enable: boolean) => {
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    const groupMods = modules.filter(mod => {
      const info = groupInfo[mod.module];
      return (info?.group || 'Egyéb') === groupName;
    });

    groupMods.forEach(mod => {
      const currentEffective = getEffectiveValue(platform, entityId, mod.module, field, mod[field]);
      
      if (field === 'canWrite' && enable) {
        const currentRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
        if (!currentRead) {
          onToggle(platform, entityId, mod.module, 'canRead', false);
        }
      }
      
      if (field === 'canRead' && !enable) {
        const currentWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
        if (currentWrite) {
          onToggle(platform, entityId, mod.module, 'canWrite', true);
        }
      }

      if (currentEffective !== enable) {
        onToggle(platform, entityId, mod.module, field, currentEffective);
      }
    });
  };

  const handleResetGroup = (groupName: string) => {
    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
    const groupMods = modules.filter(mod => {
      const info = groupInfo[mod.module];
      return (info?.group || 'Egyéb') === groupName;
    });

    groupMods.forEach(mod => {
      const currentRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
      if (currentRead !== mod.canRead) {
        onToggle(platform, entityId, mod.module, 'canRead', currentRead);
      }
      const currentWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
      if (currentWrite !== mod.canWrite) {
        onToggle(platform, entityId, mod.module, 'canWrite', currentWrite);
      }
    });
  };

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
          
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Modul szűrése..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-background/50"
              aria-label="Modul szűrése"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40 text-muted-foreground bg-muted/5">
                <th className="text-left py-2.5 px-4 font-medium">Modul</th>
                <th className="text-center py-2.5 px-3 font-medium w-24">Olvasás</th>
                <th className="text-center py-2.5 px-3 font-medium w-24">Írás</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(groupedModules).length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nincs a szűrésnek megfelelő modul.
                  </td>
                </tr>
              )}
              {Object.entries(groupedModules).map(([groupName, groupMods]) => (
                <React.Fragment key={groupName}>
                  <tr className="border-b border-border/20 bg-muted/20">
                    <td className="py-1.5 px-4 font-bold text-[10px] text-primary uppercase tracking-wider">
                      {groupName}
                    </td>
                    <td colSpan={2} className="py-1 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleBulkToggleGroup(groupName, 'canRead', true)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          title="Összes olvasása engedélyezve a csoportban"
                        >
                          R+
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => handleBulkToggleGroup(groupName, 'canWrite', true)}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                          title="Összes írása engedélyezve a csoportban"
                        >
                          W+
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => {
                            handleBulkToggleGroup(groupName, 'canRead', false);
                            handleBulkToggleGroup(groupName, 'canWrite', false);
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Összes letiltása a csoportban"
                        >
                          Tilt
                        </button>
                        <span className="text-muted-foreground/20 text-[9px]">|</span>
                        <button
                          onClick={() => handleResetGroup(groupName)}
                          className="p-1 rounded text-muted-foreground hover:text-warning hover:bg-warning/10 transition-colors"
                          title="Csoport visszaállítása alapértelmezettre"
                        >
                          <RotateCcw className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {groupMods.map(mod => {
                    const effectiveRead = getEffectiveValue(platform, entityId, mod.module, 'canRead', mod.canRead);
                    const effectiveWrite = getEffectiveValue(platform, entityId, mod.module, 'canWrite', mod.canWrite);
                    const readChanged = isChanged(platform, entityId, mod.module, 'canRead', mod.canRead);
                    const writeChanged = isChanged(platform, entityId, mod.module, 'canWrite', mod.canWrite);
                    const groupInfo = PLATFORM_MODULE_GROUPS[platform] || {};
                    const label = groupInfo[mod.module]?.label || MODULE_LABELS[mod.module] || mod.module;

                    return (
                      <tr key={mod.module} className="border-b border-border/10 hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4 font-medium">
                          <span className="flex items-center gap-2">
                            {label}
                            {mod.isOverride && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary/30 bg-primary/5">
                                egyedi
                              </Badge>
                            )}
                          </span>
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => onToggle(platform, entityId, mod.module, 'canRead', effectiveRead)}
                            className={`h-6 w-7 rounded-md border flex items-center justify-center mx-auto transition-all duration-150
                              ${effectiveRead
                                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60'
                              }
                              ${readChanged ? 'ring-2 ring-warning/60 border-warning' : ''}
                            `}
                            title={effectiveRead ? 'Olvasás: Engedélyezve' : 'Olvasás: Letiltva'}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                        <td className="text-center py-2 px-3">
                          <button
                            onClick={() => onToggle(platform, entityId, mod.module, 'canWrite', effectiveWrite)}
                            className={`h-6 w-7 rounded-md border flex items-center justify-center mx-auto transition-all duration-150
                              ${effectiveWrite
                                ? 'bg-primary/15 text-primary border-primary/30 hover:bg-primary/25'
                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:bg-muted/60'
                              }
                              ${writeChanged ? 'ring-2 ring-warning/60 border-warning' : ''}
                            `}
                            title={effectiveWrite ? 'Írás: Engedélyezve' : 'Írás: Letiltva'}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
