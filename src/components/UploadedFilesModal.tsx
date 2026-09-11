// v2 - batch delete enabled
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize, extractStoragePath } from '@/lib/utils';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Trash2,
  Search,
  FileText,
  Landmark,
  Wallet,
  Package,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Coins,
} from 'lucide-react';

interface UploadedFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which tab is active — determines which table to query */
  activeTab: 'invoices' | 'vouchers' | 'bank' | 'transactions' | 'salaries' | 'reports';
}

interface UploadRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_url: string;
  processing_status: string;
  created_at: string;
  document_category?: string;
}

const TAB_CONFIG = {
  invoices: {
    table: 'invoice_uploads',
    bucket: 'invoice-uploads',
    uploadType: 'invoice',
    labelKey: 'invoices:title',
    label: 'Számlák',
    icon: FileText,
    filter: (q: any) => q.not('document_category', 'in', '("payroll","penztarbizonylat")'),
  },
  vouchers: {
    table: 'invoice_uploads',
    bucket: 'invoice-uploads',
    uploadType: 'invoice',
    labelKey: 'vouchers',
    label: 'Pénztárbizonylatok',
    icon: Coins,
    filter: (q: any) => q.eq('document_category', 'penztarbizonylat'),
  },
  bank: {
    table: 'bank_statement_uploads',
    bucket: 'bank-statements',
    uploadType: 'bank',
    labelKey: 'bank',
    label: 'Bankkivonatok',
    icon: Landmark,
    filter: null,
  },
  transactions: {
    table: 'transaction_uploads',
    bucket: 'transactions',
    uploadType: 'transaction',
    labelKey: 'transactions',
    label: 'Tranzakciók',
    icon: Landmark,
    filter: null,
  },
  salaries: {
    table: 'invoice_uploads',
    bucket: 'invoice-uploads',
    uploadType: 'invoice',
    labelKey: 'salaries',
    label: 'Bérek/Járulékok',
    icon: Wallet,
    filter: (q: any) => q.eq('document_category', 'payroll'),
  },
  reports: {
    table: 'report_uploads',
    bucket: 'report-uploads',
    uploadType: 'report',
    labelKey: 'reports',
    label: 'Riportok',
    icon: Package,
    filter: null,
  },
} as const;

const PAGE_SIZE = 15;

