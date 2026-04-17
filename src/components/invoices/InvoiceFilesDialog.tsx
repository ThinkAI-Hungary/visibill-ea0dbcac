import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
  created_at: string;
  user_id: string | null;
  invoiceNumbers: string[];
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

export function InvoiceFilesDialog() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UploadWithInvoices | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');

  const companyId = selectedCompany?.id;

  // Fetch invoice_uploads with related invoice bizonylatsorszam
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['invoice_uploads_with_invoices', companyId],
    queryFn: async () => {
      // Get uploads
      const { data: uploadData, error: uploadError } = await supabase
        .from('invoice_uploads')
        .select('id, file_name, created_at, user_id')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (uploadError) throw uploadError;
      if (!uploadData || uploadData.length === 0) return [];

      // Get invoices linked to these uploads
      const uploadIds = uploadData.map(u => u.id);
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('invoice_uploads_id, bizonylatsorszam')
        .in('invoice_uploads_id', uploadIds);
      if (invoiceError) throw invoiceError;

      // Group invoice numbers by upload id
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

  // Option A: Delete ONLY the uploaded file (keep invoice data)
  const handleDeleteFileOnly = async (upload: UploadWithInvoices) => {
    setDeleting(true);
    try {
      // Fetch file URL for storage cleanup
      const { data: uploadData } = await supabase
        .from('invoice_uploads')
        .select('file_url')
        .eq('id', upload.id)
        .single();

      // Unlink invoices from this upload (set invoice_uploads_id to null)
      await supabase
        .from('invoices')
        .update({ invoice_uploads_id: null })
        .eq('invoice_uploads_id', upload.id);

      // Delete the upload record
      const { error } = await supabase
        .from('invoice_uploads')
        .delete()
        .eq('id', upload.id);
      if (error) throw error;

      // Remove file from Storage
      if (uploadData?.file_url) {
        const storagePath = extractStoragePath(uploadData.file_url, 'invoice-uploads');
        if (storagePath) {
          await supabase.storage.from('invoice-uploads').remove([storagePath]);
        }
      }

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

  // Option B: Delete file AND associated invoice data
  const handleDeleteFileAndInvoice = async (upload: UploadWithInvoices) => {
    setDeleting(true);
    try {
      // Fetch file URL for storage cleanup
      const { data: uploadData } = await supabase
        .from('invoice_uploads')
        .select('file_url')
        .eq('id', upload.id)
        .single();

      // Delete the upload record (CASCADE will delete linked invoices + invoice_items)
      const { error } = await supabase
        .from('invoice_uploads')
        .delete()
        .eq('id', upload.id);
      if (error) throw error;

      // Remove file from Storage
      if (uploadData?.file_url) {
        const storagePath = extractStoragePath(uploadData.file_url, 'invoice-uploads');
        if (storagePath) {
          await supabase.storage.from('invoice-uploads').remove([storagePath]);
        }
      }

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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Feltöltött fájlok
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feltöltött számla dokumentumok</DialogTitle>
            <DialogDescription>
              Itt tekintheti meg és törölheti a korábban feltöltött dokumentumokat.
              A törlés eltávolítja a fájlból származó összes számla adatot is.
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder="Keresés fájlnév vagy bizonylatszám alapján..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
              />
            </div>
            <Select value={uploaderFilter} onValueChange={setUploaderFilter}>
              <SelectTrigger className="h-9 w-[220px] bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10">
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
            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <Table className="compact-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Fájl neve</TableHead>
                    <TableHead className="w-[25%]">Bizonylatszám</TableHead>
                    <TableHead className="w-[18%]">Feltöltés dátuma</TableHead>
                    <TableHead className="w-[15%]">Feltöltötte</TableHead>
                    <TableHead className="w-[12%] text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell className="font-medium text-sm truncate max-w-[250px]">
                        {upload.file_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {upload.invoiceNumbers.length > 0
                          ? upload.invoiceNumbers.length <= 2
                            ? upload.invoiceNumbers.join(', ')
                            : `${upload.invoiceNumbers.slice(0, 2).join(', ')} +${upload.invoiceNumbers.length - 2}`
                          : '—'}
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
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
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
            {/* Option A: File only */}
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
                  <p className="text-sm font-medium text-foreground">
                    Csak a fájl törlése
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground">{deleteTarget?.file_name}</span> fájl törlődik, de a feldolgozott számla adatok megmaradnak.
                  </p>
                </div>
              </div>
            </button>

            {/* Option B: File + Invoice data */}
            <button
              disabled={deleting}
              onClick={() => { if (deleteTarget) handleDeleteFileAndInvoice(deleteTarget); }}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    Fájl és számla adatok törlése
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A <span className="font-medium text-foreground">{deleteTarget?.file_name}</span> fájl és a hozzátartozó{' '}
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

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégsem</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
