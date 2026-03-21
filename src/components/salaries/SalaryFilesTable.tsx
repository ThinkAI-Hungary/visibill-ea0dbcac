import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
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

interface SalaryFileRow {
  id: string;
  file_name: string | null;
  created_at: string;
  user_id: string;
}

interface CompanyMember {
  user_id: string;
  name: string | null;
}

export function SalaryFilesDialog() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploaderFilter, setUploaderFilter] = useState('all');

  const companyId = selectedCompany?.id;

  // Fetch salary files
  const { data: salaryFiles = [], isLoading } = useQuery({
    queryKey: ['salary_files', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_files')
        .select('id, file_name, created_at, user_id')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SalaryFileRow[];
    },
    enabled: !!companyId,
  });

  // Fetch company members with their profile names
  const { data: companyMembers = [] } = useQuery({
    queryKey: ['company_members_profiles', companyId],
    queryFn: async () => {
      // Get company member user_ids
      const { data: members, error: membersError } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId!);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      const memberUserIds = members.map(m => m.user_id);

      // Get profiles for those users
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
    enabled: !!companyId,
  });

  // Build profileMap from company members
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    companyMembers.forEach(m => {
      if (m.name) map.set(m.user_id, m.name);
    });
    return map;
  }, [companyMembers]);

  const getUserName = (userId: string): string => {
    return profileMap.get(userId) || 'Ismeretlen felhasználó';
  };

  // Group by file_name
  const allUploads = useMemo(() => {
    const grouped = salaryFiles.reduce<Map<string, { fileName: string; createdAt: string; userId: string; ids: string[] }>>((acc, file) => {
      const key = file.file_name || file.id;
      if (!acc.has(key)) {
        acc.set(key, { fileName: file.file_name || 'Ismeretlen fájl', createdAt: file.created_at, userId: file.user_id, ids: [] });
      }
      acc.get(key)!.ids.push(file.id);
      return acc;
    }, new Map());
    return Array.from(grouped.values());
  }, [salaryFiles]);

  // Client-side filtering
  const filteredUploads = useMemo(() => {
    return allUploads.filter(upload => {
      const matchesSearch = !searchQuery || upload.fileName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUploader = uploaderFilter === 'all' || upload.userId === uploaderFilter;
      return matchesSearch && matchesUploader;
    });
  }, [allUploads, searchQuery, uploaderFilter]);

  const handleDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('salary_files')
        .delete()
        .in('id', ids);
      if (error) throw error;

      toast({ title: 'Sikeres törlés', description: 'A dokumentum és a hozzá tartozó adatok törölve lettek.' });
      queryClient.invalidateQueries({ queryKey: ['salary_files', companyId] });
      queryClient.invalidateQueries({ queryKey: ['salaries', companyId] });
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message || 'A törlés sikertelen.', variant: 'destructive' });
    } finally {
      setDeleting(false);
      setDeleteIds(null);
    }
  };

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Feltöltött fájlok
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Feltöltött bérjegyzékek és összesítők</DialogTitle>
            <DialogDescription>
              Itt tekintheti meg és törölheti a korábban feltöltött dokumentumokat.
              A törlés eltávolítja a fájlból származó összes béradatot is.
            </DialogDescription>
          </DialogHeader>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-muted-foreground" />
              <Input
                placeholder="Keresés fájlnév alapján..."
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
              {allUploads.length === 0 ? 'Nincs feltöltött dokumentum.' : 'Nincs találat a megadott szűrőkkel.'}
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-x-auto">
              <Table className="compact-table">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Fájlnév</TableHead>
                    <TableHead className="w-[25%]">Feltöltés dátuma</TableHead>
                    <TableHead className="w-[20%]">Feltöltötte</TableHead>
                    <TableHead className="w-[15%] text-right">Művelet</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUploads.map((upload) => (
                    <TableRow key={upload.ids[0]}>
                      <TableCell className="font-medium text-sm truncate max-w-[300px]">
                        {upload.fileName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(upload.createdAt), 'yyyy. MMM dd. HH:mm', { locale: hu })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {getUserName(upload.userId)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => setDeleteIds(upload.ids)}
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

      <AlertDialog open={!!deleteIds} onOpenChange={(open) => { if (!open) setDeleteIds(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dokumentum törlése</AlertDialogTitle>
            <AlertDialogDescription>
              Biztosan törlöd ezt a dokumentumot? Minden belőle kinyert bér és járulék adat is törlődni fog.
              Ez a művelet nem vonható vissza.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleting}
              onClick={() => { if (deleteIds) handleDelete(deleteIds); }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
