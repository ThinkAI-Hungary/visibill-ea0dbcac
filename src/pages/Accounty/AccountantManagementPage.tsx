import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountyRole } from './AccountyRoleContext';
import {
  Building2, Users, Shield, Search, Plus, Trash2, Loader2, UserPlus, ChevronDown, Check, X, AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ── Types ──
interface FirmAccountant {
  userId: string;
  name: string;
  email: string;
  role: string;
  assignedCompanies: { id: string; name: string; role: string; assignmentId: string }[];
}

interface AvailableCompany {
  id: string;
  name: string;
  taxNumber: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  'iroda_admin': 'Iroda Admin',
  'senior_könyvelő': 'Senior Könyvelő',
  'könyvelő': 'Könyvelő',
  'asszisztens': 'Asszisztens',
};

const ROLE_COLORS: Record<string, string> = {
  'iroda_admin': 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  'senior_könyvelő': 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  'könyvelő': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  'asszisztens': 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
};

// ── Data hooks ──
function useFirmAccountants() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['firm-accountants', user?.id],
    queryFn: async (): Promise<{ firmId: string; accountants: FirmAccountant[]; companies: AvailableCompany[] }> => {
      // Get admin's firm
      const { data: myAssign } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1)
        .single();

      const firmId = myAssign?.accounting_firm_id;
      if (!firmId) return { firmId: '', accountants: [], companies: [] };

      // Get all assignments for firm
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('id, accountant_user_id, company_id, role')
        .eq('accounting_firm_id', firmId);

      if (!assignments) return { firmId, accountants: [], companies: [] };

      // Get unique user IDs
      const userIds = [...new Set(assignments.map((a: any) => a.accountant_user_id))];
      const companyIds = [...new Set(assignments.map((a: any) => a.company_id))];

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', userIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.name || 'Névtelen'; });

      // Get companies
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', companyIds);
      const companyMap: Record<string, { name: string; taxNumber: string | null }> = {};
      (companies || []).forEach((c: any) => {
        companyMap[c.id] = { name: c.name, taxNumber: c.tax_number };
      });

      // Build accountant objects
      const accountantMap: Record<string, FirmAccountant> = {};
      for (const uid of userIds) {
        accountantMap[uid] = {
          userId: uid,
          name: nameMap[uid] || 'Névtelen',
          email: '',
          role: '',
          assignedCompanies: [],
        };
      }

      for (const a of assignments as any[]) {
        const acc = accountantMap[a.accountant_user_id];
        if (!acc) continue;
        // Use the first role found as the "main" role
        if (!acc.role) acc.role = a.role;
        const comp = companyMap[a.company_id];
        if (comp && comp.name !== 'SANDBOX') {
          acc.assignedCompanies.push({
            id: a.company_id,
            name: comp.name,
            role: a.role,
            assignmentId: a.id,
          });
        }
      }

      const accountants = Object.values(accountantMap)
        .filter(a => a.name !== 'Sandbox')
        .sort((a, b) => a.name.localeCompare(b.name));

      // Available companies for assignment (all firm companies except the firm itself)
      const availableCompanies = (companies || [])
        .filter((c: any) => c.name !== 'SANDBOX' && c.id !== firmId)
        .map((c: any): AvailableCompany => ({
          id: c.id,
          name: c.name,
          taxNumber: c.tax_number,
        }));

      return { firmId, accountants, companies: availableCompanies };
    },
    enabled: !!user?.id,
    staleTime: 10_000,
  });
}

function useAddCompanyAssignment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: { userId: string; companyId: string; firmId: string; role: string }) => {
      const { error } = await supabase
        .from('accounty_assignments')
        .insert({
          accountant_user_id: params.userId,
          company_id: params.companyId,
          accounting_firm_id: params.firmId,
          role: params.role,
          source: 'manual',
          is_primary: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-accountants'] });
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
      toast({ title: 'Cég hozzárendelve', description: 'A könyvelő hozzá lett rendelve a céghez.' });
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
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('accounty_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firm-accountants'] });
      queryClient.invalidateQueries({ queryKey: ['permission-matrix'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
      toast({ title: 'Hozzárendelés törölve', description: 'A könyvelő el lett távolítva a cégtől.' });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    },
  });
}

