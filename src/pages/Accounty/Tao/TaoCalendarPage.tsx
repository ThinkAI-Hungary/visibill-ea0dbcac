import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
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

const EVENTS_2025: CalendarEvent[] = [
  { date: '2025-01-20', type: 'advance', label: 'KIVA Q4 előleg (2024)', color: 'bg-yellow-500' },
  { date: '2025-04-20', type: 'advance', label: 'TAO Q1 előleg / KIVA Q1 előleg', color: 'bg-yellow-500' },
  { date: '2025-05-31', type: 'hipa', label: 'HIPA bevallás', color: 'bg-purple-500' },
  { date: '2025-06-01', type: 'tao', label: '2429 TAO bevallás (2024. adóévre)', color: 'bg-red-500' },
  { date: '2025-06-01', type: 'kiva', label: '2425 KIVA bevallás (2024. adóévre)', color: 'bg-orange-500' },
  { date: '2025-07-20', type: 'advance', label: 'TAO Q2 előleg / Inno járulék Q1', color: 'bg-yellow-500' },
  { date: '2025-10-20', type: 'advance', label: 'TAO Q3 előleg / Inno járulék Q2', color: 'bg-yellow-500' },
  { date: '2025-12-20', type: 'advance', label: 'TAO Q4 előleg / Inno járulék feltöltés', color: 'bg-yellow-500' },
];

const ALL_EVENTS: Record<number, CalendarEvent[]> = {
  2025: EVENTS_2025,
  2026: EVENTS_2026,
};

const COLOR_MAP: Record<string, { label: string; dot: string }> = {
  tao:     { label: 'TAO bevallás',   dot: 'bg-red-500' },
  kiva:    { label: 'KIVA bevallás',  dot: 'bg-orange-500' },
  hipa:    { label: 'HIPA bevallás',  dot: 'bg-purple-500' },
  advance: { label: 'Adóelőleg',      dot: 'bg-yellow-500' },
  pillar2: { label: 'Pillar Two',     dot: 'bg-blue-500' },
  tp:      { label: 'TP dokumentáció', dot: 'bg-green-500' },
};

const MONTH_NAMES = ['Január','Február','Március','Április','Május','Június','Július','Augusztus','Szeptember','Október','November','December'];
const Q_LABELS = ['Q1 (Jan–Már)', 'Q2 (Ápr–Jún)', 'Q3 (Júl–Szep)', 'Q4 (Okt–Dec)'];