export default function UploadedFilesModal({ open, onOpenChange, activeTab }: UploadedFilesModalProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Single delete
  const [deleteTarget, setDeleteTarget] = useState<UploadRecord | null>(null);
  const [singleDeleting, setSingleDeleting] = useState(false);

  // Batch delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const config = TAB_CONFIG[activeTab];
  const companyId = selectedCompany?.id;

  // ── Fetch uploads ──
  const { data: uploads = [], isLoading } = useQuery<UploadRecord[]>({
    queryKey: ['uploaded-files', activeTab, companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const selectFields = config.table === 'invoice_uploads'
        ? 'id, file_name, file_size, file_url, processing_status, created_at, document_category'
        : 'id, file_name, file_size, file_url, processing_status, created_at';

      let query = (supabase as any)
        .from(config.table)
        .select(selectFields)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (config.filter) {
        query = config.filter(query);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UploadRecord[];
    },
    enabled: open && !!companyId,
  });

  // ── Search + pagination ──
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return uploads;
    const q = searchQuery.toLowerCase();
    return uploads.filter(u => u.file_name.toLowerCase().includes(q));
  }, [uploads, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useMemo(() => { setCurrentPage(1); }, [searchQuery]);

  // ── Selection helpers ──
  const visibleIds = paged.map(u => u.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some(id => selectedIds.has(id));

  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedCount = selectedIds.size;
  const selectedUploads = useMemo(
    () => uploads.filter(u => selectedIds.has(u.id)),
    [uploads, selectedIds]
  );

  // ── Delete actions ──
  const deleteSingleRecord = async (record: UploadRecord, withData: boolean) => {
    if (config.bucket && record.file_url) {
      const path = extractStoragePath(record.file_url, config.bucket);
      if (path) {
        await supabase.storage.from(config.bucket).remove([path]);
      }
    }
    if (withData && config.table === 'invoice_uploads') {
      await supabase.from('invoices').delete().eq('invoice_uploads_id', record.id);
    }
    const { error } = await (supabase as any).from(config.table).delete().eq('id', record.id);
    if (error) throw error;
  };

  const handleSingleDelete = async (withData: boolean) => {
    if (!deleteTarget) return;
    setSingleDeleting(true);
    try {
      await deleteSingleRecord(deleteTarget, withData);
      toast({
        title: withData ? t('invoices:dialogs.files.toast_file_and_invoices_deleted') : t('invoices:dialogs.files.toast_file_deleted'),
        description: deleteTarget.file_name,
        duration: 3000,
      });
      setSelectedIds(prev => { const n = new Set(prev); n.delete(deleteTarget.id); return n; });
    } catch (err: any) {
      toast({
        title: t('common:status.error'),
        description: err.message || t('invoices:dialogs.files.toast_delete_error'),
        variant: 'destructive',
      });
    } finally {
      setSingleDeleting(false);
      setDeleteTarget(null);
      invalidateAfterDelete();
    }
  };

  const handleBatchDelete = async (withData: boolean) => {
    setBatchDeleting(true);
    const results = await Promise.allSettled(
      selectedUploads.map(rec => deleteSingleRecord(rec, withData))
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    const succeeded = results.length - failed;

    if (failed === 0) {
      toast({
        title: t('invoices:dialogs.files.toast_batch_deleted_title', { count: succeeded }),
        description: withData ? t('invoices:dialogs.files.toast_batch_deleted_invoices') : t('invoices:dialogs.files.toast_batch_deleted_files_only'),
        duration: 3000,
      });
    } else {
      toast({
        title: t('invoices:dialogs.files.toast_batch_partial_title', { succeeded, total: results.length }),
        description: t('invoices:dialogs.files.toast_batch_partial_desc', { failed }),
        variant: 'destructive',
      });
    }

    setSelectedIds(new Set());
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    invalidateAfterDelete();
  };

  const invalidateAfterDelete = () => {
    queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
    queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
  };

  // ── Status badge ──
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20 text-[10px]">{t('invoices:status.processed', 'Feldolgozva')}</Badge>;
      case 'processing':
      case 'webhook_sent':
        return <Badge variant="outline" className="text-[10px]">{t('invoices:status.processing', 'Folyamatban')}</Badge>;
      case 'error':
      case 'failed':
      case 'webhook_failed':
        return <Badge variant="destructive" className="text-[10px]">{t('common:status.error', 'Hiba')}</Badge>;
      case 'ignored':
        return <Badge variant="secondary" className="text-[10px]">{t('common:status.ignored', 'Mellőzve')}</Badge>;
      case 'cmr_attached':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">{t('invoices:status.cmr_attached', 'Dok. párosítva')}</Badge>;
      case 'cmr_orphaned':
        return <Badge variant="secondary" className="text-[10px]">{t('invoices:status.cmr_orphaned', 'Vár a számlára')}</Badge>;
      case 'cmr_escalated':
        return <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">{t('invoices:status.cmr_escalated', 'Eszkaláció')}</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">{t('invoices:status.pending', 'Függőben')}</Badge>;
    }
  };

  // ── Reusable A/B delete option buttons ──
  const DeleteOptions = ({
    onFileOnly,
    onWithData,
    disabled,
    fileName,
    isMulti,
    count,
  }: {
    onFileOnly: () => void;
    onWithData: () => void;
    disabled: boolean;
    fileName?: string;
    isMulti?: boolean;
    count?: number;
  }) => (
    <div className="space-y-2 py-1 w-full min-w-0">
      {/* Option A */}
      <button
        disabled={disabled}
        onClick={onFileOnly}
        className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {isMulti ? t('invoices:dialogs.files.opt_a_batch_title') : t('invoices:dialogs.files.opt_a_single_title')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isMulti
                ? t('invoices:dialogs.files.opt_a_batch_desc', { count })
                : t('invoices:dialogs.files.opt_a_single_desc', { fileName })
              }
            </p>
          </div>
        </div>
      </button>

      {/* Option B */}
      <button
        disabled={disabled}
        onClick={onWithData}
        className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">
              {isMulti ? t('invoices:dialogs.files.opt_b_batch_title') : t('invoices:dialogs.files.opt_b_single_title')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isMulti
                ? t('invoices:dialogs.files.opt_b_batch_desc', { count })
                : t('invoices:dialogs.files.opt_b_single_desc', { fileName, invoices: '' })
              }
            </p>
          </div>
        </div>
      </button>
    </div>
  );

  const Icon = config.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setDeleteTarget(null);
          setBatchDeleteOpen(false);
          setSelectedIds(new Set());
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col border-border bg-card">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Icon className="h-5 w-5 text-primary" />
              {t('invoices:dialogs.files.trigger_button')} — {config.label}
            </DialogTitle>
            <DialogDescription>
              {uploads.length} · {t('invoices:dialogs.files.delete_choose_mode')}
            </DialogDescription>
          </DialogHeader>

          {/* Search + Batch delete button */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Select all checkbox */}
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleSelectAll}
              aria-label={t('invoices:dialogs.files.select_all_page')}
              {...(someVisibleSelected && !allVisibleSelected ? { 'data-state': 'indeterminate' } : {})}
              className="shrink-0"
            />
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('invoices:dialogs.files.search_placeholder')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 bg-muted/30 border-border/50"
              />
            </div>
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-9 gap-1.5 shrink-0"
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('invoices:dialogs.files.delete_selected', { count: selectedCount })}
              </Button>
            )}
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : paged.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                {searchQuery ? t('invoices:dialogs.files.no_results') : t('invoices:dialogs.files.no_files')}
              </div>
            ) : (
              paged.map(record => (
                <div
                  key={record.id}
                  className={`flex items-center gap-3 border rounded-lg px-3 py-2.5 transition-colors group ${
                    selectedIds.has(record.id)
                      ? 'border-primary/40 bg-primary/5 dark:bg-primary/10'
                      : 'border-border/50 bg-card hover:border-border'
                  }`}
                >
                  <Checkbox
                    checked={selectedIds.has(record.id)}
                    onCheckedChange={() => toggleSelect(record.id)}
                    aria-label={`Kijelölés: ${record.file_name}`}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{record.file_name}</p>
                      {getStatusBadge(record.processing_status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatFileSize(record.file_size)} · {format(new Date(record.created_at), 'yyyy. MM. dd. HH:mm', { locale: getDateFnsLocale() })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => window.open(record.file_url, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(record)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between shrink-0 pt-2 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                {filtered.length} / {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 text-xs font-semibold tabular-nums">{currentPage} / {totalPages}</span>
                <Button
                  variant="outline" size="icon" className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Single delete dialog ─────────────────────────────────────────── */}
      <AlertDialog open={open && !!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>{t('invoices:dialogs.files.delete_single_title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1 w-full min-w-0">
                <p>{t('invoices:dialogs.files.delete_choose_mode')}</p>
                <p className="text-xs text-muted-foreground">{t('invoices:dialogs.files.delete_cannot_undo')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <DeleteOptions
            disabled={singleDeleting}
            fileName={deleteTarget?.file_name}
            onFileOnly={() => handleSingleDelete(false)}
            onWithData={() => handleSingleDelete(true)}
          />

          {singleDeleting && (
            <div className="flex items-center justify-center py-2 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('invoices:dialogs.files.deleting')}</span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={singleDeleting}>{t('common:actions.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Batch delete dialog ──────────────────────────────────────────── */}
      <AlertDialog open={open && batchDeleteOpen} onOpenChange={o => { if (!o && !batchDeleting) setBatchDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>{t('invoices:dialogs.files.delete_batch_title', { count: selectedCount })}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 w-full min-w-0">
                <p>{t('invoices:dialogs.files.delete_batch_choose')}</p>
                <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-1 w-full min-w-0 overflow-x-hidden">
                  {selectedUploads.map(u => (
                    <div key={u.id} className="text-xs text-muted-foreground truncate w-full min-w-0" title={u.file_name}>
                      • {u.file_name}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('invoices:dialogs.files.delete_cannot_undo')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <DeleteOptions
            disabled={batchDeleting}
            isMulti
            count={selectedCount}
            onFileOnly={() => handleBatchDelete(false)}
            onWithData={() => handleBatchDelete(true)}
          />

          {batchDeleting && (
            <div className="flex items-center justify-center py-2 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('invoices:dialogs.files.deleting_batch', { count: selectedCount })}</span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={batchDeleting}>{t('common:actions.cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
