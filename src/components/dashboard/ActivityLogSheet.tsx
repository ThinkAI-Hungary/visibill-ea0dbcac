import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { History, Plus, Pencil, Trash2, Upload, Link2, FileText, Banknote, ArrowLeftRight, Tag, ClipboardList } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { hu } from 'date-fns/locale';

interface AuditLogRow {
  id: string;
  company_id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_name: string | null;
  details: any;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Plus; color: string; label: string }> = {
  'létrehozás': { icon: Plus, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30', label: 'létrehozott' },
  'módosítás': { icon: Pencil, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/30', label: 'módosított' },
  'törlés': { icon: Trash2, color: 'text-red-500 bg-red-50 dark:bg-red-950/30', label: 'törölt' },
  'feltöltés': { icon: Upload, color: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/30', label: 'feltöltött' },
  'párosítás': { icon: Link2, color: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30', label: 'párosított' },
};

const ENTITY_CONFIG: Record<string, { icon: typeof FileText; label: string }> = {
  'számla': { icon: FileText, label: 'számlát' },
  'bérjegyzék': { icon: Banknote, label: 'bérjegyzéket' },
  'tranzakció': { icon: ArrowLeftRight, label: 'tranzakciót' },
  'kategória': { icon: Tag, label: 'kategóriát' },
  'dokumentum': { icon: ClipboardList, label: 'dokumentumot' },
};

export function ActivityLogSheet() {
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit_logs', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as AuditLogRow[];
    },
    enabled: !!companyId,
    staleTime: 0,
  });

  // Get unique user_ids and fetch profiles
  const userIds = useMemo(() => [...new Set(logs.map(l => l.user_id).filter(Boolean) as string[])], [logs]);
  const { data: profiles = [] } = useQuery({
    queryKey: ['audit_log_profiles', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, avatar_url')
        .in('user_id', userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; avatar: string | null }>();
    profiles.forEach((p: any) => map.set(p.user_id, { name: p.name || 'Felhasználó', avatar: p.avatar_url }));
    return map;
  }, [profiles]);

  const getUser = (userId: string | null) => {
    if (!userId) return { name: 'Rendszer', avatar: null };
    return profileMap.get(userId) || { name: 'Felhasználó', avatar: null };
  };

  return (
    <Sheet onOpenChange={(open) => { if (open) refetch(); }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <History className="mr-2 h-4 w-4" />
          Műveleti napló
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Műveleti napló</SheetTitle>
          <SheetDescription>Az aktuális cég eseményeinek idővonala.</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Betöltés...
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <History className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Még nincsenek rögzített műveletek.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-1">
                {logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || ACTION_CONFIG['módosítás'];
                  const entityCfg = ENTITY_CONFIG[log.entity] || { label: log.entity, icon: FileText };
                  const user = getUser(log.user_id);
                  const ActionIcon = actionCfg.icon;

                  return (
                    <div key={log.id} className="relative flex gap-3 py-2.5 pl-0">
                      {/* Icon dot */}
                      <div className={`relative z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border border-border/50 ${actionCfg.color}`}>
                        <ActionIcon className="h-4 w-4" />
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-sm leading-snug">
                          <span className="font-semibold">{user.name}</span>
                          {' '}
                          <span className="text-muted-foreground">{actionCfg.label} egy {entityCfg.label}</span>
                          {log.entity_name && (
                            <>
                              {': '}
                              <span className="font-medium text-foreground">{log.entity_name}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: hu })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
