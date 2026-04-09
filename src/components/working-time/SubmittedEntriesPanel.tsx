import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle2,
  Clock,
  User,
  FolderKanban,
  Calendar,
  Loader2,
  Inbox,
  ChevronDown,
  ChevronRight,
  Trash2,
  Check,
  CheckCheck,
  Banknote,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { hu } from 'date-fns/locale';
import { cn, formatCurrency } from '@/lib/utils';

interface SubmittedEntry {
  id: string;
  user_id: string;
  date: string;
  hours: number;
  status: string;
  description: string | null;
  project_id: string | null;
  project_name?: string;
  employee_name?: string;
  hourly_rate?: number;
}

export function SubmittedEntriesPanel() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleEmployee = (name: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Fetch all submitted entries (admin view)
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['submitted-entries', selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('id, user_id, date, hours, status, description, project_id')
        .eq('company_id', selectedCompany!.id)
        .eq('status', 'submitted')
        .order('date', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map((e) => e.user_id))];
      const projectIds = [
        ...new Set((data || []).map((e) => e.project_id).filter(Boolean)),
      ];

      // Fetch employee names + hourly rates
      const nameMap: Record<string, string> = {};
      const rateMap: Record<string, number> = {};
      if (userIds.length > 0) {
        const { data: employees } = await supabase
          .from('employee_rates')
          .select('user_id, employee_name, hourly_rate')
          .eq('company_id', selectedCompany!.id)
          .in('user_id', userIds);

        (employees || []).forEach((e) => {
          if (e.user_id) {
            nameMap[e.user_id] = e.employee_name;
            if (e.hourly_rate) rateMap[e.user_id] = Number(e.hourly_rate);
          }
        });
      }

      const projMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds as string[]);

        (projects || []).forEach((p) => {
          projMap[p.id] = p.name;
        });
      }

      return (data || []).map((entry) => ({
        ...entry,
        hours: Number(entry.hours),
        employee_name: nameMap[entry.user_id] || 'Ismeretlen',
        project_name: entry.project_id ? projMap[entry.project_id] || '—' : '—',
        hourly_rate: rateMap[entry.user_id] || 0,
      })) as SubmittedEntry[];
    },
    enabled: !!user && !!selectedCompany?.id,
    refetchInterval: 30_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['submitted-entries', selectedCompany?.id] });
    queryClient.invalidateQueries({ queryKey: ['submitted-count', selectedCompany?.id] });
    queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
  };

  // Approve batch
  const approveBatchMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { error } = await supabase
        .from('time_entries')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .in('id', entryIds);
      if (error) throw error;
    },
    onSuccess: (_data, entryIds) => {
      toast({ title: 'Jóváhagyva', description: `${entryIds.length} bejegyzés jóváhagyva.` });
      setSelectedIds(new Set());
      invalidateAll();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült jóváhagyni.' });
    },
  });

  // Delete batch
  const deleteBatchMutation = useMutation({
    mutationFn: async (entryIds: string[]) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .in('id', entryIds);
      if (error) throw error;
    },
    onSuccess: (_data, entryIds) => {
      toast({ title: 'Törölve', description: `${entryIds.length} bejegyzés törölve.` });
      setSelectedIds(new Set());
      invalidateAll();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült törölni.' });
    },
  });

  const isBusy = approveBatchMutation.isPending || deleteBatchMutation.isPending;

  // Group by employee
  const grouped = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const name = entry.employee_name || 'Ismeretlen';
        if (!acc[name]) acc[name] = [];
        acc[name].push(entry);
        return acc;
      },
      {} as Record<string, SubmittedEntry[]>
    );
  }, [entries]);

  // Selection helpers
  const allSelected = entries.length > 0 && entries.every((e) => selectedIds.has(e.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleEmployeeEntries = (employeeEntries: SubmittedEntry[]) => {
    const ids = employeeEntries.map((e) => e.id);
    const allChecked = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Cost calculations
  const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
  const selectedTotalHours = selectedEntries.reduce((s, e) => s + e.hours, 0);
  const selectedTotalCost = selectedEntries.reduce(
    (s, e) => s + e.hours * (e.hourly_rate || 0),
    0
  );
  const totalCost = entries.reduce((s, e) => s + e.hours * (e.hourly_rate || 0), 0);
  const totalHours = entries.reduce((s, e) => s + e.hours, 0);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
          <div className="p-3 rounded-full bg-emerald-500/10">
            <Inbox className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="font-semibold">Nincs leadott bejegyzés</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Jelenleg nincs jóváhagyásra váró munkaidő-bejegyzés.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top summary + global approve */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={toggleSelectAll}
            className="h-4.5 w-4.5"
          />
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{entries.length}</span>{' '}
            bejegyzés •{' '}
            <span className="font-medium text-foreground">{Object.keys(grouped).length}</span>{' '}
            dolgozó •{' '}
            <span className="font-mono tabular-nums font-medium text-foreground">{totalHours}h</span>
            {totalCost > 0 && (
              <>
                {' '}• <span className="font-mono tabular-nums font-medium text-primary">{formatCurrency(totalCost)}</span>
              </>
            )}
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => approveBatchMutation.mutate(entries.map((e) => e.id))}
          disabled={isBusy}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {approveBatchMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCheck className="h-4 w-4 mr-2" />
          )}
          Mind jóváhagyása
        </Button>
      </div>

      {/* Collapsible employee cards */}
      {Object.entries(grouped).map(([employeeName, employeeEntries]) => {
        const empTotalHours = employeeEntries.reduce((sum, e) => sum + e.hours, 0);
        const empCost = employeeEntries.reduce(
          (sum, e) => sum + e.hours * (e.hourly_rate || 0),
          0
        );
        const isExpanded = expandedEmployees.has(employeeName);
        const entryCount = employeeEntries.length;
        const empIds = employeeEntries.map((e) => e.id);
        const empAllSelected = empIds.every((id) => selectedIds.has(id));
        const empSomeSelected = empIds.some((id) => selectedIds.has(id));

        return (
          <Card
            key={employeeName}
            className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden"
          >
            {/* Employee header */}
            <button
              type="button"
              onClick={() => toggleEmployee(employeeName)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-3 text-left',
                'hover:bg-secondary/30 transition-colors cursor-pointer',
                isExpanded && 'border-b border-border/30'
              )}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={empAllSelected}
                  onCheckedChange={() => toggleEmployeeEntries(employeeEntries)}
                  onClick={(e) => e.stopPropagation()}
                  className={cn('h-4 w-4', empSomeSelected && !empAllSelected && 'opacity-60')}
                />
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold">{employeeName}</span>
                <Badge variant="outline" className="text-xs tabular-nums">
                  {empTotalHours}h
                </Badge>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {entryCount} bejegyzés
                </Badge>
                {empCost > 0 && (
                  <Badge variant="outline" className="text-xs tabular-nums bg-primary/5 text-primary border-primary/20">
                    <Banknote className="h-3 w-3 mr-1" />
                    {formatCurrency(empCost)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    approveBatchMutation.mutate(empIds);
                  }}
                  disabled={isBusy}
                >
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Összes
                </Button>

                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Collapsible entry rows */}
            <div
              className={cn(
                'grid transition-all duration-200 ease-in-out',
                isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              )}
            >
              <div className="overflow-hidden">
                <CardContent className="p-3 space-y-1">
                  {employeeEntries.map((entry) => {
                    const isChecked = selectedIds.has(entry.id);
                    const entryCost = entry.hours * (entry.hourly_rate || 0);

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                          isChecked ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-secondary/20'
                        )}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleEntry(entry.id)}
                          className="h-4 w-4"
                        />

                        {/* Date */}
                        <div className="flex items-center gap-1.5 text-muted-foreground min-w-[110px]">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {format(parseISO(entry.date), 'MMM d. (EEE)', { locale: hu })}
                        </div>

                        {/* Hours */}
                        <div className="flex items-center gap-1.5 min-w-[55px]">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          <span className="font-medium tabular-nums">{entry.hours}h</span>
                        </div>

                        {/* Project */}
                        <div className="flex items-center gap-1.5 text-muted-foreground flex-1 min-w-0">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{entry.project_name}</span>
                        </div>

                        {/* Description */}
                        {entry.description && (
                          <span className="text-muted-foreground truncate max-w-[200px] text-xs italic">
                            {entry.description}
                          </span>
                        )}

                        {/* Cost */}
                        {entryCost > 0 && (
                          <span className="font-mono text-xs tabular-nums text-muted-foreground min-w-[80px] text-right">
                            {formatCurrency(entryCost)}
                          </span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteBatchMutation.mutate([entry.id])}
                            disabled={isBusy}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10"
                            onClick={() => approveBatchMutation.mutate([entry.id])}
                            disabled={isBusy}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Sticky bulk action bar */}
      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex items-center gap-4 px-5 py-3 rounded-xl shadow-2xl border border-border/50 bg-card/95 backdrop-blur-md">
            <span className="text-sm font-medium">
              <span className="font-bold text-primary tabular-nums">{selectedIds.size}</span> kijelölve
            </span>

            {selectedTotalCost > 0 && (
              <Badge variant="outline" className="tabular-nums text-xs bg-primary/5 text-primary border-primary/20">
                <Banknote className="h-3 w-3 mr-1" />
                {formatCurrency(selectedTotalCost)} • {selectedTotalHours}h
              </Badge>
            )}

            <div className="h-5 w-px bg-border/50" />

            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                if (confirm(`Biztosan törölni szeretnéd a kijelölt ${selectedIds.size} tételt?`)) {
                  deleteBatchMutation.mutate([...selectedIds]);
                }
              }}
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Törlés
            </Button>

            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => approveBatchMutation.mutate([...selectedIds])}
              disabled={isBusy}
            >
              {approveBatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
              )}
              Jóváhagyás
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
