import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, AlertTriangle, FileText, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ViewMode = 'year' | 'quarter' | 'month' | 'list';

interface CalendarEvent {
  date: string;
  type: 'tao' | 'kiva' | 'hipa' | 'advance' | 'pillar2' | 'tp';
  label: string;
  color: string;
}

const EVENTS_2026: CalendarEvent[] = [
  { date: '2026-01-20', type: 'advance', label: 'KIVA Q4 előleg', color: 'bg-yellow-500' },
  { date: '2026-04-20', type: 'advance', label: 'TAO Q1 előleg / KIVA Q1 előleg', color: 'bg-yellow-500' },
  { date: '2026-05-31', type: 'hipa', label: 'HIPA bevallás', color: 'bg-purple-500' },
  { date: '2026-06-01', type: 'tao', label: '2529 TAO bevallás (2025. adóévre)', color: 'bg-red-500' },
  { date: '2026-06-01', type: 'kiva', label: '2525 KIVA bevallás (2025. adóévre)', color: 'bg-orange-500' },
  { date: '2026-06-30', type: 'pillar2', label: 'GIR/TTIR bevallás (2024. évre)', color: 'bg-blue-500' },
  { date: '2026-06-30', type: 'tp', label: 'TP dokumentáció (bevallásig)', color: 'bg-green-500' },
  { date: '2026-07-20', type: 'advance', label: 'TAO Q2 előleg / Inno járulék Q1', color: 'bg-yellow-500' },
  { date: '2026-10-20', type: 'advance', label: 'TAO Q3 előleg / Inno járulék Q2', color: 'bg-yellow-500' },
  { date: '2026-12-20', type: 'advance', label: 'TAO Q4 előleg / Inno járulék feltöltés', color: 'bg-yellow-500' },
];

const COLOR_MAP: Record<string, { label: string; dot: string }> = {
  tao:     { label: 'TAO bevallás',   dot: 'bg-red-500' },
  kiva:    { label: 'KIVA bevallás',  dot: 'bg-orange-500' },
  hipa:    { label: 'HIPA bevallás',  dot: 'bg-purple-500' },
  advance: { label: 'Adóelőleg',      dot: 'bg-yellow-500' },
  pillar2: { label: 'Pillar Two',     dot: 'bg-blue-500' },
  tp:      { label: 'TP dokumentáció', dot: 'bg-green-500' },
};

export default function TaoCalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [year, setYear] = useState(2026);

  const now = new Date();
  const upcomingEvents = EVENTS_2026.filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = EVENTS_2026.filter(e => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">TAO-zárási Kalendárium</h1>
            <p className="text-sm text-slate-500">TAO, KIVA, HIPA, Inno, Pillar Two határidők</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setYear(y => y - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-bold px-3">{year}</span>
          <Button variant="outline" size="sm" onClick={() => setYear(y => y + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* View toggle + Legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-0.5">
          {(['year', 'quarter', 'month', 'list'] as ViewMode[]).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize',
                viewMode === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500'
              )}
            >
              {{ year: 'Év', quarter: 'Negyedév', month: 'Hónap', list: 'Lista' }[v]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          {Object.entries(COLOR_MAP).map(([key, val]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', val.dot)} />
              <span className="text-[10px] text-slate-500">{val.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Közelgő határidők</h2>
        </div>
        <div className="divide-y divide-border/50">
          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nincs közelgő határidő</div>
          ) : (
            upcomingEvents.map((ev, i) => {
              const date = new Date(ev.date);
              const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={i} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn('w-3 h-3 rounded-full shrink-0', ev.color)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{ev.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                      {date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <p className={cn('text-xs', daysLeft <= 14 ? 'text-red-600 font-bold' : 'text-slate-400')}>
                      {daysLeft} nap
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Past */}
      {pastEvents.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-400">Lejárt határidők</h2>
          </div>
          <div className="divide-y divide-border/50">
            {pastEvents.map((ev, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2.5 opacity-60">
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', ev.color)} />
                <p className="text-sm text-slate-500 flex-1">{ev.label}</p>
                <p className="text-xs font-mono text-slate-400">{new Date(ev.date).toLocaleDateString('hu-HU')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
