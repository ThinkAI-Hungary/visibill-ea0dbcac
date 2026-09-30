import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  Users, UserPlus, Search, Filter, ChevronRight, ArrowLeft,
  Download, Upload, MoreVertical, Mail, Phone, Building2, Shield,
  ChevronLeft, Briefcase, Trash2, Loader2, LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  usePayrollEmployees,
  useCompanyEmployments,
  useCompanyEfoEntries,
  type PayrollEmployee
} from '@/hooks/usePayrollData';
import { formatTajNumber } from '@/lib/payroll/validators';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAccountyClients } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { SzochoAdvisor } from '@/components/accounty/payroll/SzochoAdvisor';

export default function EmployeesPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const prefix = pathname.startsWith('/hr') ? '/hr' : '';
  const effectiveDateRange = dateRange || 'this-year';
  const navigate = useNavigate();

  const typeParam = searchParams.get('type');
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'efo'>(
    typeParam === 'regular' || typeParam === 'efo' ? typeParam : 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Sync type filter when URL param changes
  useEffect(() => {
    if (typeParam === 'regular' || typeParam === 'efo') {
      setTypeFilter(typeParam);
    }
  }, [typeParam]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, typeFilter]);

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

  const { data: employees = [], isLoading: empLoading, isError: empError, refetch } = usePayrollEmployees(companyId || '');
  const { data: employments = [] } = useCompanyEmployments(companyId || '');
  const { data: efoEntries = [] } = useCompanyEfoEntries(companyId || '');
  const { data: clients } = useAccountyClients();
  const company = useMemo(() => clients?.find(c => c.id === companyId), [clients, companyId]);

  // ── EFO Identification Helper ──
  const efoCodes = useMemo(() => ['81', '82', '83', '1181', '1138', '1139', 'efo', 'efo_alkalmi'], []);

  const isEmployeeEfo = useCallback((emp: PayrollEmployee): boolean => {
    const empJobs = employments.filter(e => e.employee_id === emp.id);
    const hasEfoJob = empJobs.some(j => {
      const t = (j.employment_type || '').toLowerCase();
      const c = (j.job_code || '').trim().toLowerCase();
      return efoCodes.includes(t) || efoCodes.includes(c) || t.includes('efo');
    });
    if (hasEfoJob) return true;

    return efoEntries.some(efo =>
      (emp.tax_id && efo.tax_id === emp.tax_id) ||
      (emp.taj_number && efo.taj_number && efo.taj_number === emp.taj_number)
    );
  }, [employments, efoEntries, efoCodes]);

  const regularEmployeesCount = useMemo(() => employees.filter(e => !isEmployeeEfo(e)).length, [employees, isEmployeeEfo]);
  const efoEmployeesCount = useMemo(() => employees.filter(e => isEmployeeEfo(e)).length, [employees, isEmployeeEfo]);

  const filtered = useMemo(() => {
    let result = employees;

    // Filter by type: regular vs EFO
    if (typeFilter === 'regular') {
      result = result.filter(e => !isEmployeeEfo(e));
    } else if (typeFilter === 'efo') {
      result = result.filter(e => isEmployeeEfo(e));
    }

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
  }, [employees, searchQuery, statusFilter, typeFilter, isEmployeeEfo]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const statusCounts = useMemo(() => {
    // Counts within current type filter
    const base = typeFilter === 'regular'
      ? employees.filter(e => !isEmployeeEfo(e))
      : typeFilter === 'efo'
      ? employees.filter(e => isEmployeeEfo(e))
      : employees;

    return {
      all: base.length,
      active: base.filter(e => e.status === 'active').length,
      pending: base.filter(e => e.status === 'pending').length,
      terminated: base.filter(e => e.status === 'terminated').length,
      suspended: base.filter(e => e.status === 'suspended').length,
    };
  }, [employees, typeFilter, isEmployeeEfo]);

  const statusLabels: Record<string, string> = {
    active: 'Aktív',
    pending: 'Függő',
    terminated: 'Kilépett',
    suspended: 'Szünetelő',
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    terminated: 'bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground',
    suspended: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  };

  if (empError) {
    return <AccountyErrorState message="Nem sikerült betölteni a foglalkoztatottak listáját." onRetry={() => refetch()} />;
  }

  if (empLoading) {
    return (
      <div className="w-full space-y-6 page-animate">
        <div className="flex items-center gap-3">
          <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="bg-card rounded-lg p-4 border border-border animate-pulse h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 page-animate">
      {/* Header */}
      <PageHeader
        title="Foglalkoztatottak"
        description={`${employees.length} fő nyilvántartva`}
        actions={
          <>
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
              Exportálás
            </Button>
            <Button
              variant="outline"
              className="flex items-center gap-2 text-sm"
              onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/import`)}
            >
              <Upload className="w-4 h-4" />
              Excel importálás
            </Button>
            <Button
              onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/new`)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Új foglalkoztatott
            </Button>
          </>
        }
      />

      <SzochoAdvisor companyId={companyId || ''} />

      {/* Type & Status filter bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Type tabs (Mind / Állandó / EFO) */}
        <div className="flex items-center gap-1 bg-muted/60 dark:bg-card/60 p-1 rounded-lg border border-border/60">
          <button
            onClick={() => {
              setTypeFilter('all');
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('type');
                return next;
              });
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5',
              typeFilter === 'all'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Mind ({employees.length})
          </button>
          <button
            onClick={() => {
              setTypeFilter('regular');
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('type', 'regular');
                return next;
              });
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5',
              typeFilter === 'regular'
                ? 'bg-card text-teal-600 dark:text-teal-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Állandó ({regularEmployeesCount})
          </button>
          <button
            onClick={() => {
              setTypeFilter('efo');
              setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('type', 'efo');
                return next;
              });
            }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 flex items-center gap-1.5',
              typeFilter === 'efo'
                ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Briefcase className="w-3.5 h-3.5" />
            EFO ({efoEmployeesCount})
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-muted/80 dark:bg-card/80 p-1 rounded-lg border border-border/60 overflow-x-auto">
          {(['all', 'active', 'pending', 'terminated', 'suspended'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap',
                statusFilter === s
                  ? 'bg-card text-foreground shadow-soft font-semibold'
                  : 'text-muted-foreground hover:text-foreground/90'
              )}
            >
              {s === 'all' ? 'Összes státusz' : statusLabels[s]} ({statusCounts[s]})
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Keresés név, TAJ, adóazonosító, e-mail..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border text-sm"
          />
        </div>
      </div>

      {/* Employee list */}
      <div className="bg-card rounded-lg border border-border shadow-soft overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground/90">
              {employees.length === 0 ? 'Még nincsenek foglalkoztatottak' : 'Nincs találat a szűrésre'}
            </p>
            {employees.length === 0 && (
              <Button
                onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/new`)}
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
            <Table className="compact-table min-w-[850px]">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Név</TableHead>
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Típus</TableHead>
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">TAJ-szám</TableHead>
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adóazonosító</TableHead>
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Elérhetőség</TableHead>
                  <TableHead className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Státusz</TableHead>
                  <TableHead className="px-5 py-3 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {paginatedEmployees.map((emp) => {
                  const empIsEfo = isEmployeeEfo(emp);
                  return (
                    <TableRow
                      key={emp.id}
                      onClick={() => navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${emp.id}`)}
                      className="hover:bg-muted/40 cursor-pointer transition-colors group border-l-2 border-l-transparent hover:border-l-primary"
                    >
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                            empIsEfo
                              ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                              : "bg-primary/10 text-primary"
                          )}>
                            {emp.last_name[0]}{emp.first_name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {emp.last_name} {emp.first_name}
                            </p>
                            {emp.birth_name && emp.birth_name !== `${emp.last_name} ${emp.first_name}` && (
                              <p className="text-[11px] text-muted-foreground">
                                Szül.: {emp.birth_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        {empIsEfo ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            EFO alkalmi
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                            Állandó
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-sm text-foreground/90 font-mono tabular-nums">
                        {emp.taj_number ? formatTajNumber(emp.taj_number) : <span className="text-muted-foreground">–</span>}
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-sm text-foreground/90 font-mono tabular-nums">
                        {emp.tax_id || <span className="text-muted-foreground">–</span>}
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {emp.email && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {emp.email}
                            </span>
                          )}
                          {emp.phone && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {emp.phone}
                            </span>
                          )}
                          {!emp.email && !emp.phone && <span className="text-xs text-muted-foreground">–</span>}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <span className={cn(
                          'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
                          statusColors[emp.status] || statusColors.active
                        )}>
                          {statusLabels[emp.status] || emp.status}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Kilépő dokumentumok"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`${prefix}/eaisybooks/${companyId}/${effectiveDateRange}/payroll/employees/${emp.id}/exit-docs`);
                            }}
                            className={cn(
                              "text-xs h-7 px-2 transition-all",
                              emp.status === 'terminated'
                                ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-100 font-semibold"
                                : "text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 opacity-0 group-hover:opacity-100"
                            )}
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1" />
                            Kilépő iratok
                          </Button>
                          <button
                            onClick={(e) => handleDelete(emp.id, `${emp.last_name} ${emp.first_name}`, e)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                            title="Törlés"
                          >
                            {deletingId === emp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-5 py-3 border-t border-border/50 dark:bg-card/30">
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
