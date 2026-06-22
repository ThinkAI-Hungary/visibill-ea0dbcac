import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize, extractStoragePath } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
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
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface UploadedFilesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which tab is active — determines which table to query */
  activeTab: 'invoices' | 'transactions' | 'salaries' | 'reports';
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
    label: 'Számlák',
    icon: FileText,
    filter: (q: any) => q.or('document_category.is.null,document_category.neq.payroll'),
  },
  transactions: {
    table: 'transaction_uploads',
    bucket: 'transactions',
    uploadType: 'transaction',
    label: 'Tranzakciók',
    icon: Landmark,
    filter: null,
  },
  salaries: {
    table: 'invoice_uploads',
    bucket: 'invoice-uploads',
    uploadType: 'invoice',
    label: 'Bérek/Járulékok',
    icon: Wallet,
    filter: (q: any) => q.eq('document_category', 'payroll'),
  },
  reports: {
    table: 'report_uploads',
    bucket: 'report-uploads',
    uploadType: 'report',
    label: 'Riportok',
    icon: Package,
    filter: null,
  },
} as const;

const PAGE_SIZE = 15;

export default function UploadedFilesModal({ open, onOpenChange, activeTab }: UploadedFilesModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<UploadRecord | null>(null);

  const config = TAB_CONFIG[activeTab];
  const companyId = selectedCompany?.id;

  // ── Fetch uploads ──
  const { data: uploads = [], isLoading } = useQuery<UploadRecord[]>({
    queryKey: ['uploaded-files', activeTab, companyId],
    queryFn: async () => {
      if (!companyId) return [];

      let query = supabase
        .from(config.table as any)
        .select('id, file_name, file_size, file_url, processing_status, created_at, document_category')
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

  // Reset page on search change
  useMemo(() => { setCurrentPage(1); }, [searchQuery]);

  // ── Delete mutation ──
  const deleteMutation = useMutation({
    mutationFn: async (record: UploadRecord) => {
      // Step 1: Call RPC to delete DB rows (cascade)
      const { data, error } = await supabase.rpc('delete_upload_with_data', {
        p_upload_id: record.id,
        p_upload_type: config.uploadType,
      });

      if (error) throw error;

      // Step 2: Delete file from storage
      const storagePath = extractStoragePath(record.file_url, config.bucket);
      if (storagePath) {
        await supabase.storage.from(config.bucket).remove([storagePath]);
      }

      return data as any;
    },
    onSuccess: (data, record) => {
      const parts: string[] = [`${record.file_name} törölve.`];
      if (data?.deleted_invoices > 0) parts.push(`${data.deleted_invoices} számla törölve.`);
      if (data?.deleted_transactions > 0) parts.push(`${data.deleted_transactions} tranzakció törölve.`);
      if (data?.deleted_transport_docs > 0) parts.push(`${data.deleted_transport_docs} dokumentum törölve.`);

      toast({ title: 'Törlés sikeres', description: parts.join(' '), duration: 4000 });

      // Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ['uploaded-files'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
      queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDeleteTarget(null);
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Törlés sikertelen',
        description: error instanceof Error ? error.message : 'Ismeretlen hiba történt.',
      });
      setDeleteTarget(null);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20 text-[10px]">Feldolgozva</Badge>;
      case 'processing':
      case 'webhook_sent':
        return <Badge variant="outline" className="text-[10px]">Folyamatban</Badge>;
      case 'error':
      case 'failed':
      case 'webhook_failed':
        return <Badge variant="destructive" className="text-[10px]">Hiba</Badge>;
      case 'ignored':
        return <Badge variant="secondary" className="text-[10px]">Mellőzve</Badge>;
      case 'cmr_attached':
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">Dok. párosítva</Badge>;
      case 'cmr_orphaned':
        return <Badge variant="secondary" className="text-[10px]">Vár a számlára</Badge>;
      case 'cmr_escalated':
        return <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px]">Eszkaláció</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">Függőben</Badge>;
    }
  };

  const Icon = config.icon;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col border-border bg-card">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Icon className="h-5 w-5 text-primary" />
              Feltöltött fájlok — {config.label}
            </DialogTitle>
            <DialogDescription>
              {uploads.length} feltöltött fájl · Válaszd ki a törlendő fájlokat
            </DialogDescription>
          </DialogHeader>

          {/* Search */}
          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés fájlnév alapján..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-border/50"
            />
          </div>

          {/* File List */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            ) : paged.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                {searchQuery ? 'Nincs találat a keresésre.' : 'Nincs feltöltött fájl.'}
              </div>
            ) : (
              paged.map(record => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 border border-border/50 rounded-lg px-4 py-2.5 bg-card hover:border-border transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{record.file_name}</p>
                      {getStatusBadge(record.processing_status)}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatFileSize(record.file_size)} · {format(new Date(record.created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })}
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
                      disabled={deleteMutation.isPending}
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
                {filtered.length} fájlból {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 text-xs font-semibold tabular-nums">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Fájl törlése
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Biztosan törölni akarod a következő fájlt?</p>
              <p className="font-semibold text-foreground">{deleteTarget?.file_name}</p>
              <p className="text-xs text-warning">
                ⚠️ Ez a művelet törli a fájlt és az összes hozzá kapcsolódó adatot (számlák, tranzakciók, dokumentumok). Ez a művelet nem visszavonható!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Mégsem</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Törlés...</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" /> Törlés</>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
