import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyRole } from './AccountyRoleContext';
import { Building2, Users, Shield, ChevronDown, Search, Check, X, Loader2 } from 'lucide-react';
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
      if (!firmId) return { users: [], companies: [], assignments: [] };

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

      // 5. Get user emails from auth (via a helper view or direct query)
      // Since we can't query auth.users directly from client, we use profiles + assignment data
      const users: AccountantUser[] = userIds.map(uid => {
        const profile = (profiles || []).find((p: any) => p.user_id === uid);
        return {
          id: uid,
          email: '', // Will be populated if available
          name: profile?.name || 'Ismeretlen',
        };
      });

      // 6. Get company details
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', companyIds);

      if (compErr) throw compErr;

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

function RoleSelector({ currentRole, onSelect, onClose }: {
  currentRole: string;
  onSelect: (role: RoleOption) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-50 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[180px]">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground">Szerepkör módosítása</span>
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
      <div className="border-t border-border px-3 py-1.5">
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Mégse
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──

export default function PermissionMatrixPage() {
  const { isAdmin } = useAccountyRole();
  const { data, isLoading } = usePermissionMatrix();
  const updateRole = useUpdateAssignmentRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCell, setEditingCell] = useState<string | null>(null); // "userId:companyId"

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!data?.users) return [];
    if (!searchQuery) return data.users;
    const q = searchQuery.toLowerCase();
    return data.users.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [data?.users, searchQuery]);

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
          Könyvelők szerepköreinek kezelése cégenként. Kattints egy cellára a szerepkör módosításához.
        </p>
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

      {/* Matrix table */}
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
                {companies.map(company => (
                  <th key={company.id} className="px-3 py-3 text-center font-medium text-foreground min-w-[140px]">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="truncate max-w-[120px]">{company.name}</span>
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
                  <td className="sticky left-0 z-10 bg-card px-4 py-3 font-medium text-foreground">
                    <div>
                      <div className="font-medium">{user.name}</div>
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
                                onClose={() => setEditingCell(null)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
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
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {ROLE_OPTIONS.map(role => (
          <div key={role} className="flex items-center gap-1.5">
            <RoleBadge role={role} />
          </div>
        ))}
      </div>
    </div>
  );
}
