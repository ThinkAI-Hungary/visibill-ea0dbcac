import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useSalaryData } from '@/hooks/useSalaryData';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useDateRange } from '@/contexts/DateRangeContext';
import SalaryPageSkeleton from '@/components/salaries/SalaryPageSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, FileText } from 'lucide-react';
import { SalaryKpiCards } from '@/components/salaries/SalaryKpiCards';
import { EmployeeAccordion } from '@/components/salaries/EmployeeAccordion';
import { NavSummaryTable } from '@/components/salaries/NavSummaryTable';
import { SalaryAddDialog, SalaryEditDialog } from '@/components/salaries/SalaryDialogs';
import { SalaryFilesDialog } from '@/components/salaries/SalaryFilesTable';
import type { SalaryItem } from '@/lib/salary-helpers';

export default function SalariesPage() {
  const {
    salaryItems, loading, employeeGroups, navItems,
    metrics, addMutation, editMutation,
  } = useSalaryData();

  const { dateFrom, dateTo } = useDateRange();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('salaries');
  const [searchParams, setSearchParams] = useSearchParams();
  const isSingleMonth = dateFrom.getFullYear() === dateTo.getFullYear()
    && dateFrom.getMonth() === dateTo.getMonth();
  const periodLabel = isSingleMonth
    ? format(dateFrom, 'yyyy. MMM', { locale: hu })
    : `${format(dateFrom, 'yyyy. MMM d.', { locale: hu })} – ${format(dateTo, 'yyyy. MMM d.', { locale: hu })}`;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryItem | null>(null);

  // ── URL param helpers ──
  const setSalaryParam = useCallback((params: { action?: string; salary?: string } | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('action'); next.delete('salary');
      if (params?.action) next.set('action', params.action);
      if (params?.salary) next.set('salary', params.salary);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const openAddDialog = useCallback(() => {
    setAddDialogOpen(true);
    setSalaryParam({ action: 'add' });
  }, [setSalaryParam]);

  const openFilesDialog = useCallback(() => {
    setFilesDialogOpen(true);
    setSalaryParam({ action: 'files' });
  }, [setSalaryParam]);

  const openEditModal = useCallback((item: SalaryItem) => {
    setEditingRecord(item);
    setEditDialogOpen(true);
    setSalaryParam({ salary: item.id });
  }, [setSalaryParam]);

  const handleCloseAdd = useCallback((open: boolean) => {
    setAddDialogOpen(open);
    if (!open) setSalaryParam(null);
  }, [setSalaryParam]);

  const handleCloseEdit = useCallback((open: boolean) => {
    setEditDialogOpen(open);
    if (!open) { setEditingRecord(null); setSalaryParam(null); }
  }, [setSalaryParam]);

  const handleCloseFiles = useCallback((open: boolean) => {
    setFilesDialogOpen(open);
    if (!open) setSalaryParam(null);
  }, [setSalaryParam]);

  // ── Auto-open from URL ──
  const actionFromUrl = searchParams.get('action');
  const salaryIdFromUrl = searchParams.get('salary');
  useEffect(() => {
    if (actionFromUrl === 'add' && !addDialogOpen) {
      setAddDialogOpen(true);
    }
    if (actionFromUrl === 'files' && !filesDialogOpen) {
      setFilesDialogOpen(true);
    }
    if (salaryIdFromUrl && !editDialogOpen) {
      const match = salaryItems.find(s => s.id === salaryIdFromUrl);
      if (match) { setEditingRecord(match); setEditDialogOpen(true); }
    }
  }, [actionFromUrl, salaryIdFromUrl, salaryItems]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && salaryItems.length === 0) return <SalaryPageSkeleton />;

  return (
    <div className="h-full space-y-4 px-2 py-2 page-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bérek / járulékok</h1>
          <p className="text-muted-foreground">Alkalmazottak bérének és járulékainak kezelése</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openFilesDialog}>
            <FileText className="mr-2 h-4 w-4" />
            Feltöltött fájlok
          </Button>
          <SalaryFilesDialog open={filesDialogOpen} onOpenChange={handleCloseFiles} />
          <Button onClick={openAddDialog} disabled={!writable} title={!writable ? 'Nincs írási jogosultságod' : undefined}>
            <Plus className="mr-2 h-4 w-4" />
            KP kifizetés
          </Button>
        </div>
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
        isSingleMonth={isSingleMonth}
        periodLabel={periodLabel}
      />

      {/* NAV Summary Table */}
      <NavSummaryTable navItems={navItems} onEdit={openEditModal} isSingleMonth={isSingleMonth} periodLabel={periodLabel} />

      {/* Dialogs */}
      <SalaryAddDialog
        open={addDialogOpen}
        onOpenChange={handleCloseAdd}
        onSubmit={(form) => addMutation.mutate(form)}
      />
      <SalaryEditDialog
        open={editDialogOpen}
        onOpenChange={handleCloseEdit}
        record={editingRecord}
        onSubmit={(id, form) => editMutation.mutate({ id, form })}
      />
    </div>
  );
}
