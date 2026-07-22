import { useState, useMemo } from 'react';
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';
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
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, FileText, Loader2, Search, User } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface UploadWithInvoices {
  id: string;
  file_name: string;
  file_url: string | null;
  created_at: string;
  user_id: string | null;
  invoiceNumbers: string[];
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

interface InvoiceFilesDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function InvoiceFilesDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: InvoiceFilesDialogProps = {}) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = externalOnOpenChange || setInternalOpen;

  // Single delete
  const [deleteTarget, setDeleteTarget] = useState<UploadWithInvoices | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Batch delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const { previewFile, openPreview, closePreview } = useFilePreview();

  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleUploaderChange = (value: string) => {
    setUploaderFilter(value);
    setCurrentPage(1);
  };

  const companyId = selectedCompany?.id;

  // Fetch invoice_uploads with related invoice bizonylatsorszam
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['invoice_uploads_with_invoices', companyId],
    queryFn: async () => {
      const { data: uploadData, error: uploadError } = await supabase
        .from('invoice_uploads')
        .select('id, file_name, file_url, created_at, user_id')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (uploadError) throw uploadError;
      if (!uploadData || uploadData.length === 0) return [];

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('invoice_uploads_id, bizonylatsorszam')
        .eq('company_id', companyId!)
        .not('invoice_uploads_id', 'is', null);
      if (invoiceError) throw invoiceError;

      const invoicesByUpload = new Map<string, string[]>();
      (invoiceData || []).forEach((inv: any) => {
        if (!inv.invoice_uploads_id) return;
        if (!invoicesByUpload.has(inv.invoice_uploads_id)) {
          invoicesByUpload.set(inv.invoice_uploads_id, []);
        }
        invoicesByUpload.get(inv.invoice_uploads_id)!.push(inv.bizonylatsorszam);
      });

      return uploadData
        .map(u => ({
          id: u.id,
          file_name: u.file_name,
          file_url: (u as any).file_url ?? null,
          created_at: u.created_at,
          user_id: u.user_id,
          invoiceNumbers: invoicesByUpload.get(u.id) || [],
        }))
        .filter(u => u.invoiceNumbers.length > 0) as UploadWithInvoices[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 0,
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

  // Client-side filtering
  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery
        || upload.file_name.toLowerCase().includes(searchLower)
        || upload.invoiceNumbers.some(n => n.toLowerCase().includes(searchLower));
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

  // ── Selection helpers ──────────────────────────────────────────────────────
  const visibleIds = paginatedUploads.map(u => u.id);
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
  const selectedUploads = uploads.filter(u => selectedIds.has(u.id));

  // ── Single delete helpers ──────────────────────────────────────────────────
  const deleteUploadFileOnly = async (upload: UploadWithInvoices) => {
    const { data: uploadData } = await supabase
      .from('invoice_uploads')
      .select('file_url')
      .eq('id', upload.id)
      .single();

    await supabase.from('invoices').update({ invoice_uploads_id: null }).eq('invoice_uploads_id', upload.id);
    const { error } = await supabase.from('invoice_uploads').delete().eq('id', upload.id);
    if (error) throw error;

    if (uploadData?.file_url) {
      const storagePath = extractStoragePath(uploadData.file_url, 'invoice-uploads');
      if (storagePath) await supabase.storage.from('invoice-uploads').remove([storagePath]);
    }
  };

  const deleteUploadWithInvoices = async (upload: UploadWithInvoices) => {
    const { data: uploadData } = await supabase
      .from('invoice_uploads')
      .select('file_url')
      .eq('id', upload.id)
      .single();

    const { error: invoiceError } = await supabase.from('invoices').delete().eq('invoice_uploads_id', upload.id);
    if (invoiceError) throw invoiceError;

    const { error } = await supabase.from('invoice_uploads').delete().eq('id', upload.id);
    if (error) throw error;

    if (uploadData?.file_url) {
      const storagePath = extractStoragePath(uploadData.file_url, 'invoice-uploads');
      if (storagePath) await supabase.storage.from('invoice-uploads').remove([storagePath]);
    }
  };

  // ── Single delete handlers ─────────────────────────────────────────────────
  const handleDeleteFileOnly = async (upload: UploadWithInvoices) => {
    setDeleting(true);
    try {
      await deleteUploadFileOnly(upload);
      toast({ title: 'Sikeres törlés', description: 'A fájl törölve lett. A számla adatok megmaradtak.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['invoice_uploads_with_invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteFileAndInvoice = async (upload: UploadWithInvoices) => {
    setDeleting(true);
    try {
      await deleteUploadWithInvoices(upload);
      toast({ title: 'Sikeres törlés', description: 'A dokumentum és a hozzá tartozó számlák törölve lettek.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['invoice_uploads_with_invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // ── Batch delete handler ───────────────────────────────────────────────────
  const handleBatchDelete = async (withInvoices: boolean) => {
    setBatchDeleting(true);
    const fn = withInvoices ? deleteUploadWithInvoices : deleteUploadFileOnly;
    const results = await Promise.allSettled(selectedUploads.map(fn));
    const failed = results.filter(r => r.status === 'rejected').length;
    const succeeded = results.length - failed;

    if (failed === 0) {
      toast({
        title: `${succeeded} dokumentum törölve`,
        description: withInvoices ? 'A fájlok és a kapcsolódó számlák törölve lettek.' : 'A fájlok törölve, a számla adatok megmaradtak.',
        duration: 3000,
      });
    } else {
      toast({
        title: `${succeeded}/${results.length} sikeres törlés`,
        description: `${failed} dokumentum törlése sikertelen volt.`,
        variant: 'destructive',
      });
    }

    setSelectedIds(new Set());
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    queryClient.invalidateQueries({ queryKey: ['invoice_uploads_with_invoices', companyId] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
    queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
    queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
  };

  return (
    <>
      <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            // Reset all ephemeral state so AlertDialogs don't flash during close animation
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
              <FileText className="h-4 w-4 mr-2" />
              Feltöltött fájlok
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col border-border bg-card">
          <DialogHeader className="shrink-0">
            <DialogTitle>Feltöltött számla dokumentumok</DialogTitle>
            <DialogDescription>
              Itt tekintheti meg és törölheti a korábban feltöltött dokumentumokat.
              A törlés eltávolítja a fájlból származó összes számla adatot is.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">

          {/* Filters + Batch delete button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder="Keresés fájlnév vagy bizonylatszám alapján..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
              />
            </div>
            <Select value={uploaderFilter} onValueChange={handleUploaderChange}>
              <SelectTrigger className="h-9 w-[200px] bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
                <User className="h-3.5 w-3.5 mr-1.5 text-slate-500 dark:text-muted-foreground" />
                <SelectValue placeholder="Feltöltő" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes feltöltő</SelectItem>
                {companyMembers.map(member => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || 'Névtelen felhasználó'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Batch delete trigger — visible only when items are selected */}
            {selectedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="h-9 gap-1.5 shrink-0"
                onClick={() => setBatchDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selectedCount} törlése
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {uploads.length === 0 ? 'Nincs feltöltött dokumentum.' : 'Nincs találat a megadott szűrőkkel.'}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/50 overflow-x-auto">
                <Table className="compact-table table-fixed min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      {/* Select-all checkbox */}
                      <TableHead className="w-[40px] pr-0">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Összes kijelölése az oldalon"
                          className="data-[state=indeterminate]:opacity-70"
                          {...(someVisibleSelected && !allVisibleSelected ? { 'data-state': 'indeterminate' } : {})}
                        />
                      </TableHead>
                      <TableHead className="w-[28%]">Fájl neve</TableHead>
                      <TableHead className="w-[22%]">Bizonylatszám</TableHead>
                      <TableHead className="w-[18%] whitespace-nowrap">Feltöltés dátuma</TableHead>
                      <TableHead className="w-[16%]">Feltöltötte</TableHead>
                      <TableHead className="w-[10%] text-right">Művelet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUploads.map((upload) => (
                      <TableRow
                        key={upload.id}
                        data-row-hover
                        className={selectedIds.has(upload.id) ? 'bg-primary/5 dark:bg-primary/10' : ''}
                      >
                        <TableCell className="w-[40px] pr-0">
                          <Checkbox
                            checked={selectedIds.has(upload.id)}
                            onCheckedChange={() => toggleSelect(upload.id)}
                            aria-label={`Kijelölés: ${upload.file_name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm truncate max-w-[220px]">
                          {upload.file_url ? (
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => upload.file_url && openPreview({ url: upload.file_url, name: upload.file_name })}
                              className="text-left truncate max-w-full text-primary hover:underline underline-offset-2 focus:outline-none cursor-pointer"
                              title={upload.file_name}
                            >
                              {upload.file_name}
                            </button>
                          ) : (
                            <span className="truncate" title={upload.file_name}>{upload.file_name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-0">
                          {(() => {
                            const text = upload.invoiceNumbers.length > 0
                              ? upload.invoiceNumbers.length <= 2
                                ? upload.invoiceNumbers.join(', ')
                                : `${upload.invoiceNumbers.slice(0, 2).join(', ')} +${upload.invoiceNumbers.length - 2}`
                              : '—';
                            return (
                              <span className="block truncate" title={text}>
                                {text}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {format(new Date(upload.created_at), 'yyyy. MMM dd. HH:mm', { locale: hu })}
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
                    {/* Placeholder rows — prevent pagination jump on last page (spec: 11-data-display-tables.md) */}
                    {Array.from({ length: Math.max(0, pageSize - paginatedUploads.length) }).map((_, i) => (
                      <TableRow key={`placeholder-${i}`} className="border-b border-transparent pointer-events-none select-none">
                        <TableCell colSpan={6} className="py-1.5">&nbsp;</TableCell>
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
                disableScrollToTop
              />
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Single delete dialog — only mount while dialog is open to avoid portal flash ── */}
      <AlertDialog open={isOpen && !!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>Dokumentum törlése</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 w-full min-w-0">
                <p>Válaszd ki a törlés módját:</p>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
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
                  <p className="text-sm font-medium text-foreground">Csak a fájl törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground break-all">{deleteTarget?.file_name}</span> fájl törlődik, de a feldolgozott számla adatok megmaradnak.
                  </p>
                </div>
              </div>
            </button>

            <button
              disabled={deleting}
              onClick={() => { if (deleteTarget) handleDeleteFileAndInvoice(deleteTarget); }}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-destructive">Fájl és számla adatok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground break-all">{deleteTarget?.file_name}</span> fájl és a hozzátartozó{' '}
                    <span className="font-medium text-foreground">
                      {deleteTarget?.invoiceNumbers.join(', ')}
                    </span>{' '}
                    számla(ák) is véglegesen törlődnek.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {deleting && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Törlés folyamatban...</span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={deleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Batch delete dialog — only mount while dialog is open to avoid portal flash ── */}
      <AlertDialog open={isOpen && batchDeleteOpen} onOpenChange={(open) => { if (!open && !batchDeleting) setBatchDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>
              {selectedCount} dokumentum törlése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 w-full min-w-0">
                <p>Válaszd ki a törlés módját az összes kijelölt elemre:</p>
                {/* Selected files preview */}
                <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-1 w-full min-w-0 overflow-x-hidden">
                  {selectedUploads.map(u => (
                    <div key={u.id} className="text-xs text-muted-foreground truncate w-full min-w-0" title={u.file_name}>
                      • {u.file_name}
                      {u.invoiceNumbers.length > 0 && (
                        <span className="text-foreground/60 ml-1">
                          ({u.invoiceNumbers.length} számla)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1 w-full min-w-0">
            {/* Option A: files only */}
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
                  <p className="text-sm font-medium text-foreground">Csak a fájlok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCount} fájl törlődik, a feldolgozott számla adatok megmaradnak.
                  </p>
                </div>
              </div>
            </button>

            {/* Option B: files + invoice data */}
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
                  <p className="text-sm font-medium text-destructive">Fájlok és számla adatok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCount} fájl és az összes hozzájuk tartozó számla véglegesen törlődik.
                  </p>
                </div>
              </div>
            </button>
          </div>

          {batchDeleting && (
            <div className="flex items-center justify-center py-2 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Törlés folyamatban... ({selectedCount} elem)</span>
            </div>
          )}

          <AlertDialogFooter className="w-full min-w-0">
            <AlertDialogCancel disabled={batchDeleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </>
  );
}
