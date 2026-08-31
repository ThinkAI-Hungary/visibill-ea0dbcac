import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '../common/ManagementSkeleton';
import { fetchManagementData, postManagementData } from '../../api/managementApi';
import { FileRow, FilesData, FileSortCol, ControlCenterUser } from '../../api/types';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  FolderOpen, Check, AlertCircle, Clock, AlertTriangle, Search, ChevronDown,
  ChevronLeft, ChevronRight, Eye, Download, RefreshCw, Trash2, X,
  FileText, CreditCard, Landmark, BarChart3, RotateCcw, Receipt, Wallet,
  Truck, Mail, Loader2, ArrowUp, ArrowDown, ArrowUpDown
} from 'lucide-react';

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function fileExtBadge(fileName: string) {
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

export type StatusCategory = 'success' | 'pending' | 'error' | 'redirected' | 'dismissed';

export function normalizeStatus(status: string | null, errorMessage?: string | null): StatusCategory {
  if (status === 'redirected') return 'redirected';
  const isCompleted = errorMessage?.toLowerCase() === 'job completed' || errorMessage?.toLowerCase().includes('job completed');
  const isDuplicate = errorMessage?.includes('már létezik a rendszerben');
  if (isDuplicate) return 'dismissed';
  if (errorMessage && !isCompleted) return 'error';
  if (!status) return 'pending';
  switch (status) {
    case 'done': case 'completed': case 'processed': return 'success';
    case 'dismissed': return 'dismissed';
    case 'ignored': return 'dismissed';
    case 'error': case 'failed': case 'webhook_failed': return 'error';
    default: return 'pending';
  }
}

export const STATUS_DISPLAY: Record<StatusCategory, { label: string; cls: string }> = {
  success: { label: 'Feldolgozva', cls: 'bg-success/10 text-success border-success/25' },
  pending: { label: 'Folyamatban', cls: 'bg-warning/10 text-warning border-warning/25' },
  error: { label: 'Hiba', cls: 'bg-destructive/10 text-destructive border-destructive/25' },
  redirected: { label: 'Átirányítva', cls: 'bg-info/10 text-info border-info/25' },
  dismissed: { label: 'Mellőzve', cls: 'bg-muted text-muted-foreground border-border' },
};

export const STATUS_FILTER_VALUES: Record<string, string> = {
  success: 'done,completed,processed',
  pending: 'processing,pending',
  error: 'error,failed,ignored,dismissed,webhook_failed',
};

export function processingStatusBadge(status: string | null, errorMessage?: string | null) {
  const cat = normalizeStatus(status, errorMessage);
  const { label, cls } = STATUS_DISPLAY[cat];
  return <Badge className={`text-[10px] border ${cls} w-20 justify-center`}>{label}</Badge>;
}

export function fileTypeBadge(label: string, sourceTable: string) {
  const colors: Record<string, string> = {
    invoice: 'bg-primary/10 text-primary border-primary/25',
    transaction: 'bg-info/10 text-info border-info/25',
    bank: 'bg-purple-500/10 text-purple-400 border-purple-500/25',
    report: 'bg-warning/10 text-warning border-warning/25',
  };
  const cls = colors[sourceTable] || 'bg-muted text-muted-foreground border-border';
  return <Badge className={`text-[10px] border ${cls} w-20 justify-center`}>{label}</Badge>;
}

interface FilesPanelProps {
  allUsers: ControlCenterUser[];
}

export function FilesPanel({ allUsers }: FilesPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const PAGE_SIZE = 25;

  // Local retry states
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string; project?: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same');
  const [retryPhase, setRetryPhase] = useState<'idle' | 'sending' | 'refreshing'>('idle');
  const [retrying, setRetrying] = useState(false);

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
    setRetryTargets(ids);
    setRetryPipeline('same');
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (retryTargets.length === 0) return;
    setRetrying(true);
    setRetryPhase('sending');
    try {
      const pipelineOverride = retryPipeline !== 'same'
        ? PIPELINE_OPTIONS.find(p => p.value === retryPipeline)
        : null;

      await postManagementData('retry-errors', {
        ids: retryTargets,
        ...(pipelineOverride && {
          targetQueue: pipelineOverride.queue,
          targetCategory: pipelineOverride.category,
        }),
      });
      setSelectedFiles(new Set());

      setRetryPhase('refreshing');
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['management-files'], type: 'active' }),
        queryClient.refetchQueries({ queryKey: ['management-overview'], type: 'active' }),
      ]);
    } catch (e) {
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors failed:', error: e });
    } finally {
      setRetrying(false);
      setRetryPhase('idle');
      setRetryModalOpen(false);
      setRetryTargets([]);
    }
  };

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

  const { data, isLoading, isFetching } = useQuery<FilesData>({
    queryKey: ['management-files', page, PAGE_SIZE, sortCol, sortDir, debouncedSearch, filterCompanyId, filterUserId, filterFileType, filterStatus, dateFrom, dateTo],
    queryFn: () => fetchManagementData('files', {
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy: sortCol,
      sortDir,
      search: debouncedSearch,
      companyId: filterCompanyId,
      userId: filterUserId,
      fileType: filterFileType,
      status: STATUS_FILTER_VALUES[filterStatus] || filterStatus,
      dateFrom,
      dateTo,
    }),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const fileRows = data?.files || [];
  const totalRows = data?.totalRows || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const stats = data?.stats;

  // Local state for the input field
  const [search, setSearch] = useState(debouncedSearch);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { previewFile, openPreview: openPreview2, closePreview: closePreview2 } = useFilePreview();
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);

  // Selection state for bulk operations
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [_deleteConfirmCounts, setDeleteConfirmCounts] = useState({ withStorage: 0, dbOnly: 0 });

  // Reset last selected index on pagination/sort/filter changes
  useEffect(() => {
    setLastSelectedIndex(null);
  }, [page, sortCol, sortDir, debouncedSearch, filterCompanyId, filterUserId, filterFileType, filterStatus, dateFrom, dateTo]);

  const toggleFileSelection = useCallback((fileKey: string, index: number, shiftKey: boolean) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      const isAdding = !next.has(fileKey);

      if (shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index);
        const end = Math.max(lastSelectedIndex, index);
        for (let i = start; i <= end; i++) {
          const item = fileRows[i];
          if (item) {
            const itemKey = `${item.source_table}:${item.id}`;
            if (isAdding) {
              next.add(itemKey);
            } else {
              next.delete(itemKey);
            }
          }
        }
      } else {
        if (next.has(fileKey)) next.delete(fileKey);
        else next.add(fileKey);
      }

      setLastSelectedIndex(index);
      return next;
    });
  }, [fileRows, lastSelectedIndex]);

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
      updateParams({ file_sort: col, file_dir: 'desc' });
    }
  }, [sortCol, sortDir, updateParams]);

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

  const companyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of allUsers) {
      for (const c of (u as any).companies || []) {
        if (c.id && !seen.has(c.id)) seen.set(c.id, c.name);
      }
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allUsers]);

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
              role="button"
              tabIndex={0}
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
              role="button"
              tabIndex={0}
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
              role="button"
              tabIndex={0}
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
              role="button"
              tabIndex={0}
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
                          {userOptions.map((u: any) => (
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

                {/* File type filter */}
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

                {/* Status filter */}
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
                  value={dateFrom.includes('T') ? dateFrom.split('T')[0] : dateFrom}
                  onChange={e => { updateParams({ file_from: e.target.value, file_page: null }); }}
                  className="h-8 text-xs bg-background w-36"
                  id="files-date-from"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={dateTo.includes('T') ? dateTo.split('T')[0] : dateTo}
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
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-success/30 hover:bg-success/10"
                    onClick={() => handleBulkStatusUpdate('done')}
                    disabled={bulkUpdating || bulkDeleting}
                  >
                    <Check className="h-3 w-3 text-success" />
                    Feldolgozva
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-warning/30 hover:bg-warning/10"
                    onClick={() => handleBulkStatusUpdate('pending')}
                    disabled={bulkUpdating || bulkDeleting}
                  >
                    <Clock className="h-3 w-3 text-warning" />
                    Folyamatban
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-primary"
                    onClick={() => handleBulkStatusUpdate('error')}
                    disabled={bulkUpdating || bulkDeleting}
                  >
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    Hiba
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-primary"
                    onClick={handleOpenDeleteConfirm}
                    disabled={bulkUpdating || bulkDeleting}
                  >
                    <Trash2 className="h-3 w-3" />
                    Törlés
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-primary/30 hover:bg-primary/10"
                    onClick={() => {
                      const targets = Array.from(selectedFiles).map(key => {
                        const [sourceTable, id] = key.split(':');
                        const fullTable = sourceTable === 'invoice' ? 'invoice_uploads' :
                                          sourceTable === 'transaction' ? 'transaction_uploads' :
                                          sourceTable === 'report' ? 'report_uploads' : sourceTable + '_uploads';
                        return { source: fullTable, id };
                      }).filter(t => t.source === 'invoice_uploads' || t.source === 'transaction_uploads' || t.source === 'report_uploads');
                      
                      if (targets.length > 0) {
                        openRetryModal(targets);
                      } else {
                        toast({ title: 'Nem támogatott', description: 'A kijelölt fájlok nem támogatják az újraküldést.', variant: 'destructive' });
                      }
                    }}
                    disabled={bulkUpdating || bulkDeleting}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Újraküldés
                  </Button>
                  <div className="h-4 w-px bg-border" />
                  <Button
                    size="sm"
                    variant="ghost"
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
                <col style={{ width: 130 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 110 }} />
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
                ) : fileRows.map((row, index) => {
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
                            onClick={(e) => toggleFileSelection(`${row.source_table}:${row.id}`, index, e.shiftKey)}
                            onChange={() => {}}
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
                                {(row.source_table === 'invoice' || row.source_table === 'transaction' || row.source_table === 'report') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                    title="Újraküldés feldolgozásra"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const fullTable = row.source_table === 'invoice' ? 'invoice_uploads' :
                                                        row.source_table === 'transaction' ? 'transaction_uploads' :
                                                        row.source_table === 'report' ? 'report_uploads' : row.source_table + '_uploads';
                                      openRetryModal([{ source: fullTable, id: row.id }]);
                                    }}
                                    aria-label="Újraküldés feldolgozásra"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Megtekintés"
                                  onClick={e => { e.stopPropagation(); openPreview2({ url: row.file_url!, name: row.file_name }); }}
                                  aria-label="Megtekintés"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
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
                      {/* Expanded row */}
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
                              {row.error_message && (() => {
                                const isDuplicate = row.error_message.includes('már létezik a rendszerben');
                                const bgClass = isDuplicate 
                                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' 
                                  : 'bg-destructive/8 border border-destructive/20 text-destructive';
                                const Icon = isDuplicate ? AlertTriangle : AlertCircle;
                                return (
                                  <div className={`mt-2 flex items-start gap-2 rounded-md px-3 py-2 border overflow-hidden ${bgClass}`}>
                                    <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                    <span className="text-xs break-words min-w-0">{row.error_message}</span>
                                  </div>
                                );
                              })()}
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateParams({ file_page: 1 })}
                  disabled={page === 1}
                  aria-label="Első"
                >
                  <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateParams({ file_page: Math.max(1, page - 1) })}
                  disabled={page === 1}
                  aria-label="Előző"
                >
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
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateParams({ file_page: Math.min(totalPages, page + 1) })}
                  disabled={page === totalPages}
                  aria-label="Következő"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => updateParams({ file_page: totalPages })}
                  disabled={page === totalPages}
                  aria-label="Utolsó"
                >
                  <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* File Preview */}
      <FilePreviewModal previewFile={previewFile} onClose={closePreview2} />

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
    </div>
  );
}
