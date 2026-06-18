import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyRole } from './AccountyRoleContext';
import { AccountyModule } from '@/hooks/useAccountyPermissions';
import {
  Building2, Users, Shield, ChevronDown, Search, Check, X, Loader2,
  Eye, Pencil, ToggleLeft, ToggleRight, Layers,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Types ──
interface AccountantUser {
  id: string;
  email: string;
  name: string;
}

interface CompanyInfo {
  id: string;
  name: string;
  taxNumber: string | null;
}

interface Assignment {
  id: string;
  accountantUserId: string;
  companyId: string;
  role: string;
  source: string;
  isPrimary: boolean;
}

interface ModulePermRow {
  id: string;
  userId: string;
  moduleName: string;
  canRead: boolean;
  canWrite: boolean;
}

type RoleOption = 'iroda_admin' | 'senior_könyvelő' | 'könyvelő' | 'asszisztens';
const ROLE_OPTIONS: RoleOption[] = ['iroda_admin', 'senior_könyvelő', 'könyvelő', 'asszisztens'];
const ROLE_LABELS: Record<RoleOption, string> = {
  'iroda_admin': 'Iroda Admin',
  'senior_könyvelő': 'Senior Könyvelő',
  'könyvelő': 'Könyvelő',
  'asszisztens': 'Asszisztens',
};
const ROLE_COLORS: Record<RoleOption, string> = {
  'iroda_admin': 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'senior_könyvelő': 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
  'könyvelő': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  'asszisztens': 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/20',
};

// Modules that can be configured by admin
const CONFIGURABLE_MODULES: { key: AccountyModule; label: string }[] = [
  { key: 'portfolio', label: 'Portfólió' },
  { key: 'missing_invoices', label: 'Hiányzó számlák' },
  { key: 'tax_calendar', label: 'Adó naptár' },
  { key: 'reports', label: 'Riportok' },
  { key: 'approval_queue', label: 'Jóváhagyó rendszer' },
  { key: 'alerts', label: 'Riasztások' },
  { key: 'nav_deadlines', label: 'NAV határidők' },
  { key: 'payroll', label: 'Bérszámfejtés' },
  { key: 'tao', label: 'TAO / KIVA' },
  { key: 'settings', label: 'Beállítások' },
  { key: 'tickets', label: 'Hibajegyek' },
  { key: 'ai_assistant', label: 'AI Asszisztens' },
];

type TabMode = 'roles' | 'modules';

// ── Data hooks ──
function usePermissionMatrix() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['permission-matrix', user?.id],
    queryFn: async () => {
      // 1. Get accounting firm for current admin
      const { data: adminAssignment } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1)
        .single();

      const firmId = adminAssignment?.accounting_firm_id;
      if (!firmId) return { firmId: null, users: [], companies: [], assignments: [], modulePerms: [] };

      // 2. Get all assignments for this firm
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('id, accountant_user_id, company_id, role, source, is_primary')
        .eq('accounting_firm_id', firmId);

      if (assignErr) throw assignErr;

      // 3. Get unique user IDs and company IDs
      const userIds = [...new Set((assignments || []).map((a: any) => a.accountant_user_id))];
      const companyIds = [...new Set((assignments || []).map((a: any) => a.company_id))];

      // 4. Get user profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);

      const users: AccountantUser[] = userIds.map(uid => {
        const profile = (profiles || []).find((p: any) => p.user_id === uid);
        return {
          id: uid,
          email: '',
          name: profile?.name || 'Ismeretlen',
        };
      });

      // 5. Get company details
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', companyIds);

      if (compErr) throw compErr;

      // 6. Get module permissions for all users in this firm
      const { data: modulePermsRaw } = await supabase
        .from('accounty_module_permissions' as any)
        .select('id, user_id, module_name, can_read, can_write')
        .eq('accounting_firm_id', firmId);

      const modulePerms: ModulePermRow[] = (modulePermsRaw as any[] || []).map((r: any) => ({
        id: r.id,
        userId: r.user_id,
        moduleName: r.module_name,
        canRead: r.can_read,
        canWrite: r.can_write,
      }));

      return {
        firmId,
        users,
        companies: (companies || []).map((c: any): CompanyInfo => ({
          id: c.id,
          name: c.name,
          taxNumber: c.tax_number,
        })),
        assignments: (assignments || []).map((a: any): Assignment => ({
          id: a.id,
          accountantUserId: a.accountant_user_id,
          companyId: a.company_id,
          role: a.role,
          source: a.source || 'manual',
          isPrimary: a.is_primary || false,
        })),
        modulePerms,
      };
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });
}

