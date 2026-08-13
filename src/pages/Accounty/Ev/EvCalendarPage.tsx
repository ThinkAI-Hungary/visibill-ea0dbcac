import { useDateRange } from '@/contexts/DateRangeContext';
import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar, ArrowLeft, ChevronRight, Clock, CheckCircle2,
  AlertTriangle, XCircle, FileText, ChevronLeft,
  Filter, Download, Bell, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAllEvTaxReturns, type EvTaxReturn } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
  'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
];

const RETURN_TYPE_MAP: Record<string, { type: string; label: string }> = {
  szja: { type: 'szja', label: 'SZJA' },
  '2658': { type: 'járulék', label: 'Járulék' },
  hipa: { type: 'hipa', label: 'HIPA' },
  kata: { type: 'kata', label: 'KATA' },
  afa: { type: 'afa', label: 'ÁFA' },
};

const TYPE_LABELS: Record<string, string> = {
  szja: 'SZJA', 'járulék': 'Járulék', hipa: 'HIPA', kata: 'KATA', afa: 'ÁFA', egyeb: 'Egyéb'
};
const TYPE_COLORS: Record<string, string> = {
  szja: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
  'járulék': 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  hipa: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400',
  kata: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
  afa: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400',
  egyeb: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400',
};

type DeadlineStatus = 'done' | 'upcoming' | 'overdue' | 'warning';

