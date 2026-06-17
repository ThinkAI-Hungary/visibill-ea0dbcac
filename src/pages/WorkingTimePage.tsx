import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Clock,
  Users,
  DollarSign,
  Calculator,
  Settings2,
  UserPlus,
  Wallet,
  CalendarPlus,
  ClipboardCheck,
  ClipboardList,
} from 'lucide-react';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { useSalaryData } from '@/hooks/useSalaryData';
import { useEmployeeRates } from '@/hooks/useEmployeeRates';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useProjectList } from '@/hooks/useProjectList';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { WorkingTimePageSkeleton } from '@/components/working-time/WorkingTimePageSkeleton';
import { EmployeeRatesPanel } from '@/components/working-time/EmployeeRatesPanel';
import { EmployeeListPanel } from '@/components/working-time/EmployeeListPanel';
import { WorkSettingsDialog } from '@/components/working-time/WorkSettingsDialog';
import { AddEmployeeDialog } from '@/components/working-time/AddEmployeeDialog';
import { TimeEntryForm } from '@/components/working-time/TimeEntryForm';
import { MonthlyTimesheetView } from '@/components/working-time/WeeklyTimesheetView';
import { SubmittedEntriesPanel } from '@/components/working-time/SubmittedEntriesPanel';
import { TimesheetTable } from '@/components/working-time/TimesheetTable';
import { MonthlyBalanceCard } from '@/components/working-time/MonthlyBalanceCard';
import {
  formatHourlyRate,
} from '@/lib/payrollUtils';
import type { SalaryCostItem } from '@/lib/payrollUtils';
import { formatCurrency } from '@/lib/utils';

