import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Search, User, Bot, AlertCircle } from 'lucide-react';

interface UserActivityDialogProps {
  userId: string | null;
  userName: string;
  isSystem: boolean;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserActivityDialog({ userId, userName, isSystem, companyId, open, onOpenChange }: UserActivityDialogProps) {
  const [search, setSearch] = useState('');

  const { data: logs = [], isLoading, isError } = useQuery({
    queryKey: ['user_audit_logs_dialog', companyId, userId, isSystem],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (isSystem || userId === null) {
        query = query.is('user_id', null);
      } else {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const filteredLogs = logs.filter((log: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (log.entity_name && log.entity_name.toLowerCase().includes(q)) ||
      (log.action && log.action.toLowerCase().includes(q)) ||
      (log.entity && log.entity.toLowerCase().includes(q))
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 flex flex-row items-center gap-4 mb-2">
          <div className={`p-3 rounded-full flex items-center justify-center shrink-0 ${isSystem ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
            {isSystem ? <Bot className="h-6 w-6" /> : <User className="h-6 w-6" />}
          </div>
          <div className="flex flex-col gap-1 items-start">
            <DialogTitle className="text-xl">
              {userName}
            </DialogTitle>
            <DialogDescription>
              {isSystem ? 'A rendszer által automatikusan végrehajtott műveletek.' : 'A felhasználó összes naplózott tevékenysége.'}
              {' '}(Utolsó {logs.length} esemény)
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Keresés eseményekben..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md mt-4 relative bg-background">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm border-b">
              <TableRow>
                <TableHead className="w-[160px]">Dátum</TableHead>
                <TableHead>Művelet</TableHead>
                <TableHead>Típus</TableHead>
                <TableHead>Célpont</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Betöltés...
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-destructive">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="h-6 w-6" />
                      Hiba történt az adatok lekérdezése közben.
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">
                    Nincs találat.
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {format(new Date(log.created_at), 'yyyy. MM. dd. HH:mm', { locale: hu })}
                    </TableCell>
                    <TableCell className="capitalize font-medium">{log.action || '-'}</TableCell>
                    <TableCell className="capitalize">{log.entity || '-'}</TableCell>
                    <TableCell className="font-medium text-foreground">{log.entity_name || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
