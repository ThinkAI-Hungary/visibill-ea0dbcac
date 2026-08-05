import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePath } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, FileText, Loader2, Search, User } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ReportUploadWithRows {
  id: string;
  file_name: string;
  created_at: string;
  user_id: string | null;
  report_type: string;
  upload_status: string;
  processing_status: string;
  metadata: any;
  rowCount: number;
  matchedCount: number;
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

interface ReportFilesDialogProps {
  reportType?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ReportFilesDialog({ reportType, open: externalOpen, onOpenChange: externalOnOpenChange }: ReportFilesDialogProps) {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = externalOnOpenChange || setInternalOpen;
  const [deleteTarget, setDeleteTarget] = useState<ReportUploadWithRows | null>(null);
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<ReportUploadWithRows[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');

  const companyId = selectedCompany?.id;

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedIds(new Set());
  };

  const handleUploaderFilterChange = (val: string) => {
    setUploaderFilter(val);
    setSelectedIds(new Set());
  };

  // Fetch report_uploads with courier_reports counts
  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ['report_uploads_with_rows', companyId, reportType],
    queryFn: async () => {
      let query = supabase
        .from('report_uploads')
        .select('id, file_name, created_at, user_id, report_type, upload_status, processing_status, metadata')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      if (reportType) {
        query = query.eq('report_type', reportType);
      }

      const { data: uploadData, error: uploadError } = await query;
      if (uploadError) throw uploadError;
      if (!uploadData || uploadData.length === 0) return [];

      // Get courier_reports counts per upload
      const uploadIds = uploadData.map(u => u.id);
      const { data: reportData, error: reportError } = await supabase
        .from('courier_reports')
        .select('upload_id, match_status')
        .in('upload_id', uploadIds);
      if (reportError) throw reportError;

      // Group counts by upload_id
      const countsByUpload = new Map<string, { total: number; matched: number }>();
      (reportData || []).forEach((r: any) => {
        if (!r.upload_id) return;
        if (!countsByUpload.has(r.upload_id)) {
          countsByUpload.set(r.upload_id, { total: 0, matched: 0 });
        }
        const entry = countsByUpload.get(r.upload_id)!;
        entry.total++;
        if (r.match_status === 'full' || r.match_status === 'partial_nav' || r.match_status === 'partial_trx') {
          entry.matched++;
        }
      });

      return uploadData.map(u => ({
        id: u.id,
        file_name: u.file_name,
        created_at: u.created_at,
        user_id: u.user_id,
        report_type: u.report_type,
        upload_status: u.upload_status,
        processing_status: u.processing_status,
        metadata: typeof u.metadata === 'string' ? JSON.parse(u.metadata) : u.metadata,
        rowCount: countsByUpload.get(u.id)?.total || 0,
        matchedCount: countsByUpload.get(u.id)?.matched || 0,
      })) as ReportUploadWithRows[];
    },
    enabled: !!companyId && isOpen,
    staleTime: 0,
  });

  // Fetch company members
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

  const filteredUploads = useMemo(() => {
    return uploads.filter(upload => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery
        || upload.file_name.toLowerCase().includes(searchLower);
      const matchesUploader = uploaderFilter === 'all' || upload.user_id === uploaderFilter;
      return matchesSearch && matchesUploader;
    });
  }, [uploads, searchQuery, uploaderFilter]);

  // Delete file only (keep report data)
  const handleDeleteFileOnly = async (upload: ReportUploadWithRows) => {
    setDeleting(true);
    try {
      const { data: uploadData } = await supabase
        .from('report_uploads')
        .select('file_url')
        .eq('id', upload.id)
        .single();

      // Unlink courier_reports from this upload
      await supabase
        .from('courier_reports')
        .update({ upload_id: null })
        .eq('upload_id', upload.id);

      // Delete upload record
      const { error } = await supabase
        .from('report_uploads')
        .delete()
        .eq('id', upload.id);
      if (error) throw error;

      // Remove from storage
      if (uploadData?.file_url) {
        const storagePath = extractStoragePath(uploadData.file_url, 'report-uploads');
        if (storagePath) {
          await supabase.storage.from('report-uploads').remove([storagePath]);
        }
      }

      toast({ title: 'Sikeres törlés', description: 'A fájl törölve lett. A riport adatok megmaradtak.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['report_uploads_with_rows', companyId] });
      queryClient.invalidateQueries({ queryKey: ['courier-reports'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Delete file AND all associated report data
  const handleDeleteFileAndData = async (upload: ReportUploadWithRows) => {
    setDeleting(true);
    try {
      const { data: uploadData } = await supabase
        .from('report_uploads')
        .select('file_url')
        .eq('id', upload.id)
        .single();

      // 1. Delete linked courier_reports
      const { error: reportError } = await supabase
        .from('courier_reports')
        .delete()
        .eq('upload_id', upload.id);
      if (reportError) throw reportError;

      // 2. Delete upload record
      const { error } = await supabase
        .from('report_uploads')
        .delete()
        .eq('id', upload.id);
      if (error) throw error;

      // 3. Remove from storage
      if (uploadData?.file_url) {
        const storagePath = extractStoragePath(uploadData.file_url, 'report-uploads');
        if (storagePath) {
          await supabase.storage.from('report-uploads').remove([storagePath]);
        }
      }

      toast({ title: 'Sikeres törlés', description: 'A dokumentum és a hozzá tartozó riport sorok törölve lettek.', duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ['report_uploads_with_rows', companyId] });
      queryClient.invalidateQueries({ queryKey: ['courier-reports'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Bulk Delete file only (keep report data)
  const handleBulkDeleteFileOnly = async (uploadsToDelete: ReportUploadWithRows[]) => {
    setDeleting(true);
    try {
      const ids = uploadsToDelete.map(u => u.id);
      const { data: uploadRows } = await supabase
        .from('report_uploads')
        .select('file_url')
        .in('id', ids);

      // Unlink courier_reports from these uploads
      await supabase
        .from('courier_reports')
        .update({ upload_id: null })
        .in('upload_id', ids);

      // Delete upload records
      const { error } = await supabase
        .from('report_uploads')
        .delete()
        .in('id', ids);
      if (error) throw error;

      // Remove from storage
      const storagePaths: string[] = [];
      (uploadRows || []).forEach(row => {
        if (row.file_url) {
          const storagePath = extractStoragePath(row.file_url, 'report-uploads');
          if (storagePath) storagePaths.push(storagePath);
        }
      });
      if (storagePaths.length > 0) {
        await supabase.storage.from('report-uploads').remove(storagePaths);
      }

      toast({ title: 'Sikeres törlés', description: `${uploadsToDelete.length} fájl törölve lett. A riport adatok megmaradtak.`, duration: 3000 });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['report_uploads_with_rows', companyId] });
      queryClient.invalidateQueries({ queryKey: ['courier-reports'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setBulkDeleteTarget(null);
    }
  };

  // Bulk Delete file AND all associated report data
  const handleBulkDeleteFileAndData = async (uploadsToDelete: ReportUploadWithRows[]) => {
    setDeleting(true);
    try {
      const ids = uploadsToDelete.map(u => u.id);
      const { data: uploadRows } = await supabase
        .from('report_uploads')
        .select('file_url')
        .in('id', ids);

      // 1. Delete linked courier_reports
      const { error: reportError } = await supabase
        .from('courier_reports')
        .delete()
        .in('upload_id', ids);
      if (reportError) throw reportError;

      // 2. Delete upload records
      const { error } = await supabase
        .from('report_uploads')
        .delete()
        .in('id', ids);
      if (error) throw error;

      // 3. Remove from storage
      const storagePaths: string[] = [];
      (uploadRows || []).forEach(row => {
        if (row.file_url) {
          const storagePath = extractStoragePath(row.file_url, 'report-uploads');
          if (storagePath) storagePaths.push(storagePath);
        }
      });
      if (storagePaths.length > 0) {
        await supabase.storage.from('report-uploads').remove(storagePaths);
      }

      toast({ title: 'Sikeres törlés', description: `A kijelölt dokumentumok és a hozzájuk tartozó riport sorok törölve lettek.`, duration: 3000 });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['report_uploads_with_rows', companyId] });
      queryClient.invalidateQueries({ queryKey: ['courier-reports'] });
      queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setBulkDeleteTarget(null);
    }
  };

  const REPORT_TYPE_LABELS: Record<string, string> = {
    gls: 'GLS',
    dpd: 'DPD',
    mpl: 'MPL',
    foxpost: 'Foxpost',
    sprinter: 'Sprinter',
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSelectedIds(new Set());
      }}>
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
            <DialogTitle>Feltöltött riport dokumentumok</DialogTitle>
            <DialogDescription>
              Itt tekintheti meg és törölheti a korábban feltöltött futárszolgálat riportokat.
              A törlés eltávolítja a fájlból származó összes riport adatot is.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder="Keresés fájlnév alapján..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-secondary/50 border border-slate-200 dark:border-white/10 focus:border-primary"
              />
            </div>
            <Select value={uploaderFilter} onValueChange={handleUploaderFilterChange}>
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

          {/* Bulk Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-950 dark:text-red-400 animate-in fade-in duration-200">
              <span className="text-sm font-semibold">{selectedIds.size} kijelölt elem</span>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5 font-semibold"
                onClick={() => {
                  const targets = uploads.filter(u => selectedIds.has(u.id));
                  setBulkDeleteTarget(targets);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Kijelöltek törlése
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {uploads.length === 0 ? 'Nincs feltöltött riport dokumentum.' : 'Nincs találat a megadott szűrőkkel.'}
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <Table className="compact-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[5%]">
                      <input
                        type="checkbox"
                        checked={filteredUploads.length > 0 && selectedIds.size === filteredUploads.length}
                        ref={input => {
                          if (input) {
                            input.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredUploads.length;
                          }
                        }}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(filteredUploads.map(u => u.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        className="rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary h-4 w-4 accent-primary cursor-pointer mt-1"
                      />
                    </TableHead>
                    <TableHead className="w-[30%]">Fájl neve</TableHead>
                    <TableHead className="w-[10%]">Típus</TableHead>
                    <TableHead className="w-[15%]">Sorok</TableHead>
                    <TableHead className="w-[18%]">Feltöltés dátuma</TableHead>
                    <TableHead className="w-[15%]">Feltöltötte</TableHead>
                    <TableHead className="w-[7%] text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUploads.map((upload) => (
                    <TableRow key={upload.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(upload.id)}
                          onChange={() => {
                            const next = new Set(selectedIds);
                            if (next.has(upload.id)) {
                              next.delete(upload.id);
                            } else {
                              next.add(upload.id);
                            }
                            setSelectedIds(next);
                          }}
                          className="rounded border-slate-300 dark:border-white/10 text-primary focus:ring-primary h-4 w-4 accent-primary cursor-pointer mt-1"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm truncate max-w-[250px]">
                        {upload.file_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {REPORT_TYPE_LABELS[upload.report_type] || upload.report_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {upload.rowCount > 0
                          ? `${upload.matchedCount}/${upload.rowCount} párosítva`
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
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget || !!bulkDeleteTarget} onOpenChange={(open) => {
        if (!open) {
          setDeleteTarget(null);
          setBulkDeleteTarget(null);
        }
      }}>
        <AlertDialogContent className="max-w-md border-border bg-card">
          <AlertDialogHeader className="w-full min-w-0">
            <AlertDialogTitle>
              {deleteTarget ? 'Riport dokumentum törlése' : 'Kijelölt riport dokumentumok törlése'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 w-full min-w-0">
                <p>Válaszd ki a törlés módját:</p>
                <p className="text-xs text-muted-foreground">Ez a művelet nem vonható vissza.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-1 w-full min-w-0">
            {/* Option A: File only */}
            <button
              disabled={deleting}
              onClick={() => {
                if (deleteTarget) handleDeleteFileOnly(deleteTarget);
                else if (bulkDeleteTarget) handleBulkDeleteFileOnly(bulkDeleteTarget);
              }}
              className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-primary/50 hover:bg-primary/5 dark:hover:bg-primary/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400">A</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Csak a fájl törlése
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {deleteTarget ? (
                      <>
                        A <span className="font-medium text-foreground break-all">{deleteTarget.file_name}</span> fájl törlődik, de a feldolgozott riport adatok megmaradnak.
                      </>
                    ) : (
                      <>
                        A kijelölt <span className="font-medium text-foreground">{bulkDeleteTarget?.length} fájl</span> törlődik, de a feldolgozott riport adatok megmaradnak.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </button>

            {/* Option B: File + Report data */}
            <button
              disabled={deleting}
              onClick={() => {
                if (deleteTarget) handleDeleteFileAndData(deleteTarget);
                else if (bulkDeleteTarget) handleBulkDeleteFileAndData(bulkDeleteTarget);
              }}
              className="w-full text-left p-3 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">
                    Fájl és riport adatok törlése
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {deleteTarget ? (
                      <>
                        A <span className="font-medium text-foreground break-all">{deleteTarget.file_name}</span> fájl és a hozzátartozó{' '}
                        <span className="font-medium text-foreground">
                          {deleteTarget.rowCount} riport sor
                        </span>{' '}
                        is véglegesen törlődik.
                      </>
                    ) : (
                      <>
                        A kijelölt <span className="font-medium text-foreground">{bulkDeleteTarget?.length} fájl</span> és a hozzájuk tartozó összesen{' '}
                        <span className="font-medium text-foreground">
                          {bulkDeleteTarget?.reduce((acc, u) => acc + u.rowCount, 0)} riport sor
                        </span>{' '}
                        is véglegesen törlődik.
                      </>
                    )}
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
    </>
  );
}
