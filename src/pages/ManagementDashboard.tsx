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
import { useTickets } from '@/hooks/useTickets';
import {
  Users, Building2, FileText, Clock,
  ChevronRight, ChevronLeft, ChevronDown, Search, LogOut, ArrowLeft, Shield,
  Bot, Coins, ArrowUpDown, ArrowUp, ArrowDown,
  Trophy, Zap, Calendar, X, Crown, Sun, Moon,
  AlertTriangle, Trash2, RefreshCw, RotateCcw, Receipt, Wallet, Landmark, BarChart3,
  Eye, Download, ExternalLink, ShieldCheck, ToggleLeft, ToggleRight, Save, Check, Loader, Loader2, Pencil,
  ArrowLeftRight, BookOpen, Briefcase, Upload, AlertCircle, ClipboardList, CalendarClock, HardHat,
  CreditCard, User, Mail, Inbox,
  Tags, FolderKanban, Package2, Truck, FileSpreadsheet, Scale, ScrollText, Gavel,
  TicketCheck, FolderOpen,
  Server, Activity, CircleDot, CheckCircle2, XCircle, TrendingUp,
  DollarSign, PieChart, Cpu,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  totalErrors?: number;
  mostErrorCompany?: { id: string; name: string; errorCount: number } | null;
  mostErrorUser?: { id: string; name: string; email: string; errorCount: number } | null;
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
function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-muted/60 animate-shimmer ${className}`}
      role="status"
      aria-label="Betöltés…"
      style={style}
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

  // Debounce search — useEffect handles cleanup properly (useMemo does NOT)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

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

function ErrorControlPanel({ onOpenCompany, allUsers }: { onOpenCompany: (id: string) => void; allUsers: ControlCenterUser[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const PAGE_SIZE = 25;

  // Deriving states directly from URL search parameters
  const page = Number(searchParams.get('err_page')) || 0;
  const sortCol = (searchParams.get('err_sort') as ErrorSortCol) || 'created_at';
  const sortDir = (searchParams.get('err_dir') as 'asc' | 'desc') || 'desc';
  const filterCompanyId = searchParams.get('err_company') || '';
  const filterUserId = searchParams.get('err_user') || '';
  const filterSource = searchParams.get('err_source') || '';
  const filterCategory = searchParams.get('err_category') || '';
  const dateFrom = searchParams.get('err_from') || '';
  const dateTo = searchParams.get('err_to') || '';
  const debouncedSearch = searchParams.get('err_q') || '';

  // Local state for the input field to prevent layout/input lag
  const [search, setSearch] = useState(debouncedSearch);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<Array<{ source: string; id: string }>>([]);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const queryClient = useQueryClient();

  // Helper function to update search parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    // Reset page on filter changes unless page is explicitly updated
    if (!('err_page' in updates)) {
      next.delete('err_page');
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Sync local search input value when URL changes externally
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch]);

  // Debounce search input to URL parameters
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== debouncedSearch) {
        updateParams({ err_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, debouncedSearch, updateParams]);

  // Build company options from allUsers (deduped companies) — same as FilesPanel
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

  const toggleSort = useCallback((col: ErrorSortCol) => {
    if (sortCol === col) {
      updateParams({ err_dir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ err_sort: col, err_dir: 'desc' });
    }
  }, [sortCol, sortDir, updateParams]);

  const { data, isLoading, isFetching } = useQuery<ErrorsData>({
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
    setDeleting(true);
    try {
      await postManagementData('delete-errors', { ids: deleteTargets });
      toast({ title: 'Hibák törölve', description: `${deleteTargets.length} hiba sikeresen törölve.` });
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Delete errors failed:', error: e });
      toast({ title: 'Törlés sikertelen', description: 'Hiba történt a törlés során.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteModalOpen(false);
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
      if (result.error) {
        reportError({ type: 'api_call', severity: 'warning', component: 'ManagementDashboard', action: 'warning', message: 'Retry partial errors', error: result.error });
        toast({ title: 'Részleges újraküldés', description: `${result.retried || 0} elem újraküldve, néhány hiba történt.`, variant: 'destructive' });
      } else {
        toast({ title: 'Újraküldés sikeres', description: `${result.retried || retryTargets.length} elem újra feldolgozásra küldve.` });
      }
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors failed:', error: e });
      toast({ title: 'Újraküldés sikertelen', description: 'Hiba történt az újraküldés során.', variant: 'destructive' });
    } finally {
      setRetrying(false);
      setRetryModalOpen(false);
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

  function ErrSortTh({ col, label, width }: { col: ErrorSortCol; label: string; width?: string }) {
    const active = sortCol === col;
    return (
      <th
        className={`py-2 px-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors duration-150 text-left${width ? ` ${width}` : ''}`}
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
    { value: 'uploads',              label: 'Feltöltés' },   // ← minden upload tábla egyben
    { value: 'app_error_logs:frontend', label: 'Frontend' },
    { value: 'app_error_logs:worker',   label: 'Worker' },
    { value: 'app_error_logs:mailgun',  label: 'Mailgun' },
  ];

  const categoryOptions = [
    { value: 'Application', label: '⚙️ Application' },
    { value: 'Mailgun',     label: '📧 Mailgun' },
    { value: 'Worker',      label: '🔧 Worker' },
  ];

  const categoryColors: Record<string, string> = {
    Application: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
    Mailgun:     'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    Worker:      'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  };

  // Forrás badge színek
  const sourceColors: Record<string, string> = {
    uploads:                   'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    invoice_uploads:           'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    transaction_uploads:       'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    report_uploads:            'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    bank_statement_uploads:    'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    gl_upload_notifications:   'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    nav_sync_logs:             'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    'app_error_logs:frontend': 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
    'app_error_logs:worker':   'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    'app_error_logs:mailgun':  'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300" style={{ maxWidth: '100%' }}>
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[0,1,2,3].map(i => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
        {/* Total errors */}
        {(() => {
          const hasAnyFilter = !!(search || filterCompanyId || filterUserId || filterSource || filterCategory || dateFrom || dateTo);
          return (
            <Card
              className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30",
                !hasAnyFilter ? "border-destructive/50 bg-destructive/5" : ""
              )}
              onClick={() => {
                updateParams({
                  err_q: '',
                  err_company: '',
                  err_user: '',
                  err_source: '',
                  err_category: '',
                  err_from: '',
                  err_to: '',
                  err_page: null,
                });
                setSearch('');
              }}
              role="button" tabIndex={0}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-destructive">{data?.totalErrors ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Összes hiba</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* 24h errors */}
        {(() => {
          const is24hActive = dateFrom.includes('T');
          return (
            <Card
              className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30",
                is24hActive ? "border-warning/50 bg-warning/5" : ""
              )}
              onClick={() => {
                if (is24hActive) {
                  updateParams({ err_from: '', err_to: '', err_page: null });
                } else {
                  const relative24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
                  updateParams({ err_from: relative24h, err_to: '', err_page: null });
                }
              }}
              role="button" tabIndex={0}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-warning/10 border border-warning/20 shrink-0">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xl font-bold tabular-nums text-warning">{data?.last24hErrors ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Utolsó 24h</p>
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Most affected company */}
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30",
            data?.mostAffectedCompany && filterCompanyId === data.mostAffectedCompany.id ? "border-primary/50 bg-primary/5" : ""
          )}
          onClick={() => {
            if (data?.mostAffectedCompany) {
              const id = data.mostAffectedCompany.id;
              updateParams({
                err_company: filterCompanyId === id ? '' : id,
                err_user: '',
                err_page: null,
              });
            }
          }}
          role="button" tabIndex={0}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{data?.mostAffectedCompany?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Legtöbb ({data?.mostAffectedCompany?.errorCount ?? 0})</p>
            </div>
          </CardContent>
        </Card>

        {/* Most affected user */}
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30",
            data?.mostAffectedUser && filterUserId === data.mostAffectedUser.id ? "border-primary/50 bg-primary/5" : ""
          )}
          onClick={() => {
            if (data?.mostAffectedUser) {
              const id = data.mostAffectedUser.id;
              updateParams({
                err_user: filterUserId === id ? '' : id,
                err_page: null,
              });
            }
          }}
          role="button" tabIndex={0}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-orange-500/10 border border-orange-500/20 shrink-0">
              <Users className="h-5 w-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">{data?.mostAffectedUser?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">Legtöbb ({data?.mostAffectedUser?.errorCount ?? 0})</p>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* ── Filter toolbar ── */}
      <Card>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Skeleton className="h-7 w-[160px] rounded-md" />
              <Skeleton className="h-7 w-[90px] rounded-md" />
              <Skeleton className="h-7 w-[90px] rounded-md" />
              <Skeleton className="h-7 w-[90px] rounded-md" />
              <Skeleton className="h-7 w-[90px] rounded-md" />
              <Skeleton className="ml-auto h-7 w-[120px] rounded-md" />
            </div>
          ) : (
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); }}
                placeholder="Hiba keresése…"
                className="pl-8 h-8 text-xs w-52 bg-background"
                id="errors-search"
              />
            </div>

             {/* Source filter (Popover + scroll) */}
            {(() => {
              const active = sourceOptions.find(o => o.value === filterSource);
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs justify-between min-w-[140px] font-normal gap-2">
                      <span className="truncate">{active?.label || 'Minden forrás'}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-1" align="start">
                    <div className="max-h-[280px] overflow-y-auto">
                      <button
                        onClick={() => { updateParams({ err_source: '' }); }}
                        className={cn(
                          "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                          filterSource === '' ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent/50"
                        )}
                      >
                        Minden forrás
                        {filterSource === '' && <Check className="h-3 w-3 ml-auto text-primary" />}
                      </button>
                      {sourceOptions.map(o => (
                        <button
                          key={o.value}
                          onClick={() => { updateParams({ err_source: o.value }); }}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                            filterSource === o.value ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          {o.label}
                          {filterSource === o.value && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}

            {/* Category filter (Popover + scroll) */}
            {(() => {
              const active = categoryOptions.find(o => o.value === filterCategory);
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs justify-between min-w-[140px] font-normal gap-2">
                      <span className="truncate">{active?.label || 'Minden típus'}</span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[220px] p-1" align="start">
                    <div className="max-h-[280px] overflow-y-auto">
                      <button
                        onClick={() => { updateParams({ err_category: '' }); }}
                        className={cn(
                          "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                          filterCategory === '' ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent/50"
                        )}
                      >
                        Minden típus
                        {filterCategory === '' && <Check className="h-3 w-3 ml-auto text-primary" />}
                      </button>
                      {categoryOptions.map(o => (
                        <button
                          key={o.value}
                          onClick={() => { updateParams({ err_category: o.value }); }}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                            filterCategory === o.value ? "bg-accent text-accent-foreground font-medium" : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <span className={cn("w-2 h-2 rounded-full shrink-0", categoryColors[o.value]?.split(' ')[0] || 'bg-muted')} />
                          {o.label}
                          {filterCategory === o.value && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })()}

            {/* Company Search Combobox */}
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
                      ? companyOptions.find(([id]) => id === filterCompanyId)?.[1]
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
                          updateParams({ err_company: '', err_user: '', err_page: null });
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
                            updateParams({ err_company: id, err_user: '', err_page: null });
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
                          updateParams({ err_user: '', err_page: null });
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
                            updateParams({ err_user: u.user_id, err_page: null });
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

            {/* Date range */}
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { updateParams({ err_from: e.target.value, err_page: null }); }}
              className="h-8 text-xs bg-background w-36"
              id="errors-date-from"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { updateParams({ err_to: e.target.value, err_page: null }); }}
              className="h-8 text-xs bg-background w-36"
              id="errors-date-to"
            />

            {/* Reset filters */}
            {(search || filterSource || filterCategory || filterCompanyId || filterUserId || dateFrom || dateTo) && (
              <Button
                variant="ghost" size="sm"
                onClick={() => {
                  updateParams({
                    err_q: '',
                    err_company: '',
                    err_user: '',
                    err_source: '',
                    err_category: '',
                    err_from: '',
                    err_to: '',
                    err_page: null,
                  });
                  setSearch('');
                }}
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
                Szűrők törlése
              </Button>
            )}

            {/* Bulk actions */}
            {selected.size > 0 && (
              <>
                <div className="h-4 w-px bg-border" />
                <Button variant="destructive" size="sm" className="h-8 gap-1.5 text-xs px-3" disabled={deleting}
                  onClick={handleBulkDelete}>
                  <Trash2 className="h-3 w-3" />
                  Törlés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{selected.size}</span>)
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs px-3 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary" disabled={retrying}
                  onClick={handleBulkRetry}>
                  <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                  Újraküldés
                </Button>
                <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelected(new Set())}>
                  <X className="h-3 w-3" />
                  Kijelölés törlése
                </Button>
              </>
            )}

            {/* Delete all + record count */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums">{totalRows} rekord</span>
              {totalRows > 0 && (
                <Button
                  variant="outline" size="sm"
                  className="h-8 gap-1.5 text-xs px-3 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={deleting || deletingAll}
                  onClick={() => setDeleteAllModalOpen(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Összes törlés
                </Button>
              )}
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {/* ── Table with severity strip ── */}
      <Card className={cn("overflow-hidden transition-opacity duration-200", isFetching && !isLoading && "opacity-60")}>
        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-[11px]" style={{ tableLayout: 'fixed', minWidth: 900 }} role="table">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="py-1.5 px-2 w-7">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer" />
                  </th>
                  <th className="py-1.5 px-1 w-6"></th>
                  <ErrSortTh col="created_at" label="Dátum" />
                  <th className="text-left py-1.5 px-3 font-medium">Cég</th>
                  <th className="text-left py-1.5 px-3 font-medium">User</th>
                  <ErrSortTh col="source" label="Forrás" width="w-[100px]" />
                  <ErrSortTh col="error_category" label="Típus" width="w-[100px]" />
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
                            onChange={() => toggleOne(r)} className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer" />
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
                              onClick={e => { e.stopPropagation(); if (r.company_id) { updateParams({ err_company: r.company_id, err_page: null }); } }}
                              title={`Szűrés: ${r.company_name}`}>
                              {r.company_name}
                            </button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 px-3">
                          {r.error_message?.includes('process-mailgun-webhook') || r.user_name === 'Mailgun' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium" title="Mailgun webhook">
                              <Mail className="h-3 w-3" />
                              Mailgun
                            </span>
                          ) : r.user_name ? (
                            <button className="text-foreground hover:text-primary transition-colors text-left truncate max-w-[120px] block text-[11px]"
                              onClick={e => { e.stopPropagation(); if (r.user_id) { updateParams({ err_user: r.user_id, err_page: null }); } }}
                              title={`Szűrés: ${r.user_name}`}>
                              {r.user_name}
                            </button>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-1.5 px-3 w-[100px]">
                          <Badge className={`text-[10px] w-full justify-center ${sourceColors[r.source] || 'bg-slate-600 text-white border-transparent dark:bg-slate-500'}`}>
                            {r.source_label}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-3 w-[100px]">
                          <Badge className={`text-[10px] w-full justify-center ${categoryColors[r.error_category_label] || categoryColors[r.error_category] || 'bg-slate-600 text-white border-transparent'}`}>
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
                            <span className="text-foreground/50 truncate inline-flex items-center gap-1 max-w-full">
                              <span className="w-3 h-3 shrink-0" />
                              <span className="truncate">{r.file_name || '—'}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-foreground/50 truncate max-w-[200px]" title={r.error_message || ''}>
                          {r.error_message ? r.error_message.slice(0, 55) + (r.error_message.length > 55 ? '…' : '') : '—'}
                        </td>
                        <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {RETRYABLE_SOURCES.has(r.source) ? (
                              <button className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Újraküldés feldolgozásra"
                                disabled={retrying}
                                onClick={() => openRetryModal([{ source: r.source, id: r.id }])}>
                                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                              </button>
                            ) : (
                              <div className="w-5 h-5 shrink-0" />
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
          {isLoading ? (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <Skeleton className="h-4 w-28" />
              <div className="flex items-center gap-1">
                {[0,1,2].map(i => <Skeleton key={i} className="h-6 w-6 rounded-md" />)}
              </div>
            </div>
          ) : totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-border">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {totalRows === 0 ? '0' : `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalRows)} / ${totalRows}`}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page === 0}
                  onClick={() => updateParams({ err_page: page - 1 })}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-2">{page + 1}/{totalPages}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={page >= totalPages - 1}
                  onClick={() => updateParams({ err_page: page + 1 })}>
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
                <Button variant="ghost" size="sm" onClick={() => setRetryModalOpen(false)} disabled={retrying}>
                  Mégse
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleRetryConfirm} disabled={retrying}>
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {retrying ? 'Küldés…' : <>Újraküldés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{retryTargets.length}</span>)</>}
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
                <Button variant="ghost" size="sm" onClick={() => { setDeleteModalOpen(false); setDeleteTargets([]); }} disabled={deleting}>
                  Mégse
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleDeleteConfirm} disabled={deleting}>
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deleting ? 'Törlés…' : <>Törlés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{deleteTargets.length}</span>)</>}
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
                <Button variant="ghost" size="sm" onClick={() => setDeleteAllModalOpen(false)} disabled={deletingAll}>
                  Mégse
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  disabled={deletingAll}
                  onClick={async () => {
                    setDeletingAll(true);
                    try {
                      await postManagementData('delete-all-errors', {});
                      toast({ title: 'Összes hiba törölve', description: 'Minden hiba sikeresen törölve.' });
                      setSelected(new Set());
                      queryClient.invalidateQueries({ queryKey: ['management-errors'] });
                      queryClient.invalidateQueries({ queryKey: ['management-overview'] });
                    } catch (e) {
                      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Delete all errors failed:', error: e });
                      toast({ title: 'Törlés sikertelen', description: 'Hiba történt az összes hiba törlése során.', variant: 'destructive' });
                    } finally {
                      setDeletingAll(false);
                      setDeleteAllModalOpen(false);
                    }
                  }}
                >
                  {deletingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {deletingAll ? 'Törlés…' : 'Összes törlés'}
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
              <div className="flex-1 overflow-hidden relative">
                <FilePreviewContent previewFile={previewFile} />
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

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 4 Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="p-5 flex items-center justify-between border border-border/30 bg-card/50">
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800"></div>
          </Card>
        ))}
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Financial & Costs */}
        <div>
          <Card className="p-5 h-full space-y-4 flex flex-col justify-between">
            <div className="space-y-4 flex-1">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Column 2: Worker Status */}
        <div className="flex flex-col space-y-4 h-full">
          <Card className="p-5 space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-12 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
              </div>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-900 pt-4 space-y-3">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900 rounded"></div>
            </div>
          </Card>

          <Card className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-12"></div>
            </div>
            <div className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded flex items-end justify-between p-2 gap-4 mt-4">
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
            </div>
          </Card>
        </div>

        {/* Column 3: Tickets & Files */}
        <div className="flex flex-col space-y-3 h-full">
          <Card className="p-3.5 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
          </Card>

          {/* Applikáció hibák card skeleton */}
          <Card className="p-3.5 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
          </Card>

          {/* Recent Files card skeleton */}
          <Card className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-10"></div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col justify-end mt-2">
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
          </Card>
        </div>
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
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  // Derive view state from URL
  const urlView = searchParams.get('view') as 'company' | 'user' | 'errors' | 'permissions' | 'files' | 'superadmin' | 'tickets' | 'worker' | 'users' | null;
  const urlId = searchParams.get('id');
  const hasSuperadminParams = !!searchParams.get('sa_company') || !!searchParams.get('sa_mode');
  const view = (urlView === 'superadmin' && user?.email === 'superadmin@thinkai.hu')
    ? 'superadmin'
    : (urlView === 'company' || urlView === 'user' || urlView === 'errors' || urlView === 'permissions' || urlView === 'files' || urlView === 'superadmin' || urlView === 'tickets' || urlView === 'worker' || urlView === 'users')
      ? urlView
      : 'overview';
  const selectedCompanyId = view === 'company' ? urlId : null;
  const selectedUserId = view === 'user' ? urlId : null;

  // No local user search states needed here

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

  // Unused user filtering and pagination removed

  const queryClient = useQueryClient();

  // Reset queries on navigating to overview to trigger fresh fetches & skeleton loading state
  useEffect(() => {
    if (view === 'overview') {
      queryClient.resetQueries({ queryKey: ['management-overview'] });
      queryClient.resetQueries({ queryKey: ['llm-costs-trend'] });
      queryClient.resetQueries({ queryKey: ['llm-costs-all-time'] });
      queryClient.resetQueries({ queryKey: ['worker-status'] });
      queryClient.resetQueries({ queryKey: ['management-files-latest'] });
      queryClient.resetQueries({ queryKey: ['tickets'] });
    }
  }, [view, queryClient]);

  // ── Bento Grid Queries ───────────────────────────────
  const [bentoLlmPeriod, setBentoLlmPeriod] = useState<'7d' | '30d'>('7d');
  const { data: bentoLlmCostsData, isLoading: bentoLlmCostsLoading } = useQuery({
    queryKey: ['llm-costs-trend', bentoLlmPeriod],
    queryFn: () => fetchManagementData('llm-costs', { period: bentoLlmPeriod }),
    enabled: !!user && view === 'overview',
    staleTime: 30_000,
  });

  const { data: bentoLlmCostsAllTime } = useQuery({
    queryKey: ['llm-costs-all-time'],
    queryFn: () => fetchManagementData('llm-costs', { period: 'all' }),
    enabled: !!user && view === 'overview',
    staleTime: 60_000,
  });

  const { data: workerStatusData, isLoading: workerStatusLoading } = useQuery({
    queryKey: ['worker-status', '24h'],
    queryFn: () => fetchManagementData('worker-status', { period: '24h' }),
    refetchInterval: 5_000,
    staleTime: 2_500,
    enabled: !!user && view === 'overview',
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useTickets('all');
  const ticketsOverview = useMemo(() => {
    if (!ticketsData) return { newUnassigned: 0, resolved: 0 };
    return {
      newUnassigned: ticketsData.filter((t: any) => t.status === 'created' && !t.assigned_to).length,
      resolved: ticketsData.filter((t: any) => t.status === 'resolved').length,
    };
  }, [ticketsData]);

  const latestCriticalError = workerStatusData?.error_jobs?.[0] || null;

  const { data: recentFilesData, isLoading: recentFilesLoading } = useQuery<FilesData>({
    queryKey: ['management-files-latest'],
    queryFn: () => fetchManagementData('files', {
      page: '0',
      pageSize: '10',
      sortBy: 'updated_at',
      sortDir: 'desc',
      search: '',
      companyId: '',
      userId: '',
      fileType: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    }),
    enabled: !!user && view === 'overview',
    staleTime: 10_000,
  });

  const recentFilesList = useMemo(() => {
    const rawFiles = recentFilesData?.files || [];
    
    // Identify parent upload IDs that have a child fallback row present in this fetch
    const parentIdsToExclude = new Set<string>();
    for (const f of rawFiles) {
      if (f.fallback_from_invoice_upload_id) {
        parentIdsToExclude.add(f.fallback_from_invoice_upload_id);
      }
      if (f.fallback_from_transaction_upload_id) {
        parentIdsToExclude.add(f.fallback_from_transaction_upload_id);
      }
    }

    // Filter out parent rows and deduplicate by file name for safety
    const filtered = rawFiles.filter((f: any) => !parentIdsToExclude.has(f.id));
    
    const uniqueFiles: any[] = [];
    const seenNames = new Set<string>();
    for (const f of filtered) {
      if (!seenNames.has(f.file_name)) {
        seenNames.add(f.file_name);
        uniqueFiles.push(f);
      }
    }

    return uniqueFiles.slice(0, 4);
  }, [recentFilesData]);

  const isOverviewLoading = overviewLoading || bentoLlmCostsLoading || workerStatusLoading || recentFilesLoading || ticketsLoading;

  const selectedCompanyName = overview?.companies.find(c => c.id === selectedCompanyId)?.name;
  const selectedUserObj = overview?.users.find(u => u.user_id === selectedUserId);

  // ── Navigation (stable refs) ────────────────────
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
  const title = view === 'overview'
    ? 'Management Dashboard'
    : (view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users')
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
        {(view === 'overview' || view === 'errors' || view === 'permissions' || view === 'files' || view === 'superadmin' || view === 'tickets' || view === 'worker' || view === 'users') && (
          <div className="border-t border-border/40">
            <nav className="max-w-7xl mx-auto px-6 flex items-center gap-0.5 py-1.5" aria-label="Főnavigáció">
              <button
                onClick={goBack}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
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
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users'
                    ? 'bg-primary text-primary-foreground border-transparent shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 border-transparent'
                }`}
                aria-current={view === 'errors' || view === 'permissions' || view === 'files' || view === 'worker' || view === 'users' ? 'page' : undefined}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Control Center
              </button>
              <button
                onClick={openSuperadmin}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
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
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border ${
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
        <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
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
          isOverviewLoading ? (
            <OverviewSkeleton />
          ) : (
            <div className="space-y-6 page-animate">
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
                    <div className="min-w-0 flex-1">
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

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Bento Col 1: LLM Pénzügyi Áttekintés */}
              <Card className="flex flex-col justify-between p-5 space-y-4 h-full">
                {(() => {
                  const calculateProportionalTokenCosts = (inputTokens: number, outputTokens: number, totalCost: number) => {
                    if (totalCost <= 0) return { inputCost: 0, outputCost: 0 };
                    const r = 4.0; // average multiplier for output tokens vs input tokens
                    const inputWeight = inputTokens;
                    const outputWeight = outputTokens * r;
                    const totalWeight = inputWeight + outputWeight;
                    if (totalWeight <= 0) return { inputCost: 0, outputCost: 0 };
                    
                    const inputCost = totalCost * (inputWeight / totalWeight);
                    const outputCost = totalCost * (outputWeight / totalWeight);
                    return { inputCost, outputCost };
                  };

                  const monthlyTokenCosts = calculateProportionalTokenCosts(
                    overview?.llmOverview.totalMonthlyInputTokens || 0,
                    overview?.llmOverview.totalMonthlyOutputTokens || 0,
                    overview?.llmOverview.totalMonthlyCostUsd || 0
                  );

                  const allTimeTokenCosts = calculateProportionalTokenCosts(
                    bentoLlmCostsAllTime?.kpi?.total_input_tokens || 0,
                    bentoLlmCostsAllTime?.kpi?.total_output_tokens || 0,
                    bentoLlmCostsAllTime?.kpi?.total_cost || 0
                  );

                  const rawModels = bentoLlmCostsData?.by_model || [];

                  return (
                    <>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Coins className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">LLM Pénzügyi Áttekintés</span>
                        </div>
                        <div className="space-y-4 mt-2">
                          <div>
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Havi összköltség</h3>
                            <span className="text-3xl font-extrabold text-foreground block mt-0.5 tracking-tight">
                              {overview ? `$${overview.llmOverview.totalMonthlyCostUsd.toFixed(4)}` : '$0.0000'}
                            </span>
                            <div className="mt-2 p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800/50 space-y-1 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Input token:</span>
                                <span className="font-medium text-foreground">
                                  {overview ? `${(overview.llmOverview.totalMonthlyInputTokens / 1000).toFixed(1)}k ($${monthlyTokenCosts.inputCost.toFixed(4)})` : '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Output token:</span>
                                <span className="font-medium text-foreground">
                                  {overview ? `${(overview.llmOverview.totalMonthlyOutputTokens / 1000).toFixed(1)}k ($${monthlyTokenCosts.outputCost.toFixed(4)})` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-zinc-200 dark:border-zinc-900/60">
                            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Összes költség</h3>
                            <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400 block mt-0.5 tracking-tight">
                              {bentoLlmCostsAllTime ? `$${(bentoLlmCostsAllTime.kpi?.total_cost || 0).toFixed(4)}` : '$0.0000'}
                            </span>
                            <div className="mt-2 p-2.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded-lg border border-zinc-200/60 dark:border-zinc-800/30 space-y-1 text-xs text-muted-foreground">
                              <div className="flex justify-between">
                                <span>Input token:</span>
                                <span className="font-medium text-foreground">
                                  {bentoLlmCostsAllTime ? `${(bentoLlmCostsAllTime.kpi.total_input_tokens / 1000).toFixed(1)}k ($${allTimeTokenCosts.inputCost.toFixed(4)})` : '—'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Output token:</span>
                                <span className="font-medium text-foreground">
                                  {bentoLlmCostsAllTime ? `${(bentoLlmCostsAllTime.kpi.total_output_tokens / 1000).toFixed(1)}k ($${allTimeTokenCosts.outputCost.toFixed(4)})` : '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
                        <span className="text-xs font-semibold text-muted-foreground block">Költség Megoszlás (Modellek)</span>
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                          {(() => {
                            if (rawModels.length === 0) {
                              return <div className="text-center text-muted-foreground/60 text-[10px] py-2">Nincs modell adat</div>;
                            }

                            // Aggregate costs per normalized model name
                            const aggregated: Record<string, { name: string; cost: number; colorClass: string }> = {};
                            let totalCost = 0;

                            for (const m of rawModels) {
                              const low = (m.model || '').toLowerCase();
                              let normName = m.model || '';
                              let colorClass = 'bg-zinc-500';

                              if (low.includes('deepseek')) {
                                if (low.includes('flash')) {
                                  normName = 'deepseek-v4-flash';
                                  colorClass = 'bg-teal-500';
                                } else {
                                  normName = 'deepseek-chat';
                                  colorClass = 'bg-teal-500/80';
                                }
                              } else if (low.includes('gpt-4') || low.includes('openai')) {
                                normName = 'gpt-4o';
                                colorClass = 'bg-amber-500';
                              } else if (low.includes('gemini') || low.includes('google')) {
                                normName = 'gemini-1.5-flash';
                                colorClass = 'bg-purple-500';
                              } else {
                                normName = m.model?.split('/')?.pop() || m.model;
                              }

                              const cost = Number(m.cost) || 0;
                              totalCost += cost;

                              if (!aggregated[normName]) {
                                aggregated[normName] = { name: normName, cost: 0, colorClass };
                              }
                              aggregated[normName].cost += cost;
                            }

                            // Convert to array, sort by cost descending, and calculate percentages
                            const modelList = Object.values(aggregated)
                              .sort((a, b) => b.cost - a.cost)
                              .map((item) => ({
                                ...item,
                                pct: totalCost > 0 ? ((item.cost / totalCost) * 100).toFixed(1) : '0.0',
                              }));

                            return modelList.map((m, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-sm ${m.colorClass}`}></span>
                                  {m.name}
                                </span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200">{m.pct}%</span>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </Card>

              {/* Bento Col 2: Worker Status & Feldolgozási hibák */}
              <div className="flex flex-col space-y-4 h-full">
                <Card className="p-5">
                  {(() => {
                    const isHealthy = workerStatusData?.containers?.length > 0 
                      ? workerStatusData.containers.every((c: any) => c.is_healthy) 
                      : true;
                    const healthyCount = workerStatusData?.summary?.healthy_containers ?? 0;
                    const totalCount = workerStatusData?.summary?.total_containers ?? 0;

                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Server className="h-4 w-4 text-teal-400" />
                            <h4 className="text-sm font-semibold">Worker Status</h4>
                          </div>
                          <span className={`text-xs font-bold flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                            <span className="relative flex h-2.5 w-2.5">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                                isHealthy ? 'bg-emerald-400' : 'bg-red-400'
                              }`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                                isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                              }`}></span>
                            </span>
                            {healthyCount}/{totalCount} Konténer fut
                          </span>
                        </div>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40">
                              <span className="text-[9px] text-muted-foreground block">Státusz</span>
                              <span className={`font-bold mt-0.5 block ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                                {isHealthy ? 'Fut (Egészséges)' : 'Hiba (Unhealthy)'}
                              </span>
                            </div>
                            <div className="p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40">
                              <span className="text-[9px] text-muted-foreground block">Feldolgozás alatt</span>
                              <span className="font-bold text-teal-600 dark:text-teal-400 mt-0.5 block">
                                {workerStatusData?.queues?.reduce((acc: number, q: any) => acc + (q.visible_messages || 0), 0) ?? 0} elem
                              </span>
                            </div>
                          </div>

                          {/* CPU / RAM bars */}
                          <div className="space-y-2 pt-1">
                            <div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>CPU Terheltség</span>
                                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                  {(workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.cpu_usage || 0), 0) / (workerStatusData?.containers?.length || 1)).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded overflow-hidden">
                                <div
                                  className="bg-teal-500 h-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(10, (workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.cpu_usage || 0), 0) / (workerStatusData?.containers?.length || 1))))}%` }}
                                ></div>
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                                <span>RAM Használat</span>
                                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                                  {((workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.ram_usage || 0), 0) / (workerStatusData?.containers?.length || 1)) * 0.04).toFixed(1)} GB / 4.0 GB
                                </span>
                              </div>
                              <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded overflow-hidden">
                                <div
                                  className="bg-teal-500 h-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, Math.max(10, (workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.ram_usage || 0), 0) / (workerStatusData?.containers?.length || 1))))}%` }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Processing Errors */}
                          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
                            <div className="flex items-center justify-between">
                              <span 
                                onClick={openWorker}
                                className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-red-400 dark:hover:text-red-300 transition-colors"
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Feldolgozási hibák (24h)
                              </span>
                              <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 dark:text-red-400 text-[9px] font-bold rounded">
                                {workerStatusData?.summary?.total_errors_24h ?? 0} hiba
                              </span>
                            </div>
                            {latestCriticalError ? (
                              <div 
                                onClick={openWorker}
                                className="p-2 bg-red-500/5 hover:bg-red-500/10 dark:hover:bg-red-500/15 rounded border border-red-500/15 dark:border-red-500/10 flex justify-between items-center cursor-pointer transition-colors duration-150"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                                    [{latestCriticalError.pipeline}] {latestCriticalError.error_message || 'Feldolgozási hiba'}
                                  </span>
                                  <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                                    {latestCriticalError.file_name} · {latestCriticalError.company_name || 'Ismeretlen cég'} · {new Date(latestCriticalError.created_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <span className="text-[9px] text-red-500 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold border border-red-500/20 shrink-0">Kritikus</span>
                              </div>
                            ) : (
                              <div className="p-2 bg-emerald-500/5 rounded border border-emerald-500/10 text-center py-3">
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Nincs aktív feldolgozási hiba</span>
                              </div>
                            )}
                          </div>
                        </div>
                    </>
                  );
                })()}
              </Card>

                {/* LLM Costs Chart Panel */}
                {(() => {
                  const chartData = (bentoLlmCostsData?.daily_trend || []).length > 0
                    ? bentoLlmPeriod === '7d'
                      ? (bentoLlmCostsData.daily_trend).slice(-7).map((d: any) => ({
                          key: d.date,
                          cost: d.cost,
                          label: d.date.slice(5),
                        }))
                      : (() => {
                          const last28 = (bentoLlmCostsData.daily_trend).slice(-28);
                          const weeks = [];
                          for (let i = 0; i < last28.length; i += 7) {
                            const chunk = last28.slice(i, i + 7);
                            if (chunk.length === 0) continue;
                            const costSum = chunk.reduce((sum: number, day: any) => sum + (day.cost || 0), 0);
                            const start = chunk[0].date.slice(5);
                            const end = chunk[chunk.length - 1].date.slice(5);
                            weeks.push({
                              key: `week_${i}`,
                              cost: costSum,
                              label: `${start}–${end}`,
                            });
                          }
                          return weeks;
                        })()
                    : [];

                  const maxBentoCost = chartData.length > 0 ? Math.max(...chartData.map((x: any) => x.cost), 0.001) : 0.001;

                  return (
                    <Card className="p-5 flex-1 flex flex-col justify-between">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold">
                          {bentoLlmPeriod === '7d' ? 'LLM Napi Költségek (7 nap)' : 'LLM Heti Költségek (4 hét)'}
                        </span>
                        <div className="flex gap-1.5 text-[9px] bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                          <span 
                            onClick={() => setBentoLlmPeriod('7d')}
                            className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                              bentoLlmPeriod === '7d' ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Napi
                          </span>
                          <span 
                            onClick={() => setBentoLlmPeriod('30d')}
                            className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                              bentoLlmPeriod === '30d' ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            Heti
                          </span>
                        </div>
                      </div>
                      <div className="h-20 w-full flex items-end justify-between gap-4 pt-5 px-2">
                        {chartData.length > 0 ? (
                          chartData.map((d: any, i: number, arr: any[]) => (
                            <div
                              key={d.key}
                              className="flex-1 rounded-t-sm min-h-[2px] relative group cursor-default"
                              style={{
                                height: `${Math.max((d.cost / maxBentoCost) * 100, 4)}%`,
                                background: i === arr.length - 1
                                  ? 'linear-gradient(180deg, #14b8a6, #14b8a650)'
                                  : 'linear-gradient(180deg, #6366f1, #6366f150)',
                              }}
                            >
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 font-mono text-[8.5px] text-muted-foreground text-center whitespace-nowrap">
                                <span className="font-bold text-foreground">${d.cost.toFixed(4)}</span>
                                <span className="block text-[7px] text-muted-foreground/50 mt-0.5">{d.label}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center text-muted-foreground text-xs py-6 w-full">Nincs elérhető trend adat</div>
                        )}
                      </div>
                    </Card>
                  );
                })()}
              </div>

              {/* Bento Col 3: Tickets & Files */}
              <div className="flex flex-col space-y-3 h-full">
                {/* Tickets card */}
                <Card className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span 
                      onClick={openTickets}
                      className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-teal-500 dark:hover:text-teal-300 transition-colors"
                    >
                      <TicketCheck className="h-3.5 w-3.5" />
                      Hibajegyek
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div 
                      onClick={openTickets}
                      className="py-1.5 px-3 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 text-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <span className="text-[9px] text-zinc-500 block mb-1">Új (felelős nélkül)</span>
                      <span className="text-xl font-black text-teal-600 dark:text-teal-400">{ticketsOverview.newUnassigned}</span>
                    </div>
                    <div 
                      onClick={openTickets}
                      className="py-1.5 px-3 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 text-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
                    >
                      <span className="text-[9px] text-zinc-500 block mb-1">Megoldott</span>
                      <span className="text-xl font-bold text-zinc-700 dark:text-zinc-300">{ticketsOverview.resolved}</span>
                    </div>
                  </div>
                </Card>

                {/* Applikáció hibák card */}
                <Card className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span 
                      onClick={openErrors}
                      className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-red-600 dark:hover:text-red-300 transition-colors"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Applikáció hibák
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div 
                      onClick={openErrors}
                      className="py-1.5 px-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
                    >
                      <div>
                        <span className="text-[9px] text-zinc-500 block mb-0.5 font-bold">Rendszer & feltöltési naplók</span>
                        <span className="text-[10px] text-muted-foreground block">Kattints a részletes hibanaplóhoz</span>
                      </div>
                      <span className={`text-xl font-black px-2 py-0.5 rounded flex items-center justify-center min-w-[36px] ${
                        (overview?.totalErrors ?? 0) > 0 
                          ? 'text-red-500 dark:text-red-400 bg-red-500/10 animate-pulse border border-red-500/20' 
                          : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                      }`}>
                        {overview?.totalErrors ?? 0}
                      </span>
                    </div>

                    {/* Most Error Company & User Stats */}
                    {overview && (overview.mostErrorCompany || overview.mostErrorUser) && (
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        {overview.mostErrorCompany ? (
                          <div className="p-1.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded border border-zinc-200/60 dark:border-zinc-800/20">
                            <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Legtöbb hiba (Cég)</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate mt-0.5" title={overview.mostErrorCompany.name}>
                              {overview.mostErrorCompany.name}
                            </span>
                            <span className="text-[9px] text-red-500 dark:text-red-400 font-bold block mt-0.5">
                              {overview.mostErrorCompany.errorCount} hiba
                            </span>
                          </div>
                        ) : (
                          <div className="p-1.5 bg-zinc-100/20 dark:bg-zinc-900/20 rounded border border-dashed border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center text-zinc-500 text-[8px] uppercase">
                            Nincs cég hiba
                          </div>
                        )}

                        {overview.mostErrorUser ? (
                          <div className="p-1.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded border border-zinc-200/60 dark:border-zinc-800/20">
                            <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Legtöbb hiba (Felh.)</span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate mt-0.5" title={`${overview.mostErrorUser.name} (${overview.mostErrorUser.email})`}>
                              {overview.mostErrorUser.name}
                            </span>
                            <span className="text-[9px] text-red-500 dark:text-red-400 font-bold block mt-0.5">
                              {overview.mostErrorUser.errorCount} hiba
                            </span>
                          </div>
                        ) : (
                          <div className="p-1.5 bg-zinc-100/20 dark:bg-zinc-900/20 rounded border border-dashed border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center text-zinc-500 text-[8px] uppercase">
                            Nincs felhasználó hiba
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Recent Files card */}
                <Card className="p-3.5 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5" />
                      Utolsó fájlok
                    </span>
                    <span className="text-[10px] text-muted-foreground">Frissítve</span>
                  </div>
                  <div className="space-y-1 text-xs flex-1 flex flex-col justify-start">
                    {recentFilesList.length > 0 ? (
                      recentFilesList.map((f: any) => (
                        <button
                          key={f.id}
                          disabled={!f.file_url}
                          onClick={() => {
                            if (f.file_url) {
                              setPreviewFile({ url: f.file_url, name: f.file_name });
                            }
                          }}
                          className={cn(
                            "w-full flex items-center justify-between py-1.5 px-2 bg-zinc-100/50 dark:bg-zinc-900/50 rounded transition-colors text-left",
                            f.file_url ? "hover:bg-zinc-200/85 dark:hover:bg-zinc-900/85 cursor-pointer" : "cursor-default"
                          )}
                        >
                          <span
                            className={cn(
                              "flex-1 mr-2 truncate text-xs transition-colors",
                              f.file_url
                                ? "text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                                : "text-zinc-700 dark:text-zinc-300"
                            )}
                            title={f.file_name}
                          >
                            {f.file_name}
                          </span>
                          <span className={cn(
                            "text-[9px] font-bold shrink-0",
                            (() => {
                              const cat = normalizeStatus(f.processing_status, f.error_message);
                              if (cat === "success") return "text-emerald-600 dark:text-emerald-400";
                              if (cat === "error") return "text-red-500 dark:text-red-400";
                              if (cat === "redirected") return "text-blue-500 dark:text-blue-400";
                              return "text-teal-600 dark:text-teal-400 animate-pulse";
                            })()
                          )}>
                            {(() => {
                              const cat = normalizeStatus(f.processing_status, f.error_message);
                              if (cat === "success") return "Kész";
                              if (cat === "error") return "Hiba";
                              if (cat === "redirected") return "Átirányítva";
                              return "Feldolgozás";
                            })()}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center text-muted-foreground text-xs py-4">Nincs nemrég feltöltött fájl</div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          </div>
          )
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
              <div className="flex-1 overflow-hidden relative">
                <FilePreviewContent previewFile={previewFile} />
              </div>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ─── Control Center (tabs: Hibák / Jogosultságok / Fájlok / Worker / Felhasználók) ────
// ═══════════════════════════════════════════════════════
type ControlCenterTab = 'errors' | 'permissions' | 'files' | 'worker' | 'users';

interface ControlCenterUser {
  user_id: string;
  name: string;
  email: string;
}

function ControlCenter({
  initialTab,
  onOpenCompany,
  allUsers,
  overviewLoading,
  companyCostMap,
}: {
  initialTab: ControlCenterTab;
  onOpenCompany: (id: string) => void;
  allUsers: ControlCenterUser[];
  overviewLoading: boolean;
  companyCostMap: Map<string, any>;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = initialTab;

  const setTab = (newTab: ControlCenterTab) => {
    setSearchParams({ view: newTab });
  };

  return (
    <div className="space-y-6 page-animate overflow-hidden">
      {/* Tab bar — azonos design mint a TicketsPage subtabs */}
      <div className="flex border-b border-border bg-muted/20 rounded-lg p-1 w-fit gap-1">
        <button
          onClick={() => setTab('errors')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
            tab === 'errors'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Hibák
        </button>
        <button
          onClick={() => setTab('files')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
            tab === 'files'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Fájlok
        </button>
        <button
          onClick={() => setTab('worker')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
            tab === 'worker'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          Worker
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
            tab === 'users'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          Felhasználók
        </button>
        <button
          onClick={() => setTab('permissions')}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap border ${
            tab === 'permissions'
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Jogosultságok
        </button>
      </div>

      {/* Tab content — ensures all tabs fill the same width to prevent layout shift */}
      <div className="w-full overflow-hidden">
        <div className="w-full" style={{ minWidth: 900 }}>
          {tab === 'errors' && <ErrorControlPanel onOpenCompany={onOpenCompany} allUsers={allUsers} />}
          {tab === 'permissions' && <PermissionsPanel allUsers={allUsers} />}
          {tab === 'files' && <FilesPanel allUsers={allUsers} />}
          {tab === 'worker' && <WorkerPanel />}
          {tab === 'users' && (
            <UsersControlPanel
              allUsers={allUsers}
              overviewLoading={overviewLoading}
              companyCostMap={companyCostMap}
              onOpenCompany={onOpenCompany}
            />
          )}
        </div>
      </div>
    </div>
  );
}
// ═══════════════════════════════════════════════════════
// ─── Worker Panel ─────────────────────────────────────
// ═══════════════════════════════════════════════════════

/** SVG sparkline bar chart — dependency-free */
function MiniSparkline({ data, color = 'hsl(var(--primary))' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 20;
  const gap = 2;
  const barW = Math.max(2, (w - (data.length - 1) * gap) / data.length);
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      {data.map((v, i) => {
        const barH = Math.max(1, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={h - barH}
            width={barW}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.35 + (i / data.length) * 0.6}
          />
        );
      })}
    </svg>
  );
}

/** Format uptime seconds to human-readable */
function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

/** Format duration ms */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}


// ═══════════════════════════════════════════════════════
// ─── LLM Cost Panel ──────────────────────────────────
// ═══════════════════════════════════════════════════════
const PIE_COLORS = ['#a78bfa', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'];
const PROJECT_COLORS: Record<string, string> = { PROD: '#10b981', VSWEB: '#3b82f6', THINKERMAN: '#f59e0b' };

function CSSPieChart({ data, centerLabel, centerSub, size = 140 }: {
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="flex items-center justify-center text-muted-foreground text-xs" style={{ width: size, height: size }}>Nincs adat</div>;
  let cumPct = 0;
  const stops = data.map(d => {
    const start = cumPct;
    cumPct += (d.value / total) * 100;
    return `${d.color} ${start}% ${cumPct}%`;
  }).join(', ');

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${stops})` }} />
      <div className="absolute rounded-full bg-background" style={{ inset: size * 0.2 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span className="text-sm font-bold">{centerLabel}</span>
        <span className="text-[9px] text-muted-foreground">{centerSub}</span>
      </div>
    </div>
  );
}

function LLMCostPanel() {
  const [period, setPeriod] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['llm-costs', period],
    queryFn: () => fetchManagementData('llm-costs', { period }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {/* Period selector skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-64 rounded-md" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3.5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-2 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Pie charts + Top companies row skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-28 w-28 rounded-full" />
                <div className="space-y-1.5 w-full">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {/* Daily trend skeleton */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${20 + Math.random() * 60}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Model table skeleton */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpi = {}, by_pipeline = [], by_project = [], top_companies = [], daily_trend = [], by_model = [] } = data;
  const maxDailyCost = Math.max(...daily_trend.map((d: any) => d.cost), 0.001);

  const periodLabel: Record<string, string> = { 'all': 'Összesen', '24h': '24 óra', '7d': '7 nap', '30d': '30 nap', '90d': '90 nap' };

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-muted/30 p-0.5 rounded-md">
          {['all', '24h', '7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                period === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {periodLabel[p] || p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Összes LLM költség', value: `$${kpi.total_cost?.toFixed(2) || '0'}`, icon: DollarSign, color: 'text-purple-400', sub: '3 projekt összesen' },
          { label: 'Feldolgozott jobok', value: String(kpi.total_jobs || 0), icon: CheckCircle2, color: 'text-emerald-500', sub: 'összes pipeline' },
          { label: 'Átlag költség/job', value: `$${kpi.avg_cost_per_job?.toFixed(4) || '0'}`, icon: TrendingUp, color: 'text-blue-400', sub: 'összes pipeline átlag' },
          { label: 'Összes token', value: formatTokens(kpi.total_tokens || 0), icon: Zap, color: 'text-amber-400', sub: 'input + output' },
        ].map((kpiItem, i) => (
          <Card key={i} className="border-border/40">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <kpiItem.icon className={`h-3.5 w-3.5 ${kpiItem.color}`} />
                {kpiItem.label}
              </div>
              <div className={`text-xl font-bold tracking-tight ${kpiItem.color}`}>{kpiItem.value}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">{kpiItem.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost by Pipeline */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-400" />
              Költség pipeline szerint
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-6">
              <CSSPieChart
                data={by_pipeline.map((p: any, i: number) => ({ label: p.pipeline, value: p.cost, color: PIE_COLORS[i % PIE_COLORS.length] }))}
                centerLabel={`$${kpi.total_cost?.toFixed(2) || '0'}`}
                centerSub={periodLabel[period] || '7 nap'}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                {by_pipeline.map((p: any, i: number) => (
                  <div key={p.pipeline} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground flex-1 truncate">{p.pipeline}</span>
                    <span className="font-semibold tabular-nums">${p.cost}</span>
                    <span className="text-muted-foreground/50 text-[10px] w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost by Project */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-500" />
              Költség projekt szerint
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-6">
              <CSSPieChart
                data={by_project.map((p: any) => ({ label: p.project, value: p.cost, color: PROJECT_COLORS[p.project] || '#6b7280' }))}
                centerLabel="3 projekt"
                centerSub={periodLabel[period] || '7 nap'}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                {by_project.map((p: any) => (
                  <div key={p.project} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PROJECT_COLORS[p.project] || '#6b7280' }} />
                    <span className="text-muted-foreground flex-1">{p.project}</span>
                    <span className="font-semibold tabular-nums">${p.cost}</span>
                    <span className="text-muted-foreground/50 text-[10px] w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Companies + Daily Trend */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top 3 Companies */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top 3 legdrágább cég
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {top_companies.map((c: any, i: number) => {
              const maxCost = top_companies[0]?.cost || 1;
              const rankColors = ['bg-amber-500/15 text-amber-500', 'bg-slate-400/15 text-slate-400', 'bg-orange-700/15 text-orange-600'];
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/20 last:border-0">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${rankColors[i] || rankColors[2]}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground/60">{c.jobs} job · {c.project}</div>
                    <div className="mt-1.5 h-0.5 bg-muted/30 rounded-full">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style={{ width: `${(c.cost / maxCost) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-purple-400 tabular-nums">${c.cost}</div>
                </div>
              );
            })}
            {top_companies.length === 0 && (
              <p className="text-xs text-muted-foreground/60 py-4 text-center">Nincs adat</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Cost Trend */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Napi költség trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-[2px] h-20">
              {daily_trend.slice(-14).map((d: any, i: number, arr: any[]) => (
                <div
                  key={d.date}
                  className="flex-1 rounded-t-sm min-h-[2px] relative group cursor-default"
                  style={{
                    height: `${Math.max((d.cost / maxDailyCost) * 100, 2)}%`,
                    background: i === arr.length - 1
                      ? 'linear-gradient(180deg, #10b981, #10b98150)'
                      : 'linear-gradient(180deg, #a78bfa, #7c3aed50)',
                  }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover border border-border px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    ${d.cost} · {d.date.slice(5)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-[2px] mt-1">
              {daily_trend.slice(-14).map((d: any, i: number, arr: any[]) => (
                <div key={d.date} className="flex-1 text-center text-[8px] text-muted-foreground/40">
                  {i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2) ? d.date.slice(5) : ''}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Usage Table */}
      <Card className="border-border/40">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Modell használat
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-1.5 font-medium text-muted-foreground">Modell</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Pipeline</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Jobok</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Átlag token</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Költség</th>
                <th className="text-right px-4 py-1.5 font-medium text-muted-foreground">Arány</th>
              </tr>
            </thead>
            <tbody>
              {by_model.map((m: any, i: number) => (
                <tr key={i} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium text-purple-400">{m.model?.split('/')?.pop() || m.model}</td>
                  <td className="px-3 py-2">{m.pipeline}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums">{m.jobs.toLocaleString()}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums text-muted-foreground">{m.avg_tokens.toLocaleString()}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums text-purple-400 font-semibold">${m.cost}</td>
                  <td className="text-right px-4 py-2 text-muted-foreground/60">{m.pct}%</td>
                </tr>
              ))}
              {by_model.length === 0 && (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground/60">Nincs modell adat</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Global File Preview Content Component ────────────────
function FilePreviewContent({ previewFile }: { previewFile: { url: string; name: string } }) {
  const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isCsv = ['csv', 'tsv'].includes(ext);
  const isExcel = ['xls', 'xlsx', 'xlsm'].includes(ext);

  if (isPdf) {
    return (
      <iframe
        src={`${previewFile.url}#toolbar=1`}
        className="w-full h-full border-0"
        title={`PDF előnézet: ${previewFile.name}`}
      />
    );
  }

  if (isImage) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6 overflow-auto bg-black/20">
        <img
          src={previewFile.url}
          alt={previewFile.name}
          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
        />
      </div>
    );
  }

  if (isExcel) {
    const encodedUrl = encodeURIComponent(previewFile.url);
    const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
    return (
      <iframe
        src={officeUrl}
        className="w-full h-full border-0 bg-background"
        title={`Excel előnézet: ${previewFile.name}`}
      />
    );
  }

  if (isCsv) {
    return <CsvPreviewComponent url={previewFile.url} />;
  }

  return (
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
      </div>
    </div>
  );
}

function CsvPreviewComponent({ url }: { url: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-xs">Nem sikerült betölteni a CSV tartalmát.</p>
      </div>
    );
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0).slice(0, 100);
  const rows = lines.map(line => {
    const delimiter = line.includes(';') ? ';' : ',';
    return line.split(delimiter);
  });

  return (
    <div className="w-full h-full overflow-auto p-4 bg-background">
      <div className="border border-border/40 rounded-lg overflow-x-auto">
        <table className="w-full text-[11px] font-mono border-collapse">
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={`border-b border-border/20 ${rIdx === 0 ? 'bg-muted/50 font-bold text-foreground' : 'hover:bg-muted/20 text-muted-foreground'}`}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 border-r border-border/25 whitespace-nowrap">
                    {cell.replace(/^"|"$/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 100 && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Csak az első 100 sor jelenik meg előnézetben.</p>
      )}
    </div>
  );
}

function WorkerPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Driving state from URL search params
  const workerTab = (searchParams.get('wrk_tab') as 'overview' | 'llm-costs') || 'overview';
  const workerPeriod = searchParams.get('wrk_period') || '24h';
  const errorPage = Number(searchParams.get('wrk_err_page')) || 1;

  // Helper to update parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'containers' | 'queues'>('containers');
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const showAllQueues = searchParams.get('wrk_show_queues') === 'true';
  const [dismissedQueues, setDismissedQueues] = useState<Set<string>>(new Set());
  const showProcessing = searchParams.get('wrk_show_processing') === 'true';
  const showWorkerErrors = searchParams.get('wrk_show_errors') === 'true';
  const [expandedErrorRowId, setExpandedErrorRowId] = useState<string | null>(null);
  const [workerErrorSearch, setWorkerErrorSearch] = useState('');
  const ERROR_PAGE_SIZE = 10;

  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same');
  const [retrying, setRetrying] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const RETRYABLE_SOURCES = new Set(['invoice_uploads', 'transaction_uploads', 'gl_upload_notifications']);

  const PIPELINE_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode; queue?: string; category?: string | null }> = [
    { value: 'same', label: 'Eredeti pipeline (változatlan)', icon: <RotateCcw className="h-4 w-4 text-muted-foreground" /> },
    { value: 'invoice', label: 'Számla feldolgozás', icon: <Receipt className="h-4 w-4 text-emerald-500" />, queue: 'invoice_jobs', category: 'invoice' },
    { value: 'payroll', label: 'Bérjegyzék feldolgozás', icon: <Wallet className="h-4 w-4 text-amber-500" />, queue: 'invoice_jobs', category: 'payroll' },
    { value: 'transaction', label: 'Tranzakció feldolgozás', icon: <Landmark className="h-4 w-4 text-blue-500" />, queue: 'transaction_jobs', category: null },
    { value: 'gl', label: 'Főkönyvi besorolás', icon: <BarChart3 className="h-4 w-4 text-purple-500" />, queue: 'gl_classification_jobs', category: null },
  ];

  const openRetryModal = (ids: Array<{ source: string; id: string }>) => {
    const retryable = ids.filter(i => RETRYABLE_SOURCES.has(i.source));
    if (retryable.length === 0) {
      toast({ title: 'Nem támogatott', description: 'A kijelölt fájl nem támogatja az újraküldést.', variant: 'destructive' });
      return;
    }
    setRetryTargets(retryable);
    setRetryPipeline('same');
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (retryTargets.length === 0) return;
    setRetrying(true);
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
      if (result.error) {
        reportError({ type: 'api_call', severity: 'warning', component: 'ManagementDashboard', action: 'warning', message: 'Retry partial errors from worker', error: result.error });
        toast({ title: 'Részleges újraküldés', description: `${result.retried || 0} elem újraküldve, néhány hiba történt.`, variant: 'destructive' });
      } else {
        toast({ title: 'Újraküldés sikeres', description: `${result.retried || retryTargets.length} elem újra feldolgozásra küldve.` });
      }
      queryClient.invalidateQueries({ queryKey: ['worker-status'] });
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors from worker failed:', error: e });
      toast({ title: 'Újraküldés sikertelen', description: 'Hiba történt az újraküldés során.', variant: 'destructive' });
    } finally {
      setRetrying(false);
      setRetryModalOpen(false);
      setRetryTargets([]);
    }
  };

  const workerPeriodLabel: Record<string, string> = { 'all': 'Összesen', '24h': '24 óra', '7d': '7 nap', '30d': '30 nap', '90d': '90 nap' };

  // Near-realtime 5s polling for operator dashboard responsiveness
  const { data, isLoading } = useQuery({
    queryKey: ['worker-status', workerPeriod],
    queryFn: () => fetchManagementData('worker-status', { period: workerPeriod }),
    refetchInterval: 5_000,
    staleTime: 2_500,
  });

  const recent_jobs = data?.recent_jobs || [];
  const { containers = [], queues = [], pipelines = [], active_processing = [], summary = {} } = data || {};

  // Default: select first container
  const activeContainer = selectedContainer || containers[0]?.container_name || null;
  const containerData = containers.find((c: any) => c.container_name === activeContainer);

  // Filter recent jobs & pipelines for the selected container's project
  const activeProject = containerData?.supabase_project || null;

  // Group recent jobs by job execution to avoid duplicate entries for multi-model runs
  const groupedRecentJobs = useMemo(() => {
    const grouped: Record<string, any> = {};
    for (const j of recent_jobs) {
      // Group by upload_id if available, otherwise fall back to a minute-precision timestamp key
      const key = j.upload_id 
        ? `${j.project}_${j.upload_id}` 
        : `${j.project}_${j.worker_id}_${j.pipeline}_${j.file_name}_${j.created_at?.substring(0, 16)}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...j,
          estimated_cost_usd: j.estimated_cost_usd || 0,
          total_tokens: j.total_tokens || 0,
          processing_duration_ms: j.processing_duration_ms || 0,
          status: j.status || 'OK',
        };
      } else {
        grouped[key].estimated_cost_usd += (j.estimated_cost_usd || 0);
        grouped[key].total_tokens += (j.total_tokens || 0);
        grouped[key].processing_duration_ms = Math.max(grouped[key].processing_duration_ms, j.processing_duration_ms || 0);
        if (j.status === 'ERROR') {
          grouped[key].status = 'ERROR';
        } else if (j.status === 'REDIRECTED' && grouped[key].status !== 'ERROR') {
          grouped[key].status = 'REDIRECTED';
        }
      }
    }
    return Object.values(grouped).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [recent_jobs]);

  const filteredJobs = useMemo(() => {
    return activeProject
      ? groupedRecentJobs.filter((j: any) => j.worker_id === activeContainer || j.project === activeProject)
      : groupedRecentJobs;
  }, [groupedRecentJobs, activeProject, activeContainer]);

  const errorJobs = useMemo(() => {
    return data?.error_jobs || [];
  }, [data]);

  const filteredErrorJobs = useMemo(() => {
    if (!workerErrorSearch) return errorJobs;
    const term = workerErrorSearch.toLowerCase().trim();
    return errorJobs.filter((j: any) =>
      (j.file_name || '').toLowerCase().includes(term) ||
      (j.company_name || '').toLowerCase().includes(term) ||
      (j.pipeline || '').toLowerCase().includes(term) ||
      (j.error_message || '').toLowerCase().includes(term)
    );
  }, [errorJobs, workerErrorSearch]);

  const errorTotalPages = Math.max(1, Math.ceil(filteredErrorJobs.length / ERROR_PAGE_SIZE));

  const paginatedErrorJobs = useMemo(() => {
    return filteredErrorJobs.slice((errorPage - 1) * ERROR_PAGE_SIZE, errorPage * ERROR_PAGE_SIZE);
  }, [filteredErrorJobs, errorPage]);

  const prevPeriodRef = React.useRef(workerPeriod);
  useEffect(() => {
    if (prevPeriodRef.current !== workerPeriod) {
      updateParams({ wrk_err_page: null });
      prevPeriodRef.current = workerPeriod;
    }
  }, [workerPeriod, updateParams]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {/* Sub-tab skeleton */}
        <Skeleton className="h-9 w-60 rounded-lg" />
        {/* KPI row skeleton */}
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3.5 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-2 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Container + Content skeleton */}
        <div className="grid grid-cols-[240px_1fr] gap-4">
          <Card className="border-border/40">
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-4 w-24 mb-3" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const filteredPipelines = activeProject
    ? pipelines.filter((p: any) => p.project === activeProject)
    : pipelines;
  const filteredQueues = (activeProject
    ? queues.filter((q: any) => q.project === activeProject)
    : queues
  ).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name));

  return (
    <div className="space-y-4">
      {/* ── Worker Sub-Tabs ── */}
      <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => updateParams({ wrk_tab: 'overview' })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            workerTab === 'overview' ? 'bg-emerald-500/12 text-emerald-500' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          Áttekintés
        </button>
        <button
          onClick={() => updateParams({ wrk_tab: 'llm-costs' })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            workerTab === 'llm-costs' ? 'bg-purple-500/12 text-purple-400' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          LLM Költség
        </button>
      </div>

      {workerTab === 'llm-costs' ? (
        <LLMCostPanel />
      ) : (
      <>
      {/* ── Period Selector ── */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-muted/30 p-0.5 rounded-md">
          {['all', '24h', '7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => updateParams({ wrk_period: p })}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                workerPeriod === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {workerPeriodLabel[p] || p}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Summary Row ── */}
      <div className="grid grid-cols-5 gap-3">
        {[
          {
            label: 'Konténerek',
            value: `${summary.healthy_containers || 0}/${summary.total_containers || 0}`,
            icon: Server,
            color: summary.healthy_containers === summary.total_containers ? 'text-emerald-500' : 'text-amber-500',
            sub: 'healthy',
          },
          {
            label: 'Queue várakozó',
            value: summary.total_queue_pending || 0,
            icon: ClipboardList,
            color: (summary.total_queue_pending || 0) > 20 ? 'text-amber-500' : 'text-blue-500',
            sub: 'üzenet',
          },
          {
            label: `Feldolgozva (${workerPeriodLabel[workerPeriod]})`,
            value: summary.total_jobs_24h || 0,
            icon: CheckCircle2,
            color: 'text-emerald-500',
            sub: 'job',
          },
          {
            label: 'Feldolgozás alatt',
            value: summary.total_processing || 0,
            icon: Loader,
            color: (summary.total_processing || 0) > 0 ? 'text-cyan-500' : 'text-muted-foreground',
            sub: 'aktív',
          },
          {
            label: `Worker hibák (${workerPeriodLabel[workerPeriod]})`,
            value: summary.total_errors_24h || 0,
            icon: AlertTriangle,
            color: (summary.total_errors_24h || 0) > 0 ? 'text-red-500' : 'text-muted-foreground',
            sub: 'hiba',
          },
        ].map((kpi) => {
          const isQueueKpi = kpi.label === 'Queue várakozó';
          const isProcessingKpi = kpi.label === 'Feldolgozás alatt';
          const isErrorKpi = kpi.label.startsWith('Worker hibák');
          const isQueueClickable = isQueueKpi && (summary.total_queue_pending || 0) > 0;
          const isProcessingClickable = isProcessingKpi;
          const isErrorClickable = isErrorKpi && (summary.total_errors_24h || 0) > 0;
          const isClickable = isQueueClickable || isProcessingClickable || isErrorClickable;
          const isActive = (showAllQueues && isQueueKpi) || (showProcessing && isProcessingKpi) || (showWorkerErrors && isErrorKpi);
          const activeColor = isQueueKpi 
            ? 'border-amber-500/50 bg-amber-500/5' 
            : isProcessingKpi 
              ? 'border-cyan-500/50 bg-cyan-500/5' 
              : 'border-red-500/50 bg-red-500/5';
          const hoverColor = isQueueKpi 
            ? 'hover:border-amber-500/50 hover:bg-amber-500/5' 
            : isProcessingKpi 
              ? 'hover:border-cyan-500/50 hover:bg-cyan-500/5' 
              : 'hover:border-red-500/50 hover:bg-red-500/5';
          return (
          <Card
            key={kpi.label}
            className={`p-3 bg-card/80 border-border/50 transition-colors ${
              isClickable ? `cursor-pointer ${hoverColor}` : 'hover:border-border'
            } ${isActive ? activeColor : ''}`}
            onClick={() => {
              if (isQueueClickable) {
                updateParams({
                  wrk_show_queues: showAllQueues ? null : 'true',
                  wrk_show_processing: null,
                  wrk_show_errors: null,
                  wrk_err_page: null,
                });
                setSelectedQueue(null);
                setDismissedQueues(new Set());
              } else if (isProcessingClickable) {
                updateParams({
                  wrk_show_processing: showProcessing ? null : 'true',
                  wrk_show_queues: null,
                  wrk_show_errors: null,
                  wrk_err_page: null,
                });
                setSelectedQueue(null);
              } else if (isErrorClickable) {
                updateParams({
                  wrk_show_errors: showWorkerErrors ? null : 'true',
                  wrk_show_queues: null,
                  wrk_show_processing: null,
                  wrk_err_page: null,
                });
                setSelectedQueue(null);
              }
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`h-4 w-4 ${kpi.color} ${isProcessingKpi && (summary.total_processing || 0) > 0 ? 'animate-spin' : ''}`} />
              <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
            </div>
            <div className="text-lg font-bold">{kpi.value}</div>
          </Card>
          );
        })}
      </div>

      {/* ── Split Panel: Left Nav + Right Content ── */}
      <div className="grid grid-cols-[220px_1fr] gap-4">
        {/* Left sidebar */}
        <div className="space-y-3">
          {/* Containers section */}
          <div>
            <button
              onClick={() => setSelectedSection('containers')}
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded w-full text-left transition-colors ${
                selectedSection === 'containers' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Server className="h-3 w-3" />
              Konténerek
            </button>
            <div className="mt-1 space-y-0.5">
              {containers.map((c: any) => (
                <button
                  key={c.container_name}
                  onClick={() => { setSelectedContainer(c.container_name); setSelectedSection('containers'); }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs transition-colors ${
                    activeContainer === c.container_name && selectedSection === 'containers'
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <CircleDot className={`h-2.5 w-2.5 ${c.is_healthy ? 'text-emerald-500' : 'text-red-500'}`} />
                  <span className="truncate flex-1 text-left">{c.container_name}</span>
                  <div className="flex items-center gap-1.5 ml-auto text-[10px] opacity-60 font-mono">
                    {c.is_healthy && c.cpu_usage !== undefined && c.cpu_usage > 0 && (
                      <span className={`${c.cpu_usage > 80 ? 'text-red-400 font-semibold' : c.cpu_usage > 50 ? 'text-amber-400' : 'text-muted-foreground/80'}`}>{c.cpu_usage.toFixed(0)}%</span>
                    )}
                    <span>({c.jobs_24h})</span>
                  </div>
                </button>
              ))}
              {containers.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-3 py-1">Nincs heartbeat adat</p>
              )}
            </div>
          </div>

          {/* Queues section */}
          <div>
            <button
              onClick={() => setSelectedSection('queues')}
              className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded w-full text-left transition-colors ${
                selectedSection === 'queues' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ClipboardList className="h-3 w-3" />
              Queue-k
            </button>
            <div className="mt-1 space-y-0.5">
              {filteredQueues.map((q: any) => {
                const hasItems = q.queue_length > 0;
                const queueKey = `${q.project}:${q.queue_name}`;
                const isDismissed = dismissedQueues.has(queueKey);
                // In showAllQueues mode: expanded = has items & not dismissed
                const isExpanded = showAllQueues ? (hasItems && !isDismissed) : selectedQueue === q.queue_name;
                return (
                  <button
                    key={q.queue_name}
                    onClick={() => {
                      if (!hasItems) return;
                      if (showAllQueues) {
                        // Toggle dismiss
                        if (isDismissed) {
                          setDismissedQueues(prev => { const next = new Set(prev); next.delete(queueKey); return next; });
                        } else {
                          setDismissedQueues(prev => new Set([...prev, queueKey]));
                        }
                      } else {
                        setSelectedQueue(prev => prev === q.queue_name ? null : q.queue_name);
                      }
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs transition-colors ${
                      isExpanded
                        ? 'bg-amber-500/10 text-amber-400 font-medium'
                        : hasItems
                          ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer'
                          : 'text-muted-foreground/60 cursor-default'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${hasItems ? 'bg-amber-500' : 'bg-emerald-500/50'}`} />
                    <span className="truncate flex-1 text-left">{q.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '')}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 min-w-[24px] text-center justify-center ${hasItems ? 'bg-amber-500/15 text-amber-400' : ''}`}>
                      {q.queue_length}
                    </Badge>
                    <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${
                      !hasItems ? 'invisible' : isExpanded ? 'rotate-180 text-amber-400' : 'text-muted-foreground/40'
                    }`} />
                  </button>
                );
              })}
              {filteredQueues.length === 0 && (
                <p className="text-xs text-muted-foreground/60 px-3 py-1">Nincs queue adat</p>
              )}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Container header */}
          {selectedSection === 'containers' && containerData && (
            <Card className="p-3 bg-card/60 border-border/40">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${containerData.is_healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                  <Server className={`h-5 w-5 ${containerData.is_healthy ? 'text-emerald-500' : 'text-red-500'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{containerData.container_name}</span>
                    <Badge variant={containerData.is_healthy ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0">
                      {containerData.is_healthy ? 'Healthy' : 'Unhealthy'}
                    </Badge>
                    {containerData.version && (
                      <span className="text-[10px] text-muted-foreground font-mono">{containerData.version}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                    <span>Uptime: {formatUptime(containerData.uptime_seconds)}</span>
                    {containerData.host_ip && <span>IP: {containerData.host_ip}</span>}
                    <span>Jobs (24h): {containerData.jobs_24h}</span>
                    <span>Avg: {formatDuration(containerData.avg_duration_ms)}</span>
                    <span>LLM: ${containerData.total_cost_24h}</span>
                  </div>
                  {containerData.cpu_usage !== undefined && containerData.ram_usage !== undefined && (
                    <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border/10 pt-3">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground font-medium">CPU terheltség</span>
                          <span className="font-semibold text-foreground font-mono">{containerData.cpu_usage.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              containerData.cpu_usage > 85 ? 'bg-red-500' : containerData.cpu_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, containerData.cpu_usage))}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-muted-foreground font-medium">RAM használat</span>
                          <span className="font-semibold text-foreground font-mono">{containerData.ram_usage.toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              containerData.ram_usage > 85 ? 'bg-red-500' : containerData.ram_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, containerData.ram_usage))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* ── Worker Errors Panel (replaces pipeline+jobs when active) ── */}
          {showWorkerErrors ? (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Hibás feldolgozások (Összes projekt)
                    <Badge className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400">
                      {filteredErrorJobs.length} hiba
                    </Badge>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        value={workerErrorSearch}
                        onChange={e => { setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('wrk_err_page', '1'); return n; }); setWorkerErrorSearch(e.target.value); }}
                        placeholder="Keresés (fájl, cég, hiba)..."
                        className="pl-8 h-7 text-xs w-64 bg-background/50 border-border/30 focus-visible:bg-background"
                      />
                    </div>
                    <button onClick={() => { updateParams({ wrk_show_errors: null, wrk_err_page: null }); setWorkerErrorSearch(''); }} className="text-muted-foreground hover:text-foreground p-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-2">
                {errorJobs.length > 0 ? (
                  <>
                    <table className="w-full text-xs table-fixed">
                      <thead>
                        <tr className="border-b border-border/30 text-muted-foreground">
                          <th className="text-left px-4 py-1.5 font-medium w-[110px]">Dátum</th>
                          <th className="text-left px-3 py-1.5 font-medium w-[110px]">Pipeline</th>
                          <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                          <th className="text-left px-3 py-1.5 font-medium w-[160px]">Cég</th>
                          <th className="text-right px-3 py-1.5 font-medium w-[70px]">Idő</th>
                          <th className="text-right px-3 py-1.5 font-medium w-[80px]">$</th>
                          <th className="text-left px-3 py-1.5 font-medium w-[220px]">Worker</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredErrorJobs.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                              Nincs találat a keresésre: <span className="font-semibold text-foreground">"{workerErrorSearch}"</span>
                            </td>
                          </tr>
                        ) : (
                          paginatedErrorJobs.map((j: any) => {
                          const time = new Date(j.created_at);
                          const dateStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getDate().toString().padStart(2, '0')}`;
                          const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                          return (
                            <React.Fragment key={j.id}>
                              <tr 
                                className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${expandedErrorRowId === j.id ? 'bg-red-500/5 hover:bg-red-500/5' : ''}`}
                                onClick={() => setExpandedErrorRowId(prev => prev === j.id ? null : j.id)}
                              >
                                <td className="px-4 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr} - {timeStr}</td>
                                <td className="px-3 py-1.5">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-[75px] justify-center">{j.pipeline}</Badge>
                                </td>
                                <td className="px-3 py-1.5 max-w-[200px] truncate" title={j.file_name}>
                                  {j.file_url ? (
                                    <button
                                      className="font-medium hover:underline text-left truncate flex items-center gap-1.5 w-full text-foreground/90"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPreviewFile({ url: j.file_url, name: j.file_name });
                                      }}
                                    >
                                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="truncate">{j.file_name}</span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1.5 truncate text-muted-foreground/80">
                                      <FileText className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                      <span className="truncate">{j.file_name}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate">{j.company_name || '—'}</td>
                                <td className="text-right px-3 py-1.5 font-mono text-muted-foreground">{formatDuration(j.processing_duration_ms)}</td>
                                <td className="text-right px-3 py-1.5 font-mono text-purple-500">${j.estimated_cost_usd?.toFixed(4)}</td>
                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground/60 font-mono flex items-center gap-2">
                                  <div className="truncate flex-1">
                                    {j.project && j.project !== 'PROD' && <span className="text-primary/50 mr-1">[{j.project}]</span>}
                                    {j.worker_id || '—'}
                                  </div>
                                  {j.source && j.upload_id && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                                      disabled={retrying}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openRetryModal([{ source: j.source, id: j.upload_id }]);
                                      }}
                                    >
                                      <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                              {expandedErrorRowId === j.id && (
                                <tr className="bg-red-500/5 border-b border-border/20">
                                  <td colSpan={7} className="px-4 py-2.5 text-xs text-red-400/90 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                    <div className="flex flex-col gap-1 pl-4 border-l-2 border-red-500/30">
                                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Részletes hibaüzenet</span>
                                      <span className="text-red-400">{j.error_message || 'Ismeretlen hiba történt a feldolgozás során.'}</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                        )}
                        {(() => {
                          const renderedCount = filteredErrorJobs.length === 0 ? 1 : paginatedErrorJobs.length;
                          const emptyRowsCount = ERROR_PAGE_SIZE - renderedCount;
                          if (emptyRowsCount <= 0) return null;
                          return Array.from({ length: emptyRowsCount }).map((_, index) => (
                            <tr key={`placeholder-${index}`} className="border-b border-transparent">
                              <td colSpan={7} className="px-3 py-1.5 select-none pointer-events-none">&nbsp;</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>

                    <div className="flex items-center justify-between px-4 py-3 border-t border-border/10 min-h-[53px]">
                      {filteredErrorJobs.length > 0 ? (
                        <>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {((errorPage - 1) * ERROR_PAGE_SIZE) + 1}–{Math.min(errorPage * ERROR_PAGE_SIZE, filteredErrorJobs.length)} / {filteredErrorJobs.length} hiba
                          </span>
                          {errorTotalPages > 1 && (
                            <div className="flex gap-1">
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: 1 })} disabled={errorPage === 1} aria-label="Első">
                                <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: Math.max(1, errorPage - 1) })} disabled={errorPage === 1} aria-label="Előző">
                                <ChevronLeft className="h-3.5 w-3.5" />
                              </Button>
                              {Array.from({ length: Math.min(5, errorTotalPages) }, (_, i) => {
                                const pNum = Math.max(1, Math.min(errorTotalPages - 4, errorPage - 2)) + i;
                                return pNum <= errorTotalPages ? (
                                  <Button
                                    key={pNum}
                                    variant={pNum === errorPage ? 'default' : 'outline'}
                                    size="icon"
                                    className="h-7 w-7 text-xs"
                                    onClick={() => updateParams({ wrk_err_page: pNum })}
                                    aria-label={`${pNum}. oldal`}
                                    aria-current={pNum === errorPage ? 'page' : undefined}
                                  >
                                    {pNum}
                                  </Button>
                                ) : null;
                              })}
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: Math.min(errorTotalPages, errorPage + 1) })} disabled={errorPage === errorTotalPages} aria-label="Következő">
                                <ChevronRight className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: errorTotalPages })} disabled={errorPage === errorTotalPages} aria-label="Utolsó">
                                <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                              </Button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Nincs találat a keresésre</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                    <p className="text-muted-foreground text-sm">Nincs hibás feldolgozás</p>
                    <p className="text-muted-foreground/60 text-xs">Minden feladat sikeresen lefutott</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : showProcessing ? (
            <Card className="border-cyan-500/30 bg-cyan-500/5">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Loader className={`h-4 w-4 text-cyan-500 ${active_processing.length > 0 ? 'animate-spin' : ''}`} />
                    Feldolgozás alatt (globális)
                    <Badge className="text-[10px] px-1.5 py-0 bg-cyan-500/15 text-cyan-400">
                      {active_processing.length} aktív
                    </Badge>
                  </CardTitle>
                  <button onClick={() => updateParams({ wrk_show_processing: null })} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="px-0 pb-2 space-y-3">
                {active_processing.length > 0 ? (() => {
                  // Group by project
                  const byProject = new Map<string, any[]>();
                  for (const item of active_processing) {
                    const key = item.project || 'unknown';
                    if (!byProject.has(key)) byProject.set(key, []);
                    byProject.get(key)!.push(item);
                  }

                  const formatElapsed = (sec: number) => {
                    if (sec < 60) return `${sec}s`;
                    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
                    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
                  };
                  const elapsedColor = (sec: number) => {
                    if (sec < 30) return 'text-emerald-500';
                    if (sec < 120) return 'text-amber-500';
                    return 'text-red-500';
                  };

                  return Array.from(byProject.entries()).map(([project, items]) => (
                    <div key={project}>
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-y border-border/20">
                        <Activity className="h-3.5 w-3.5 text-cyan-500" />
                        <span className="text-xs font-semibold">{project}</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-cyan-500/15 text-cyan-400">{items.length}</Badge>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left px-4 py-1.5 font-medium w-12">Pipeline</th>
                            <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                            <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                            <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                            <th className="text-right px-3 py-1.5 font-medium">Eltelt idő</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item: any) => (
                            <tr key={item.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-1.5">
                                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
                                  item.pipeline_type === 'invoice' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                                }`}>
                                  {item.pipeline_type}
                                </Badge>
                              </td>
                              <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                <div className="flex items-center gap-1.5">
                                  <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                  {item.file_name || '—'}
                                </div>
                              </td>
                              <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                              <td className="px-3 py-1.5">
                                <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                              </td>
                              <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${elapsedColor(item.elapsed_sec || 0)}`}>
                                {formatElapsed(item.elapsed_sec || 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ));
                })() : (
                  <div className="text-center py-8 space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                    <p className="text-muted-foreground text-sm">Jelenleg nincs aktív feldolgozás</p>
                    <p className="text-muted-foreground/60 text-xs">A workerek várakoznak új feladatokra</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : showAllQueues ? (
            /* ── Global Queue Panel (replaces pipeline+jobs when active) ── */
            (() => {
              const allPendingQueues = queues.filter((q: any) => q.queue_length > 0 && !dismissedQueues.has(`${q.project}:${q.queue_name}`)).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name));

              // Auto-close if all dismissed
              if (allPendingQueues.length === 0 && queues.some((q: any) => q.queue_length > 0)) {
                setTimeout(() => { updateParams({ wrk_show_queues: null }); setDismissedQueues(new Set()); }, 0);
                return null;
              }

              const formatWaitTime = (enqueuedAt: string) => {
                const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                const secs = Math.floor(diffMs / 1000);
                if (secs < 60) return `${secs} mp`;
                const mins = Math.floor(secs / 60);
                const remainSecs = secs % 60;
                if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
                return `${Math.floor(mins / 60)}h ${mins % 60}m`;
              };
              const waitColor = (enqueuedAt: string) => {
                const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                if (diffMs < 2 * 60 * 1000) return 'text-emerald-500';
                if (diffMs < 5 * 60 * 1000) return 'text-amber-500';
                return 'text-red-500';
              };
              const sourceIcon = (src: string) => {
                if (src === 'email_alias' || src === 'email') return <Mail className="h-3 w-3" />;
                if (src === 'retry') return <RefreshCw className="h-3 w-3" />;
                return <Upload className="h-3 w-3" />;
              };
              const sourceLabel = (src: string) => {
                if (src === 'email_alias' || src === 'email') return 'Email';
                if (src === 'retry') return 'Retry';
                return 'Feltöltés';
              };
              const sourceBgClass = (src: string) => {
                if (src === 'email_alias' || src === 'email') return 'bg-purple-500/10 text-purple-400';
                if (src === 'retry') return 'bg-red-500/10 text-red-400';
                return 'bg-blue-500/10 text-blue-400';
              };

              return (
                <Card className="border-amber-500/30 bg-amber-500/5">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-amber-500" />
                        Queue várakozó (globális)
                        <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                          {allPendingQueues.reduce((s: number, q: any) => s + (q.queue_length || 0), 0)} várakozó
                        </Badge>
                      </CardTitle>
                      <button onClick={() => updateParams({ wrk_show_queues: null })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-2 space-y-3">
                    {allPendingQueues.length > 0 ? allPendingQueues.map((queueData: any) => {
                      const items = queueData.pending_items || [];
                      const queueDisplayName = queueData.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '');
                      return (
                        <div key={`${queueData.project}:${queueData.queue_name}`}>
                          <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-y border-border/20">
                            <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-semibold capitalize">{queueDisplayName}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{queueData.project}</Badge>
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">{queueData.queue_length}</Badge>
                            <span className="flex-1" />
                            <button
                              onClick={(e) => { e.stopPropagation(); setDismissedQueues(prev => new Set([...prev, `${queueData.project}:${queueData.queue_name}`])); }}
                              className="text-muted-foreground/40 hover:text-foreground transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {items.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border/30 text-muted-foreground">
                                  <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                                  <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                  <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                                  <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                                  <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                                  <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item: any) => (
                                  <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                                    <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                      <div className="flex items-center gap-1.5">
                                        <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                        {item.file_name || '—'}
                                      </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                                    <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>{formatWaitTime(item.enqueued_at)}</td>
                                    <td className="px-3 py-1.5">
                                      <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                                        {sourceIcon(item.source)}
                                        {sourceLabel(item.source)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-1.5">
                                      <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-center py-3 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
                          )}
                        </div>
                      );
                    }) : (
                      <div className="text-center py-8 space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                        <p className="text-muted-foreground text-sm">Jelenleg nincs várakozó üzenet</p>
                        <p className="text-muted-foreground/60 text-xs">Minden queue üres</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()
          ) : (
          <>
          {/* Pipeline Performance Table */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Pipeline teljesítmény ({workerPeriodLabel[workerPeriod]})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left px-4 py-1.5 font-medium">Pipeline</th>
                    <th className="text-right px-3 py-1.5 font-medium">Kész</th>
                    <th className="text-right px-3 py-1.5 font-medium">Avg idő</th>
                    <th className="text-right px-3 py-1.5 font-medium">LLM $</th>
                    <th className="text-right px-3 py-1.5 font-medium">Hibák</th>
                    <th className="text-center px-3 py-1.5 font-medium">7 nap</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPipelines.map((p: any) => (
                    <tr key={p.pipeline} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium">{p.pipeline}</td>
                      <td className="text-right px-3 py-2 font-mono">{p.jobs_24h}</td>
                      <td className="text-right px-3 py-2 font-mono text-muted-foreground">{formatDuration(p.avg_duration_ms)}</td>
                      <td className="text-right px-3 py-2 font-mono text-purple-500">${p.total_cost_usd}</td>
                      <td className="text-right px-3 py-2">
                        {p.error_count_24h > 0 ? (
                          <span className="text-red-500 font-mono">{p.error_count_24h}</span>
                        ) : (
                          <span className="text-muted-foreground/40">0</span>
                        )}
                      </td>
                      <td className="text-center px-3 py-2">
                        <MiniSparkline data={p.daily_counts || []} />
                      </td>
                    </tr>
                  ))}
                  {filteredPipelines.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nincs pipeline adat az utolsó 24 órában</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* ── Queue Detail Panel (inline above recent jobs) ── */}
          {(() => {
            // Determine which queues to show
            const queuesToShow = showAllQueues
              ? queues.filter((q: any) => q.queue_length > 0).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name))
              : selectedQueue
                ? filteredQueues.filter((q: any) => q.queue_name === selectedQueue && q.queue_length > 0)
                : [];
            if (queuesToShow.length === 0) return null;

            const formatWaitTime = (enqueuedAt: string) => {
              const diffMs = Date.now() - new Date(enqueuedAt).getTime();
              const secs = Math.floor(diffMs / 1000);
              if (secs < 60) return `${secs} mp`;
              const mins = Math.floor(secs / 60);
              const remainSecs = secs % 60;
              if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
              return `${Math.floor(mins / 60)}h ${mins % 60}m`;
            };
            const waitColor = (enqueuedAt: string) => {
              const diffMs = Date.now() - new Date(enqueuedAt).getTime();
              if (diffMs < 2 * 60 * 1000) return 'text-emerald-500';
              if (diffMs < 5 * 60 * 1000) return 'text-amber-500';
              return 'text-red-500';
            };
            const sourceIcon = (src: string) => {
              if (src === 'email_alias' || src === 'email') return <Mail className="h-3 w-3" />;
              if (src === 'retry') return <RefreshCw className="h-3 w-3" />;
              return <Upload className="h-3 w-3" />;
            };
            const sourceLabel = (src: string) => {
              if (src === 'email_alias' || src === 'email') return 'Email';
              if (src === 'retry') return 'Retry';
              return 'Feltöltés';
            };
            const sourceBgClass = (src: string) => {
              if (src === 'email_alias' || src === 'email') return 'bg-purple-500/10 text-purple-400';
              if (src === 'retry') return 'bg-red-500/10 text-red-400';
              return 'bg-blue-500/10 text-blue-400';
            };

            return (
              <div className="space-y-3">
                {showAllQueues && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Összes várakozó queue ({queuesToShow.reduce((acc: number, q: any) => acc + q.queue_length, 0)} elem)
                    </span>
                    <button onClick={() => { updateParams({ wrk_show_queues: null }); setSelectedQueue(null); }} className="text-muted-foreground hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {queuesToShow.map((queueData: any) => {
                  const items = queueData.pending_items || [];
                  const queueDisplayName = queueData.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '');
                  return (
                    <Card key={queueData.queue_name} className="border-amber-500/30 bg-amber-500/5">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-amber-500" />
                            <span className="capitalize">{queueDisplayName}</span>
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                              {queueData.queue_length} várakozó
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-normal">{queueData.project}</span>
                          </CardTitle>
                          {!showAllQueues && (
                            <button onClick={() => setSelectedQueue(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="px-0 pb-2">
                        {items.length > 0 ? (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                                <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                                <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                                <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                                <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: any) => (
                                <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                                  <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                    <div className="flex items-center gap-1.5">
                                      <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                      {item.file_name || '—'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                                  <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>{formatWaitTime(item.enqueued_at)}</td>
                                  <td className="px-3 py-1.5">
                                    <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                                      {sourceIcon(item.source)}
                                      {sourceLabel(item.source)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-center py-4 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}

          {/* Recent Jobs */}
          <Card className="border-border/40">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Utolsó feldolgozások
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              <table className="w-full text-xs table-fixed">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left px-4 py-1.5 font-medium w-[110px]">Dátum</th>
                    <th className="text-left px-3 py-1.5 font-medium w-[110px]">Pipeline</th>
                    <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                    <th className="text-left px-3 py-1.5 font-medium w-[160px]">Cég</th>
                    <th className="text-center px-3 py-1.5 font-medium w-[70px]">Státusz</th>
                    <th className="text-right px-3 py-1.5 font-medium w-[70px]">Idő</th>
                    <th className="text-right px-3 py-1.5 font-medium w-[80px]">$</th>
                    <th className="text-left px-3 py-1.5 font-medium w-[220px]">Worker</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJobs.map((j: any) => {
                    const time = new Date(j.created_at);
                    const dateStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getDate().toString().padStart(2, '0')}`;
                    const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                    return (
                      <tr key={j.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr} - {timeStr}</td>
                        <td className="px-3 py-1.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-[75px] justify-center">{j.pipeline}</Badge>
                        </td>
                        <td className="px-3 py-1.5 max-w-[180px] truncate" title={j.file_name}>
                          {j.file_url ? (
                            <button
                              className="font-medium hover:underline text-left truncate flex items-center gap-1.5 w-full text-foreground/90"
                              onClick={() => setPreviewFile({ url: j.file_url, name: j.file_name })}
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate">{j.file_name}</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 truncate text-muted-foreground/80">
                              <FileText className="h-3.5 w-3.5 opacity-50 shrink-0" />
                              <span className="truncate">{j.file_name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">{j.company_name || '—'}</td>
                        <td className="text-center px-3 py-1.5">
                          {j.status === 'ERROR' ? (
                            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0 font-medium">ERROR</Badge>
                          ) : j.status === 'REDIRECTED' ? (
                            <Badge variant="outline" className="bg-info/10 text-info border-info/20 text-[10px] px-1.5 py-0 font-medium">REDIRECT</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0 font-medium">OK</Badge>
                          )}
                        </td>
                        <td className="text-right px-3 py-1.5 font-mono text-muted-foreground">{formatDuration(j.processing_duration_ms)}</td>
                        <td className="text-right px-3 py-1.5 font-mono text-purple-500">${j.estimated_cost_usd?.toFixed(4)}</td>
                        <td className="px-3 py-1.5 text-[10px] text-muted-foreground/60 font-mono flex items-center gap-2">
                          <div className="truncate flex-1">
                            {j.project && j.project !== 'PROD' && <span className="text-primary/50 mr-1">[{j.project}]</span>}
                            {j.worker_id || '—'}
                          </div>
                          {j.source && j.upload_id && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                              disabled={retrying}
                              onClick={(e) => {
                                e.stopPropagation();
                                openRetryModal([{ source: j.source, id: j.upload_id }]);
                              }}
                            >
                              <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredJobs.length === 0 && (
                    <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nincs feldolgozás ennél a konténernél az utolsó időszakban</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          </>
          )}
        </div>
      </div>
      </>
      )}




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
            {previewFile && <FilePreviewContent previewFile={previewFile} />}
          </div>
        </DialogContent>
      </Dialog>

      {/* Retry Pipeline Modal */}
      {retryModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <Card className="w-full max-w-md border border-border shadow-2xl bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Fájl újraküldése
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {retryTargets.length} elem kerül újra feldolgozásra. Válaszd ki a cél pipeline-t:
              </p>
              <div className="space-y-2">
                {PIPELINE_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      retryPipeline === p.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="retryPipeline"
                      value={p.value}
                      checked={retryPipeline === p.value}
                      onChange={() => setRetryPipeline(p.value)}
                      className="sr-only"
                    />
                    {p.icon}
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setRetryModalOpen(false)} disabled={retrying}>
                  Mégsem
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleRetryConfirm} disabled={retrying}>
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {retrying ? 'Küldés ' : <>Újraküldés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{retryTargets.length}</span>)</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
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
  fallback_from_invoice_upload_id?: string | null;
  fallback_from_transaction_upload_id?: string | null;
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

/** Normalize raw processing_status to one of 4 display categories */
type StatusCategory = 'success' | 'pending' | 'error' | 'redirected';

function normalizeStatus(status: string | null, errorMessage?: string | null): StatusCategory {
  if (status === 'redirected') return 'redirected';
  // If there's an error_message, it's an error regardless of processing_status (excluding success messages)
  const isCompleted = errorMessage?.toLowerCase() === 'job completed' || errorMessage?.toLowerCase().includes('job completed');
  if (errorMessage && !isCompleted) return 'error';
  if (!status) return 'pending';
  switch (status) {
    case 'done': case 'completed': case 'processed': return 'success';
    case 'error': case 'failed': case 'ignored': case 'dismissed': case 'webhook_failed': return 'error';
    default: return 'pending';
  }
}

const STATUS_DISPLAY: Record<StatusCategory, { label: string; cls: string }> = {
  success: { label: 'Feldolgozva', cls: 'bg-success/10 text-success border-success/25' },
  pending:  { label: 'Folyamatban', cls: 'bg-warning/10 text-warning border-warning/25' },
  error:   { label: 'Hiba',        cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  redirected: { label: 'Átirányítva', cls: 'bg-info/10 text-info border-info/25' },
};

/** Comma-separated DB values for each filter category (sent to EF) */
const STATUS_FILTER_VALUES: Record<string, string> = {
  success: 'done,completed,processed',
  pending: 'processing,pending',
  error:   'error,failed,ignored,dismissed,webhook_failed',
};

function processingStatusBadge(status: string | null, errorMessage?: string | null) {
  const cat = normalizeStatus(status, errorMessage);
  const { label, cls } = STATUS_DISPLAY[cat];
  return <Badge className={`text-[10px] border ${cls} w-20 justify-center`}>{label}</Badge>;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 25;

  // Deriving states directly from URL search parameters
  const page = Number(searchParams.get('file_page')) || 1;
  const sortCol = (searchParams.get('file_sort') as FileSortCol) || 'created_at';
  const sortDir = (searchParams.get('file_dir') as 'asc' | 'desc') || 'desc';
  const filterCompanyId = searchParams.get('file_company') || '';
  const filterUserId = searchParams.get('file_user') || '';
  const filterFileType = searchParams.get('file_type') || '';
  const filterStatus = searchParams.get('file_status') || '';
  const dateFrom = searchParams.get('file_from') || '';
  const dateTo = searchParams.get('file_to') || '';
  const debouncedSearch = searchParams.get('file_q') || '';

  // Local state for the input field to prevent layout/input lag
  const [search, setSearch] = useState(debouncedSearch);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string, name: string } | null>(null);
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  // Selection state for bulk operations
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmCounts, setDeleteConfirmCounts] = useState({ withStorage: 0, dbOnly: 0 });

  const toggleFileSelection = useCallback((fileKey: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(fileKey)) next.delete(fileKey);
      else next.add(fileKey);
      return next;
    });
  }, []);

  // Helper function to update search parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    // Reset page on filter changes unless page is explicitly updated
    if (!('file_page' in updates)) {
      next.set('file_page', '1');
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Sync local search input value when URL changes externally
  useEffect(() => {
    setSearch(debouncedSearch);
  }, [debouncedSearch]);

  // Debounce search input to URL parameters
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== debouncedSearch) {
        updateParams({ file_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, debouncedSearch, updateParams]);

  const toggleSort = useCallback((col: FileSortCol) => {
    if (sortCol === col) {
      updateParams({ file_dir: sortDir === 'asc' ? 'desc' : 'asc' });
    } else {
      updateParams({ file_sort: col, err_dir: 'desc' });
    }
  }, [sortCol, sortDir, updateParams]);

  const { data, isLoading, isFetching } = useQuery<FilesData>({
    queryKey: ['management-files', page, PAGE_SIZE, sortCol, sortDir, debouncedSearch, filterCompanyId, filterUserId, filterFileType, filterStatus, dateFrom, dateTo],
    queryFn: () => fetchManagementData('files', {
      page: String(page), pageSize: String(PAGE_SIZE),
      sortBy: sortCol, sortDir,
      search: debouncedSearch,
      companyId: filterCompanyId,
      userId: filterUserId,
      fileType: filterFileType,
      status: STATUS_FILTER_VALUES[filterStatus] || filterStatus,
      dateFrom, dateTo,
    }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const fileRows = data?.files || [];
  const totalRows = data?.totalRows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const stats = data?.stats;

  const selectAllOnPage = useCallback(() => {
    const allKeys = fileRows.map((r: any) => `${r.source_table}:${r.id}`);
    const allSelected = allKeys.every((k: string) => selectedFiles.has(k));
    if (allSelected) {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        allKeys.forEach((k: string) => next.delete(k));
        return next;
      });
    } else {
      setSelectedFiles(prev => {
        const next = new Set(prev);
        allKeys.forEach((k: string) => next.add(k));
        return next;
      });
    }
  }, [fileRows, selectedFiles]);

  const handleBulkStatusUpdate = useCallback(async (targetStatus: string) => {
    if (selectedFiles.size === 0) return;
    setBulkUpdating(true);
    try {
      const files = Array.from(selectedFiles).map(key => {
        const [source_table, id] = key.split(':');
        return { id, source_table };
      });
      const result = await postManagementData('update-file-status', { files, targetStatus });
      if (result.success || result.updated > 0) {
        toast({ title: `${result.updated} fájl állapota frissítve`, description: `Új állapot: ${targetStatus}` });
        setSelectedFiles(new Set());
        queryClient.invalidateQueries({ queryKey: ['management-files'] });
      } else {
        toast({ title: 'Hiba történt', description: result.error || 'Ismeretlen hiba', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Hiba', description: e.message, variant: 'destructive' });
    } finally {
      setBulkUpdating(false);
    }
  }, [selectedFiles, toast, queryClient]);

  const selectedUploads = useMemo(() => {
    return Array.from(selectedFiles).map(key => {
      const [source_table, id] = key.split(':');
      const row = fileRows.find((r: FileRow) => r.id === id && r.source_table === source_table);
      return row;
    }).filter(Boolean) as FileRow[];
  }, [selectedFiles, fileRows]);

  // Open delete confirmation — pre-calculate storage vs db-only counts from current rows
  const handleOpenDeleteConfirm = useCallback(() => {
    const withStorage = Array.from(selectedFiles).filter(key => {
      const [source_table, id] = key.split(':');
      const row = fileRows.find((r: FileRow) => r.id === id && r.source_table === source_table);
      return !!row?.file_url;
    }).length;
    const dbOnly = selectedFiles.size - withStorage;
    setDeleteConfirmCounts({ withStorage, dbOnly });
    setDeleteConfirmOpen(true);
  }, [selectedFiles, fileRows]);

  const handleBulkDelete = useCallback(async (isDbOnly: boolean = false) => {
    if (selectedFiles.size === 0) return;
    setBulkDeleting(true);
    try {
      const files = Array.from(selectedFiles).map(key => {
        const [source_table, id] = key.split(':');
        const row = fileRows.find((r: FileRow) => r.id === id && r.source_table === source_table);
        return { id, source_table, file_url: row?.file_url ?? null };
      });
      const result = await postManagementData('delete-files', { files, dbOnly: isDbOnly });
      if (result.success || result.deleted > 0) {
        toast({
          title: isDbOnly ? `${result.deleted} adatbázis sor törölve` : `${result.deleted} fájl törölve`,
          description: isDbOnly
            ? `A Storage fájlok megmaradtak, csak az adatbázisból kerültek ki a sorok.`
            : result.storageDeleted > 0
              ? `Storage: ${result.storageDeleted} fájl, csak DB: ${result.dbOnlyDeleted ?? 0} fájl`
              : `Csak adatbázisból törölve (nem volt storage fájl)`,
        });
        setSelectedFiles(new Set());
        queryClient.invalidateQueries({ queryKey: ['management-files'] });
      } else {
        toast({ title: 'Hiba történt', description: result.error || 'Ismeretlen hiba', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Hiba', description: e.message, variant: 'destructive' });
    } finally {
      setBulkDeleting(false);
      setDeleteConfirmOpen(false);
    }
  }, [selectedFiles, fileRows, toast, queryClient]);

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
    updateParams({
      file_q: '',
      file_company: '',
      file_user: '',
      file_type: '',
      file_status: '',
      file_from: '',
      file_to: '',
      file_page: 1,
    });
    setSearch('');
  };

  const hasActiveFilters = search || filterCompanyId || filterUserId || filterFileType || filterStatus || dateFrom || dateTo;

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            {[0,1,2,3].map(i => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-4">
                  <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-6 w-14" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30", filterStatus === '' ? "border-primary/50 bg-primary/5" : "")}
          onClick={() => { updateParams({ file_status: '' }); }}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') { updateParams({ file_status: '' }); } }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                <p className="text-xl font-bold tabular-nums">{(stats?.totalCount ?? totalRows)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Összes fájl</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30", filterStatus === 'success' ? "border-success/50 bg-success/5" : "")}
          onClick={() => { updateParams({ file_status: filterStatus === 'success' ? '' : 'success' }); }}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') { updateParams({ file_status: filterStatus === 'success' ? '' : 'success' }); } }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-success/10 border border-success/20 shrink-0">
              <Check className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                <p className="text-xl font-bold tabular-nums text-success">{(stats?.successCount ?? 0)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Feldolgozva</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30", filterStatus === 'error' ? "border-destructive/50 bg-destructive/5" : "")}
          onClick={() => { updateParams({ file_status: filterStatus === 'error' ? '' : 'error' }); }}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') { updateParams({ file_status: filterStatus === 'error' ? '' : 'error' }); } }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-destructive/10 border border-destructive/20 shrink-0">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                <p className="text-xl font-bold tabular-nums text-destructive">{(stats?.errorCount ?? 0)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Hiba</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer transition-all duration-150 hover:bg-accent/30", filterStatus === 'pending' ? "border-warning/50 bg-warning/5" : "")}
          onClick={() => { updateParams({ file_status: filterStatus === 'pending' ? '' : 'pending' }); }}
          role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') { updateParams({ file_status: filterStatus === 'pending' ? '' : 'pending' }); } }}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-warning/10 border border-warning/20 shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <div className="h-7 min-w-[40px]">
                <p className="text-xl font-bold tabular-nums text-warning">{(stats?.pendingCount ?? 0)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Folyamatban</p>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>

      {/* Filter toolbar */}
      <Card>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="flex flex-wrap gap-2 items-center">
              <Skeleton className="h-8 w-52 rounded-md" />
              <Skeleton className="h-8 w-[180px] rounded-md" />
              <Skeleton className="h-8 w-[180px] rounded-md" />
              <Skeleton className="h-8 w-[140px] rounded-md" />
              <Skeleton className="h-8 w-[140px] rounded-md" />
              <Skeleton className="h-8 w-36 rounded-md" />
              <Skeleton className="h-3 w-2" />
              <Skeleton className="h-8 w-36 rounded-md" />
              <Skeleton className="ml-auto h-4 w-16" />
            </div>
          ) : (
          <>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); }}
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
                          updateParams({ file_company: '', file_user: '', file_page: null });
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
                            updateParams({ file_company: id, file_user: '', file_page: null });
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
                          updateParams({ file_user: '', file_page: null });
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
                            updateParams({ file_user: u.user_id, file_page: null });
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

            {/* File type filter (Popover + Lucide icons) */}
            {(() => {
              const fileTypeOptions: Array<{ value: string; label: string; icon: React.ElementType }> = [
                { value: '', label: 'Minden típus', icon: FolderOpen },
                { value: 'invoice', label: 'Számla', icon: FileText },
                { value: 'transaction', label: 'Tranzakció', icon: CreditCard },
                { value: 'bank', label: 'Bankkivonat', icon: Landmark },
                { value: 'report', label: 'Riport', icon: BarChart3 },
              ];
              const active = fileTypeOptions.find(o => o.value === filterFileType) || fileTypeOptions[0];
              const ActiveIcon = active.icon;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs justify-between min-w-[140px] font-normal gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <ActiveIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        {active.label}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[180px] p-1" align="start">
                    {fileTypeOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { updateParams({ file_type: opt.value, file_page: null }); }}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                            filterFileType === opt.value
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          {opt.label}
                          {filterFileType === opt.value && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              );
            })()}

            {/* Status filter — 3 unified categories (Popover + Lucide icons) */}
            {(() => {
              const statusOptions: Array<{ value: string; label: string; icon: React.ElementType; cls?: string }> = [
                { value: '', label: 'Minden állapot', icon: FolderOpen },
                { value: 'success', label: 'Feldolgozva', icon: Check, cls: 'text-success' },
                { value: 'pending', label: 'Folyamatban', icon: Clock, cls: 'text-warning' },
                { value: 'error', label: 'Hiba', icon: AlertCircle, cls: 'text-destructive' },
              ];
              const active = statusOptions.find(o => o.value === filterStatus) || statusOptions[0];
              const ActiveIcon = active.icon;
              return (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-8 text-xs justify-between min-w-[140px] font-normal gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <ActiveIcon className={cn("h-3.5 w-3.5 shrink-0", active.cls || "text-muted-foreground")} />
                        {active.label}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[180px] p-1" align="start">
                    {statusOptions.map(opt => {
                      const Icon = opt.icon;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => { updateParams({ file_status: opt.value, file_page: null }); }}
                          className={cn(
                            "flex items-center gap-2 w-full rounded-sm px-2 py-1.5 text-xs transition-colors",
                            filterStatus === opt.value
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-foreground hover:bg-accent/50"
                          )}
                        >
                          <Icon className={cn("h-3.5 w-3.5 shrink-0", opt.cls || "text-muted-foreground")} />
                          {opt.label}
                          {filterStatus === opt.value && <Check className="h-3 w-3 ml-auto text-primary" />}
                        </button>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              );
            })()}

            {/* Date range */}
            <Input
              type="date"
              value={dateFrom}
              onChange={e => { updateParams({ file_from: e.target.value, file_page: null }); }}
              className="h-8 text-xs bg-background w-36"
              id="files-date-from"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => { updateParams({ file_to: e.target.value, file_page: null }); }}
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
              {`${totalRows} rekord`}
            </span>
          </div>

          {selectedFiles.size > 0 && (
            <div className="pt-2.5 border-t border-border/40 flex items-center gap-3 flex-wrap animate-in fade-in duration-200">
              <span className="text-xs font-semibold text-muted-foreground">
                <span className="tabular-nums inline-block min-w-[2ch] text-center text-primary font-bold">{selectedFiles.size}</span> fájl kijelölve
              </span>
              <div className="h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Állapot módosítása:</span>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-success/30 hover:bg-success/10"
                onClick={() => handleBulkStatusUpdate('done')}
                disabled={bulkUpdating || bulkDeleting}
              >
                <Check className="h-3 w-3 text-success" />
                Feldolgozva
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-warning/30 hover:bg-warning/10"
                onClick={() => handleBulkStatusUpdate('pending')}
                disabled={bulkUpdating || bulkDeleting}
              >
                <Clock className="h-3 w-3 text-warning" />
                Folyamatban
              </Button>
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-primary"
                onClick={() => handleBulkStatusUpdate('error')}
                disabled={bulkUpdating || bulkDeleting}
              >
                <AlertCircle className="h-3 w-3 text-destructive" />
                Hiba
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm" variant="outline"
                className="h-8 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-primary"
                onClick={handleOpenDeleteConfirm}
                disabled={bulkUpdating || bulkDeleting}
              >
                <Trash2 className="h-3 w-3" />
                Törlés
              </Button>
              <div className="h-4 w-px bg-border" />
              <Button
                size="sm" variant="ghost"
                className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => setSelectedFiles(new Set())}
                disabled={bulkUpdating || bulkDeleting}
              >
                <X className="h-3 w-3" />
                Kijelölés törlése
              </Button>
              {(bulkUpdating || bulkDeleting) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={(open) => { if (!bulkDeleting) setDeleteConfirmOpen(open); }}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedFiles.size} dokumentum törlése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Válaszd ki a törlés módját az összes kijelölt elemre:</p>
                {/* Selected files preview */}
                <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-1 w-full max-w-[340px] sm:max-w-[500px] overflow-x-hidden">
                  {selectedUploads.map(u => (
                    <div key={`${u.source_table}:${u.id}`} className="text-xs text-muted-foreground truncate block w-full" title={u.file_name}>
                      • {u.file_name} <span className="text-foreground/60 ml-1">({u.file_type_label})</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1">
            {/* Option A: dbOnly = true */}
            <button
              disabled={bulkDeleting}
              onClick={() => handleBulkDelete(true)}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Csak a sorok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedFiles.size === 1 ? '1 adatbázis sor' : `${selectedFiles.size} adatbázis sor`} törlődik, a Storage fájlok megmaradnak.
                  </p>
                </div>
              </div>
            </button>

            {/* Option B: dbOnly = false */}
            <button
              disabled={bulkDeleting}
              onClick={() => handleBulkDelete(false)}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-destructive">Sorok és fájlok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedFiles.size === 1 ? '1 sor' : `${selectedFiles.size} sor`} és a hozzá tartozó Storage fájl(ok) véglegesen törlődnek.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {bulkDeleting && (
            <div className="flex items-center justify-center py-2 animate-in fade-in duration-200">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Törlés folyamatban...</span>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Data table */}
      <Card className={cn("transition-opacity duration-200", isFetching && !isLoading && "opacity-60")}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 36 }} />
                <col style={{ width: 40 }} />
                <col style={{ width: '18%' }} />
                <col style={{ width: 90 }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '11%' }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 90 }} />
              </colgroup>
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs bg-muted/30">
                  <th className="py-2.5 px-2 font-medium w-9">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                      checked={fileRows.length > 0 && fileRows.every((r: any) => selectedFiles.has(`${r.source_table}:${r.id}`))}
                      onChange={selectAllOnPage}
                    />
                  </th>
                  <th className="text-left py-2.5 px-4 font-medium"></th>
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
                      <td className="py-3 px-2"><Skeleton className="h-4 w-4" /></td>
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
                    <td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">
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
                        <td className="py-2.5 px-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                            checked={selectedFiles.has(`${row.source_table}:${row.id}`)}
                            onChange={() => toggleFileSelection(`${row.source_table}:${row.id}`)}
                          />
                        </td>
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
                          {row.user_name === 'Mailgun' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium" title="Mailgun webhook">
                              <Mail className="h-3 w-3" />
                              Mailgun
                            </span>
                          ) : row.user_name ? (
                            <button 
                              className="text-foreground hover:text-primary transition-colors text-left truncate max-w-[120px] block text-[11px] font-bold"
                              onClick={e => { e.stopPropagation(); if (row.user_id) { updateParams({ file_user: row.user_id, file_page: null }); } }}
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
                          {processingStatusBadge(row.processing_status, row.error_message)}
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
                          <td colSpan={10} className="p-0">
                            <div className="bg-muted/20 border-t border-border/50 px-10 py-3 animate-in slide-in-from-top-1 duration-200 overflow-hidden">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 text-xs">
                                <div><span className="text-muted-foreground">Forrástábla: </span><span className="font-mono">{row.source_table}_uploads</span></div>
                                <div><span className="text-muted-foreground">Upload státusz: </span><span>{row.upload_status || '—'}</span></div>
                                <div><span className="text-muted-foreground">MIME típus: </span><span className="font-mono truncate">{row.file_type || '—'}</span></div>
                                <div><span className="text-muted-foreground">Frissítve: </span><span>{row.updated_at ? new Date(row.updated_at).toLocaleString('hu-HU') : '—'}</span></div>
                              </div>
                              {row.error_message && (
                                <div className="mt-2 flex items-start gap-2 rounded-md bg-destructive/8 border border-destructive/20 px-3 py-2 overflow-hidden">
                                  <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                                  <span className="text-xs text-destructive break-words min-w-0">{row.error_message}</span>
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
          {isLoading ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <Skeleton className="h-4 w-32" />
              <div className="flex gap-1">
                {[0,1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-7 w-7 rounded-md" />)}
              </div>
            </div>
          ) : totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground tabular-nums">
                {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, totalRows)} / {totalRows} rekord
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ file_page: 1 })} disabled={page === 1} aria-label="Első">
                  <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ file_page: Math.max(1, page - 1) })} disabled={page === 1} aria-label="Előző">
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
                      onClick={() => updateParams({ file_page: pNum })}
                      aria-label={`${pNum}. oldal`}
                      aria-current={pNum === page ? 'page' : undefined}
                    >
                      {pNum}
                    </Button>
                  ) : null;
                })}
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ file_page: Math.min(totalPages, page + 1) })} disabled={page === totalPages} aria-label="Következő">
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ file_page: totalPages })} disabled={page === totalPages} aria-label="Utolsó">
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
            {previewFile && <FilePreviewContent previewFile={previewFile} />}
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

interface UsersControlPanelProps {
  allUsers: any[];
  overviewLoading: boolean;
  companyCostMap: Map<string, any>;
  onOpenCompany: (id: string) => void;
}

function UsersControlPanel({ allUsers, overviewLoading, companyCostMap, onOpenCompany }: UsersControlPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const USER_PAGE_SIZE = 15;

  // Deriving state from URL search params
  const searchUser = searchParams.get('usr_q') || '';
  const userPage = Number(searchParams.get('usr_page')) || 0;

  // Local input search state
  const [search, setSearch] = useState(searchUser);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Helper to update search parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    // Reset page to 0 on query update
    if (!('usr_page' in updates)) {
      next.set('usr_page', '0');
    }
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Debounce sync local input search to URL search parameter
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchUser) {
        updateParams({ usr_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, searchUser, updateParams]);

  // Sync local search state when URL changes externally
  useEffect(() => {
    setSearch(searchUser);
  }, [searchUser]);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    if (!searchUser.trim()) return allUsers;
    const q = searchUser.toLowerCase();
    return allUsers.filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [allUsers, searchUser]);

  const userTotalPages = Math.ceil(filteredUsers.length / USER_PAGE_SIZE);
  const paginatedUsers = useMemo(() =>
    filteredUsers.slice(userPage * USER_PAGE_SIZE, (userPage + 1) * USER_PAGE_SIZE)
  , [filteredUsers, userPage]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" /> Felhasználók
        </CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
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
                                      onClick={(e) => { e.stopPropagation(); onOpenCompany(c.id); }}
                                      className="cursor-pointer hover:bg-accent/40 transition-colors duration-150 group/company"
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenCompany(c.id); } }}
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
                onClick={() => updateParams({ usr_page: userPage - 1 })} aria-label="Előző oldal">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground tabular-nums px-2">{userPage + 1}/{userTotalPages}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" disabled={userPage >= userTotalPages - 1}
                onClick={() => updateParams({ usr_page: userPage + 1 })} aria-label="Következő oldal">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PermissionsPanel({ allUsers }: { allUsers: ControlCenterUser[] }) {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Driving searchUser from URL parameter perm_q
  const searchUser = searchParams.get('perm_q') || '';
  const [search, setSearch] = useState(searchUser);

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

  // Helper to update parameter atomically
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, val);
      } else {
        next.delete(key);
      }
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  // Debounce sync local input value to URL search parameter
  useEffect(() => {
    const t = setTimeout(() => {
      if (search !== searchUser) {
        updateParams({ perm_q: search });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [search, searchUser, updateParams]);

  // Sync local search input when URL changes externally
  useEffect(() => {
    setSearch(searchUser);
  }, [searchUser]);

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
              value={search}
              onChange={e => setSearch(e.target.value)}
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
