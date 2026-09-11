import { useState, useMemo } from 'react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, FileText, Loader2, Search, User, Landmark, Download } from 'lucide-react';
import { format } from 'date-fns';
import { getDateFnsLocale, formatCurrency } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

interface UploadWithTransactions {
  id: string;
  file_name: string;
  file_url?: string;
  created_at: string;
  user_id: string | null;
  detected_bank: string | null;
  transactionCount: number;
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

interface TransactionFilesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const BANK_CONFIG: Record<string, { label: string }> = {
  otp:        { label: 'OTP' },
  cib:        { label: 'CIB' },
  raiffeisen: { label: 'Raiffeisen' },
  kh:         { label: 'K&H' },
  erste:      { label: 'Erste' },
  unicredit:  { label: 'UniCredit' },
  magnet:     { label: 'MagNet' },
  granit:     { label: 'Gránit' },
  wise:       { label: 'Wise' },
  revolut:    { label: 'Revolut' },
  paypal:     { label: 'PayPal' },
  binx:       { label: 'Binx' },
  mbh:        { label: 'MBH' },
  mkb:        { label: 'MKB' },
  oberbank:   { label: 'Oberbank' },
};

export function TransactionFilesDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: TransactionFilesDialogProps = {}) {
  const { t } = useTranslation(['transactions', 'common']);
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = externalOnOpenChange || setInternalOpen;

  // Single delete
  const [deleteTarget, setDeleteTarget] = useState<UploadWithTransactions | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [viewingUpload, setViewingUpload] = useState<UploadWithTransactions | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleUploaderChange = (value: string) => {
    setUploaderFilter(value);
    setCurrentPage(1);
  };

  const handleDownloadSelected = async () => {
    if (selectedIds.size === 0) return;
    setDownloading(true);
    try {
      const targets = uploads.filter(u => selectedIds.has(u.id));
      for (const upload of targets) {
        if (!upload.file_url) continue;
        const storagePath = extractStoragePath(upload.file_url, 'transactions');
        if (storagePath) {
          const { data, error } = await supabase.storage.from('transactions').download(storagePath);
          if (error) throw error;
          if (data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = upload.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }
        } else {
          const a = document.createElement('a');
          a.href = upload.file_url;
          a.download = upload.file_name;
          a.target = '_blank';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
      }
      toast({ title: 'Sikeres letöltés', description: `${targets.length} fájl letöltése elindítva.` });
    } catch (err: any) {
      toast({ title: 'Hiba a letöltés során', description: err.message || 'Ismeretlen hiba történt.', variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const companyId = selectedCompany?.id;

  // Fetch transaction_uploads
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['transaction_uploads_with_counts', companyId],
    queryFn: async () => {
      const { data: uploadData, error: uploadError } = await supabase
        .from('transaction_uploads')
        .select('id, file_name, file_url, created_at, user_id, detected_bank')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (uploadError) throw uploadError;
      if (!uploadData || uploadData.length === 0) return [];

      return uploadData as Omit<UploadWithTransactions, 'transactionCount'>[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 0,
    refetchInterval: 3000,
  });

  // Fetch company members with profile names
  const { data: companyMembers = [] } = useQuery({
    queryKey: ['company_members_profiles', companyId],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId!);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const memberUserIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', memberUserIds);
      if (profilesError) throw profilesError;

      return (profiles || []).map(p => ({
        user_id: p.user_id,
        name: p.name,
      })) as CompanyMember[];
    },
    enabled: !!companyId && isOpen,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    companyMembers.forEach(m => { if (m.name) map.set(m.user_id, m.name); });
    return map;
  }, [companyMembers]);

  const getUserName = (userId: string | null): string => {
    if (!userId) return 'Rendszer';
    return profileMap.get(userId) || 'Ismeretlen felhasználó';
  };

  // Fetch transactions for the viewing upload
  const { data: viewingTransactions = [], isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['upload_transactions', viewingUpload?.id],
    queryFn: async () => {
      if (!viewingUpload) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, description, amount, currency, type, is_verified')
        .eq('upload_id', viewingUpload.id)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!viewingUpload,
  });

  const getBankLabel = (bankKey: string | null): string => {
    if (!bankKey) return '—';
    const cfg = BANK_CONFIG[bankKey.toLowerCase()];
    return cfg?.label || bankKey.toUpperCase();
  };

  // Client-side filtering
  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery
        || upload.file_name.toLowerCase().includes(searchLower)
        || getBankLabel(upload.detected_bank).toLowerCase().includes(searchLower);
      const matchesUploader = uploaderFilter === 'all' || upload.user_id === uploaderFilter;
      return matchesSearch && matchesUploader;
    });
  }, [uploads, searchQuery, uploaderFilter]);

  // Client-side pagination
  const { paginatedUploads, totalPages } = useMemo(() => {
    const totalPages = Math.ceil(filteredUploads.length / pageSize);
    const paginated = filteredUploads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return { paginatedUploads: paginated, totalPages };
  }, [filteredUploads, currentPage, pageSize]);

  // Visible IDs on current page
  const visibleIds = useMemo(() => paginatedUploads.map(u => u.id), [paginatedUploads]);

  // Target IDs for count lookup: visible uploads on current page + any selected uploads across other pages
  const targetCountIds = useMemo(() => {
    const idSet = new Set(visibleIds);
    selectedIds.forEach(id => idSet.add(id));
    return Array.from(idSet);
  }, [visibleIds, selectedIds]);

  // Fetch transaction counts bounded to visible uploads and selected uploads
  const { data: pageCounts = new Map<string, number>() } = useQuery({
    queryKey: ['transaction_upload_page_counts', companyId, targetCountIds],
    queryFn: async () => {
      if (!targetCountIds || targetCountIds.length === 0) return new Map<string, number>();

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('upload_id')
        .in('upload_id', targetCountIds);
      if (txError) throw txError;

      const countsByUpload = new Map<string, number>();
      (txData || []).forEach((tx: any) => {
        if (!tx.upload_id) return;
        countsByUpload.set(tx.upload_id, (countsByUpload.get(tx.upload_id) || 0) + 1);
      });

      return countsByUpload;
    },
    enabled: !!companyId && isOpen && targetCountIds.length > 0,
    staleTime: 0,
    refetchInterval: 3000,
  });

  const paginatedUploadsWithCounts = useMemo(() => {
    return paginatedUploads.map(u => ({
      ...u,
      transactionCount: pageCounts.get(u.id) || 0,
    })) as UploadWithTransactions[];
  }, [paginatedUploads, pageCounts]);

  // Selection helpers
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
  const selectedUploads = useMemo(() => {
    return uploads
      .filter(u => selectedIds.has(u.id))
      .map(u => ({
        ...u,
        transactionCount: pageCounts.get(u.id) || 0,
      })) as UploadWithTransactions[];
  }, [uploads, selectedIds, pageCounts]);

  // Single delete functions
  const deleteUploadFileOnly = async (upload: UploadWithTransactions) => {
    const { data: uploadData } = await supabase
      .from('transaction_uploads')
      .select('file_url')
      .eq('id', upload.id)
      .single();

    await supabase.from('transactions').update({ upload_id: null }).eq('upload_id', upload.id);
    const { error } = await supabase.from('transaction_uploads').delete().eq('id', upload.id);
    if (error) throw error;

    if (uploadData?.file_url) {
      const storagePath = extractStoragePath(uploadData.file_url, 'transactions');
      if (storagePath) await supabase.storage.from('transactions').remove([storagePath]);
    }
  };

  const deleteUploadWithTransactions = async (upload: UploadWithTransactions) => {
    const { data: uploadData } = await supabase
      .from('transaction_uploads')
      .select('file_url')
      .eq('id', upload.id)
      .single();

    const { error: rpcError } = await supabase.rpc('delete_upload_with_data', {
      p_upload_id: upload.id,
      p_upload_type: 'transaction',
    });
    if (rpcError) throw rpcError;

    if (uploadData?.file_url) {
      const storagePath = extractStoragePath(uploadData.file_url, 'transactions');
      if (storagePath) await supabase.storage.from('transactions').remove([storagePath]);
    }
  };

  // Handlers
  const handleDeleteFileOnly = async (upload: UploadWithTransactions) => {
    setDeleting(true);
    try {
      await deleteUploadFileOnly(upload);
      toast({
        title: t('transactions:dialogs.files.toasts.file_only_success_title'),
        description: t('transactions:dialogs.files.toasts.file_only_success_desc'),
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['transaction_upload_page_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['bank-uploads-unified', companyId] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({
        title: t('transactions:dialogs.files.toasts.error_title'),
        description: err.message || t('transactions:dialogs.files.toasts.error_desc'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteFileAndTransactions = async (upload: UploadWithTransactions) => {
    setDeleting(true);
    try {
      await deleteUploadWithTransactions(upload);
      toast({
        title: t('transactions:dialogs.files.toasts.all_success_title'),
        description: t('transactions:dialogs.files.toasts.all_success_desc'),
        duration: 3000,
      });
      queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['transaction_upload_page_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['bank-uploads-unified', companyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['tx-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({
        title: t('transactions:dialogs.files.toasts.error_title'),
        description: err.message || t('transactions:dialogs.files.toasts.error_desc'),
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleBatchDelete = async (withTransactions: boolean) => {
    setBatchDeleting(true);
    const fn = withTransactions ? deleteUploadWithTransactions : deleteUploadFileOnly;
    const results = await Promise.allSettled(selectedUploads.map(fn));
    const failed = results.filter(r => r.status === 'rejected').length;
    const succeeded = results.length - failed;

    if (failed === 0) {
      toast({
        title: t('transactions:dialogs.files.toasts.batch_all_success_title', { count: succeeded }),
        description: withTransactions
          ? t('transactions:dialogs.files.toasts.batch_all_success_desc_with_tx')
          : t('transactions:dialogs.files.toasts.batch_all_success_desc_file_only'),
        duration: 3000,
      });
    } else {
      toast({
        title: t('transactions:dialogs.files.toasts.batch_partial_title', { succeeded, total: results.length }),
        description: t('transactions:dialogs.files.toasts.batch_partial_desc', { failed }),
        variant: 'destructive',
      });
    }

    setSelectedIds(new Set());
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
    queryClient.invalidateQueries({ queryKey: ['transaction_upload_page_counts', companyId] });
    queryClient.invalidateQueries({ queryKey: ['bank-uploads-unified', companyId] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['tx-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
  };

  return (
    <>
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setBatchDeleteOpen(false);
            setSelectedIds(new Set());
          }
          setIsOpen(open);
        }}
      >
        {externalOpen === undefined && (
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Landmark className="h-4 w-4 mr-2" />
              {t('transactions:dialogs.files.trigger_btn')}
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col border-border bg-card">
          <DialogHeader className="shrink-0">
            <DialogTitle>{t('transactions:dialogs.files.title')}</DialogTitle>
            <DialogDescription>
              {t('transactions:dialogs.files.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">

          {/* Filters + Batch delete button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder={t('transactions:dialogs.files.search_placeholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
              />
            </div>
            <Select value={uploaderFilter} onValueChange={handleUploaderChange}>
              <SelectTrigger className="h-9 w-[200px] bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
                <User className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-muted-foreground" />
                <SelectValue placeholder={t('transactions:dialogs.files.uploader_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('transactions:dialogs.files.all_uploaders')}</SelectItem>
                {companyMembers.map(member => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || t('transactions:dialogs.files.anonymous_user')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {uploads.length === 0
                ? t('transactions:dialogs.files.empty_no_uploads')
                : t('transactions:dialogs.files.empty_no_matches')}
            </div>
          ) : (
            <div className="space-y-4">
              {selectedCount > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20 text-foreground animate-in fade-in duration-200">
                  <span className="text-sm font-semibold">
                    {t('transactions:dialogs.files.selected_count', { count: selectedCount })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 font-semibold bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10"
                      onClick={handleDownloadSelected}
                      disabled={downloading}
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {t('transactions:dialogs.files.download_btn')}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-8 gap-1.5 font-semibold"
                      onClick={() => setBatchDeleteOpen(true)}
                      disabled={downloading}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('transactions:dialogs.files.delete_btn')}
                    </Button>
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] pr-0">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label={t('transactions:dialogs.files.select_all_aria')}
                          className="data-[state=indeterminate]:opacity-70"
                          {...(someVisibleSelected && !allVisibleSelected ? { 'data-state': 'indeterminate' } : {})}
                        />
                      </TableHead>
                      <TableHead className="w-[35%]">{t('transactions:dialogs.files.columns.file_name')}</TableHead>
                      <TableHead className="w-[20%]">{t('transactions:dialogs.files.columns.bank_tx_count')}</TableHead>
                      <TableHead className="w-[18%]">{t('transactions:dialogs.files.columns.upload_date')}</TableHead>
                      <TableHead className="w-[17% his]">{t('transactions:dialogs.files.columns.uploaded_by')}</TableHead>
                      <TableHead className="w-[10%] text-right">{t('transactions:dialogs.files.columns.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUploadsWithCounts.map((upload) => (
                      <TableRow
                        key={upload.id}
                        data-row-hover
                        className={selectedIds.has(upload.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}
                      >
                        <TableCell className="pr-0">
                          <Checkbox
                            checked={selectedIds.has(upload.id)}
                            onCheckedChange={() => toggleSelect(upload.id)}
                            aria-label={t('transactions:dialogs.files.select_item_aria', { fileName: upload.file_name })}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm truncate max-w-[280px]">
                          {upload.file_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {upload.transactionCount > 0 ? (
                            <button
                              type="button"
                              onClick={() => setViewingUpload(upload)}
                              className="flex items-center gap-1.5 hover:underline text-left cursor-pointer group focus:outline-none"
                            >
                              <span className="font-semibold text-primary">{getBankLabel(upload.detected_bank)}</span>
                              <span className="text-xs text-muted-foreground group-hover:text-primary">
                                {t('transactions:dialogs.files.tx_count_suffix', { count: upload.transactionCount })}
                              </span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>{getBankLabel(upload.detected_bank)}</span>
                              <span className="text-xs">
                                {t('transactions:dialogs.files.tx_count_suffix', { count: upload.transactionCount })}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(upload.created_at), 'yyyy. MMM dd. HH:mm', { locale: getDateFnsLocale() })}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {getUserName(upload.user_id)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(upload)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredUploads.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                pageSizeOptions={[15, 30, 50]}
              />
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Single delete AlertDialog */}
      <AlertDialog open={isOpen && !!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>{t('transactions:dialogs.files.single_delete.title')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 w-full min-w-0">
                <p>{t('transactions:dialogs.files.single_delete.mode_prompt')}</p>
                <p className="text-xs text-muted-foreground">{t('transactions:dialogs.files.single_delete.irreversible')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1 w-full min-w-0">
            <button
              disabled={deleting}
              onClick={() => { if (deleteTarget) handleDeleteFileOnly(deleteTarget); }}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('transactions:dialogs.files.single_delete.option_file_only_title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('transactions:dialogs.files.single_delete.option_file_only_desc', { fileName: deleteTarget?.file_name })}
                  </p>
                </div>
              </div>
            </button>

            <button
              disabled={deleting}
              onClick={() => { if (deleteTarget) handleDeleteFileAndTransactions(deleteTarget); }}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    {t('transactions:dialogs.files.single_delete.option_all_title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('transactions:dialogs.files.single_delete.option_all_desc', {
                      fileName: deleteTarget?.file_name,
                      count: deleteTarget?.transactionCount,
                    })}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {deleting && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                {t('transactions:dialogs.files.single_delete.deleting')}
              </span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={deleting}>
              {t('transactions:dialogs.files.single_delete.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete AlertDialog */}
      <AlertDialog open={isOpen && batchDeleteOpen} onOpenChange={(open) => { if (!open && !batchDeleting) setBatchDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>
              {t('transactions:dialogs.files.batch_delete.title', { count: selectedCount })}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 w-full min-w-0">
                <p>{t('transactions:dialogs.files.batch_delete.mode_prompt')}</p>
                <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-1 w-full min-w-0 overflow-x-hidden">
                  {selectedUploads.map(u => (
                    <div key={u.id} className="text-xs text-muted-foreground truncate w-full min-w-0" title={u.file_name}>
                      {t('transactions:dialogs.files.batch_delete.item_line', { fileName: u.file_name, count: u.transactionCount })}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('transactions:dialogs.files.batch_delete.irreversible')}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1 w-full min-w-0">
            <button
              disabled={batchDeleting}
              onClick={() => handleBatchDelete(false)}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    {t('transactions:dialogs.files.batch_delete.option_files_only_title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('transactions:dialogs.files.batch_delete.option_files_only_desc', { count: selectedCount })}
                  </p>
                </div>
              </div>
            </button>

            <button
              disabled={batchDeleting}
              onClick={() => handleBatchDelete(true)}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-destructive">
                    {t('transactions:dialogs.files.batch_delete.option_all_title')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('transactions:dialogs.files.batch_delete.option_all_desc', { count: selectedCount })}
                  </p>
                </div>
              </div>
            </button>
          </div>

          {batchDeleting && (
            <div className="flex items-center justify-center py-2 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {t('transactions:dialogs.files.batch_delete.deleting', { count: selectedCount })}
              </span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={batchDeleting}>
              {t('transactions:dialogs.files.batch_delete.cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transaction Details Modal */}
      <Dialog 
        open={!!viewingUpload} 
        onOpenChange={(open) => { if (!open) setViewingUpload(null); }}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col border-border bg-card">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 truncate">
              <FileText className="h-5 w-5 text-primary" />
              <span>{t('transactions:dialogs.files.details_modal.title', { fileName: viewingUpload?.file_name })}</span>
            </DialogTitle>
            <DialogDescription>
              {t('transactions:dialogs.files.details_modal.description', { count: viewingUpload?.transactionCount })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 mt-2">
            {isLoadingTransactions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : viewingTransactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {t('transactions:dialogs.files.details_modal.empty')}
              </div>
            ) : (
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[15%]">{t('transactions:dialogs.files.details_modal.col_date')}</TableHead>
                      <TableHead className="w-[50%]">{t('transactions:dialogs.files.details_modal.col_description')}</TableHead>
                      <TableHead className="w-[20%] text-right">{t('transactions:dialogs.files.details_modal.col_amount')}</TableHead>
                      <TableHead className="w-[15%] text-center">{t('transactions:dialogs.files.details_modal.col_status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewingTransactions.map((tx: any) => (
                      <TableRow key={tx.id} data-row-hover>
                        <TableCell className="text-sm font-medium">
                          {tx.transaction_date}
                        </TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate" title={tx.description}>
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-right whitespace-nowrap">
                          <span className={tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {formatCurrency(tx.amount, tx.currency || 'HUF')}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {tx.is_verified ? (
                            <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                              {t('transactions:dialogs.files.details_modal.status_verified')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                              {t('transactions:dialogs.files.details_modal.status_pending')}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-3 border-t border-border/30 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setViewingUpload(null)}>
              {t('transactions:dialogs.files.details_modal.close_btn')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
