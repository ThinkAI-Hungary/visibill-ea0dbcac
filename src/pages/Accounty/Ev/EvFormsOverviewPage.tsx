import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FileText, ArrowLeft, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, Download, Eye,
  Search, Shield, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllEvTaxReturns } from '@/hooks/useEvData';

// ─── Types & Constants ──────────────────────────────────────────────────────

type FormStatus = 'submitted' | 'draft' | 'overdue' | 'upcoming' | 'not_required';

interface AggregatedForm {
  key: string;
  code: string;
  name: string;
  description: string;
  period: string;
  deadline: string;
  status: FormStatus;
  category: string;
  clientsAffected: number;
  clientsSubmitted: number;
}

const STATUS_CONFIG: Record<FormStatus, { icon: React.ReactNode; label: string; color: string }> = {
  submitted: { icon: <CheckCircle2 className="w-4 h-4" />, label: 'Benyújtva', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
  draft: { icon: <FileText className="w-4 h-4" />, label: 'Vázlat', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  overdue: { icon: <AlertTriangle className="w-4 h-4" />, label: 'Lejárt!', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  upcoming: { icon: <Clock className="w-4 h-4" />, label: 'Közelgő', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' },
  not_required: { icon: <Shield className="w-4 h-4" />, label: 'Nem kötelező', color: 'text-slate-400 bg-slate-50 dark:bg-slate-900/20' },
};

const CATEGORY_COLORS: Record<string, string> = {
  szja: 'bg-indigo-500',
  contrib: 'bg-violet-500',
  hipa: 'bg-teal-500',
  kata: 'bg-amber-500',
  afa: 'bg-cyan-500',
  car: 'bg-rose-500',
  egyeb: 'bg-slate-400',
};

const RETURN_TYPE_META: Record<string, { code: string; name: string; description: string; category: string }> = {
  szja: { code: 'SZJA', name: 'Személyi jövedelemadó bevallás', description: 'Éves SZJA bevallás az egyéni vállalkozók jövedelméről', category: 'szja' },
  contrib: { code: '2658', name: 'Járulékbevallás', description: 'Negyedéves társadalombiztosítási járulék bevallás', category: 'contrib' },
  '2658': { code: '2658', name: 'Járulékbevallás', description: 'Negyedéves társadalombiztosítási járulék bevallás', category: 'contrib' },
  hipa: { code: 'HIPA', name: 'HIPA bevallás', description: 'Helyi iparűzési adó bevallás', category: 'hipa' },
  kata: { code: 'KATA', name: 'KATA nyilatkozat', description: 'Kisadózó tételes adó nyilatkozat', category: 'kata' },
  afa: { code: '65A', name: 'ÁFA bevallás', description: 'Általános forgalmi adó bevallás', category: 'afa' },
  car: { code: 'CAR', name: 'Cégautóadó', description: 'Cégautóadó negyedéves bevallás', category: 'car' },
};

const CATEGORY_LABELS: Record<string, string> = {
  szja: 'SZJA',
  contrib: 'Járulék',
  hipa: 'HIPA',
  kata: 'KATA',
  afa: 'ÁFA',
  car: 'Cégautó',
  egyeb: 'Egyéb',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function resolveStatus(dbStatus: string, deadline: string | null): FormStatus {
  if (dbStatus === 'submitted' || dbStatus === 'accepted') return 'submitted';
  if (dbStatus === 'draft') {
    // check if overdue
    if (deadline && new Date(deadline) < new Date()) return 'overdue';
    return 'draft';
  }
  if (deadline && new Date(deadline) < new Date()) return 'overdue';
  return 'upcoming';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvFormsOverviewPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const taxYear = dateFrom.getFullYear();

  const setTaxYear = (year: number) => {
    setDateFrom(new Date(year, 0, 1));
    setDateTo(new Date(year, 11, 31));
  };

  // ─── Real data: portfolio-wide tax returns ────────────────────────────────
  const { data: allReturns, isLoading } = useAllEvTaxReturns(taxYear);

  // Group returns by (return_type + period_key) to aggregate across clients
  const forms = useMemo<AggregatedForm[]>(() => {
    if (!allReturns?.length) return [];

    const groupMap = new Map<string, {
      returnType: string;
      formCode: string;
      periodKey: string;
      deadline: string;
      totalClients: Set<string>;
      submittedClients: Set<string>;
      statuses: string[];
    }>();

    allReturns.forEach((r: any) => {
      const key = `${r.return_type}::${r.period_key || r.form_code || 'annual'}`;
      const existing = groupMap.get(key) || {
        returnType: r.return_type,
        formCode: r.form_code || '',
        periodKey: r.period_key || '',
        deadline: r.deadline || '',
        totalClients: new Set<string>(),
        submittedClients: new Set<string>(),
        statuses: [],
      };

      existing.totalClients.add(r.company_id);
      if (r.status === 'submitted' || r.status === 'accepted') {
        existing.submittedClients.add(r.company_id);
      }
      existing.statuses.push(r.status);

      // Keep the latest deadline
      if (r.deadline && (!existing.deadline || r.deadline > existing.deadline)) {
        existing.deadline = r.deadline;
      }

      groupMap.set(key, existing);
    });

    return Array.from(groupMap.entries()).map(([key, g]) => {
      const meta = RETURN_TYPE_META[g.returnType] || {
        code: g.formCode || g.returnType?.toUpperCase() || '?',
        name: g.returnType || 'Egyéb',
        description: '',
        category: 'egyeb',
      };

      const clientsAffected = g.totalClients.size;
      const clientsSubmitted = g.submittedClients.size;

      // Overall status: if all submitted => submitted, if any overdue => overdue, etc.
      let status: FormStatus;
      if (clientsSubmitted === clientsAffected && clientsAffected > 0) {
        status = 'submitted';
      } else if (g.statuses.some(s => resolveStatus(s, g.deadline) === 'overdue')) {
        status = 'overdue';
      } else if (g.statuses.some(s => s === 'draft')) {
        status = 'draft';
      } else {
        status = 'upcoming';
      }

      return {
        key,
        code: g.formCode || meta.code,
        name: meta.name,
        description: meta.description,
        period: g.periodKey || '-',
        deadline: g.deadline || '-',
        status,
        category: meta.category,
        clientsAffected,
        clientsSubmitted,
      };
    }).sort((a, b) => {
      // Sort: overdue first, then draft, then upcoming, then submitted
      const ORDER: Record<FormStatus, number> = { overdue: 0, draft: 1, upcoming: 2, submitted: 3, not_required: 4 };
      return (ORDER[a.status] ?? 5) - (ORDER[b.status] ?? 5);
    });
  }, [allReturns]);

  const filtered = useMemo(() => {
    return forms.filter(f => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase()) && !f.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      return true;
    });
  }, [forms, search, statusFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: forms.length,
    submitted: forms.filter(f => f.status === 'submitted').length,
    pending: forms.filter(f => f.status === 'draft' || f.status === 'upcoming').length,
    overdue: forms.filter(f => f.status === 'overdue').length,
  }), [forms]);

  // Determine which categories exist in real data for the filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set(forms.map(f => f.category));
    return Array.from(cats).sort();
  }, [forms]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/eaisybooks?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Nyomtatványok</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Nyomtatványok & Bevallások</h1>
            <p className="text-sm text-slate-500">NAV nyomtatványok, bevallási státuszok a teljes EV portfólióra</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes nyomtatvány</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : stats.total}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Benyújtott</p>
          <p className="text-2xl font-bold text-green-600">{isLoading ? '...' : stats.submitted}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Függőben</p>
          <p className="text-2xl font-bold text-amber-600">{isLoading ? '...' : stats.pending}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Lejárt</p>
          <p className="text-2xl font-bold text-red-600">{isLoading ? '...' : stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Nyomtatvány keresése..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-sm pl-9 pr-3 py-2 bg-card border border-border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/30 text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
        >
          <option value="all">Minden kategória</option>
          {availableCategories.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
        >
          <option value="all">Minden státusz</option>
          <option value="submitted">Benyújtott</option>
          <option value="draft">Vázlat</option>
          <option value="upcoming">Közelgő</option>
          <option value="overdue">Lejárt</option>
        </select>
        <select
          value={taxYear}
          onChange={e => ((y) => { setDateFrom(new Date(y, 0, 1)); setDateTo(new Date(y, 11, 31)); })(Number(e.target.value))}
          className="text-sm border border-border rounded-lg px-3 py-2 bg-card text-foreground"
        >
          <option value={2026}>2026</option>
          <option value={2025}>2025</option>
          <option value={2024}>2024</option>
        </select>
      </div>

      {/* Forms table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-indigo-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50/50 dark:bg-slate-800/30">
                  <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Nyomtatvány</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Időszak</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Határidő</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Státusz</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider">Ügyfelek</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-500 text-xs uppercase tracking-wider w-24">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(form => {
                  const statusCfg = STATUS_CONFIG[form.status];
                  const progress = form.clientsAffected > 0 ? (form.clientsSubmitted / form.clientsAffected) * 100 : 0;

                  return (
                    <tr key={form.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('w-1 h-10 rounded-full', CATEGORY_COLORS[form.category] || CATEGORY_COLORS.egyeb)} />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{form.code}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{form.name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{form.period}</span>
                      </td>
                      <td className="py-3 px-4">
                        {form.deadline !== '-' ? (
                          <span className="text-slate-700 dark:text-slate-300 font-mono text-xs tabular-nums">
                            {new Date(form.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold', statusCfg.color)}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {form.clientsAffected > 0 ? (
                          <div className="flex items-center gap-2 justify-end">
                            <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              {form.clientsSubmitted}/{form.clientsAffected}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600" title="Megtekintés">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-600" title="Letöltés">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nincs találat</p>
            <p className="text-xs mt-1">Módosítsd a szűrőket a kereséshez.</p>
          </div>
        )}
      </div>
    </div>
  );
}
