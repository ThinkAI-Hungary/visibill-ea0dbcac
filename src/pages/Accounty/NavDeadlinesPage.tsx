import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Clock, AlertTriangle, FileText, CreditCard, CheckCircle, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Deadline {
  id: string;
  date: string;
  day: number;
  title: string;
  type: 'nav_report' | 'nav_payment' | 'internal' | 'other';
  description: string;
  status: 'upcoming' | 'due_today' | 'overdue' | 'completed';
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  nav_report: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', icon: FileText },
  nav_payment: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', icon: CreditCard },
  internal: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: Clock },
  other: { color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: Calendar },
};

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
    ...(([0, 3, 6, 9].includes(m)) ? [
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
  const now = new Date();

  const grouped = useMemo(() => {
    const map = new Map<string, Deadline[]>();
    deadlines.forEach(d => {
      const month = d.date.substring(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(d);
    });
    map.forEach(v => v.sort((a, b) => a.day - b.day));
    return Array.from(map.entries());
  }, [deadlines]);

  const active = deadlines.filter(d => d.status !== 'completed').length;
  const overdue = deadlines.filter(d => d.status === 'overdue').length;
  const dueToday = deadlines.filter(d => d.status === 'due_today').length;

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

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {Object.entries(TYPE_CONFIG).map(([key, conf]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs text-slate-500">
            <div className={cn('w-2.5 h-2.5 rounded-full', conf.bg, 'border', key === 'nav_report' ? 'border-red-300' : key === 'nav_payment' ? 'border-orange-300' : key === 'internal' ? 'border-blue-300' : 'border-purple-300')} />
            {key === 'nav_report' ? 'NAV bevallás' : key === 'nav_payment' ? 'NAV befizetés' : key === 'internal' ? 'Belső' : 'Egyéb'}
          </div>
        ))}
      </div>

      {/* Timeline grouped by month */}
      {grouped.map(([monthKey, items]) => {
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
      })}
    </div>
  );
}