export default function TaoCalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [year, setYear] = useState(2026);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3)); // 0-3

  const now = new Date();
  const events = ALL_EVENTS[year] || [];

  // Filter events based on view mode
  const filteredEvents = useMemo(() => {
    if (viewMode === 'month') {
      return events.filter(e => new Date(e.date).getMonth() === selectedMonth);
    }
    if (viewMode === 'quarter') {
      const qStart = selectedQuarter * 3;
      const qEnd = qStart + 2;
      return events.filter(e => {
        const m = new Date(e.date).getMonth();
        return m >= qStart && m <= qEnd;
      });
    }
    return events; // year + list show all
  }, [events, viewMode, selectedMonth, selectedQuarter]);

  const upcomingEvents = filteredEvents.filter(e => new Date(e.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pastEvents = filteredEvents.filter(e => new Date(e.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const renderEventRow = (ev: CalendarEvent, i: number, isPast: boolean) => {
    const date = new Date(ev.date);
    const daysLeft = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <div key={i} className={cn('flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors', isPast && 'opacity-60')}>
        <div className={cn('w-3 h-3 rounded-full shrink-0', ev.color)} />
        <div className="flex-1">
          <p className={cn('text-sm font-medium', isPast ? 'text-slate-500' : 'text-slate-900 dark:text-slate-100')}>{ev.label}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
            {date.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          {!isPast && (
            <p className={cn('text-xs', daysLeft <= 14 ? 'text-red-600 font-bold' : 'text-slate-400')}>
              {daysLeft} nap
            </p>
          )}
        </div>
      </div>
    );
  };

  // Year view: show months as grid with event dots
  const renderYearView = () => (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
      {MONTH_NAMES.map((name, mi) => {
        const monthEvents = events.filter(e => new Date(e.date).getMonth() === mi);
        const isCurrentMonth = year === now.getFullYear() && mi === now.getMonth();
        return (
          <button
            key={mi}
            onClick={() => { setSelectedMonth(mi); setViewMode('month'); }}
            className={cn(
              'bg-card rounded-xl border p-4 text-left hover:shadow-md transition-all',
              isCurrentMonth ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-border hover:border-primary/30'
            )}
          >
            <p className={cn('text-sm font-bold mb-2', isCurrentMonth ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300')}>
              {name}
            </p>
            {monthEvents.length === 0 ? (
              <p className="text-[10px] text-slate-400">Nincs esemény</p>
            ) : (
              <div className="space-y-1">
                {monthEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', ev.color)} />
                    <span className="text-[10px] text-slate-500 truncate">{ev.label}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );

  // Quarter view: 4 columns
  const renderQuarterView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Q_LABELS.map((qLabel, qi) => {
        const qStart = qi * 3;
        const qEnd = qStart + 2;
        const qEvents = events.filter(e => {
          const m = new Date(e.date).getMonth();
          return m >= qStart && m <= qEnd;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const isCurrentQ = year === now.getFullYear() && qi === Math.floor(now.getMonth() / 3);
        return (
          <div
            key={qi}
            className={cn(
              'bg-card rounded-xl border p-4',
              isCurrentQ ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-border'
            )}
          >
            <p className={cn('text-sm font-bold mb-3', isCurrentQ ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-300')}>
              {qLabel}
            </p>
            {qEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nincs határidő</p>
            ) : (
              <div className="space-y-2">
                {qEvents.map((ev, i) => {
                  const date = new Date(ev.date);
                  const isPast = date < now;
                  return (
                    <div key={i} className={cn('flex items-start gap-2', isPast && 'opacity-50')}>
                      <div className={cn('w-2.5 h-2.5 rounded-full shrink-0 mt-1', ev.color)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ev.label}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {date.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Month view: detailed list for selected month
  const renderMonthView = () => {
    const monthEvents = events
      .filter(e => new Date(e.date).getMonth() === selectedMonth)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return (
      <div className="space-y-4">
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedMonth(m => Math.max(0, m - 1))} disabled={selectedMonth === 0}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold px-3 min-w-[120px] text-center">{MONTH_NAMES[selectedMonth]}</span>
          <Button variant="outline" size="sm" onClick={() => setSelectedMonth(m => Math.min(11, m + 1))} disabled={selectedMonth === 11}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          {monthEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nincs határidő ebben a hónapban</div>
          ) : (
            <div className="divide-y divide-border/50">
              {monthEvents.map((ev, i) => renderEventRow(ev, i, new Date(ev.date) < now))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // List view: upcoming + past
  const renderListView = () => (
    <div className="space-y-4">
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
        <div className="px-4 py-3 border-b border-border dark:bg-slate-900/30">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Közelgő határidők</h2>
        </div>
        <div className="divide-y divide-border/50">
          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">Nincs közelgő határidő</div>
          ) : (
            upcomingEvents.map((ev, i) => renderEventRow(ev, i, false))
          )}
        </div>
      </div>
      {pastEvents.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
          <div className="px-4 py-3 border-b border-border dark:bg-slate-900/30">
            <h2 className="text-sm font-bold text-slate-400">Lejárt határidők</h2>
          </div>
          <div className="divide-y divide-border/50">
            {pastEvents.map((ev, i) => renderEventRow(ev, i, true))}
          </div>
        </div>
      )}
    </div>
  );

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
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                viewMode === v ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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

      {/* Content based on viewMode */}
      {viewMode === 'year' && renderYearView()}
      {viewMode === 'quarter' && renderQuarterView()}
      {viewMode === 'month' && renderMonthView()}
      {viewMode === 'list' && renderListView()}
    </div>
  );
}
