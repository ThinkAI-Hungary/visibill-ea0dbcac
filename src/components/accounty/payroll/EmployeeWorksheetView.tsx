import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { payrollQueryKeys, paramsToTaxParams } from '@/hooks/usePayrollData';
import type { TaxParameters, EmployeeDeclarations } from '@/lib/payroll/taxEngine';
import WorksheetSidebar from './worksheet/WorksheetSidebar';
import WorksheetEmployeeForm from './worksheet/WorksheetEmployeeForm';
import WorksheetLivePayslip from './worksheet/WorksheetLivePayslip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RotateCcw,
  Loader2,
  Check,
  ArrowRight,
  ListFilter,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmployeeWorksheetViewProps {
  companyId: string;
  cycle: any;
  activeEmployees: any[];
  allEmployments: any[];
  attendanceData: Record<string, { workDays: number; workedHours?: number; overtime: number; sickDays: number; leaveDays: number }>;
  onAttendanceChange: (empId: string, field: 'workDays' | 'workedHours' | 'overtime' | 'sickDays' | 'leaveDays', value: number) => void;
  items: any[];
  cafeteriaItems: any[];
  garnishments: any[];
  calculations: any[];
  runBatch: any;
  onSaveTimesheet: () => Promise<void>;
  onPrintPayslip: (calc: any) => void;
  onSwitchToStepper: (step?: number) => void;
  onCycleClose: () => Promise<void>;
  isPosting?: boolean;
}

