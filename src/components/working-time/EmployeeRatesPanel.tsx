import { Card, CardContent } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { SalaryLinkCard } from './SalaryLinkCard';
import type { EmployeeRate, SalaryCostItem } from '@/lib/payrollUtils';

interface EmployeeGroup {
  employeeName: string;
  salaryItems: SalaryCostItem[];
}

interface EmployeeRatesPanelProps {
  /** Grouped salary data per employee (from salary table) */
  employeeGroups: EmployeeGroup[];
  /** Existing employee rates (from employee_rates table) */
  employeeRates: EmployeeRate[];
  /** Monthly working hours from company settings */
  monthlyWorkingHours: number;
  /** Callback when user saves a rate */
  onSave: (data: {
    employee_name: string;
    base_salary_cost: number;
    hourly_rate: number;
  }) => void;
  isSaving: boolean;
}

/** Shared grid class for header + rows alignment */
export const RATES_GRID = 'grid grid-cols-[16px_40px_1fr_140px_140px_140px_44px] items-center gap-x-4';

export function EmployeeRatesPanel({
  employeeGroups,
  employeeRates,
  monthlyWorkingHours,
  onSave,
  isSaving,
}: EmployeeRatesPanelProps) {
  // Merge: salary employees + employee_rates entries that don't have salary data
  const salaryEmployeeNames = new Set(employeeGroups.map(g => g.employeeName));
  const ratesOnlyEmployees = employeeRates
    .filter(r => !salaryEmployeeNames.has(r.employee_name))
    .map(r => ({
      employeeName: r.employee_name,
      salaryItems: [] as SalaryCostItem[],
    }));

  const allEmployees = [...employeeGroups, ...ratesOnlyEmployees];

  if (allEmployees.length === 0) {
    return (
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nincsenek dolgozók</p>
            <p className="text-sm mt-1">
              A bérlista feltöltésekor a rendszer automatikusan felismeri a dolgozókat.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">
            Dolgozók és óradíjak{' '}
            <span className="text-muted-foreground font-normal">
              ({allEmployees.length} fő)
            </span>
          </h2>
        </div>

        {/* Column header */}
        <div className={`${RATES_GRID} px-4 py-2 border-b border-border/50`}>
          {/* chevron */}
          <div />
          {/* avatar */}
          <div />
          {/* name */}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Dolgozó
          </span>
          {/* status */}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
            Státusz
          </span>
          {/* cost */}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Bérköltség
          </span>
          {/* rate */}
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
            Óradíj
          </span>
          {/* action */}
          <div />
        </div>

        {/* Employee list */}
        {allEmployees.map((group) => {
          const existingRate = employeeRates.find(
            (r) => r.employee_name === group.employeeName
          ) ?? null;

          return (
            <SalaryLinkCard
              key={group.employeeName}
              employeeName={group.employeeName}
              salaryItems={group.salaryItems}
              existingRate={existingRate}
              monthlyWorkingHours={monthlyWorkingHours}
              onSave={onSave}
              isSaving={isSaving}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
