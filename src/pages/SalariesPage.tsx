import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { useSalaryData } from '@/hooks/useSalaryData';
import { useEaisybillPermissions } from '@/hooks/useEaisybillPermissions';
import { useDateRange } from '@/contexts/DateRangeContext';
import SalaryPageSkeleton from '@/components/salaries/SalaryPageSkeleton';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Users, Wheat } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SalaryKpiCards } from '@/components/salaries/SalaryKpiCards';
import { EmployeeAccordion } from '@/components/salaries/EmployeeAccordion';
import { NavSummaryTable } from '@/components/salaries/NavSummaryTable';
import { SalaryAddDialog, SalaryEditDialog } from '@/components/salaries/SalaryDialogs';
import { SalaryFilesDialog } from '@/components/salaries/SalaryFilesTable';
import { PurchaseVouchersTab } from '@/features/purchase-vouchers/components/PurchaseVouchersTab';
import type { SalaryItem } from '@/lib/salary-helpers';
import { useTranslation } from 'react-i18next';

export default function SalariesPage() {
  const { t } = useTranslation(['hr', 'common']);
  const {
    salaryItems, loading, employeeGroups, navItems,
    metrics, addMutation, editMutation,
  } = useSalaryData();

  const { dateFrom, dateTo } = useDateRange();
  const { canWrite: canWriteModule } = useEaisybillPermissions();
  const writable = canWriteModule('salaries');
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'salaries';

  const dateFnsLocale = getDateFnsLocale();
  const isSingleMonth = dateFrom.getFullYear() === dateTo.getFullYear()
    && dateFrom.getMonth() === dateTo.getMonth();
  const periodLabel = isSingleMonth
    ? format(dateFrom, 'yyyy. MMM', { locale: dateFnsLocale })
    : `${format(dateFrom, 'yyyy. MMM d.', { locale: dateFnsLocale })} – ${format(dateTo, 'yyyy. MMM d.', { locale: dateFnsLocale })}`;

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filesDialogOpen, setFilesDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<SalaryItem | null>(null);

  const handleTabChange = useCallback((newTab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newTab === 'salaries') {
        next.delete('tab');
      } else {
        next.set('tab', newTab);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

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

  if (loading && salaryItems.length === 0 && currentTab !== 'purchase_vouchers') return <SalaryPageSkeleton />;

  return (
    <div className="h-full space-y-4 px-2 py-2 page-animate">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('hr:salaries.title', 'Bérek / járulékok')}</h1>
          <p className="text-muted-foreground">{t('hr:salaries.subtitle', 'Alkalmazottak bérének és járulékainak kezelése')}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentTab === 'salaries' && (
            <>
              <Button variant="outline" onClick={openFilesDialog}>
                <FileText className="mr-2 h-4 w-4" />
                {t('hr:salaries.uploaded_files', 'Feltöltött fájlok')}
              </Button>
              <Button onClick={openAddDialog} disabled={!writable} title={!writable ? t('common:no_permission', 'Nincs írási jogosultságod') : undefined}>
                <Plus className="mr-2 h-4 w-4" />
                {t('hr:salaries.cash_payout', 'KP kifizetés')}
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="salaries" className="gap-2">
            <Users className="h-4 w-4" />
            {t('hr:salaries.tabs.overview', 'Alkalmazottak & NAV')}
          </TabsTrigger>
          <TabsTrigger value="purchase_vouchers" className="gap-2">
            <Wheat className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            {t('hr:salaries.tabs.purchase_vouchers', 'Felvásárlási jegyek')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="salaries" className="space-y-4 mt-0">
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
        </TabsContent>

        <TabsContent value="purchase_vouchers" className="mt-0">
          <PurchaseVouchersTab />
        </TabsContent>
      </Tabs>

      {/* Salary Dialogs */}
      <SalaryFilesDialog open={filesDialogOpen} onOpenChange={handleCloseFiles} />
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
