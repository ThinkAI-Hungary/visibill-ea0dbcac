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
import { Trash2, FileText, Loader2, Search, User, Landmark } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface UploadWithTransactions {
  id: string;
  file_name: string;
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
  binx:       { label: 'Binx' },
  mbh:        { label: 'MBH' },
  mkb:        { label: 'MKB' },
};

export function TransactionFilesDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: TransactionFilesDialogProps = {}) {
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

  // Fetch transaction_uploads with related transaction counts
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['transaction_uploads_with_counts', companyId],
    queryFn: async () => {
      const { data: uploadData, error: uploadError } = await supabase
        .from('transaction_uploads')
        .select('id, file_name, created_at, user_id, detected_bank')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
      if (uploadError) throw uploadError;
      if (!uploadData || uploadData.length === 0) return [];

      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('upload_id')
        .eq('company_id', companyId!)
        .not('upload_id', 'is', null);
      if (txError) throw txError;

      const countsByUpload = new Map<string, number>();
      (txData || []).forEach((tx: any) => {
        if (!tx.upload_id) return;
        countsByUpload.set(tx.upload_id, (countsByUpload.get(tx.upload_id) || 0) + 1);
      });

      return uploadData.map(u => ({
        id: u.id,
        file_name: u.file_name,
        created_at: u.created_at,
        user_id: u.user_id,
        detected_bank: u.detected_bank,
        transactionCount: countsByUpload.get(u.id) || 0,
      })) as UploadWithTransactions[];
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

  // Selection helpers
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
      toast({ title: 'Sikeres törlés', description: 'A fájl törölve lett. A tranzakciók megmaradtak.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['bank-uploads-unified', companyId] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteFileAndTransactions = async (upload: UploadWithTransactions) => {
    setDeleting(true);
    try {
      await deleteUploadWithTransactions(upload);
      toast({ title: 'Sikeres törlés', description: 'A dokumentum és a hozzá tartozó tranzakciók törölve lettek.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
      queryClient.invalidateQueries({ queryKey: ['bank-uploads-unified', companyId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['tx-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
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
        title: `${succeeded} dokumentum törölve`,
        description: withTransactions ? 'A fájlok és a kapcsolódó tranzakciók törölve lettek.' : 'A fájlok törölve, a tranzakciók megmaradtak.',
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
    queryClient.invalidateQueries({ queryKey: ['transaction_uploads_with_counts', companyId] });
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
              Feltöltött fájlok
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feltöltött tranzakció dokumentumok</DialogTitle>
            <DialogDescription>
              Itt tekintheti meg és törölheti a korábban feltöltött bankkivonatokat.
              A törlés eltávolítja a fájlból származó összes tranzakciós adatot is.
            </DialogDescription>
          </DialogHeader>

          {/* Filters + Batch delete button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder="Keresés fájlnév vagy bank alapján..."
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
                <Table className="compact-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px] pr-0">
                        <Checkbox
                          checked={allVisibleSelected}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Összes kijelölése az oldalon"
                          className="data-[state=indeterminate]:opacity-70"
                          {...(someVisibleSelected && !allVisibleSelected ? { 'data-state': 'indeterminate' } : {})}
                        />
                      </TableHead>
                      <TableHead className="w-[35%]">Fájl neve</TableHead>
                      <TableHead className="w-[20%]">Bank / Tranzakciók</TableHead>
                      <TableHead className="w-[18%]">Feltöltés dátuma</TableHead>
                      <TableHead className="w-[17%]">Feltöltötte</TableHead>
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
                        <TableCell className="pr-0">
                          <Checkbox
                            checked={selectedIds.has(upload.id)}
                            onCheckedChange={() => toggleSelect(upload.id)}
                            aria-label={`Kijelölés: ${upload.file_name}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-sm truncate max-w-[280px]">
                          {upload.file_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-primary">{getBankLabel(upload.detected_bank)}</span>
                            <span className="text-xs text-muted-foreground">({upload.transactionCount} db)</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
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
        </DialogContent>
      </Dialog>

      {/* Single delete AlertDialog */}
      <AlertDialog open={isOpen && !!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Dokumentum törlése</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Válaszd ki a törlés módját:</p>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1">
            <button
              disabled={deleting}
              onClick={() => { if (deleteTarget) handleDeleteFileOnly(deleteTarget); }}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Csak a fájl törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground">{deleteTarget?.file_name}</span> fájl törlődik, de a feldolgozott tranzakció adatok megmaradnak.
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
                <div>
                  <p className="text-sm font-medium text-destructive">Fájl és tranzakció adatok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground">{deleteTarget?.file_name}</span> fájl és a hozzá tartozó{' '}
                    <span className="font-medium text-foreground">
                      {deleteTarget?.transactionCount} db
                    </span>{' '}
                    tranzakció is véglegesen törlődik.
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

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete AlertDialog */}
      <AlertDialog open={isOpen && batchDeleteOpen} onOpenChange={(open) => { if (!open && !batchDeleting) setBatchDeleteOpen(false); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedCount} dokumentum törlése
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Válaszd ki a törlés módját az összes kijelölt elemre:</p>
                <div className="max-h-28 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-2 space-y-1">
                  {selectedUploads.map(u => (
                    <div key={u.id} className="text-xs text-muted-foreground truncate">
                      • {u.file_name} ({u.transactionCount} db tranzakció)
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1">
            <button
              disabled={batchDeleting}
              onClick={() => handleBatchDelete(false)}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Csak a fájlok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCount} fájl törlődik, a tranzakció adatok megmaradnak.
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
                <div>
                  <p className="text-sm font-medium text-destructive">Fájlok és tranzakció adatok törlése</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedCount} fájl és az összes hozzájuk tartozó tranzakció véglegesen törlődik.
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

          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