export default function WorkingTimePage() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL param helpers ──
  const setActionParam = useCallback((action: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (action) next.set('action', action);
      else next.delete('action');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenSettings = useCallback(() => {
    setSettingsOpen(true);
    setActionParam('settings');
  }, [setActionParam]);

  const handleOpenAddEmployee = useCallback(() => {
    setAddEmployeeOpen(true);
    setActionParam('add-employee');
  }, [setActionParam]);

  const handleCloseSettings = useCallback((v: boolean) => {
    setSettingsOpen(v);
    if (!v) setActionParam(null);
  }, [setActionParam]);

  const handleCloseAddEmployee = useCallback((v: boolean) => {
    setAddEmployeeOpen(v);
    if (!v) setActionParam(null);
  }, [setActionParam]);

  // Auto-open from URL
  const actionFromUrl = searchParams.get('action');
  const employeeIdFromUrl = searchParams.get('employee');
  useEffect(() => {
    if (actionFromUrl === 'settings' && !settingsOpen) setSettingsOpen(true);
    if (actionFromUrl === 'add-employee' && !addEmployeeOpen) setAddEmployeeOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Employee/Rate editing params
  const handleEmployeeEditOpen = useCallback((employeeId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (employeeId) {
        next.set('action', 'edit-employee');
        next.set('employee', employeeId);
      } else {
        next.delete('action');
        next.delete('employee');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleRateEditOpen = useCallback((employeeId: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (employeeId) {
        next.set('action', 'edit-rate');
        next.set('employee', employeeId);
      } else {
        next.delete('action');
        next.delete('employee');
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const autoEditEmployeeId = actionFromUrl === 'edit-employee' ? employeeIdFromUrl : null;
  const autoEditRateId = actionFromUrl === 'edit-rate' ? employeeIdFromUrl : null;

  // Month navigation
  const [monthDate, setMonthDate] = useState(new Date());
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthStartStr = format(monthStart, 'yyyy-MM-dd');
  const monthEndStr = format(monthEnd, 'yyyy-MM-dd');

  // Selected day for time entry form
  const [selectedDate, setSelectedDate] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );

  const {
    salaryItems,
    loading: salaryLoading,
    employeeGroups: rawEmployeeGroups,
  } = useSalaryData();

  const {
    employeeRates,
    isLoading: ratesLoading,
    upsertMutation,
    deleteMutation: deleteRateMutation,
  } = useEmployeeRates();

  const {
    effectiveSettings,
    saveMutation: settingsSaveMutation,
  } = useCompanySettings();

  const { isEmployee, isAdmin } = useUserRole();

  // Time entries for the selected week (personal view)
  const {
    timeEntries,
    isLoading: entriesLoading,
    addMutation,
    deleteMutation: deleteEntryMutation,
    submitWeekMutation,
  } = useTimeEntries({ dateFrom: monthStartStr, dateTo: monthEndStr });

  // Company-wide time entries (for admin view in Jelenléti ív)
  const {
    timeEntries: companyTimeEntries,
    isLoading: companyEntriesLoading,
  } = useTimeEntries({
    dateFrom: monthStartStr,
    dateTo: monthEndStr,
    all: isAdmin,
  });

  // Projects for dropdown and name lookup
  const { projects } = useProjectList();

  // Count submitted entries for admin badge
  const { data: submittedCount = 0 } = useQuery({
    queryKey: ['submitted-count', selectedCompany?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('time_entries')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany!.id)
        .eq('status', 'submitted');

      if (error) return 0;
      return count || 0;
    },
    enabled: !!user && !!selectedCompany?.id && isAdmin,
    refetchInterval: 30_000,
  });
  const projectNames = useMemo(() => {
    const map: Record<string, string> = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);

  // Transform salary employee groups for EmployeeRatesPanel
  const employeeGroupsForPanel = useMemo(() => {
    return rawEmployeeGroups.map(([name, items]) => ({
      employeeName: name,
      salaryItems: items.map(
        (item) =>
          ({
            tipus: item.tipus,
            összeg: item.összeg,
          }) as SalaryCostItem
      ),
    }));
  }, [rawEmployeeGroups]);

  // KPI metrics
  const kpiMetrics = useMemo(() => {
    const monthStr = format(monthDate, 'yyyy-MM');
    
    // 1. Calculate cost from active salaries in the currently selected month
    let totalMonthlyCost = 0;
    const activeNames = new Set<string>();
    
    salaryItems.forEach((item) => {
      if (item.dátum && item.dátum.startsWith(monthStr) && item.munkavallalo_neve) {
        activeNames.add(item.munkavallalo_neve);
        if (item.tipus === 'bér' || item.tipus === 'adó' || item.tipus === 'járulék') {
          totalMonthlyCost += Number(item.összeg || 0);
        }
      }
    });

    // 2. Filter employee rates to only active employees in the selected month
    const activeRates = employeeRates.filter(r => activeNames.has(r.employee_name));
    
    const employeeCount = activeRates.filter(
      (r) => r.employee_type === 'employee'
    ).length || activeNames.size; // fallback to activeNames count if not in employee_rates yet
    
    const contractorCount = activeRates.filter(
      (r) => r.employee_type === 'contractor'
    ).length;

    // 3. Average hourly rate of active employees in the selected month
    const activeHourlyRates = Array.from(activeNames).map((name) => {
      const rateObj = employeeRates.find(r => r.employee_name === name);
      if (rateObj?.hourly_rate && rateObj.hourly_rate > 0) {
        return Number(rateObj.hourly_rate);
      }
      // Fallback: calculate dynamically from gross cost
      const empItems = salaryItems.filter(i => i.munkavallalo_neve === name && i.dátum && i.dátum.startsWith(monthStr));
      const net = empItems.filter(i => i.tipus === 'bér').reduce((s, i) => s + Number(i.összeg), 0);
      const adó = empItems.filter(i => i.tipus === 'adó').reduce((s, i) => s + Number(i.összeg), 0);
      const járulék = empItems.filter(i => i.tipus === 'járulék').reduce((s, i) => s + Number(i.összeg), 0);
      const gross = net + adó + járulék;
      return gross / (effectiveSettings.monthly_working_hours || 168);
    });

    const avgHourlyRate = activeHourlyRates.length > 0
      ? activeHourlyRates.reduce((sum, r) => sum + r, 0) / activeHourlyRates.length
      : 0;

    // Weekly hours from time entries
    const weeklyHours = timeEntries.reduce(
      (sum, e) => sum + Number(e.hours),
      0
    );

    return {
      totalEmployees: activeNames.size || employeeRates.length,
      employeeCount,
      contractorCount,
      totalMonthlyCost,
      avgHourlyRate,
      weeklyHours,
    };
  }, [salaryItems, employeeRates, timeEntries, effectiveSettings.monthly_working_hours, monthDate]);

  const handleSaveRate = (data: {
    employee_name: string;
    base_salary_cost: number;
    hourly_rate: number;
  }) => {
    upsertMutation.mutate({
      employee_name: data.employee_name,
      base_salary_cost: data.base_salary_cost,
      hourly_rate: data.hourly_rate,
    });
  };

  const handleAddEmployee = (data: {
    employee_name: string;
    employee_type: 'employee' | 'contractor';
    email: string | null;
    phone: string | null;
    hourly_rate: number | null;
  }) => {
    upsertMutation.mutate(data, {
      onSuccess: () => setAddEmployeeOpen(false),
    });
  };

  const handleSaveSettings = (settings: {
    work_start_time: string;
    work_end_time: string;
    admin_deadline: string;
    monthly_working_hours: number;
  }) => {
    settingsSaveMutation.mutate(settings, {
      onSuccess: () => setSettingsOpen(false),
    });
  };

  const handleAddTimeEntry = (entry: {
    project_id: string | null;
    date: string;
    hours: number;
    description: string;
    absence_type?: string | null;
  }) => {
    addMutation.mutate(entry);
  };

  const handleSaveAndSubmit = (entry: {
    project_id: string | null;
    date: string;
    hours: number;
    description: string;
    absence_type?: string | null;
  }) => {
    // First save as draft, then submit all drafts
    addMutation.mutate(entry, {
      onSuccess: () => {
        submitWeekMutation.mutate({
          dateFrom: monthStartStr,
          dateTo: monthEndStr,
        });
      },
    });
  };

  const handleSubmitMonth = () => {
    submitWeekMutation.mutate({
      dateFrom: monthStartStr,
      dateTo: monthEndStr,
    });
  };

  if (salaryLoading && salaryItems.length === 0 && ratesLoading) {
    return <WorkingTimePageSkeleton />;
  }

  return (
    <div className="h-full space-y-4 px-2 py-2 page-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-7 w-7 text-primary" />
            Munkaidő
          </h1>
          <p className="text-muted-foreground">
            {isEmployee
              ? 'Saját munkaidő rögzítése'
              : 'Munkaidő rögzítés, dolgozók kezelése és rezsióradíjak'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenSettings}
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Beállítások
            </Button>
            <Button size="sm" onClick={handleOpenAddEmployee}>
              <UserPlus className="h-4 w-4 mr-2" />
              Dolgozó hozzáadása
            </Button>
          </div>
        )}
      </div>

      {/* KPI Cards — admin only */}
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">
                Bejelentett
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {kpiMetrics.employeeCount}
            </span>
            <span className="text-sm text-muted-foreground ml-1">fő</span>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-orange-500/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Wallet className="h-4 w-4 text-orange-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                Alvállalkozók
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {kpiMetrics.contractorCount}
            </span>
            <span className="text-sm text-muted-foreground ml-1">fő</span>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-emerald-500/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                Havi bérköltség
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {formatCurrency(kpiMetrics.totalMonthlyCost)}
            </span>
          </CardContent>
        </Card>

        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm hover:border-blue-500/30 transition-colors">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Calculator className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-sm text-muted-foreground">
                Átlag óradíj
              </span>
            </div>
            <span className="text-2xl font-bold tabular-nums text-primary">
              {formatHourlyRate(Math.round(kpiMetrics.avgHourlyRate))}
            </span>
            <span className="text-sm text-muted-foreground ml-1">/óra</span>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="timesheet" className="w-full">
        <TabsList>
          <TabsTrigger value="timesheet" className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Időrögzítés
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Jelenléti ív
          </TabsTrigger>
          {isAdmin && (
            <>
              <TabsTrigger value="employees" className="gap-2">
                <Users className="h-4 w-4" />
                Dolgozók
              </TabsTrigger>
              <TabsTrigger value="submitted" className="gap-2 relative">
                <ClipboardCheck className="h-4 w-4" />
                Leadott
                {submittedCount > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">
                    {submittedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="rates" className="gap-2">
                <Calculator className="h-4 w-4" />
                Óradíjak
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="timesheet" className="mt-4 space-y-4">
          {/* Monthly timesheet */}
          <MonthlyTimesheetView
            timeEntries={timeEntries}
            projectNames={projectNames}
            monthDate={monthDate}
            onMonthChange={setMonthDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onDelete={(id) => deleteEntryMutation.mutate(id)}
            isDeleting={deleteEntryMutation.isPending}
            onSubmitMonth={handleSubmitMonth}
            isSubmitting={submitWeekMutation.isPending}
          />

          {/* Color legend */}
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-gray-400 bg-gray-200 dark:border-gray-500 dark:bg-gray-600" />
              Piszkozat
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-blue-500 bg-blue-200 dark:border-blue-400 dark:bg-blue-500/40" />
              Leadva (jóváhagyásra vár)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-emerald-500 bg-emerald-200 dark:border-emerald-400 dark:bg-emerald-500/40" />
              Jóváhagyva
            </span>
          </div>

          {/* Form + Balance side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              {/* Time entry form */}
              <TimeEntryForm
                selectedDate={selectedDate}
                onSubmit={handleAddTimeEntry}
                onSubmitDrafts={handleSubmitMonth}
                isSubmitting={addMutation.isPending}
                isSaving={submitWeekMutation.isPending}
                hasDraftEntries={timeEntries.some(e => e.status === 'draft')}
              />
            </div>
            <div>
              <MonthlyBalanceCard
                monthDate={monthDate}
                timeEntries={timeEntries}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-4">
          <TimesheetTable
            timeEntries={isAdmin ? companyTimeEntries : timeEntries}
            monthDate={monthDate}
            workStartTime={effectiveSettings.work_start_time}
            workEndTime={effectiveSettings.work_end_time}
            projectNames={projectNames}
            employeeRates={employeeRates}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="employees" className="mt-4">
          <EmployeeListPanel
            employeeRates={employeeRates}
            onDelete={(id) => deleteRateMutation.mutate(id)}
            isDeleting={deleteRateMutation.isPending}
            onEdit={(data) => upsertMutation.mutate(data)}
            isEditing={upsertMutation.isPending}
            autoEditEmployeeId={autoEditEmployeeId}
            onEditOpenChange={handleEmployeeEditOpen}
          />
        </TabsContent>

        <TabsContent value="submitted" className="mt-4">
          <SubmittedEntriesPanel />
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <EmployeeRatesPanel
            employeeGroups={employeeGroupsForPanel}
            employeeRates={employeeRates}
            monthlyWorkingHours={effectiveSettings.monthly_working_hours}
            onSave={handleSaveRate}
            isSaving={upsertMutation.isPending}
            autoEditRateId={autoEditRateId}
            onRateEditOpenChange={handleRateEditOpen}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <WorkSettingsDialog
        open={settingsOpen}
        onOpenChange={handleCloseSettings}
        currentSettings={effectiveSettings}
        onSave={handleSaveSettings}
        isSaving={settingsSaveMutation.isPending}
      />

      <AddEmployeeDialog
        open={addEmployeeOpen}
        onOpenChange={handleCloseAddEmployee}
        onSubmit={handleAddEmployee}
        isSaving={upsertMutation.isPending}
      />
    </div>
  );
}
