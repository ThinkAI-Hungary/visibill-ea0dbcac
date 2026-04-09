import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isWeekend,
  isSameMonth,
  format,
} from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  CalendarCheck,
  Timer,
  Target,
  AlertTriangle,
} from 'lucide-react';
import type { TimeEntry } from '@/lib/payrollUtils';

interface MonthlyBalanceProps {
  /** Reference date for the month */
  monthDate: Date;
  /** All time entries for this month */
  timeEntries: TimeEntry[];
  /** Daily work hours norm (default 8) */
  dailyHours?: number;
}

/**
 * Calculates business days in a given month (Mon-Fri only).
 * In the future this could also exclude Hungarian public holidays.
 */
function getBusinessDaysInMonth(monthDate: Date): number {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start, end });
  return days.filter((d) => !isWeekend(d)).length;
}

export function MonthlyBalanceCard({
  monthDate,
  timeEntries,
  dailyHours = 8,
}: MonthlyBalanceProps) {
  const stats = useMemo(() => {
    const businessDays = getBusinessDaysInMonth(monthDate);
    const requiredHours = businessDays * dailyHours;

    // Only count entries that belong to this month
    const monthEntries = timeEntries.filter((e) => {
      const d = new Date(e.date + 'T00:00:00');
      return isSameMonth(d, monthDate);
    });

    const totalWorked = monthEntries.reduce(
      (sum, e) => sum + Number(e.hours),
      0
    );

    const draftHours = monthEntries
      .filter((e) => e.status === 'draft')
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const submittedHours = monthEntries
      .filter((e) => e.status === 'submitted')
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const approvedHours = monthEntries
      .filter((e) => e.status === 'approved')
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const balance = totalWorked - requiredHours;
    const progressPercent = Math.min(
      Math.round((totalWorked / requiredHours) * 100),
      100
    );
    const remaining = Math.max(requiredHours - totalWorked, 0);
    const overtime = Math.max(totalWorked - requiredHours, 0);

    // Count unique worked days this month
    const workedDays = new Set(monthEntries.map((e) => e.date)).size;

    return {
      businessDays,
      requiredHours,
      totalWorked,
      draftHours,
      submittedHours,
      approvedHours,
      balance,
      progressPercent,
      remaining,
      overtime,
      workedDays,
    };
  }, [monthDate, timeEntries, dailyHours]);

  const isOvertime = stats.balance > 0;
  const isDeficit = stats.balance < 0;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-4">
      {/* Title */}
      <div className="flex items-center gap-2">
        <Timer className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">
          {format(monthDate, 'MMMM', { locale: hu })} összesítő
        </h3>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {stats.totalWorked} óra / {stats.requiredHours} óra
          </span>
          <span
            className={cn(
              'font-medium tabular-nums',
              isOvertime && 'text-amber-500',
              isDeficit && 'text-muted-foreground',
              !isOvertime && !isDeficit && 'text-emerald-500'
            )}
          >
            {stats.progressPercent}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isOvertime
                ? 'bg-amber-500'
                : stats.progressPercent >= 80
                ? 'bg-emerald-500'
                : stats.progressPercent >= 50
                ? 'bg-blue-500'
                : 'bg-primary'
            )}
            style={{ width: `${stats.progressPercent}%` }}
          />
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Required hours */}
        <StatItem
          icon={<Target className="h-3.5 w-3.5" />}
          label="Norma"
          value={`${stats.requiredHours} óra`}
          sublabel={`${stats.businessDays} munkanap × ${dailyHours} óra`}
        />

        {/* Hours worked */}
        <StatItem
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Rögzített"
          value={`${stats.totalWorked} óra`}
          sublabel={`${stats.workedDays} napon`}
        />

        {/* Remaining or overtime */}
        {isOvertime ? (
          <StatItem
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label="Túlóra"
            value={`+${stats.overtime} óra`}
            sublabel="Norma felett"
            variant="warning"
          />
        ) : (
          <StatItem
            icon={<TrendingDown className="h-3.5 w-3.5" />}
            label="Hátralévő"
            value={`${stats.remaining} óra`}
            sublabel="Normáig hiányzik"
            variant={stats.remaining <= dailyHours * 2 ? 'success' : 'default'}
          />
        )}

        {/* Days worked */}
        <StatItem
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          label="Napok"
          value={`${stats.workedDays} / ${stats.businessDays}`}
          sublabel="Ledolgozva / összes"
        />
      </div>

      {/* Status breakdown */}
      {(stats.draftHours > 0 ||
        stats.submittedHours > 0 ||
        stats.approvedHours > 0) && (
        <div className="flex items-center gap-3 pt-1 border-t border-border/30">
          {stats.draftHours > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              <span className="text-muted-foreground">
                Piszkozat:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {stats.draftHours} óra
                </span>
              </span>
            </div>
          )}
          {stats.submittedHours > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">
                Leadva:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {stats.submittedHours} óra
                </span>
              </span>
            </div>
          )}
          {stats.approvedHours > 0 && (
            <div className="flex items-center gap-1 text-[11px]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">
                Jóváhagyva:{' '}
                <span className="font-medium text-foreground tabular-nums">
                  {stats.approvedHours} óra
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Overtime warning */}
      {stats.overtime > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Ebben a hónapban{' '}
            <span className="font-bold">{stats.overtime} óra túlóra</span>{' '}
            keletkezett a {stats.requiredHours} órás norma felett.
          </p>
        </div>
      )}
    </div>
  );
}

/** Small stat item */
function StatItem({
  icon,
  label,
  value,
  sublabel,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
  variant?: 'default' | 'success' | 'warning';
}) {
  return (
    <div className="rounded-lg bg-secondary/30 px-3 py-2">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={cn(
            variant === 'success'
              ? 'text-emerald-500'
              : variant === 'warning'
              ? 'text-amber-500'
              : 'text-muted-foreground'
          )}
        >
          {icon}
        </span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div
        className={cn(
          'font-mono font-bold text-base tabular-nums',
          variant === 'success' && 'text-emerald-500',
          variant === 'warning' && 'text-amber-500'
        )}
      >
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground/70 mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}
