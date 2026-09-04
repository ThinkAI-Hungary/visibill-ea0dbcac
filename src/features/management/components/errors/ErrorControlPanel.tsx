import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '../common/ManagementSkeleton';
import { fetchManagementData, postManagementData } from '../../api/managementApi';
import { ErrorRow, ErrorsData, ErrorSortCol, ControlCenterUser } from '../../api/types';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Clock, Building2, Users, Search, ChevronDown, Check,
  X, Trash2, RefreshCw, ChevronLeft, ChevronRight, Eye, Mail, RotateCcw,
  Receipt, Wallet, Landmark, BarChart3, Truck, Loader2, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

interface ErrorControlPanelProps {
  onOpenCompany: (id: string) => void;
  allUsers?: ControlCenterUser[];
}

export function ErrorControlPanel({ onOpenCompany: _onOpenCompany, allUsers = [] }: ErrorControlPanelProps) {
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
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<Array<{ source: string; id: string; project?: string }>>([]);
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const { previewFile, openPreview, closePreview } = useFilePreview();
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Reset last selected index on pagination/sort/filter changes
  useEffect(() => {
    setLastSelectedIndex(null);
  }, [page, sortCol, sortDir, debouncedSearch, filterCompanyId, filterSource, filterCategory, filterUserId, dateFrom, dateTo]);

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
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy: sortCol,
      sortDir,
      search: debouncedSearch,
      companyId: filterCompanyId,
      source: filterSource,
      category: filterCategory,
      userId: filterUserId,
      dateFrom,
      dateTo,
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

  const toggleOne = (r: ErrorRow, index: number, shiftKey: boolean) => {
    const key = `${r.source}:${r.id}`;
    const next = new Set(selected);
    const isAdding = !selected.has(key);

    if (shiftKey && lastSelectedIndex !== null) {
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      for (let i = start; i <= end; i++) {
        const item = errRows[i];
        if (item) {
          const itemKey = `${item.source}:${item.id}`;
          if (isAdding) {
            next.add(itemKey);
          } else {
            next.delete(itemKey);
          }
        }
      }
    } else {
      if (next.has(key)) next.delete(key); else next.add(key);
    }
    setSelected(next);
    setLastSelectedIndex(index);
  };

  const handleDelete = async (ids: Array<{ source: string; id: string; project?: string }>) => {
    if (ids.length === 0) return;
    // For any upload error representing a grouped set of fallback attempts,
    // include all sibling attempts from history so they are dismissed together
    const expandedIds: Array<{ source: string; id: string; project?: string }> = [];
    const seen = new Set<string>();

    for (const item of ids) {
      const key = `${item.source}:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        expandedIds.push(item);
      }
      const row = errRows.find(r => r.id === item.id);
      if (row?.history) {
        for (const h of row.history) {
          const hKey = `${h.source}:${h.id}`;
          if (!seen.has(hKey)) {
            seen.add(hKey);
            expandedIds.push({ source: h.source, id: h.id, project: item.project });
          }
        }
      }
    }

    setDeleteTargets(expandedIds);
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
      queryClient.invalidateQueries({ queryKey: ['management-files'] });
      queryClient.invalidateQueries({ queryKey: ['worker-telemetry'] });
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

  const RETRYABLE_SOURCES = new Set([
    'invoice_uploads',
    'transaction_uploads',
    'gl_upload_notifications',
    'report_uploads',
    'app_error_logs',
    'app_error_logs:frontend',
    'app_error_logs:worker',
    'app_error_logs:mailgun',
  ]);

  // Retry modal state
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string; project?: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same');
  const [retryPhase, setRetryPhase] = useState<'idle' | 'sending' | 'refreshing'>('idle');

  const PIPELINE_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode; queue?: string; category?: string | null }> = [
    { value: 'same', label: 'Eredeti pipeline (változatlan)', icon: <RotateCcw className="h-4 w-4 text-muted-foreground" /> },
    { value: 'invoice', label: 'Számla feldolgozás', icon: <Receipt className="h-4 w-4 text-emerald-500" />, queue: 'invoice_jobs', category: 'invoice' },
    { value: 'payroll', label: 'Bérjegyzék feldolgozás', icon: <Wallet className="h-4 w-4 text-amber-500" />, queue: 'invoice_jobs', category: 'payroll' },
    { value: 'transaction', label: 'Tranzakció feldolgozás', icon: <Landmark className="h-4 w-4 text-blue-500" />, queue: 'transaction_jobs', category: null },
    { value: 'gl', label: 'Főkönyvi besorolás', icon: <BarChart3 className="h-4 w-4 text-purple-500" />, queue: 'gl_classification_jobs', category: null },
    { value: 'report', label: 'Futár riport feldolgozás', icon: <Truck className="h-4 w-4 text-orange-500" />, queue: 'report_jobs', category: null },
  ];

  const getPipelineOptionsForSource = (_source: string) => {
    return ['same', 'invoice', 'payroll', 'transaction', 'gl', 'report'];
  };

  const availablePipelines = useMemo(() => {
    if (retryTargets.length === 0) return ['same'];
    const sources = new Set(retryTargets.map(t => t.source));
    if (sources.size === 1) {
      return getPipelineOptionsForSource([...sources][0]);
    }
    return ['same'];
  }, [retryTargets]);

  const openRetryModal = (ids: Array<{ source: string; id: string; project?: string }>) => {
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
    const targetCount = retryTargets.length;
    setRetrying(true);
    setRetryPhase('sending');
    let apiResult: { retried?: number; error?: string | null } | null = null;
    let apiError = false;
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
      apiResult = result;
      setSelected(new Set());

      setRetryPhase('refreshing');
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['management-errors'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['management-overview'], type: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['management-files'] }),
        queryClient.invalidateQueries({ queryKey: ['worker-telemetry'] }),
      ]);
    } catch (e) {
      apiError = true;
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors failed:', error: e });
    } finally {
      setRetrying(false);
      setRetryPhase('idle');
      setRetryModalOpen(false);
      setRetryTargets([]);
    }

    if (apiError) {
      toast({ title: 'Újraküldés sikertelen', description: 'Hiba történt az újraküldés során.', variant: 'destructive' });
    } else if (apiResult?.error) {
      reportError({ type: 'api_call', severity: 'warning', component: 'ManagementDashboard', action: 'warning', message: 'Retry partial errors', error: apiResult.error });
      toast({ title: 'Részleges újraküldés', description: `${apiResult.retried || 0} elem újraküldve, néhány hiba történt.`, variant: 'destructive' });
    } else if (apiResult !== null) {
      toast({ title: 'Újraküldés sikeres', description: `${apiResult.retried ?? targetCount} elem újra feldolgozásra küldve.` });
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
    { value: 'uploads', label: 'Feltöltés' },
    { value: 'app_error_logs:frontend', label: 'Frontend' },
    { value: 'app_error_logs:worker', label: 'Worker' },
    { value: 'app_error_logs:mailgun', label: 'Mailgun' },
  ];

  const categoryOptions = [
    { value: 'Application', label: '⚙️ Application' },
    { value: 'Mailgun', label: '📧 Mailgun' },
    { value: 'Worker', label: '🔧 Worker' },
  ];

  const categoryColors: Record<string, string> = {
    Application: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
    Mailgun: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
    Worker: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  };

  const sourceColors: Record<string, string> = {
    uploads: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    invoice_uploads: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    transaction_uploads: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    report_uploads: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    bank_statement_uploads: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    gl_upload_notifications: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    nav_sync_logs: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    'app_error_logs:frontend': 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
    'app_error_logs:worker': 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
    'app_error_logs:mailgun': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
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
                  role="button"
                  tabIndex={0}
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
                  role="button"
                  tabIndex={0}
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
              role="button"
              tabIndex={0}
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
              role="button"
              tabIndex={0}
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

              {/* Source filter */}
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

              {/* Category filter */}
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
                        ? userOptions.find((u: any) => u.user_id === filterUserId)?.name ||
                          userOptions.find((u: any) => u.user_id === filterUserId)?.email
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
                        {userOptions.map((u: any) => (
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
                value={dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom}
                onChange={e => { updateParams({ err_from: e.target.value, err_page: null }); }}
                className="h-8 text-xs bg-background w-36"
                id="errors-date-from"
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="date"
                value={dateTo.includes('T') ? dateTo.split('T')[0] : dateTo}
                onChange={e => { updateParams({ err_to: e.target.value, err_page: null }); }}
                className="h-8 text-xs bg-background w-36"
                id="errors-date-to"
              />

              {/* Reset filters */}
              {(search || filterSource || filterCategory || filterCompanyId || filterUserId || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
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
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 gap-1.5 text-xs px-3"
                    disabled={deleting}
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-3 w-3" />
                    Törlés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{selected.size}</span>)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs px-3 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
                    disabled={retrying}
                    onClick={handleBulkRetry}
                  >
                    <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                    Újraküldés
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSelected(new Set())}
                  >
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
                    variant="outline"
                    size="sm"
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
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                    />
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
                ) : errRows.map((r, index) => {
                  const isExpanded = expandedId === `${r.source}:${r.id}`;
                  const key = `${r.source}:${r.id}`;
                  return (
                    <React.Fragment key={key}>
                      <tr
                        className={`hover:bg-accent/30 transition-colors duration-100 cursor-pointer ${
                          selected.has(key) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => setExpandedId(isExpanded ? null : key)}
                      >
                        <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(key)}
                            onClick={(e) => toggleOne(r, index, e.shiftKey)}
                            onChange={() => {}}
                            className="h-3.5 w-3.5 rounded border-input accent-primary cursor-pointer"
                          />
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
                            <button
                              className="text-foreground hover:text-primary transition-colors font-medium text-left truncate max-w-[140px] block"
                              onClick={e => { e.stopPropagation(); if (r.company_id) { updateParams({ err_company: r.company_id, err_page: null }); } }}
                              title={`Szűrés: ${r.company_name}`}
                            >
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
                            <button
                              className="text-foreground hover:text-primary transition-colors text-left truncate max-w-[120px] block text-[11px]"
                              onClick={e => { e.stopPropagation(); if (r.user_id) { updateParams({ err_user: r.user_id, err_page: null }); } }}
                              title={`Szűrés: ${r.user_name}`}
                            >
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
                        <td className="py-1.5 px-3 max-w-[170px]" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 max-w-full">
                            {r.file_url && r.file_name ? (
                              <button
                                className="group inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors duration-150 truncate flex-1"
                                title={`Előnézet: ${r.file_name}`}
                                onClick={() => openPreview({ url: r.file_url!, name: r.file_name! })}
                              >
                                <Eye className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <span className="truncate">{r.file_name}</span>
                              </button>
                            ) : (
                              <span className="text-foreground/50 truncate inline-flex items-center gap-1 flex-1">
                                <span className="w-3 h-3 shrink-0" />
                                <span className="truncate">{r.file_name || '—'}</span>
                              </span>
                            )}
                            {r.retry_count && r.retry_count > 1 ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-medium shrink-0" title={`${r.retry_count} sikertelen kísérlet / fallback`}>
                                {r.retry_count}x
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-1.5 px-3 text-foreground/50 truncate max-w-[200px]" title={r.error_message || ''}>
                          {r.error_message ? r.error_message.slice(0, 55) + (r.error_message.length > 55 ? '…' : '') : '—'}
                        </td>
                        <td className="py-1.5 px-2" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-0.5">
                            {RETRYABLE_SOURCES.has(r.source) ? (
                              <button
                                className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                title="Újraküldés feldolgozásra"
                                disabled={retrying}
                                onClick={() => openRetryModal([{ source: r.source, id: r.id, project: r.project }])}
                              >
                                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                              </button>
                            ) : (
                              <div className="w-5 h-5 shrink-0" />
                            )}
                            <button
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Hiba törlése"
                              onClick={() => handleDelete([{ source: r.source, id: r.id, project: r.project }])}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-0">
                            <div className="bg-muted/20 border-t border-border px-6 py-4 animate-in slide-in-from-top-1 duration-200 space-y-4">
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Forrás tábla</p>
                                  <p className="text-foreground font-medium">{r.source}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Rekord ID</p>
                                  <p className="text-foreground font-mono text-xs select-all truncate">{r.id}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Felhasználó</p>
                                  <p className="text-foreground">{r.user_name || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Cég</p>
                                  <p className="text-foreground">{r.company_name || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Időpont</p>
                                  <p className="text-foreground tabular-nums">{new Date(r.created_at).toLocaleString('hu-HU')}</p>
                                </div>
                              </div>

                              {r.fallback_chain && r.fallback_chain.length > 1 && (
                                <div className="p-2.5 rounded-md bg-amber-500/5 border border-amber-500/20 text-xs">
                                  <p className="text-amber-600 dark:text-amber-400 font-semibold mb-1">
                                    Fallback lánc ({r.retry_count} próbálkozás):
                                  </p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {r.fallback_chain.map((step, sIdx) => (
                                      <React.Fragment key={sIdx}>
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                                          {step}
                                        </Badge>
                                        {sIdx < r.fallback_chain!.length - 1 && <span className="text-muted-foreground text-xs font-bold">→</span>}
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {r.url && (
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1">Útvonal / Oldal</p>
                                  <p className="text-foreground font-mono text-xs bg-muted/40 px-2.5 py-1.5 rounded border border-border/50 select-all">{r.url}</p>
                                </div>
                              )}

                              <div>
                                <p className="text-muted-foreground text-xs mb-1 font-medium">Teljes hibaüzenet</p>
                                <pre className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 whitespace-pre-wrap break-all max-h-[300px] overflow-y-auto font-mono">
                                  {r.error_message || 'Nincs hibaüzenet'}
                                </pre>
                              </div>

                              {r.context && Object.keys(r.context).length > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-xs mb-2 font-medium">Kontextus & Részletek</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {Object.entries(r.context).map(([k, v]) => (
                                      <div key={k} className="p-2.5 rounded-md bg-card border border-border text-xs">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                          <span className="font-semibold text-foreground/90">{k}</span>
                                          <span className="text-[10px] text-muted-foreground uppercase">{typeof v}</span>
                                        </div>
                                        <div className="text-muted-foreground">
                                          {typeof v === 'object' && v !== null ? (
                                            <pre className="text-[11px] font-mono bg-muted/40 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap break-all text-foreground">
                                              {JSON.stringify(v, null, 2)}
                                            </pre>
                                          ) : (
                                            <span className="font-mono text-foreground">{String(v)}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {(r.stack_trace || ((r.context?.error_details as any)?.stack)) && (
                                <div>
                                  <p className="text-muted-foreground text-xs mb-1 font-medium">Stack Trace</p>
                                  <pre className="text-[11px] font-mono text-muted-foreground bg-muted/40 border border-border/50 rounded-lg p-3 whitespace-pre-wrap break-all max-h-[220px] overflow-y-auto">
                                    {r.stack_trace || ((r.context?.error_details as any)?.stack)}
                                  </pre>
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={page === 0}
                  onClick={() => updateParams({ err_page: page - 1 })}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-2">{page + 1}/{totalPages}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={page >= totalPages - 1}
                  onClick={() => updateParams({ err_page: page + 1 })}
                >
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
                  {retryPhase === 'refreshing' ? null : retrying ? 'Küldés…' : <>Újraküldés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{retryTargets.length}</span>)</>}
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
      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </div>
  );
}
