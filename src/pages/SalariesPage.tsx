import { useState } from 'react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useSalaryData } from '@/hooks/useSalaryData';
import { useDateRange } from '@/contexts/DateRangeContext';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Users } from 'lucide-react';
import { SalaryKpiCards } from '@/components/salaries/SalaryKpiCards';
import { EmployeeAccordion } from '@/components/salaries/EmployeeAccordion';
import { NavSummaryTable } from '@/components/salaries/NavSummaryTable';
import { SalaryAddDialog, SalaryEditDialog } from '@/components/salaries/SalaryDialogs';
import type { SalaryItem } from '@/lib/salary-helpers';

export default function SalariesPage() {
  const {
    salaryItems, loading, employeeGroups, navItems,
    metrics, addMutation, editMutation,
  } = useSalaryData();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryItem | null>(null);

  const openEditModal = (item: SalaryItem) => {
    setEditingRecord(item);
    setEditDialogOpen(true);
  };

  if (loading) return <LoadingSpinner message="Bérek betöltése..." />;

  return (
    <div className="h-full space-y-4 px-2 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bérek / járulékok</h1>
          <p className="text-muted-foreground">Alkalmazottak bérének és járulékainak kezelése</p>
        </div>
        <Button onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          KP kifizetés
        </Button>
      </div>

      {/* KPI Cards */}
      <SalaryKpiCards
        totalPayments={metrics.totalPayments}
        employeeCount={metrics.employeeCount}
        netSalary={metrics.netSalary}
        grossSalary={metrics.grossSalary}
        totalItems={salaryItems.length}
      />

      {/* Employee Accordion */}
      <EmployeeAccordion
        employeeGroups={employeeGroups}
        onEdit={openEditModal}
      />

      {/* NAV Summary Table */}
      <NavSummaryTable navItems={navItems} onEdit={openEditModal} />

      {/* Empty state */}
      {employeeGroups.length === 0 && navItems.length === 0 && (
        <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="text-center py-16 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nincs bejegyzés a kiválasztott időszakban</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <SalaryAddDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSubmit={(form) => addMutation.mutate(form)}
      />
      <SalaryEditDialog
        open={editDialogOpen}
        onOpenChange={(v) => { setEditDialogOpen(v); if (!v) setEditingRecord(null); }}
        record={editingRecord}
        onSubmit={(id, form) => editMutation.mutate({ id, form })}
      />
    </div>
  );
}
