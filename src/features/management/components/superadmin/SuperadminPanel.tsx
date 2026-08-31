import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '../common/ManagementSkeleton';
import { DatePickerInput } from '../common/DatePickerInput';
import { SUPERADMIN_MODULES, MODULE_COLUMNS, COL_LABELS, STATUS_KEYS } from './SuperadminConstants';
import { fetchManagementData } from '../../api/managementApi';
import { OverviewData, SuperadminModuleData, SuperadminModuleKey } from '../../api/types';
import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, User, Search, ChevronLeft, ChevronRight, Eye, X, Loader2,
  FileText, CreditCard, Landmark
} from 'lucide-react';

export function fmtCell(key: string, val: unknown): React.ReactNode {
  if (val == null || val === '') return <span className="text-muted-foreground/40">—</span>;
  const s = String(val);
  if (STATUS_KEYS.has(key)) {
    const isOk = ['done', 'ok', 'matched', 'active', 'completed', 'processed', 'synced'].includes(s.toLowerCase());
    const isPending = ['pending', 'processing', 'in_progress'].includes(s.toLowerCase());
    const isErr = ['error', 'failed', 'unmatched'].includes(s.toLowerCase());
    const cls = isOk
      ? 'bg-success/15 text-success border-success/25'
      : isPending
        ? 'bg-warning/15 text-warning border-warning/25'
        : isErr
          ? 'bg-destructive/15 text-destructive border-destructive/25'
          : 'bg-muted text-muted-foreground border-border';
    return <Badge className={`${cls} text-[10px] px-1.5 py-0 font-semibold`}>{s}</Badge>;
  }
  // Date formatting
  if (/date|created_at|resolved_at|due_date|item_date/.test(key) && s.includes('T')) {
    return s.slice(0, 10);
  }
  // Amount formatting
  if (/amount|gross|net|balance|credit|debit|total/.test(key) && !isNaN(Number(val))) {
    return <span className="tabular-nums">{Number(val).toLocaleString('hu-HU')} Ft</span>;
  }
  // Truncate long strings
  if (s.length > 50) return <span title={s}>{s.slice(0, 48)}…</span>;
  return s;
}

interface SuperadminPanelProps {
  overview: OverviewData | undefined;
}

