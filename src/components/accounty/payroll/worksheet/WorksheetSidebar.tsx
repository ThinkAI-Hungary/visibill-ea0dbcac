import React, { useState, useMemo } from 'react';
import { Search, CheckCircle2, Clock, Circle, Users, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface WorksheetSidebarProps {
  employees: any[];
  employments: any[];
  selectedEmployeeId: string;
  onSelectEmployee: (id: string) => void;
  completionMap: Record<string, boolean>;
  attendanceData: Record<string, any>;
  calculations: any[];
  className?: string;
}

export default function WorksheetSidebar({
  employees,
  employments,
  selectedEmployeeId,
  onSelectEmployee,
  completionMap,
  attendanceData,
  calculations,
  className,
}: WorksheetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const totalCount = employees.length;
  const completedCount = useMemo(() => {
    return employees.filter(e => !!completionMap[e.id]).length;
  }, [employees, completionMap]);

  const pendingCount = totalCount - completedCount;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const fullName = `${emp.last_name || ''} ${emp.first_name || ''}`.trim().toLowerCase();
      const employment = employments.find(e => e.employee_id === emp.id);
      const jobTitle = (employment?.job_title || '').toLowerCase();
      const jobCode = (employment?.job_code || '').toLowerCase();
      const matchesSearch = !searchQuery || fullName.includes(searchQuery.toLowerCase()) || jobTitle.includes(searchQuery.toLowerCase()) || jobCode.includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const isDone = !!completionMap[emp.id];
      if (filter === 'completed') return isDone;
      if (filter === 'pending') return !isDone;
      return true;
    });
  }, [employees, employments, searchQuery, filter, completionMap]);

  return (
    <div className={cn('flex flex-col h-full bg-card border-r border-border', className)}>
      {/* Header & Progress */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Munkavállalók</h3>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {completedCount} / {totalCount} kész
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Progress value={progressPct} className="h-2" />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Előrehaladás</span>
            <span className="font-medium text-primary">{progressPct}%</span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Keresés név vagy beosztás szerint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-8 pr-7 text-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex gap-1.5 pt-0.5">
          <Button
            variant={filter === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('all')}
            className="h-7 text-xs px-2.5 font-medium flex-1"
          >
            Mind ({totalCount})
          </Button>
          <Button
            variant={filter === 'pending' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('pending')}
            className="h-7 text-xs px-2.5 font-medium flex-1 text-amber-600 dark:text-amber-400"
          >
            Függő ({pendingCount})
          </Button>
          <Button
            variant={filter === 'completed' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilter('completed')}
            className="h-7 text-xs px-2.5 font-medium flex-1 text-green-600 dark:text-green-400"
          >
            Kész ({completedCount})
          </Button>
        </div>
      </div>

      {/* Employee List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y-0">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-8 px-4 text-xs text-muted-foreground">
            Nem található munkavállaló a megadott szűrési feltételekkel.
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSelected = emp.id === selectedEmployeeId;
            const isCompleted = !!completionMap[emp.id];
            const employment = employments.find(e => e.employee_id === emp.id);
            const att = attendanceData[emp.id];
            const hasCustomAttendance = !!att && (att.overtime > 0 || att.sickDays > 0 || att.leaveDays > 0 || att.workedHours !== undefined);
            const calc = calculations.find(c => {
              const meta = c?.metadata as any;
              return meta?.employee_id === emp.id || c.employment_id === employment?.id;
            });

            return (
              <button
                key={emp.id}
                onClick={() => onSelectEmployee(emp.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg border transition-all duration-150 flex flex-col gap-1.5',
                  isSelected
                    ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20'
                    : 'bg-card border-border/70 hover:bg-accent/40 hover:border-border'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-xs font-semibold truncate', isSelected ? 'text-primary font-bold' : 'text-foreground')}>
                    {emp.last_name} {emp.first_name}
                  </span>
                  {isCompleted ? (
                    <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-green-500/10 text-green-600 border-green-500/20 font-medium shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Kész
                    </Badge>
                  ) : hasCustomAttendance ? (
                    <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium shrink-0">
                      <Clock className="w-3 h-3" />
                      Adattal
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-slate-500/10 text-slate-500 border-slate-500/20 shrink-0">
                      <Circle className="w-2.5 h-2.5" />
                      Alapért.
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-1">
                  <span className="truncate max-w-[140px]">
                    {employment?.job_title || 'Munkakör nincs megadva'}
                  </span>
                  <span className="font-mono font-medium text-foreground shrink-0">
                    {employment?.salary_type === 'hourly'
                      ? `${Number(employment.base_salary || 0).toLocaleString('hu-HU')} Ft/ó`
                      : `${Number(employment.base_salary || 0).toLocaleString('hu-HU')} Ft`}
                  </span>
                </div>

                {calc && (
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/40 font-mono text-muted-foreground">
                    <span>Számfejtve:</span>
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      {(calc.net_salary || 0).toLocaleString('hu-HU')} Ft nettó
                    </span>
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