function useUpdateAssignmentRole() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ assignmentId, newRole }: { assignmentId: string; newRole: RoleOption }) => {
      const { error } = await supabase
        .from('accounty_assignments')
        .update({ role: newRole })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      toast({ title: 'Szerepkör frissítve', description: 'A változás azonnal érvénybe lépett.' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    },
  });
}

function useCreateAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ firmId, userId, companyId, role }: {
      firmId: string; userId: string; companyId: string; role: RoleOption;
    }) => {
      const { error } = await supabase
        .from('accounty_assignments')
        .insert({
          accounting_firm_id: firmId,
          accountant_user_id: userId,
          company_id: companyId,
          role,
          source: 'manual',
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      toast({ title: 'Hozzárendelés létrehozva', description: 'A könyvelő hozzárendelve a céghez.' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    },
  });
}

function useRemoveAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ assignmentId }: { assignmentId: string }) => {
      const { error } = await supabase
        .from('accounty_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      toast({ title: 'Hozzárendelés törölve', description: 'A könyvelő el lett távolítva a cégtől.' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    },
  });
}

function useToggleModulePermission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      firmId: string;
      userId: string;
      moduleName: string;
      canRead: boolean;
      canWrite: boolean;
      existingId?: string;
    }) => {
      if (params.existingId) {
        // Update existing
        const { error } = await supabase
          .from('accounty_module_permissions' as any)
          .update({
            can_read: params.canRead,
            can_write: params.canWrite,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.existingId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('accounty_module_permissions' as any)
          .insert({
            accounting_firm_id: params.firmId,
            user_id: params.userId,
            module_name: params.moduleName,
            can_read: params.canRead,
            can_write: params.canWrite,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-module-permissions'] });
      toast({ title: 'Modul jogosultság frissítve' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    },
  });
}

// ── Components ──

function RoleBadge({ role, onClick }: { role: string; onClick?: () => void }) {
  const r = role as RoleOption;
  const color = ROLE_COLORS[r] || 'bg-slate-100 text-slate-600';
  const label = ROLE_LABELS[r] || role;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all
        ${color}
        ${onClick ? 'cursor-pointer hover:opacity-80 hover:shadow-sm' : 'cursor-default'}
      `}
    >
      <Shield className="w-3 h-3" />
      {label}
      {onClick && <ChevronDown className="w-3 h-3" />}
    </button>
  );
}

function RoleSelector({ currentRole, onSelect, onClose, onRemove, isNew }: {
  currentRole: string | null;
  onSelect: (role: RoleOption) => void;
  onClose: () => void;
  onRemove?: () => void;
  isNew?: boolean;
}) {
  return (
    <div className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">
          {isNew ? 'Hozzárendelés' : 'Szerepkör módosítása'}
        </span>
      </div>
      {ROLE_OPTIONS.map(role => (
        <button
          key={role}
          onClick={() => onSelect(role)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left
            ${role === currentRole ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent text-foreground'}
          `}
        >
          <Shield className="w-3.5 h-3.5" />
          {ROLE_LABELS[role]}
          {role === currentRole && <Check className="w-3.5 h-3.5 ml-auto" />}
        </button>
      ))}
      {onRemove && (
        <button
          onClick={onRemove}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors text-left border-t border-border"
        >
          <X className="w-3.5 h-3.5" />
          Hozzárendelés törlése
        </button>
      )}
      <div className="border-t border-border px-3 py-1.5">
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Mégse
        </button>
      </div>
    </div>
  );
}

function PermissionToggle({ canRead, canWrite, onToggleRead, onToggleWrite }: {
  canRead: boolean | null;
  canWrite: boolean | null;
  onToggleRead: () => void;
  onToggleWrite: () => void;
}) {
  // null means "no DB override, using static default"
  const readActive = canRead !== false;
  const writeActive = canWrite === true;

  return (
    <div className="flex items-center gap-1.5 justify-center">
      <button
        onClick={onToggleRead}
        title={readActive ? 'Olvasás: engedélyezve' : 'Olvasás: tiltva'}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all
          ${readActive
            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
            : 'bg-red-500/10 text-red-500/60 border-red-500/15 hover:bg-red-500/20'
          }
          ${canRead === null ? 'opacity-50 border-dashed' : ''}
        `}
      >
        <Eye className="w-3 h-3" />
        {readActive ? 'R' : '—'}
      </button>
      <button
        onClick={onToggleWrite}
        title={writeActive ? 'Írás: engedélyezve' : 'Írás: tiltva'}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-all
          ${writeActive
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20 hover:bg-blue-500/25'
            : 'bg-slate-500/10 text-slate-400 border-slate-500/15 hover:bg-slate-500/20'
          }
          ${canWrite === null ? 'opacity-50 border-dashed' : ''}
        `}
      >
        <Pencil className="w-3 h-3" />
        {writeActive ? 'W' : '—'}
      </button>
    </div>
  );
}

