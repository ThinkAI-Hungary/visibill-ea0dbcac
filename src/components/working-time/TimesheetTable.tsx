import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  Palmtree,
} from 'lucide-react';
import { format, parseISO, isSameMonth } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { TimeEntry } from '@/lib/payrollUtils';
import { cn } from '@/lib/utils';

interface TimesheetTableProps {
  timeEntries: TimeEntry[];
  monthDate: Date;
  workStartTime: string;   // e.g. "08:00"
  workEndTime: string;      // e.g. "16:30"
  projectNames: Record<string, string>;
}

const STATUS_CONFIG = {
  draft: {
    label: 'Piszkozat',
    className: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
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

type SortDir = 'asc' | 'desc';

/**
 * Calculate end time by adding hours to a start time string (HH:mm).
 */
function addHoursToTime(start: string, hours: number): string {
  const [h, m] = start.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = Math.round(totalMinutes % 60);
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

export function TimesheetTable({
  timeEntries,
  monthDate,
  workStartTime,
  workEndTime,
  projectNames,
}: TimesheetTableProps) {
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Filter to current month only
  const monthEntries = useMemo(() => {
    return timeEntries
      .filter((e) => {
        const d = parseISO(e.date);
        return isSameMonth(d, monthDate);
      })
      .sort((a, b) => {
        const cmp = a.date.localeCompare(b.date);
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [timeEntries, monthDate, sortDir]);

  const totalHours = monthEntries.reduce((s, e) => s + Number(e.hours), 0);

  const toggleSort = () => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));

  if (monthEntries.length === 0) {
    return (
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-full bg-muted">
            <ClipboardList className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">Nincs bejegyzés</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Ebben a hónapban még nincs rögzített munkaidő.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 -ml-2 gap-1 text-xs font-semibold uppercase tracking-wider"
                  onClick={toggleSort}
                >
                  Dátum
                  {sortDir === 'asc' ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                </Button>
              </TableHead>
              <TableHead className="w-[100px] text-center">Kezdete</TableHead>
              <TableHead className="w-[100px] text-center">Vége</TableHead>
              <TableHead className="w-[80px] text-right">Órák</TableHead>
              <TableHead className="min-w-[120px]">Projekt</TableHead>
              <TableHead className="min-w-[100px]">Megjegyzés</TableHead>
              <TableHead className="w-[110px] text-center">Státusz</TableHead>
              <TableHead className="w-[140px] text-center">Jóváhagyva</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthEntries.map((entry) => {
              const statusCfg = STATUS_CONFIG[entry.status];
              const isAbsence = !!entry.absence_type;
              const startTime = isAbsence ? '—' : workStartTime;
              const endTime = isAbsence
                ? '—'
                : addHoursToTime(workStartTime, Number(entry.hours));
              const approvedDate =
                entry.status === 'approved' && entry.updated_at
                  ? format(parseISO(entry.updated_at), 'yyyy.MM.dd. HH:mm')
                  : null;
              const projName = entry.project_id ? projectNames[entry.project_id] || '—' : null;

              return (
                <TableRow
                  key={entry.id}
                  className={cn(
                    'text-sm',
                    isAbsence && 'bg-amber-500/5'
                  )}
                >
                  {/* Date */}
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {isAbsence && <Palmtree className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                      {format(parseISO(entry.date), 'yyyy.MM.dd. (EEEE)', { locale: hu })}
                    </div>
                  </TableCell>

                  {/* Start */}
                  <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
                    {startTime}
                  </TableCell>

                  {/* End */}
                  <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
                    {endTime}
                  </TableCell>

                  {/* Hours */}
                  <TableCell className="text-right font-mono font-semibold tabular-nums">
                    {entry.hours} óra
                  </TableCell>

                  {/* Project */}
                  <TableCell className="text-muted-foreground truncate max-w-[160px]">
                    {isAbsence ? (
                      <span className="text-amber-500 text-xs font-medium">Szabadság</span>
                    ) : (
                      projName || '—'
                    )}
                  </TableCell>

                  {/* Description */}
                  <TableCell className="text-muted-foreground text-xs italic truncate max-w-[180px]">
                    {entry.description || '—'}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center">
                    <Badge variant="outline" className={cn('text-[10px]', statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>

                  {/* Approved date */}
                  <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                    {approvedDate || '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell>Összesen</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right font-mono tabular-nums text-primary">
                {totalHours} óra
              </TableCell>
              <TableCell colSpan={4}>
                <span className="text-muted-foreground font-normal text-xs">
                  {monthEntries.length} bejegyzés •{' '}
                  {format(monthDate, 'yyyy. MMMM', { locale: hu })}
                </span>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </CardContent>
    </Card>
  );
}