export function SuperadminPanel({ overview }: SuperadminPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get('exit_toast') === '1') {
      toast({ title: 'Support mód befejezve', description: 'Sikeresen visszatértél a management nézetbe.' });
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('exit_toast');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, toast]);

  const mode = (searchParams.get('sa_mode') as 'company' | 'user') ?? 'company';
  const selectedCompanyId = searchParams.get('sa_company') || null;
  const selectedUserId = searchParams.get('sa_user') || null;
  const activeModule = (searchParams.get('sa_tab') as SuperadminModuleKey) ?? 'invoices';

  const setUrlParam = useCallback((updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        if (v == null) next.delete(k);
        else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');

  const filteredCompanies = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return overview?.companies ?? [];
    return (overview?.companies ?? []).filter(c =>
      c.name.toLowerCase().includes(q) || (c.tax_number || '').includes(q)
    );
  }, [overview?.companies, searchQ]);

  const filteredUsers = useMemo(() => {
    const q = searchQ.toLowerCase();
    if (!q) return overview?.users ?? [];
    return (overview?.users ?? []).filter(u =>
      (u.name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [overview?.users, searchQ]);

  const userCompanies = useMemo(() => {
    if (!selectedUserId) return [];
    const user = overview?.users.find(u => u.user_id === selectedUserId);
    if (!user) return [];
    const ids = new Set(user.companies.map(c => c.id));
    return (overview?.companies ?? []).filter(c => ids.has(c.id));
  }, [selectedUserId, overview]);

  const selectedUser = overview?.users.find(u => u.user_id === selectedUserId);
  const selectedCompany = overview?.companies.find(c => c.id === selectedCompanyId);

  const { data: moduleData, isFetching } = useQuery<SuperadminModuleData>({
    queryKey: ['superadmin-module', selectedCompanyId, activeModule, page, dateFrom, dateTo, moduleSearch],
    queryFn: () => {
      const p: Record<string, string> = {
        companyId: selectedCompanyId!,
        module: activeModule,
        page: String(page),
        pageSize: '25',
      };
      if (dateFrom) p.dateFrom = dateFrom;
      if (dateTo) p.dateTo = dateTo;
      if (moduleSearch) p.search = moduleSearch;
      return fetchManagementData('superadmin-module-data', p);
    },
    enabled: !!selectedCompanyId,
    staleTime: 30_000,
    retry: false,
  });

  const totalPages = moduleData ? Math.ceil(moduleData.totalCount / 25) : 0;
  const cols = MODULE_COLUMNS[activeModule] ?? [];
  const modDef = SUPERADMIN_MODULES.find(m => m.key === activeModule);

  function handleSelectCompany(id: string) {
    setUrlParam({ sa_company: id, ...(mode === 'user' ? {} : { sa_user: null }) });
    setPage(1); setDateFrom(''); setDateTo(''); setModuleSearch('');
  }

  function handleSelectUser(userId: string) {
    const next = userId === selectedUserId ? null : userId;
    setUrlParam({ sa_user: next, sa_company: null });
    setPage(1); setDateFrom(''); setDateTo(''); setModuleSearch('');
  }

  function handleModuleSwitch(key: SuperadminModuleKey) {
    setUrlParam({ sa_tab: key });
    setPage(1); setModuleSearch('');
  }

  const isUserMode = mode === 'user';
  const showUserList = isUserMode && !selectedUserId;
  const showUserCompanies = isUserMode && !!selectedUserId;

  const [impersonating, setImpersonating] = useState(false);

  const { data: activeImpersonation } = useQuery({
    queryKey: ['active-impersonation'],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('role', 'support_admin' as any)
        .limit(1)
        .maybeSingle();
      return data as { company_id: string } | null;
    },
    refetchInterval: 30_000,
  });

  const handleImpersonate = useCallback(async (companyId: string, companyName: string) => {
    setImpersonating(true);
    try {
      const { error } = await supabase.functions.invoke('impersonate-company', {
        body: { action: 'start', companyId },
      });

      if (error) throw new Error(error.message);

      const url = `/${companyId}/this-month/invoices`;
      window.location.href = url;

      queryClient.invalidateQueries({ queryKey: ['active-impersonation'] });
    } catch (err) {
      reportError({
        type: 'api_call',
        component: 'SuperadminPanel',
        action: 'impersonation_start',
        message: `Failed to start impersonation for ${companyName}`,
        error: err,
      });
    } finally {
      setImpersonating(false);
    }
  }, [queryClient]);

  const handleStopImpersonation = useCallback(async (companyId: string) => {
    try {
      await supabase.functions.invoke('impersonate-company', {
        body: { action: 'stop', companyId },
      });
      queryClient.invalidateQueries({ queryKey: ['active-impersonation'] });
    } catch (err) {
      reportError({
        type: 'api_call',
        component: 'SuperadminPanel',
        action: 'impersonation_stop',
        message: 'Failed to stop impersonation',
        error: err,
      });
    }
  }, [queryClient]);

  return (
    <div className="flex gap-0 h-full overflow-hidden">
      {/* ── Left panel: company list ── */}
      <div className="w-72 shrink-0 border-r border-border flex flex-col bg-muted/20">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
            <button
              onClick={() => { setUrlParam({ sa_mode: 'company', sa_user: null, sa_company: null }); setSearchQ(''); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'company' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" /> Cég
            </button>
            <button
              onClick={() => { setUrlParam({ sa_mode: 'user', sa_user: null, sa_company: null }); setSearchQ(''); }}
              className={`flex-1 py-1.5 flex items-center justify-center gap-1.5 transition-colors ${
                mode === 'user' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
              }`}
            >
              <User className="h-3.5 w-3.5" /> Felhasználó
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); }}
              placeholder={mode === 'company' ? 'Cég neve, adószám…' : 'Email, név…'}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!overview ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : showUserList ? (
            filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Nincs találat</div>
            ) : filteredUsers.map(u => (
              <button
                key={u.user_id}
                onClick={() => handleSelectUser(u.user_id)}
                className="w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50"
              >
                <div className="text-sm font-semibold truncate">{u.name || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{u.email}</div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Building2 className="h-3 w-3" /> {u.companies.length} cég</span>
                </div>
              </button>
            ))
          ) : showUserCompanies ? (
            <>
              <button
                onClick={() => handleSelectUser(selectedUserId!)}
                className="w-full text-left px-3 py-2 flex items-center gap-2 text-xs text-primary hover:bg-primary/10 border-b border-border transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Vissza ({selectedUser?.name || selectedUser?.email})
              </button>
              {userCompanies.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">Ennek a felhasználónak nincs cége</div>
              ) : userCompanies.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCompany(c.id)}
                  className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 ${
                    selectedCompanyId === c.id ? 'bg-primary/10 border-l-2 border-l-primary pl-[10px]' : ''
                  }`}
                >
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.tax_number || '—'}</div>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" /> {c.invoiceCount}</span>
                    <span className="flex items-center gap-0.5"><CreditCard className="h-3 w-3" /> {c.transactionCount}</span>
                    <span className="flex items-center gap-0.5"><Landmark className="h-3 w-3" /> {c.navInvoiceCount}</span>
                  </div>
                </button>
              ))}
            </>
          ) : (
            filteredCompanies.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs">Nincs találat</div>
            ) : filteredCompanies.map(c => (
              <button
                key={c.id}
                onClick={() => handleSelectCompany(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/50 transition-colors hover:bg-accent/50 ${
                  selectedCompanyId === c.id ? 'bg-primary/10 border-l-2 border-l-primary pl-[10px]' : ''
                }`}
              >
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.tax_number || '—'}</div>
                <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><FileText className="h-3 w-3" /> {c.invoiceCount}</span>
                  <span className="flex items-center gap-0.5"><CreditCard className="h-3 w-3" /> {c.transactionCount}</span>
                  <span className="flex items-center gap-0.5"><Landmark className="h-3 w-3" /> {c.navInvoiceCount}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedCompanyId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <Building2 className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Válassz egy céget a bal oldali listából</p>
          </div>
        ) : (
          <>
            <div className="px-5 py-3 border-b border-border bg-muted/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">{selectedCompany?.name ?? '…'}</h2>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{selectedCompany?.tax_number || '—'}</span>
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                      {selectedCompany?.members.length ?? 0} tag
                    </Badge>
                    <Badge className="text-[10px] px-1.5 py-0 bg-success/10 text-success border-success/20">eaisybill</Badge>
                    {selectedCompany?.hasEaisyBooks && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-info/10 text-info border-info/20">eaisyBooks</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeImpersonation?.company_id === selectedCompanyId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                      onClick={() => handleStopImpersonation(selectedCompanyId!)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Support mód aktív — Leállítás
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border-0"
                      onClick={() => selectedCompanyId && selectedCompany && handleImpersonate(selectedCompanyId, selectedCompany.name)}
                      disabled={impersonating || !!activeImpersonation}
                    >
                      {impersonating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {impersonating ? 'Csatlakozás...' : 'Megtekintés felhasználóként'}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setUrlParam({ sa_company: null, sa_user: null })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Module nav */}
            <div className="border-b border-border">
              {/* eaisybill row */}
              <div className="flex items-center gap-0 border-b border-border/40 overflow-x-auto">
                <span className="shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-success bg-success/5 border-r border-border/40 select-none">
                  eaisybill
                </span>
                <div className="flex min-w-max">
                  {SUPERADMIN_MODULES.filter(m => m.platform === 'eaisybill').map(m => (
                    <button
                      key={m.key}
                      onClick={() => handleModuleSwitch(m.key)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
                        activeModule === m.key
                          ? 'bg-success/10 text-success border-b-2 border-success'
                          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              {/* eaisyBooks row */}
              <div className={`flex items-center gap-0 overflow-x-auto transition-opacity ${
                selectedCompany?.hasEaisyBooks ? '' : 'opacity-30 pointer-events-none'
              }`}>
                <span className="shrink-0 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-info bg-info/5 border-r border-border/40 select-none">
                  eaisyBooks
                </span>
                <div className="flex min-w-max">
                  {SUPERADMIN_MODULES.filter(m => m.platform === 'eaisybooks').map(m => (
                    <button
                      key={m.key}
                      onClick={() => handleModuleSwitch(m.key)}
                      className={`flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium whitespace-nowrap transition-all ${
                        activeModule === m.key
                          ? 'bg-info/10 text-info border-b-2 border-info'
                          : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <m.icon className="h-3 w-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
                {!selectedCompany?.hasEaisyBooks && (
                  <span className="shrink-0 ml-auto pr-3 text-[10px] text-muted-foreground/60 italic select-none">
                    Nem elérhető
                  </span>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  value={moduleSearch}
                  onChange={e => { setModuleSearch(e.target.value); setPage(1); }}
                  placeholder="Keresés…"
                  className="pl-6 h-7 text-xs w-36 bg-background"
                />
              </div>
              <DatePickerInput value={dateFrom} onChange={v => { setDateFrom(v); setPage(1); }} />
              <span className="text-muted-foreground text-xs">—</span>
              <DatePickerInput value={dateTo} onChange={v => { setDateTo(v); setPage(1); }} />

              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5">
                {modDef && <modDef.icon className="h-3.5 w-3.5" />}
                <strong className="text-foreground">{moduleData?.totalCount ?? '…'}</strong> rekord
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs" role="table">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr className="border-b border-border">
                    {cols.map(col => (
                      <th key={col} className="text-left py-2.5 px-3 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide whitespace-nowrap">
                        {COL_LABELS[col] ?? col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {isFetching ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {cols.map(col => (
                          <td key={col} className="py-2.5 px-3">
                            <Skeleton className={`h-3.5 ${col.includes('date') || col === 'amount' || col === 'year' || col === 'month' ? 'w-20' : col.includes('name') || col.includes('description') || col === 'message' ? 'w-40' : 'w-full'}`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (moduleData?.rows ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} className="py-12 text-center text-muted-foreground">
                        Nincs adat ehhez a modulhoz
                      </td>
                    </tr>
                  ) : (moduleData?.rows ?? []).map((row, i) => (
                    <tr key={i} className="hover:bg-accent/40 transition-colors">
                      {cols.map(col => (
                        <td key={col} className="py-2 px-3 max-w-[200px] truncate">
                          {fmtCell(col, row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-2.5 border-t border-border shrink-0">
                <span className="text-xs text-muted-foreground">
                  {(page - 1) * 25 + 1}–{Math.min(page * 25, moduleData?.totalCount ?? 0)} / {moduleData?.totalCount} rekord
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = page <= 3 ? i + 1 : page - 2 + i;
                    if (p < 1 || p > totalPages) return null;
                    return (
                      <Button key={p} variant={p === page ? 'default' : 'outline'} size="icon"
                        className="h-7 w-7 text-xs" onClick={() => setPage(p)}>{p}</Button>
                    );
                  })}
                  <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