// ── Main Page ──

export default function PermissionMatrixPage() {
  const { isAdmin } = useAccountyRole();
  const { data, isLoading } = usePermissionMatrix();
  const updateRole = useUpdateAssignmentRole();
  const createAssignment = useCreateAssignment();
  const removeAssignment = useRemoveAssignment();
  const togglePerm = useToggleModulePermission();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>('roles');

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!searchQuery) return data.users;
    const q = searchQuery.toLowerCase();
    return data.users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [data?.users, searchQuery]);

  // Non-admin users (admin doesn't need module-level overrides)
  const nonAdminUsers = useMemo(() => {
    if (!data) return [];
    const adminUserIds = new Set(
      data.assignments
        .filter(a => a.role === 'iroda_admin')
        .map(a => a.accountantUserId)
    );
    return filteredUsers.filter(u => !adminUserIds.has(u.id));
  }, [filteredUsers, data]);

  const getModulePerm = useCallback((userId: string, moduleName: string): ModulePermRow | undefined => {
    return data?.modulePerms.find(p => p.userId === userId && p.moduleName === moduleName);
  }, [data?.modulePerms]);

  const handleToggleRead = useCallback((userId: string, moduleName: string) => {
    if (!data?.firmId) return;
    const existing = getModulePerm(userId, moduleName);
    const currentRead = existing?.canRead ?? true;
    togglePerm.mutate({
      firmId: data.firmId,
      userId,
      moduleName,
      canRead: !currentRead,
      canWrite: existing?.canWrite ?? false,
      existingId: existing?.id,
    });
  }, [data?.firmId, getModulePerm, togglePerm]);

  const handleToggleWrite = useCallback((userId: string, moduleName: string) => {
    if (!data?.firmId) return;
    const existing = getModulePerm(userId, moduleName);
    const currentWrite = existing?.canWrite ?? false;
    togglePerm.mutate({
      firmId: data.firmId,
      userId,
      moduleName,
      canRead: existing?.canRead ?? true,
      canWrite: !currentWrite,
      existingId: existing?.id,
    });
  }, [data?.firmId, getModulePerm, togglePerm]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Hozzáférés megtagadva</h2>
          <p className="text-sm text-muted-foreground mt-1">Ez az oldal csak iroda adminisztrátorok számára érhető el.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const companies = data?.companies || [];
  const assignments = data?.assignments || [];

  function getAssignment(userId: string, companyId: string) {
    return assignments.find(a => a.accountantUserId === userId && a.companyId === companyId);
  }

  function handleRoleChange(assignmentId: string, newRole: RoleOption) {
    updateRole.mutate({ assignmentId, newRole });
    setEditingCell(null);
  }

  function handleCreateAssignment(userId: string, companyId: string, role: RoleOption) {
    if (!data?.firmId) return;
    createAssignment.mutate({ firmId: data.firmId, userId, companyId, role });
    setEditingCell(null);
  }

  function handleRemoveAssignment(assignmentId: string) {
    removeAssignment.mutate({ assignmentId });
    setEditingCell(null);
  }

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          Jogosultságkezelő
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Könyvelők szerepköreinek és modul-hozzáférésének kezelése.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-muted/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${activeTab === 'roles'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <Users className="w-4 h-4" />
          Szerepkörök
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${activeTab === 'modules'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          <Layers className="w-4 h-4" />
          Modul jogosultságok
        </button>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Könyvelő keresése..."
            className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none flex-1"
          />
        </div>
      </div>

      {/* ── Tab: Roles Matrix ── */}
      {activeTab === 'roles' && (
        <>
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-3 text-left font-semibold text-foreground w-[180px]">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        Könyvelő
                      </div>
                    </th>
                    {companies.map(company => (
                      <th key={company.id} className="px-2 py-3 text-center font-medium text-foreground">
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="flex items-center gap-1 truncate">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate text-xs">{company.name}</span>
                          </div>
                          {company.taxNumber && (
                            <span className="text-[10px] text-muted-foreground font-normal">{company.taxNumber}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/30
                        ${idx % 2 === 0 ? '' : 'bg-muted/10'}
                      `}
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        <div>
                          <div className="font-medium truncate">{user.name}</div>
                          {user.email && <div className="text-[11px] text-muted-foreground">{user.email}</div>}
                        </div>
                      </td>
                      {companies.map(company => {
                        const assignment = getAssignment(user.id, company.id);
                        const cellKey = `${user.id}:${company.id}`;
                        const isEditing = editingCell === cellKey;

                        return (
                          <td key={company.id} className="px-3 py-3 text-center relative">
                            {assignment ? (
                              <div className="relative inline-block">
                                <RoleBadge
                                  role={assignment.role}
                                  onClick={() => setEditingCell(isEditing ? null : cellKey)}
                                />
                                {isEditing && (
                                  <RoleSelector
                                    currentRole={assignment.role}
                                    onSelect={(newRole) => handleRoleChange(assignment.id, newRole)}
                                    onRemove={() => handleRemoveAssignment(assignment.id)}
                                    onClose={() => setEditingCell(null)}
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setEditingCell(isEditing ? null : cellKey)}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all border border-dashed border-transparent hover:border-primary/30"
                                  title="Könyvelő hozzárendelése ehhez a céghez"
                                >
                                  +
                                </button>
                                {isEditing && (
                                  <RoleSelector
                                    currentRole={null}
                                    isNew
                                    onSelect={(role) => handleCreateAssignment(user.id, company.id, role)}
                                    onClose={() => setEditingCell(null)}
                                  />
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={companies.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                        {searchQuery ? `Nincs találat: "${searchQuery}"` : 'Nincsenek könyvelők hozzárendelve.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {ROLE_OPTIONS.map(role => (
              <div key={role} className="flex items-center gap-1.5">
                <RoleBadge role={role} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Tab: Module Permissions ── */}
      {activeTab === 'modules' && (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Egyedi modul-hozzáférés beállítása könyvelőnként. A szaggatott szegélyes cellák az alapértelmezett (szerepkör szerinti) jogosultságot mutatják.
            Kattints a módosításhoz. Az iroda admin jogosultságai nem korlátozhatók.
          </p>
          <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="sticky left-0 z-20 bg-muted/80 backdrop-blur px-4 py-3 text-left font-semibold text-foreground min-w-[200px]">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        Könyvelő
                      </div>
                    </th>
                    {CONFIGURABLE_MODULES.map(mod => (
                      <th key={mod.key} className="px-2 py-3 text-center font-medium text-foreground min-w-[80px]">
                        <span className="text-[11px] leading-tight">{mod.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nonAdminUsers.map((user, idx) => (
                    <tr
                      key={user.id}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/30
                        ${idx % 2 === 0 ? '' : 'bg-muted/10'}
                      `}
                    >
                      <td className="sticky left-0 z-10 bg-card px-4 py-3 font-medium text-foreground">
                        <div className="font-medium">{user.name}</div>
                      </td>
                      {CONFIGURABLE_MODULES.map(mod => {
                        const perm = getModulePerm(user.id, mod.key);
                        return (
                          <td key={mod.key} className="px-2 py-2 text-center">
                            <PermissionToggle
                              canRead={perm ? perm.canRead : null}
                              canWrite={perm ? perm.canWrite : null}
                              onToggleRead={() => handleToggleRead(user.id, mod.key)}
                              onToggleWrite={() => handleToggleWrite(user.id, mod.key)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {nonAdminUsers.length === 0 && (
                    <tr>
                      <td colSpan={CONFIGURABLE_MODULES.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                        {searchQuery ? `Nincs találat: "${searchQuery}"` : 'Nincs nem-admin könyvelő az irodában.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-4 rounded border border-dashed border-emerald-500/20 bg-emerald-500/10" />
              Alapértelmezett (szerepkör szerinti)
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-4 rounded border border-emerald-500/20 bg-emerald-500/15" />
              Egyedileg engedélyezve
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-4 rounded border border-red-500/15 bg-red-500/10" />
              Egyedileg tiltva
            </div>
          </div>
        </>
      )}
    </div>
  );
}