export default function EmployeeWorksheetView({
  companyId,
  cycle,
  activeEmployees,
  allEmployments,
  attendanceData,
  onAttendanceChange,
  items,
  cafeteriaItems,
  garnishments,
  calculations,
  runBatch,
  onSaveTimesheet,
  onPrintPayslip,
  onSwitchToStepper,
  onCycleClose,
  isPosting = false,
}: EmployeeWorksheetViewProps) {
  const queryClient = useQueryClient();

  // Selected employee
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
    return activeEmployees[0]?.id || '';
  });

  useEffect(() => {
    if (!selectedEmployeeId && activeEmployees.length > 0) {
      setSelectedEmployeeId(activeEmployees[0].id);
    }
  }, [activeEmployees, selectedEmployeeId]);

  // Tax Profile & Parameters State
  const [isKiva, setIsKiva] = useState(false);
  const [companyCarRate, setCompanyCarRate] = useState(30);
  const [taxParams, setTaxParams] = useState<TaxParameters>(() => paramsToTaxParams({}));
  const [declarationsMap, setDeclarationsMap] = useState<Record<string, EmployeeDeclarations>>({});
  const [completionMap, setCompletionMap] = useState<Record<string, boolean>>({});
  const [isSavingCommute, setIsSavingCommute] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Local employment overrides for commute (sync with DB)
  const [commuteOverrides, setCommuteOverrides] = useState<Record<string, {
    commuteType: 'none' | 'car' | 'public_transit';
    distanceKm: number;
    passCost: number;
    pct: number;
    carRate: number;
  }>>({});

  // Fetch company tax profile & parameters
  useEffect(() => {
    if (!companyId) return;

    supabase
      .from('accounty_tax_profiles')
      .select('is_kiva, commute_car_rate_per_km')
      .eq('company_id', companyId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsKiva(!!data.is_kiva);
          if (data.commute_car_rate_per_km) {
            setCompanyCarRate(Number(data.commute_car_rate_per_km));
          }
        }
      });

    if (cycle?.year) {
      supabase
        .from('accounty_tax_parameters')
        .select('parameter_key, parameter_value')
        .eq('tax_year', cycle.year)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const raw = Object.fromEntries(data.map((r: any) => [r.parameter_key, r.parameter_value]));
            setTaxParams(paramsToTaxParams(raw));
          }
        });
    }
  }, [companyId, cycle?.year]);

  // Fetch declarations for active employees
  useEffect(() => {
    if (activeEmployees.length === 0) return;
    const empIds = activeEmployees.map(e => e.id);

    supabase
      .from('accounty_declarations')
      .select('*')
      .in('employee_id', empIds)
      .eq('status', 'active')
      .then(({ data }) => {
        if (!data) return;
        const newMap: Record<string, EmployeeDeclarations> = {};
        for (const decl of data as any[]) {
          const empId = decl.employee_id;
          if (!newMap[empId]) newMap[empId] = {};
          if (decl.declaration_type === 'family_credit') {
            const children = (decl.parameters)?.children_count || 0;
            const sharePct = (decl.parameters)?.share_pct || 100;
            newMap[empId].family = {
              dependentCount: children,
              eligibleChildrenCount: children,
              sharePct,
            };
          }
          if (decl.declaration_type === 'netak') newMap[empId].netak = { eligible: true };
          if (decl.declaration_type === 'under_25') newMap[empId].young25 = { eligible: true };
          if (decl.declaration_type === 'new_mother') newMap[empId].youngMother30 = { maxDeduction: 0 };
          if (decl.declaration_type === 'first_marriage') {
            newMap[empId].firstMarriage = { eligible: true, monthsRemaining: decl.parameters?.months_remaining || 24 };
          }
          if (decl.declaration_type === 'personal_disability') newMap[empId].personal = { eligible: true };
        }
        setDeclarationsMap(newMap);
      });
  }, [activeEmployees]);

  // Fetch timesheet verification states
  useEffect(() => {
    if (!cycle?.id || allEmployments.length === 0) return;

    supabase
      .from('accounty_timesheets')
      .select('employment_id, is_verified, ocr_data')
      .eq('cycle_id', cycle.id)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, boolean> = {};
        data.forEach((ts: any) => {
          const emp = allEmployments.find(e => e.id === ts.employment_id);
          if (emp) {
            const ocr = (ts.ocr_data as any) || {};
            map[emp.employee_id] = !!ts.is_verified || !!ocr.worksheet_completed;
          }
        });
        setCompletionMap(map);
      });
  }, [cycle?.id, allEmployments]);

  // Selected employee objects
  const currentEmployee = useMemo(() => {
    return activeEmployees.find(e => e.id === selectedEmployeeId) || activeEmployees[0] || null;
  }, [activeEmployees, selectedEmployeeId]);

  const currentEmployment = useMemo(() => {
    if (!currentEmployee) return null;
    return allEmployments.find(e => e.employee_id === currentEmployee.id) || null;
  }, [allEmployments, currentEmployee]);

  // Current Attendance
  const currentAttendance = useMemo(() => {
    if (!currentEmployee) return { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };
    return attendanceData[currentEmployee.id] || { workDays: 22, overtime: 0, sickDays: 0, leaveDays: 0 };
  }, [attendanceData, currentEmployee]);

  // Current Commute Input
  const currentCommuteInput = useMemo(() => {
    if (!currentEmployee || !currentEmployment) {
      return { commuteType: 'none' as const, distanceKm: 0, passCost: 0, pct: 86, carRate: companyCarRate };
    }
    const override = commuteOverrides[currentEmployee.id];
    if (override) return override;

    return {
      commuteType: (currentEmployment.commute_type || 'none') as 'none' | 'car' | 'public_transit',
      distanceKm: Number(currentEmployment.commute_distance_km || 0),
      passCost: Number(currentEmployment.commute_monthly_pass_cost || 0),
      pct: Number(currentEmployment.commute_reimbursement_pct || 86),
      carRate: companyCarRate,
    };
  }, [currentEmployee, currentEmployment, commuteOverrides, companyCarRate]);

  // Handle Commute field change
  const handleCommuteChange = (field: string, value: any) => {
    if (!currentEmployee) return;
    setCommuteOverrides(prev => ({
      ...prev,
      [currentEmployee.id]: {
        ...currentCommuteInput,
        [field]: value,
      },
    }));
  };

  // Save Commute to Master Data
  const handleSaveCommuteToMaster = async () => {
    if (!currentEmployment) return;
    setIsSavingCommute(true);
    try {
      const { error } = await supabase
        .from('accounty_employments')
        .update({
          commute_type: currentCommuteInput.commuteType,
          commute_distance_km: currentCommuteInput.distanceKm,
          commute_monthly_pass_cost: currentCommuteInput.passCost,
          commute_reimbursement_pct: currentCommuteInput.pct,
        })
        .eq('id', currentEmployment.id);

      if (error) throw error;

      toast({
        title: 'Törzsadat sikeresen elmentve!',
        description: `${currentEmployee?.last_name} ${currentEmployee?.first_name} munkába járás beállításai elmentve a munkaviszony törzslapjára.`,
      });

      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.companyEmployments(companyId) });
    } catch (err: any) {
      toast({
        title: 'Hiba a mentés során',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsSavingCommute(false);
    }
  };

  // Items per employee
  const currentItems = useMemo(() => {
    if (!currentEmployment) return [];
    return items.filter(i => i.employment_id === currentEmployment.id);
  }, [items, currentEmployment]);

  const currentBonus = useMemo(() => {
    const b = currentItems.find(i => i.item_type === 'bonus');
    return b ? Number(b.amount) : 0;
  }, [currentItems]);

  const currentServiceCharge = useMemo(() => {
    const sc = currentItems.find(i => i.item_type === 'service_charge');
    return sc ? Number(sc.amount) : 0;
  }, [currentItems]);

  const currentItemDeductions = useMemo(() => {
    return currentItems
      .filter(i => i.is_deduction)
      .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  }, [currentItems]);

  const currentHomeOffice = useMemo(() => {
    if (!currentEmployment) return 0;
    const ho = cafeteriaItems.find(
      i => i.employment_id === currentEmployment.id && (i.sub_type === 'home_office' || i.benefit_type === 'home_office')
    );
    return ho ? Number(ho.amount) : 0;
  }, [cafeteriaItems, currentEmployment]);

  // Handle Item (bonus, service charge, deduction) changes
  const handleItemChange = async (itemType: string, amount: number, isDeduction: boolean, desc: string) => {
    if (!cycle?.id || !currentEmployment) return;
    const safeAmount = Math.max(0, amount);

    try {
      const { data: existing } = await supabase
        .from('accounty_payroll_items')
        .select('id')
        .eq('cycle_id', cycle.id)
        .eq('employment_id', currentEmployment.id)
        .eq('item_type', itemType)
        .maybeSingle();

      if (safeAmount > 0) {
        if (existing) {
          await supabase
            .from('accounty_payroll_items')
            .update({ amount: safeAmount })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('accounty_payroll_items')
            .insert({
              cycle_id: cycle.id,
              employment_id: currentEmployment.id,
              item_type: itemType,
              description: desc,
              amount: safeAmount,
              is_deduction: isDeduction,
            });
        }
      } else if (existing) {
        await supabase
          .from('accounty_payroll_items')
          .delete()
          .eq('id', existing.id);
      }

      queryClient.invalidateQueries({ queryKey: payrollQueryKeys.items(cycle.id) });
    } catch (err: any) {
      console.error('Error saving item:', err);
    }
  };

  // Toggle Completion Status
  const handleToggleCompleted = async () => {
    if (!currentEmployee || !currentEmployment || !cycle?.id) return;
    const nextState = !completionMap[currentEmployee.id];

    setCompletionMap(prev => ({
      ...prev,
      [currentEmployee.id]: nextState,
    }));

    try {
      // Upsert timesheet verified state
      const { data: existing } = await supabase
        .from('accounty_timesheets')
        .select('id, ocr_data')
        .eq('cycle_id', cycle.id)
        .eq('employment_id', currentEmployment.id)
        .maybeSingle();

      const ocr = (existing?.ocr_data as any) || currentAttendance;
      ocr.worksheet_completed = nextState;

      if (existing) {
        await supabase
          .from('accounty_timesheets')
          .update({
            is_verified: nextState,
            ocr_data: ocr,
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('accounty_timesheets')
          .insert({
            cycle_id: cycle.id,
            employment_id: currentEmployment.id,
            is_verified: nextState,
            ocr_data: ocr,
          });
      }
    } catch (err) {
      console.error('Error updating timesheet verification:', err);
    }
  };

  // Employee list navigation
  const currentIndex = activeEmployees.findIndex(e => e.id === selectedEmployeeId);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < activeEmployees.length - 1;

  const handlePrev = () => {
    if (hasPrev) setSelectedEmployeeId(activeEmployees[currentIndex - 1].id);
  };

  const handleNext = () => {
    if (hasNext) setSelectedEmployeeId(activeEmployees[currentIndex + 1].id);
  };

  // Print current employee payslip
  const handlePrintCurrentPayslip = () => {
    if (!currentEmployee) return;
    const calc = calculations.find(c => {
      const meta = c?.metadata as any;
      return meta?.employee_id === currentEmployee.id || c.employment_id === currentEmployment?.id;
    });

    if (calc) {
      onPrintPayslip(calc);
    } else {
      toast({
        title: 'Számfejtés szükséges',
        description: 'A bérlap nyomtatásához először futtasd le a bérszámfejtést a jobb felső gombbal.',
        variant: 'destructive',
      });
    }
  };

  // Run Batch Calculations & Save
  const handleSaveAndRunAll = async () => {
    if (!cycle?.id || !companyId) return;
    setIsBatchRunning(true);
    try {
      await onSaveTimesheet();
      await runBatch.mutateAsync({
        cycleId: cycle.id,
        companyId,
        year: cycle.year,
        month: cycle.month,
      });
      toast({
        title: ' Számfejtés sikeresen lefutott!',
        description: `Minden dolgozó jelenléte és bérkomponense újraszámolva.`,
      });
    } catch (err: any) {
      toast({
        title: 'Hiba a számfejtés során',
        description: err?.message || 'Nem sikerült kiszámolni a béreket.',
        variant: 'destructive',
      });
    } finally {
      setIsBatchRunning(false);
    }
  };

  const totalEmployees = activeEmployees.length;
  const completedCount = activeEmployees.filter(e => !!completionMap[e.id]).length;
  const isAllCompleted = totalEmployees > 0 && completedCount === totalEmployees;

  return (
    <div className="space-y-4">
      {/* Top Banner & Control Bar */}
      <div className="bg-card rounded-xl border border-border shadow-xs p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-foreground">
                Dolgozó-Központú Munkalap (All-in-One Nézet)
              </h2>
              <Badge variant="outline" className="text-xs px-2 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold">
                {completedCount} / {totalEmployees} dolgozó kész ({Math.round((completedCount / (totalEmployees || 1)) * 100)}%)
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Jelenlét, munkába járás költségtérítés, felszolgálási díj és élő mini bérszalvéta egyetlen felületen.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onSwitchToStepper(currentEmployment ? 8 : 1)}
            className="text-xs h-8 gap-1.5"
          >
            <ListFilter className="w-3.5 h-3.5" />
            Váltás Varázslóra (8 lépés)
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleSaveAndRunAll}
            disabled={isBatchRunning || runBatch?.isPending}
            className="text-xs h-8 gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isBatchRunning || runBatch?.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Számolás...
              </>
            ) : (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                Számfejtés futtatása ({totalEmployees} fő)
              </>
            )}
          </Button>

          {isAllCompleted ? (
            <Button
              variant="default"
              size="sm"
              onClick={onCycleClose}
              disabled={isPosting}
              className="text-xs h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {isPosting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Könyvelés...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ciklus Lezárása & Könyvelése
                </>
              )}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSwitchToStepper(8)}
              className="text-xs h-8 gap-1.5 border-green-600/30 text-green-700 dark:text-green-400 hover:bg-green-500/10"
            >
              Ugrás Cikluszáráshoz (Step 8)
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 3-Column Layout: Sidebar (left) + Form (center) + Live Payslip (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Employee List (3 cols) */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden h-[780px]">
          <WorksheetSidebar
            employees={activeEmployees}
            employments={allEmployments}
            selectedEmployeeId={selectedEmployeeId}
            onSelectEmployee={setSelectedEmployeeId}
            completionMap={completionMap}
            attendanceData={attendanceData}
            calculations={calculations}
          />
        </div>

        {/* Center: Employee Form (6 cols) */}
        <div className="lg:col-span-6 space-y-4">
          <WorksheetEmployeeForm
            employee={currentEmployee}
            employment={currentEmployment}
            attendance={currentAttendance}
            onAttendanceChange={(field, val) => {
              if (currentEmployee) onAttendanceChange(currentEmployee.id, field, val);
            }}
            commuteInput={currentCommuteInput}
            onCommuteChange={handleCommuteChange}
            onSaveCommuteToMaster={handleSaveCommuteToMaster}
            isSavingCommute={isSavingCommute}
            bonus={currentBonus}
            onBonusChange={(val) => handleItemChange('bonus', val, false, 'Egyedi prémium / jutalom')}
            serviceCharge={currentServiceCharge}
            onServiceChargeChange={(val) => handleItemChange('service_charge', val, false, 'Vendéglátóipari felszolgálási díj (15% SZJA mentes)')}
            homeOffice={currentHomeOffice}
            onHomeOfficeChange={(val) => handleItemChange('home_office', val, false, 'Home Office adómentes átalánytérítés')}
            itemDeductions={currentItemDeductions}
            onItemDeductionsChange={(val) => handleItemChange('deduction', val, true, 'Egyéb bérlevonás / előleg')}
            garnishments={garnishments.filter(g => g.employee_id === currentEmployee?.id)}
            isCompleted={!!completionMap[currentEmployee?.id || '']}
            onToggleCompleted={handleToggleCompleted}
            onPrevEmployee={handlePrev}
            onNextEmployee={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrintPayslip={handlePrintCurrentPayslip}
          />
        </div>

        {/* Right: Live Payslip (3 cols, sticky) */}
        <div className="lg:col-span-3 sticky top-4">
          <WorksheetLivePayslip
            employee={currentEmployee}
            employment={currentEmployment}
            attendance={currentAttendance}
            commuteInput={currentCommuteInput}
            bonus={currentBonus}
            serviceCharge={currentServiceCharge}
            itemDeductions={currentItemDeductions}
            homeOffice={currentHomeOffice}
            garnishments={garnishments.filter(g => g.employee_id === currentEmployee?.id)}
            declarations={currentEmployee ? declarationsMap[currentEmployee.id] : {}}
            isKiva={isKiva}
            taxParams={taxParams}
          />
        </div>
      </div>
    </div>
  );
}
