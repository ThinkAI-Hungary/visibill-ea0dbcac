import React, { useState, useMemo } from 'react';
import { Clock, FileText, CreditCard, CheckCircle, Calendar, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface Deadline {
  id: string;
  date: string;
  day: number;
  title: string;
  type: 'nav_report' | 'nav_payment' | 'internal' | 'other';
  description: string;
  status: 'upcoming' | 'due_today' | 'overdue' | 'completed';
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; dotBorder: string }> = {
  nav_report:  { label: 'NAV bevallás',  color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-900/20',    icon: FileText,   dotBorder: 'border-red-300 dark:border-red-700' },
  nav_payment: { label: 'NAV befizetés', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: CreditCard, dotBorder: 'border-orange-300 dark:border-orange-700' },
  internal:    { label: 'Belső',         color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   icon: Clock,      dotBorder: 'border-blue-300 dark:border-blue-700' },
  other:       { label: 'Egyéb',         color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Calendar, dotBorder: 'border-purple-300 dark:border-purple-700' },
};

const STATUS_OPTIONS = [
  { value: 'all',       label: 'Mind' },
  { value: 'upcoming',  label: 'Közelgő' },
  { value: 'due_today', label: 'Ma esedékes' },
  { value: 'overdue',   label: 'Lejárt' },
  { value: 'completed', label: 'Teljesítve' },
];

function generateDeadlines(): Deadline[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const deadlines: Deadline[] = [
    // Current month
    { id: '1', date: `${y}.${String(m + 1).padStart(2, '0')}.12`, day: 12, title: '2608 Havi járulékbevallás', type: 'nav_report', description: 'Foglalkoztatottak TB- és SZJA-járulék bevallása a NAV felé', status: now.getDate() > 12 ? 'completed' : now.getDate() === 12 ? 'due_today' : 'upcoming' },
    { id: '2', date: `${y}.${String(m + 1).padStart(2, '0')}.12`, day: 12, title: 'SZOCHO befizetés', type: 'nav_payment', description: 'Szociális hozzájárulási adó befizetési határidő', status: now.getDate() > 12 ? 'completed' : now.getDate() === 12 ? 'due_today' : 'upcoming' },
    { id: '3', date: `${y}.${String(m + 1).padStart(2, '0')}.10`, day: 10, title: 'Bér-utalási határidő', type: 'internal', description: 'Az aktuális havi bérek utalási határideje', status: now.getDate() > 10 ? 'completed' : now.getDate() === 10 ? 'due_today' : 'upcoming' },
    { id: '4', date: `${y}.${String(m + 1).padStart(2, '0')}.20`, day: 20, title: 'ÁFA bevallás (havi)', type: 'nav_report', description: 'Havi ÁFA-bevallás beadási határidő (havi bevalló cégek)', status: now.getDate() > 20 ? 'completed' : 'upcoming' },
    { id: '5', date: `${y}.${String(m + 1).padStart(2, '0')}.20`, day: 20, title: 'Előleg befizetés', type: 'nav_payment', description: 'SZJA-előleg és TB-járulék befizetés', status: now.getDate() > 20 ? 'completed' : 'upcoming' },
    // Quarterly
    ...([0, 3, 6, 9].includes(m) ? [
      { id: '6', date: `${y}.${String(m + 1).padStart(2, '0')}.20`, day: 20, title: '2658 EV negyedéves járulékbevallás', type: 'nav_report' as const, description: 'Egyéni vállalkozók negyedéves TB-járulék bevallása', status: 'upcoming' as const },
    ] : []),
    // Next month
    { id: '7', date: `${y}.${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}.12`, day: 12, title: '2608 Havi járulékbevallás (következő hó)', type: 'nav_report', description: 'Következő hónapra esedékes bevallás', status: 'upcoming' },
    { id: '8', date: `${y}.${String(m + 2 > 12 ? 1 : m + 2).padStart(2, '0')}.10`, day: 10, title: 'Bér-utalási határidő (következő hó)', type: 'internal', description: 'Következő havi bérek utalási határideje', status: 'upcoming' },
    // Annual
    ...(m === 0 ? [
      { id: '9', date: `${y}.01.31`, day: 31, title: '26M30 Munkáltatói éves összesítő', type: 'nav_report' as const, description: 'M30 igazolások kiküldése és NAV felé beadás', status: 'upcoming' as const },
    ] : []),
    ...(m === 2 ? [
      { id: '10', date: `${y}.03.31`, day: 31, title: 'Kamarai hozzájárulás', type: 'other' as const, description: '5 000 Ft/fő kamarai hozzájárulás befizetése', status: 'upcoming' as const },
    ] : []),
  ];

  return deadlines;
}

export default function NavDeadlinesPage() {
  const deadlines = useMemo(generateDeadlines, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(['nav_report', 'nav_payment', 'internal', 'other']));
  const [statusFilter, setStatusFilter] = useState('all');

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return deadlines.filter(d => {
      if (!activeTypes.has(d.type)) return false;
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [deadlines, activeTypes, statusFilter, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    filtered.forEach(d => {
      const month = d.date.substring(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(d);
    });
    map.forEach(v => v.sort((a, b) => a.day - b.day));
    return Array.from(map.entries());
  }, [filtered]);

  const active = filtered.filter(d => d.status !== 'completed').length;
  const overdue = filtered.filter(d => d.status === 'overdue').length;
  const dueToday = filtered.filter(d => d.status === 'due_today').length;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg shadow-red-500/25">
          <Clock className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NAV határidők</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bejelentési, bevallási és befizetési naptár</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Aktív határidők</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{active}</p>
        </div>
        <div className={cn('rounded-xl border p-4', dueToday > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : 'bg-card border-border shadow-soft')}>
          <p className="text-xs text-amber-600 mb-1">Ma esedékes</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{dueToday}</p>
        </div>
        <div className={cn('rounded-xl border p-4', overdue > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-card border-border shadow-soft')}>
          <p className="text-xs text-red-600 mb-1">Lejárt</p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdue}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés határidők..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border h-9 text-sm"
          />
        </div>

        {/* Type filter pills */}
        <div className="flex gap-1.5">
          {Object.entries(TYPE_CONFIG).map(([key, conf]) => {
            const isActive = activeTypes.has(key);
            const count = deadlines.filter(d => d.type === key).length;
            return (
              <button
                key={key}
                onClick={() => toggleType(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                  isActive
                    ? cn(conf.bg, conf.color, conf.dotBorder)
                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                )}
              >
                <div className={cn(
                  'w-2 h-2 rounded-full transition-all',
                  isActive ? conf.bg + ' border ' + conf.dotBorder : 'bg-slate-300 dark:bg-slate-600'
                )} />
                {conf.label}
                <span className={cn(
                  'ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                  isActive ? 'bg-white/60 dark:bg-black/20' : 'bg-slate-200 dark:bg-slate-700'
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5 ml-auto">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap',
                statusFilter === opt.value
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results info */}
      {(searchQuery || statusFilter !== 'all' || activeTypes.size < 4) && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            <Filter className="w-3 h-3 inline mr-1" />
            {filtered.length} / {deadlines.length} határidő
          </p>
          <button
            onClick={() => { setSearchQuery(''); setStatusFilter('all'); setActiveTypes(new Set(['nav_report', 'nav_payment', 'internal', 'other'])); }}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Szűrők törlése
          </button>
        </div>
      )}

      {/* Timeline grouped by month */}
      {grouped.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center shadow-soft">
          <Clock className="w-10 h-10 mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">Nincs találat a szűrőkkel</p>
        </div>
      ) : (
        grouped.map(([monthKey, items]) => {
          const [y, m] = monthKey.split('.');
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' });
          return (
            <div key={monthKey} className="space-y-3">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{monthName}</h2>
              {items.map(deadline => {
                const conf = TYPE_CONFIG[deadline.type] || TYPE_CONFIG.other;
                const Icon = conf.icon;
                const isCompleted = deadline.status === 'completed';
                const isDueToday = deadline.status === 'due_today';
                return (
                  <div
                    key={deadline.id}
                    className={cn(
                      'bg-card rounded-xl border p-4 transition-all hover:shadow-md',
                      isCompleted ? 'border-green-200 dark:border-green-800/50 opacity-60' :
                      isDueToday ? 'border-amber-300 dark:border-amber-700 shadow-md shadow-amber-500/10' :
                      'border-border shadow-soft'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Day */}
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0',
                        isDueToday ? 'bg-amber-100 dark:bg-amber-900/40' :
                        isCompleted ? 'bg-green-100 dark:bg-green-900/40' :
                        conf.bg
                      )}>
                        <span className={cn('text-lg font-bold leading-none', isDueToday ? 'text-amber-600' : isCompleted ? 'text-green-600' : conf.color)}>
                          {deadline.day}
                        </span>
                        <span className="text-[9px] text-slate-400 uppercase">{new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('hu-HU', { month: 'short' })}</span>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Icon className={cn('w-3.5 h-3.5', conf.color)} />
                          <h3 className={cn('text-sm font-bold', isCompleted ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-900 dark:text-slate-100')}>
                            {deadline.title}
                          </h3>
                          {isDueToday && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 animate-pulse">
                              MA
                            </span>
                          )}
                          {isCompleted && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{deadline.description}</p>
                      </div>
                      {/* Date */}
                      <span className="text-xs text-slate-400 font-mono shrink-0">{deadline.date}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