const STATUS_ICON: Record<DeadlineStatus, React.ReactNode> = {
  done: <CheckCircle2 className="w-4 h-4 text-green-500" />,
  upcoming: <Clock className="w-4 h-4 text-blue-500" />,
  warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  overdue: <XCircle className="w-4 h-4 text-red-500" />,
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvCalendarPage() {
  const [searchParams] = useSearchParams();
  const { dateFrom, setDateFrom, setDateTo, dateFromFormatted, dateToFormatted } = useDateRange();
  const yearParam = dateFrom.getFullYear();
  const [selectedYear, setSelectedYear] = useState(yearParam);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // ─── Real data from Supabase ───────────────────────────────────────────────
  const { data: rawReturns, isLoading } = useAllEvTaxReturns(selectedYear);

  // Convert DB tax returns into calendar deadlines
  const deadlines = useMemo(() => {
    const now = new Date();
    return (rawReturns || []).map((r: any) => {
      const deadline = r.deadline ? new Date(r.deadline) : null;
      const typeInfo = RETURN_TYPE_MAP[r.return_type] || { type: 'egyeb', label: 'Egyéb' };
      
      let status: DeadlineStatus = 'upcoming';
      if (r.status === 'submitted' || r.status === 'accepted') {
        status = 'done';
      } else if (deadline) {
        const daysUntil = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntil < 0) status = 'overdue';
        else if (daysUntil < 14) status = 'warning';
      }

      const companyName = r.companies?.name || '';
      return {
        id: r.id,
        title: `${typeInfo.label} – ${r.form_code || r.return_type}${r.period_key ? ` (${r.period_key})` : ''}`,
        type: typeInfo.type,
        date: r.deadline || '',
        status,
        description: companyName ? `${companyName}` : (r.form_code || ''),
        clientCount: undefined as number | undefined,
      };
    }).filter(d => d.date); // only include items with a deadline
  }, [rawReturns]);

  const filtered = useMemo(() => {
    return deadlines.filter(d => {
      if (!d.date.startsWith(String(selectedYear))) return false;
      if (typeFilter !== 'all' && d.type !== typeFilter) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      return true;
    });
  }, [deadlines, selectedYear, typeFilter, statusFilter]);

  // Group by month
  type TaxDeadline = typeof deadlines[number];
  const byMonth = useMemo(() => {
    const map = new Map<number, TaxDeadline[]>();
    filtered.forEach(d => {
      const m = new Date(d.date).getMonth();
      if (!map.has(m)) map.set(m, []);
      map.get(m)!.push(d);
    });
    return map;
  }, [filtered]);

  const stats = useMemo(() => ({
    total: filtered.length,
    done: filtered.filter(d => d.status === 'done').length,
    upcoming: filtered.filter(d => d.status === 'upcoming' || d.status === 'warning').length,
    overdue: filtered.filter(d => d.status === 'overdue').length,
  }), [filtered]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/eaisybooks?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Adónaptár</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">EV Adónaptár</h1>
            <p className="text-sm text-slate-500">{selectedYear}. adóévi határidők és bevallási kötelezettségek</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums w-16 text-center">{selectedYear}</span>
          <button
            onClick={() => setSelectedYear(y => y + 1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes határidő</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Teljesített</p>
          <p className="text-2xl font-bold text-green-600">{stats.done}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Közelgő</p>
          <p className="text-2xl font-bold text-blue-600">{stats.upcoming}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Lejárt</p>
          <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-medium text-slate-500">Szűrés:</span>
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
        >
          <option value="all">Minden típus</option>
          <option value="szja">SZJA</option>
          <option value="jarulék">Járulék</option>
          <option value="hipa">HIPA</option>
          <option value="kata">KATA</option>
          <option value="afa">ÁFA</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground"
        >
          <option value="all">Minden státusz</option>
          <option value="done">Teljesített</option>
          <option value="upcoming">Közelgő</option>
          <option value="warning">Figyelmeztető</option>
          <option value="overdue">Lejárt</option>
        </select>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {Array.from({ length: 12 }).map((_, monthIdx) => {
          const items = byMonth.get(monthIdx) || [];
          const isCurrentMonth = new Date().getMonth() === monthIdx && new Date().getFullYear() === selectedYear;

          return (
            <div key={monthIdx} className="relative">
              {/* Month header */}
              <div className={cn(
                'flex items-center gap-3 mb-3',
                items.length === 0 && 'opacity-40'
              )}>
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0',
                  isCurrentMonth
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                )}>
                  {String(monthIdx + 1).padStart(2, '0')}
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-semibold',
                    isCurrentMonth ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-300'
                  )}>
                    {MONTH_NAMES[monthIdx]}
                    {isCurrentMonth && <span className="ml-2 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 px-1.5 py-0.5 rounded-full">AKTUÁLIS</span>}
                  </p>
                  <p className="text-xs text-slate-400">{items.length} határidő</p>
                </div>
              </div>

              {/* Items */}
              {items.length > 0 && (
                <div className="ml-5 pl-8 border-l-2 border-slate-200 dark:border-slate-700 space-y-2">
                  {items.map(item => (
                    <div
                      key={item.id}
                      className={cn(
                        'relative bg-card border border-border rounded-xl p-4 shadow-soft hover:shadow-md transition-all',
                        item.status === 'overdue' && 'border-red-200 dark:border-red-800/50',
                        item.status === 'warning' && 'border-amber-200 dark:border-amber-800/50'
                      )}
                    >
                      {/* Dot on timeline */}
                      <div className={cn(
                        'absolute -left-[calc(2rem+5px)] top-5 w-2.5 h-2.5 rounded-full border-2',
                        item.status === 'done' ? 'bg-green-500 border-green-200' :
                        item.status === 'overdue' ? 'bg-red-500 border-red-200' :
                        item.status === 'warning' ? 'bg-amber-500 border-amber-200' :
                        'bg-blue-500 border-blue-200'
                      )} />

                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {STATUS_ICON[item.status]}
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', TYPE_COLORS[item.type])}>
                                {TYPE_LABELS[item.type]}
                              </span>
                              {item.clientCount && (
                                <span className="text-[10px] text-slate-400">
                                  {item.clientCount} ügyfél érintett
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {new Date(item.date).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                          </p>
                          <p className={cn(
                            'text-[10px] font-medium mt-0.5',
                            item.status === 'done' ? 'text-green-600' :
                            item.status === 'overdue' ? 'text-red-600' :
                            item.status === 'warning' ? 'text-amber-600' :
                            'text-blue-600'
                          )}>
                            {item.status === 'done' ? 'Teljesítve' :
                             item.status === 'overdue' ? 'Lejárt!' :
                             item.status === 'warning' ? 'Hamarosan!' :
                             'Közelgő'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
