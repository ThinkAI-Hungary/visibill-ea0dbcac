import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CONFIGURABLE_MODULES, getStaticDefaults, type EaisybillModule } from '@/hooks/useEaisybillPermissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Shield, ChevronDown, ChevronUp, Eye, Pencil,
  ToggleLeft, ToggleRight, Loader2, Users, Search,
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MemberInfo {
  id: string;
  userId: string;
  name: string;
  role: string;
}

interface ModulePermRow {
  id: string;
  userId: string;
  moduleName: string;
  canRead: boolean;
  canWrite: boolean;
}

interface EaisybillPermissionPanelProps {
  companyId: string;
  toast: (props: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  member: 'Pénzügyes',
  assistant: 'P. Asszisztens',
  viewer: 'Betekintő',
  employee: 'Munkavállaló',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  member: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  assistant: 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/20',
  viewer: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20',
  employee: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

/**
 * Fetches all module permission overrides for a company.
 */
function useCompanyModulePermissions(companyId: string) {
  return useQuery({
    queryKey: ['eaisybill-company-module-permissions', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eaisybill_module_permissions' as any)
        .select('id, user_id, module_name, can_read, can_write')
        .eq('company_id', companyId);

      if (error) throw error;

      return (data as any[] || []).map((r: any): ModulePermRow => ({
        id: r.id,
        userId: r.user_id,
        moduleName: r.module_name,
        canRead: r.can_read,
        canWrite: r.can_write,
      }));
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

/**
 * Fetches company members for the permission panel.
 */
function useCompanyMembers(companyId: string) {
  return useQuery({
    queryKey: ['eaisybill-permission-panel-members', companyId],
    queryFn: async (): Promise<MemberInfo[]> => {
      const { data } = await supabase
        .from('company_members')
        .select('id, user_id, role')
        .eq('company_id', companyId);

      if (!data || data.length === 0) return [];

      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

      return data.map(m => ({
        id: m.id,
        userId: m.user_id,
        name: profileMap.get(m.user_id)?.name || 'Névtelen felhasználó',
        role: m.role,
      }));
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function EaisybillPermissionPanel({ companyId, toast }: EaisybillPermissionPanelProps) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: allMembers = [], isLoading: membersLoading } = useCompanyMembers(companyId);
  const { data: modulePerms = [], isLoading: permsLoading } = useCompanyModulePermissions(companyId);
  const isLoading = membersLoading || permsLoading;

  // Non-admin/owner members that can have permissions customized
  const configurableMembers = useMemo(() => {
    return allMembers.filter(m => !['admin', 'owner'].includes(m.role));
  }, [allMembers]);

  const filteredMembers = useMemo(() => {
    if (!search.trim()) return configurableMembers;
    const q = search.toLowerCase();
    return configurableMembers.filter(m =>
      m.name.toLowerCase().includes(q) || (ROLE_LABELS[m.role] || m.role).toLowerCase().includes(q)
    );
  }, [configurableMembers, search]);

  // Selected user's role (needed for static defaults)
  const selectedUserRole = useMemo(() => {
    return configurableMembers.find(m => m.userId === selectedUserId)?.role || 'viewer';
  }, [configurableMembers, selectedUserId]);

  // Current user's permissions
  const selectedPerms = useMemo(() => {
    if (!selectedUserId) return new Map<string, ModulePermRow>();
    const map = new Map<string, ModulePermRow>();
    for (const p of modulePerms) {
      if (p.userId === selectedUserId) {
        map.set(p.moduleName, p);
      }
    }
    return map;
  }, [modulePerms, selectedUserId]);

  // Upsert mutation
  const upsertMutation = useMutation({
    mutationFn: async (args: { userId: string; moduleName: string; canRead: boolean; canWrite: boolean }) => {
      const existing = modulePerms.find(p => p.userId === args.userId && p.moduleName === args.moduleName);
      if (existing) {
        const { error } = await supabase
          .from('eaisybill_module_permissions' as any)
          .update({ can_read: args.canRead, can_write: args.canWrite, updated_at: new Date().toISOString() } as any)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('eaisybill_module_permissions' as any)
          .insert({
            company_id: companyId,
            user_id: args.userId,
            module_name: args.moduleName,
            can_read: args.canRead,
            can_write: args.canWrite,
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eaisybill-company-module-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['eaisybill-module-permissions'] });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message || 'Nem sikerült menteni.', variant: 'destructive' });
    },
  });

  // Delete override mutation (reset to default)
  const deleteMutation = useMutation({
    mutationFn: async (permId: string) => {
      const { error } = await supabase
        .from('eaisybill_module_permissions' as any)
        .delete()
        .eq('id', permId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eaisybill-company-module-permissions', companyId] });
      queryClient.invalidateQueries({ queryKey: ['eaisybill-module-permissions'] });
    },
  });

  const togglePermission = useCallback((userId: string, moduleName: string, field: 'canRead' | 'canWrite') => {
    const existing = modulePerms.find(p => p.userId === userId && p.moduleName === moduleName);
    const defaults = getStaticDefaults(selectedUserRole, moduleName as EaisybillModule);
    const currentRead = existing?.canRead ?? defaults.canRead;
    const currentWrite = existing?.canWrite ?? defaults.canWrite;

    if (field === 'canRead') {
      const newRead = !currentRead;
      // If turning off read, also turn off write
      upsertMutation.mutate({ userId, moduleName, canRead: newRead, canWrite: newRead ? currentWrite : false });
    } else {
      const newWrite = !currentWrite;
      // If turning on write, also turn on read
      upsertMutation.mutate({ userId, moduleName, canRead: newWrite ? true : currentRead, canWrite: newWrite });
    }
  }, [modulePerms, upsertMutation, selectedUserRole]);

  const resetToDefault = useCallback((userId: string, moduleName: string) => {
    const existing = modulePerms.find(p => p.userId === userId && p.moduleName === moduleName);
    if (existing) {
      deleteMutation.mutate(existing.id);
    }
  }, [modulePerms, deleteMutation]);

  // Group modules by category
  const groupedModules = useMemo(() => {
    const groups = new Map<string, typeof CONFIGURABLE_MODULES>();
    for (const mod of CONFIGURABLE_MODULES) {
      const existing = groups.get(mod.group) || [];
      existing.push(mod);
      groups.set(mod.group, existing);
    }
    return groups;
  }, []);

  if (configurableMembers.length === 0) return null;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Jogosultságkezelő
            </CardTitle>
            <CardDescription>
              Modulonkénti hozzáférés testreszabása felhasználónként
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* User selector */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Felhasználó kiválasztása</label>
                {configurableMembers.length > 5 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Keresés..."
                      className="pl-9 h-9"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                  {filteredMembers.map(m => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => setSelectedUserId(m.userId === selectedUserId ? null : m.userId)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-left text-sm transition-all',
                        m.userId === selectedUserId
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border hover:bg-muted/50'
                      )}
                    >
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{m.name}</p>
                      </div>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full border font-medium shrink-0',
                        ROLE_COLORS[m.role] || 'bg-muted text-muted-foreground'
                      )}>
                        {ROLE_LABELS[m.role] || m.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Module permission matrix for selected user */}
              {selectedUserId && (
                <div className="space-y-4 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      Modul jogosultságok: <span className="text-primary">{configurableMembers.find(m => m.userId === selectedUserId)?.name}</span>
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> Olvasás</span>
                      <span className="flex items-center gap-1"><Pencil className="h-3 w-3" /> Írás</span>
                    </div>
                  </div>

                  {[...groupedModules.entries()].map(([groupName, modules]) => (
                    <div key={groupName} className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{groupName}</p>
                      <div className="rounded-lg border border-border overflow-hidden">
                        {modules.map((mod, i) => {
                          const perm = selectedPerms.get(mod.key);
                          const hasOverride = !!perm;
                          const defaults = getStaticDefaults(selectedUserRole, mod.key);
                          const canRead = perm?.canRead ?? defaults.canRead;
                          const canWrite = perm?.canWrite ?? defaults.canWrite;

                          return (
                            <div
                              key={mod.key}
                              className={cn(
                                'flex items-center justify-between px-3 py-2 text-sm',
                                i > 0 && 'border-t border-border',
                                hasOverride && 'bg-primary/[0.02]',
                              )}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="truncate">{mod.label}</span>
                                {hasOverride && (
                                  <button
                                    type="button"
                                    onClick={() => resetToDefault(selectedUserId, mod.key)}
                                    className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
                                    title="Visszaállítás alapértelmezettre"
                                  >
                                    reset
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                {/* Read toggle */}
                                <button
                                  type="button"
                                  onClick={() => togglePermission(selectedUserId, mod.key, 'canRead')}
                                  disabled={upsertMutation.isPending}
                                  className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                                    canRead
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                      : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                  )}
                                >
                                  {canRead ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                  <Eye className="h-3 w-3" />
                                </button>
                                {/* Write toggle */}
                                <button
                                  type="button"
                                  onClick={() => togglePermission(selectedUserId, mod.key, 'canWrite')}
                                  disabled={upsertMutation.isPending}
                                  className={cn(
                                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors',
                                    canWrite
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                                      : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                                  )}
                                >
                                  {canWrite ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                                  <Pencil className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  <p className="text-xs text-muted-foreground">
                    💡 Tipp: Az Admin felhasználókat nem korlátozhatod — nekik mindig teljes hozzáférésük van. 
                    A „reset" gomb visszaállítja a modult a szerepkör szerinti alapértelmezésre.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