// ── AssignCompanyDialog ──
function AssignCompanyDialog({
  open, onClose, accountant, availableCompanies, firmId
}: {
  open: boolean;
  onClose: () => void;
  accountant: FirmAccountant;
  availableCompanies: AvailableCompany[];
  firmId: string;
}) {
  const addAssignment = useAddCompanyAssignment();
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string>('könyvelő');
  const [searchQ, setSearchQ] = useState('');

  // Filter out already-assigned companies
  const unassigned = useMemo(() => {
    const assignedIds = new Set(accountant.assignedCompanies.map(c => c.id));
    return availableCompanies.filter(c => !assignedIds.has(c.id));
  }, [accountant.assignedCompanies, availableCompanies]);

  const filtered = useMemo(() => {
    if (!searchQ) return unassigned;
    const q = searchQ.toLowerCase();
    return unassigned.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.taxNumber && c.taxNumber.includes(q))
    );
  }, [unassigned, searchQ]);

  function toggleCompany(id: string) {
    setSelectedCompanies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssign() {
    for (const companyId of selectedCompanies) {
      await addAssignment.mutateAsync({ userId: accountant.userId, companyId, firmId, role });
    }
    setSelectedCompanies(new Set());
    setSearchQ('');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Cégek hozzárendelése
          </DialogTitle>
          <DialogDescription>
            Válaszd ki a cégeket, amelyekhez hozzá szeretnéd rendelni: <strong>{accountant.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Role selector */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Szerepkör</label>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setRole(key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                  ${role === key
                    ? `${ROLE_COLORS[key]} border-current`
                    : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Company search */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Cég keresése..."
            className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Company list */}
        <div className="max-h-52 overflow-y-auto border border-border rounded-lg divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {unassigned.length === 0 ? 'Minden cég hozzárendelve.' : 'Nincs találat.'}
            </div>
          ) : filtered.map(company => {
            const selected = selectedCompanies.has(company.id);
            return (
              <button
                key={company.id}
                onClick={() => toggleCompany(company.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors
                  ${selected ? 'bg-primary/10' : 'hover:bg-accent'}
                `}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors
                  ${selected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}
                `}>
                  {selected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{company.name}</div>
                  {company.taxNumber && (
                    <div className="text-[11px] text-muted-foreground">{company.taxNumber}</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Mégse</Button>
          <Button
            onClick={handleAssign}
            disabled={selectedCompanies.size === 0 || addAssignment.isPending}
          >
            {addAssignment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            {selectedCompanies.size} cég hozzárendelése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──
export default function AccountantManagementPage() {
  const { isAdmin } = useAccountyRole();
  const { data, isLoading } = useFirmAccountants();
  const removeAssignment = useRemoveAssignment();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [assignDialogUser, setAssignDialogUser] = useState<FirmAccountant | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ assignmentId: string; companyName: string; userName: string } | null>(null);

  const filteredAccountants = useMemo(() => {
    if (!data?.accountants) return [];
    if (!searchQuery) return data.accountants;
    const q = searchQuery.toLowerCase();
    return data.accountants.filter(a =>
      a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
    );
  }, [data?.accountants, searchQuery]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold">Hozzáférés megtagadva</h2>
          <p className="text-sm text-muted-foreground mt-1">Csak iroda adminisztrátorok számára elérhető.</p>
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

  const accountants = filteredAccountants;
  const companies = data?.companies || [];
  const firmId = data?.firmId || '';

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          Könyvelők kezelése
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Könyvelők listázása, cégekhez rendelés és eltávolítás.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4 max-w-xs">
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Könyvelő keresése..."
            className="bg-transparent text-sm outline-none flex-1 text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Accountant list */}
      <div className="space-y-3">
        {accountants.map(acc => {
          const isExpanded = expandedUser === acc.userId;
          return (
            <div key={acc.userId} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              {/* Header row */}
              <button
                onClick={() => setExpandedUser(isExpanded ? null : acc.userId)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {acc.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground">{acc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {acc.assignedCompanies.length} cég hozzárendelve
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${ROLE_COLORS[acc.role] || 'bg-slate-100 text-slate-600'}`}>
                  <Shield className="w-3 h-3 inline mr-1" />
                  {ROLE_LABELS[acc.role] || acc.role}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded: company list */}
              {isExpanded && (
                <div className="border-t border-border bg-muted/10 px-5 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hozzárendelt cégek</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAssignDialogUser(acc)}
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Cég hozzáadása
                    </Button>
                  </div>
                  {acc.assignedCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3 text-center">Nincs hozzárendelt cég.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {acc.assignedCompanies.map(comp => (
                        <div
                          key={comp.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border/50 group"
                        >
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground flex-1 truncate">{comp.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ROLE_COLORS[comp.role] || 'bg-muted text-muted-foreground'}`}>
                            {ROLE_LABELS[comp.role] || comp.role}
                          </span>
                          <button
                            onClick={() => setConfirmRemove({ assignmentId: comp.assignmentId, companyName: comp.name, userName: acc.name })}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-500 transition-all"
                            title="Eltávolítás"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {accountants.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {searchQuery ? `Nincs találat: "${searchQuery}"` : 'Nincsenek könyvelők az irodában.'}
          </div>
        )}
      </div>

      {/* Assign company dialog */}
      {assignDialogUser && (
        <AssignCompanyDialog
          open={!!assignDialogUser}
          onClose={() => setAssignDialogUser(null)}
          accountant={assignDialogUser}
          availableCompanies={companies}
          firmId={firmId}
        />
      )}

      {/* Confirm remove dialog */}
      <Dialog open={!!confirmRemove} onOpenChange={() => setConfirmRemove(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" />
              Hozzárendelés törlése
            </DialogTitle>
            <DialogDescription>
              Biztosan eltávolítod <strong>{confirmRemove?.userName}</strong>-t a(z) <strong>{confirmRemove?.companyName}</strong> cégtől?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(null)}>Mégse</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmRemove) {
                  removeAssignment.mutate(confirmRemove.assignmentId);
                  setConfirmRemove(null);
                }
              }}
              disabled={removeAssignment.isPending}
            >
              {removeAssignment.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Eltávolítás
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
