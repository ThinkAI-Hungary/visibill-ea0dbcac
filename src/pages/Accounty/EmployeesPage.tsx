import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Search, Filter, ChevronRight, ArrowLeft,
  Download, Upload, MoreVertical, Mail, Phone, Building2, Shield,
  ChevronLeft, Briefcase, Trash2, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { usePayrollEmployees } from '@/hooks/usePayrollData';
import { formatTajNumber } from '@/lib/payroll/validators';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { SzochoAdvisor } from '@/components/accounty/payroll/SzochoAdvisor';

export default function EmployeesPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);



  const qc = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (empId: string, empName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(empId);
    try {
      const { error } = await supabase.from('accounty_employees').delete().eq('id', empId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['payroll', 'employees', companyId] });
      toast({ title: 'Törölve', description: `${empName} sikeresen törölve.` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Hiba', description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const { data: employees = [], isLoading, isError, refetch } = usePayrollEmployees(companyId || '');

  const filtered = useMemo(() => {
    let result = employees;

    if (statusFilter !== 'all') {
      result = result.filter(e => e.status === statusFilter);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        `${e.last_name} ${e.first_name}`.toLowerCase().includes(q) ||
        (e.taj_number && e.taj_number.replace(/[-\s]/g, '').includes(q.replace(/[-\s]/g, ''))) ||
        (e.tax_id && e.tax_id.includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q))
      );
    }

    return result;
  }, [employees, searchQuery, statusFilter]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const statusCounts = useMemo(() => ({
    all: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    pending: employees.filter(e => e.status === 'pending').length,
    terminated: employees.filter(e => e.status === 'terminated').length,
    suspended: employees.filter(e => e.status === 'suspended').length,
  }), [employees]);

  const statusLabels: Record<string, string> = {
    active: 'Aktív',
    pending: 'Függő',
    terminated: 'Kilépett',
    suspended: 'Szünetelő',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    terminated: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    suspended: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  };

  if (isError) {
    return <AccountyErrorState message="Nem sikerült betölteni a foglalkoztatottak listáját." onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-xl p-4 border border-border animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounty/payroll/${companyId}`)} className="h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Foglalkoztatottak</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{employees.length} fő nyilvántartva</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            onClick={() => {
              const headers = ['Név', 'TAJ-szám', 'Adóazonosító', 'E-mail', 'Telefon', 'Státusz'];
              const rows = filtered.map(e => [
                `${e.last_name} ${e.first_name}`,
                e.taj_number || '',
                e.tax_id || '',
                e.email || '',
                e.phone || '',
                statusLabels[e.status] || e.status,
              ]);
              const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
              const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `foglalkoztatottak_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-2 text-sm"
            onClick={() => navigate(`/accounty/payroll/${companyId}/employees/import`)}
          >
            <Upload className="w-4 h-4" />
            Excel importálás
          </Button>
          <Button
            onClick={() => navigate(`/accounty/payroll/${companyId}/employees/new`)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Új foglalkoztatott
          </Button>
        </div>
      </div>

      <SzochoAdvisor companyId={companyId || ''} />

      {/* Status tabs */}
      <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-900/80 p-1 rounded-xl border border-border/60">
        {(['all', 'active', 'pending', 'terminated', 'suspended'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              statusFilter === s
                ? 'bg-card text-slate-900 dark:text-slate-100 shadow-soft'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
            )}
          >
            {s === 'all' ? 'Mind' : statusLabels[s]} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés név, TAJ, adóazonosító, e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border text-sm"
          />
        </div>
      </div>

      {/* Employee list */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {employees.length === 0 ? 'Még nincsenek foglalkoztatottak' : 'Nincs találat a szűrésre'}
            </p>
            {employees.length === 0 && (
              <Button
                onClick={() => navigate(`/accounty/payroll/${companyId}/employees/new`)}
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Első foglalkoztatott felvétele
              </Button>
            )}
          </div>
        ) : (
          <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 dark:bg-slate-900/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Név</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">TAJ-szám</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Adóazonosító</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Elérhetőség</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Státusz</th>
                  <th className="px-5 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {paginatedEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    onClick={() => navigate(`/accounty/payroll/${companyId}/employees/${emp.id}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {emp.last_name[0]}{emp.first_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {emp.last_name} {emp.first_name}
                          </p>
                          {emp.birth_name && emp.birth_name !== `${emp.last_name} ${emp.first_name}` && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Szül.: {emp.birth_name}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {emp.taj_number ? formatTajNumber(emp.taj_number) : <span className="text-slate-400">–</span>}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 font-mono">
                      {emp.tax_id || <span className="text-slate-400">–</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {emp.email && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {emp.email}
                          </span>
                        )}
                        {emp.phone && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {emp.phone}
                          </span>
                        )}
                        {!emp.email && !emp.phone && <span className="text-xs text-slate-400">–</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={cn(
                        'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                        statusColors[emp.status] || statusColors.active
                      )}>
                        {statusLabels[emp.status] || emp.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleDelete(emp.id, `${emp.last_name} ${emp.first_name}`, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Törlés"
                        >
                          {deletingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-primary transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border/50 dark:bg-slate-900/30">
              <UnifiedPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 20, 50]}
              />
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}
