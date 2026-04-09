import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Send,
  Clock,
  Trash2,
  FolderOpen,
  Palmtree,
  X,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isToday,
  isSameMonth,
  addMonths,
  parseISO,
  setMonth as setDateMonth,
  setYear as setDateYear,
  getMonth,
  getYear,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import type { TimeEntry } from '@/lib/payrollUtils';
import { cn } from '@/lib/utils';

interface MonthlyTimesheetViewProps {
  timeEntries: TimeEntry[];
  projectNames: Record<string, string>;
  monthDate: Date;
  onMonthChange: (date: Date) => void;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  onSubmitMonth: () => void;
  isSubmitting: boolean;
}

const STATUS_CONFIG = {
  draft: {
    label: 'Piszkozat',
    className: 'bg-muted text-muted-foreground',
  },
  submitted: {
    label: 'Leadva',
    className: 'bg-blue-500/15 text-blue-500 border-blue-500/20',
  },
  approved: {
    label: 'Jóváhagyva',
    className: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  },
} as const;

const WEEKDAY_HEADERS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V'];

export function MonthlyTimesheetView({
  timeEntries,
  projectNames,
  monthDate,
  onMonthChange,
  selectedDate,
  onSelectDate,
  onDelete,
  isDeleting,
  onSubmitMonth,
  isSubmitting,
}: MonthlyTimesheetViewProps) {
  const [popupDate, setPopupDate] = useState<string | null>(null);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  // Group entries by day
  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimeEntry[]>();
    timeEntries.forEach((entry) => {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    });
    return map;
  }, [timeEntries]);

  // Daily totals
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    entriesByDay.forEach((entries, date) => {
      totals.set(
        date,
        entries.reduce((sum, e) => sum + Number(e.hours), 0)
      );
    });
    return totals;
  }, [entriesByDay]);

  // Monthly total
  const monthlyTotal = useMemo(() => {
    let total = 0;
    entriesByDay.forEach((entries, date) => {
      const d = new Date(date + 'T00:00:00');
      if (isSameMonth(d, monthDate)) {
        total += entries.reduce((sum, e) => sum + Number(e.hours), 0);
      }
    });
    return total;
  }, [entriesByDay, monthDate]);

  const hasDraftEntries = timeEntries.some((e) => e.status === 'draft');

  // Split into weeks — always render 6 rows for consistent height
  const weeks: Date[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }
  // Pad to 6 weeks if needed
  while (weeks.length < 6) {
    const lastDay = weeks[weeks.length - 1][6];
    const nextWeekStart = new Date(lastDay);
    nextWeekStart.setDate(nextWeekStart.getDate() + 1);
    const nextWeek: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(nextWeekStart);
      day.setDate(day.getDate() + d);
      nextWeek.push(day);
    }
    weeks.push(nextWeek);
  }

  // Popup entries
  const popupEntries = popupDate ? entriesByDay.get(popupDate) || [] : [];
  const popupTotal = popupDate ? dailyTotals.get(popupDate) || 0 : 0;

  const handleDayClick = (dateKey: string, inMonth: boolean) => {
    if (!inMonth) return;
    onSelectDate(dateKey);
    const entries = entriesByDay.get(dateKey) || [];
    if (entries.length > 0) {
      setPopupDate(dateKey);
    }
  };

  return (
    <>
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Havi összesítő</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onMonthChange(addMonths(monthDate, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={String(getYear(monthDate))}
                onValueChange={(v) => onMonthChange(setDateYear(monthDate, parseInt(v)))}
              >
                <SelectTrigger className="h-8 w-[80px] text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => getYear(new Date()) - 2 + i).map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(getMonth(monthDate))}
                onValueChange={(v) => onMonthChange(setDateMonth(monthDate, parseInt(v)))}
              >
                <SelectTrigger className="h-8 w-[120px] text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'Január', 'Február', 'Március', 'Április',
                    'Május', 'Június', 'Július', 'Augusztus',
                    'Szeptember', 'Október', 'November', 'December',
                  ].map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => onMonthChange(addMonths(monthDate, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              {hasDraftEntries && (
                <Button
                  size="sm"
                  onClick={onSubmitMonth}
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {isSubmitting ? 'Leadás...' : 'Hónap leadása'}
                </Button>
              )}
            </div>
          </div>

          {/* Weekday headers + Calendar grid in fixed-height container */}
          <div style={{ minHeight: 564 }}>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_HEADERS.map((name, idx) => (
              <div
                key={name}
                className={cn(
                  'text-center text-xs font-semibold uppercase py-1',
                  idx >= 5
                    ? 'text-muted-foreground/50'
                    : 'text-muted-foreground'
                )}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1 mb-1">
              {week.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const entries = entriesByDay.get(dateKey) || [];
                const total = dailyTotals.get(dateKey) || 0;
                const isSelected = dateKey === selectedDate;
                const isCurrentDay = isToday(day);
                const inMonth = isSameMonth(day, monthDate);
                const dayOfWeek = day.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                // Collect unique project names for this day
                const dayProjects = [
                  ...new Set(
                    entries
                      .filter((e) => !e.absence_type)
                      .map((e) =>
                        e.project_id ? projectNames[e.project_id] : null
                      )
                      .filter(Boolean)
                  ),
                ];
                const hasAbsence = entries.some((e) => e.absence_type);

                // Determine dominant status for color coding
                const statuses = entries.map((e) => e.status);
                const hasEntries = entries.length > 0;
                const allApproved =
                  hasEntries && statuses.every((s) => s === 'approved');
                const someSubmitted = statuses.some((s) => s === 'submitted');
                const allDraft =
                  hasEntries && statuses.every((s) => s === 'draft');

                // Color: green=approved, blue=submitted, gray=draft
                const statusColor = allApproved
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : someSubmitted
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : allDraft
                  ? 'bg-muted/60 border-border/50'
                  : '';

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      'rounded-lg border p-2 cursor-pointer transition-all min-h-[80px] flex flex-col',
                      !inMonth && 'opacity-30 pointer-events-none',
                      isSelected
                        ? 'border-primary ring-1 ring-primary/20 bg-primary/5'
                        : isCurrentDay && !hasEntries
                        ? 'border-primary/40 bg-primary/[0.02]'
                        : hasEntries
                        ? statusColor
                        : isWeekend
                        ? 'border-border/30 bg-muted/30'
                        : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                    )}
                    onClick={() => handleDayClick(dateKey, inMonth)}
                  >
                    {/* Day number + hours text */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          isCurrentDay && 'text-primary font-bold',
                          !inMonth && 'text-muted-foreground/50'
                        )}
                      >
                        {format(day, 'd.')}
                      </span>
                      {total > 0 && (
                        <span
                          className={cn(
                            'text-[10px] font-mono font-semibold tabular-nums',
                            allApproved
                              ? 'text-emerald-500'
                              : someSubmitted
                              ? 'text-blue-500'
                              : 'text-muted-foreground'
                          )}
                        >
                          {total}h
                        </span>
                      )}
                    </div>

                    {/* Compact: just project names */}
                    <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                      {entries.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                          <span className="text-[10px] text-muted-foreground/30">
                            —
                          </span>
                        </div>
                      ) : (
                        <>
                          {hasAbsence && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-500 truncate">
                              <Palmtree className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">Szabadság</span>
                            </div>
                          )}
                          {dayProjects.slice(0, hasAbsence ? 2 : 3).map((name) => (
                            <div
                              key={name}
                              className="flex items-center gap-1 text-[10px] text-muted-foreground truncate"
                            >
                              <FolderOpen className="h-2.5 w-2.5 shrink-0 text-primary/60" />
                              <span className="truncate">{name}</span>
                            </div>
                          ))}
                          {dayProjects.length > (hasAbsence ? 2 : 3) && (
                            <span className="text-[9px] text-muted-foreground/60 text-center">
                              +{dayProjects.length - (hasAbsence ? 2 : 3)} projekt
                            </span>
                          )}
                          {dayProjects.length === 0 && !hasAbsence && entries.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5 shrink-0" />
                              <span>{total}h rögzítve</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          </div>
        </CardContent>
      </Card>

      {/* Day detail popup */}
      <Dialog
        open={!!popupDate}
        onOpenChange={(open) => !open && setPopupDate(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {popupDate &&
                format(parseISO(popupDate), 'yyyy. MMMM d. (EEEE)', {
                  locale: hu,
                })}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Summary */}
            <div className="flex items-center justify-between text-sm px-1">
              <span className="text-muted-foreground">
                {popupEntries.length} bejegyzés
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'tabular-nums',
                  popupTotal >= 8
                    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/15 text-amber-600 border-amber-500/20'
                )}
              >
                Összesen: {popupTotal}h
              </Badge>
            </div>

            {/* Entry list */}
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {popupEntries.map((entry) => {
                const statusCfg = STATUS_CONFIG[entry.status];
                const projName = entry.project_id
                  ? projectNames[entry.project_id]
                  : null;
                const canDelete =
                  entry.status === 'draft' || entry.status === 'submitted';
                const isAbsence = !!entry.absence_type;

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'rounded-lg border border-border/50 p-3 space-y-2',
                      isAbsence
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-secondary/20'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isAbsence ? (
                          <Palmtree className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-mono font-bold text-lg tabular-nums">
                          {entry.hours}h
                        </span>
                        {isAbsence && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-amber-500/15 text-amber-500 border-amber-500/20"
                          >
                            Szabadság
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', statusCfg.className)}
                        >
                          {statusCfg.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => {
                            onDelete(entry.id);
                            if (popupEntries.length <= 1) {
                              setPopupDate(null);
                            }
                          }}
                          disabled={isDeleting}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {projName && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                        <span>{projName}</span>
                      </div>
                    )}

                    {entry.description && (
                      <p className="text-sm text-muted-foreground/80 italic pl-5">
                        {entry.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
