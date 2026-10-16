import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Trash2, Tag, Folder, Percent, X, Ban, Clock, RotateCcw, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
import { cn } from '@/lib/utils';
import { ItemProjectAllocationPopover } from '@/components/invoices/ItemProjectAllocationPopover';
import { useInvoiceItemProjectAllocations } from '../../hooks/useInvoiceItemProjectAllocations';
import { BulkExclusionDialog } from '../dialogs/BulkExclusionDialog';
import type { ItemProjectAllocation } from '@/types/invoices';

interface InheritedProjectInfo {
  hasMultiProjects: boolean;
  allocations: ItemProjectAllocation[];
  projectId: string | null;
}

function getInheritedProjectInfo(
  selectedItems: any[],
  itemProjectSummaries?: Record<string, any>
): InheritedProjectInfo | null {
  if (selectedItems.length === 0) return null;

  // Pass 1: Prioritize multi-project allocations across all selected items
  for (const inv of selectedItems) {
    const summary = itemProjectSummaries?.[inv.id];
    if (summary && summary.totalProjectCount > 0 && (summary.hasMultiProjects || summary.allocations?.length > 1)) {
      return {
        hasMultiProjects: true,
        allocations: summary.allocations.map((a: any) => ({
          project_id: a.projectId,
          percentage: a.percentage ?? 0,
        })),
        projectId: null,
      };
    }

    if (inv.project_allocations && Array.isArray(inv.project_allocations) && inv.project_allocations.length > 1) {
      return {
        hasMultiProjects: true,
        allocations: inv.project_allocations.map((a: any) => ({
          project_id: a.project_id,
          percentage: Number(a.percentage) || 0,
        })),
        projectId: null,
      };
    }
  }

  // Pass 2: Look for single project allocation across all selected items
  for (const inv of selectedItems) {
    const summary = itemProjectSummaries?.[inv.id];
    if (summary && summary.totalProjectCount > 0 && summary.singleProjectId) {
      return {
        hasMultiProjects: false,
        allocations: [{ project_id: summary.singleProjectId, percentage: 100 }],
        projectId: summary.singleProjectId,
      };
    }

    if (inv.project_allocations && Array.isArray(inv.project_allocations) && inv.project_allocations.length === 1) {
      return {
        hasMultiProjects: false,
        allocations: [{ project_id: inv.project_allocations[0].project_id, percentage: Number(inv.project_allocations[0].percentage) || 100 }],
        projectId: inv.project_allocations[0].project_id,
      };
    }

    if (inv.project_id) {
      return {
        hasMultiProjects: false,
        allocations: [{ project_id: inv.project_id, percentage: 100 }],
        projectId: inv.project_id,
      };
    }
  }

  return null;
}

export function InvoiceBulkActionsBar() {
  const { t } = useTranslation(['invoices', 'common']);
  const {
    companyId,
    activeSelection,
    isSubmittedTab,
    categories,
    projects,
    exportableInvoices,
    handleBulkCategoryChange,
    handleBulkProjectChange,
    handleBulkExcludeFromAccounting,
    setBulkDeleteDialogOpen,
    clearSelection,
    itemsDialogOpen,
    submittedItemsDialogOpen,
    imageDialogOpen,
    editDialogOpen,
    createDialogOpen,
    filesDialogOpen,
    syncDialogOpen,
    bulkDeleteDialogOpen,
    approvalDialogOpen,
    suggestedLinkDialogOpen,
    dataExportDialogOpen,
    selectedNavInvoice,
    selectedSubmittedForItems,
    pdfExport,
  } = useInvoiceContext();

  const [stagedCategory, setStagedCategory] = React.useState<string | null>(null);
  const [stagedProject, setStagedProject] = React.useState<string | null>(null);
  const [stagedAllocations, setStagedAllocations] = React.useState<ItemProjectAllocation[] | null>(null);
  const [isMultiProjectOpen, setIsMultiProjectOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  // Accounting Exclusion Dialog state
  const [exclusionDialogOpen, setExclusionDialogOpen] = React.useState(false);
  const [exclusionDialogType, setExclusionDialogType] = React.useState<'PERMANENT' | 'DEFERRED_VAT'>('DEFERRED_VAT');
  const [isExclusionLoading, setIsExclusionLoading] = React.useState(false);

  // Selected invoices list
  const selectedItems = React.useMemo(
    () => exportableInvoices.filter((inv) => activeSelection.has(inv.id)),
    [exportableInvoices, activeSelection]
  );

  const selectedIds = React.useMemo(() => Array.from(activeSelection), [activeSelection]);

  // Fetch line-item level project allocations for selected invoices
  const { data: itemProjectSummaries } = useInvoiceItemProjectAllocations(
    companyId,
    selectedIds,
    isSubmittedTab ? 'submitted' : 'nav'
  );

  // Look for existing project assignment across selected items to prefill display and popover
  const inheritedProjectInfo = React.useMemo(
    () => getInheritedProjectInfo(selectedItems, itemProjectSummaries),
    [selectedItems, itemProjectSummaries]
  );

  // What is displayed in the Project dropdown
  const effectiveProjectValue = stagedProject !== null
    ? stagedProject
    : (stagedAllocations && stagedAllocations.length > 1
        ? 'CUSTOM_SPLIT'
        : (inheritedProjectInfo?.hasMultiProjects
            ? 'CUSTOM_SPLIT'
            : (inheritedProjectInfo?.projectId || null)));

  // What is displayed/passed into ItemProjectAllocationPopover
  const effectiveAllocations = React.useMemo(() => {
    if (stagedAllocations !== null) {
      return stagedAllocations;
    }
    if (stagedProject !== null) {
      if (stagedProject === 'CUSTOM_SPLIT') {
        return inheritedProjectInfo?.allocations || null;
      }
      if (stagedProject === 'none') {
        return null;
      }
      return [{ project_id: stagedProject, percentage: 100 }];
    }
    return inheritedProjectInfo?.allocations || null;
  }, [stagedAllocations, stagedProject, inheritedProjectInfo]);

  const effectiveSingleProjectId = React.useMemo(() => {
    if (stagedProject !== null) {
      return (stagedProject === 'CUSTOM_SPLIT' || stagedProject === 'none') ? null : stagedProject;
    }
    return inheritedProjectInfo?.projectId || null;
  }, [stagedProject, inheritedProjectInfo]);

  // Reset staged changes whenever active selection is cleared
  React.useEffect(() => {
    if (activeSelection.size === 0) {
      setStagedCategory(null);
      setStagedProject(null);
      setStagedAllocations(null);
      setIsMultiProjectOpen(false);
    }
  }, [activeSelection.size]);

  const categoryOptions = React.useMemo(() => [
    { value: 'none', label: t('invoices:bulk_actions.category_none', 'Nincs kategória') },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ], [categories, t]);

  const projectOptions = React.useMemo(() => [
    { value: 'none', label: t('invoices:bulk_actions.project_none', 'Nincs projekt') },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ], [projects, t]);

  const isAnyModalOpen =
    Boolean(itemsDialogOpen) ||
    Boolean(submittedItemsDialogOpen) ||
    Boolean(imageDialogOpen) ||
    Boolean(editDialogOpen) ||
    Boolean(createDialogOpen) ||
    Boolean(filesDialogOpen) ||
    Boolean(syncDialogOpen) ||
    Boolean(bulkDeleteDialogOpen) ||
    Boolean(approvalDialogOpen) ||
    Boolean(suggestedLinkDialogOpen) ||
    Boolean(dataExportDialogOpen) ||
    Boolean(selectedNavInvoice) ||
    Boolean(selectedSubmittedForItems) ||
    Boolean(pdfExport?.dialogOpen);

  if (activeSelection.size === 0 || isAnyModalOpen) return null;

  const anyExcluded = selectedItems.some((inv: any) => !!inv.exclude_from_accounting);
  const allExcluded = selectedItems.length > 0 && selectedItems.every((inv: any) => !!inv.exclude_from_accounting);

  const sums: Record<string, number> = {};
  selectedItems.forEach((inv) => {
    const currency = inv.currency || 'HUF';
    sums[currency] = (sums[currency] || 0) + (inv.gross_amount || 0);
  });
  const sumStrings = Object.entries(sums).map(([ccy, amt]) => formatCurrencyLocale(amt, ccy));

  const isDirty = stagedCategory !== null || stagedProject !== null || stagedAllocations !== null;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      if (stagedCategory !== null) {
        await handleBulkCategoryChange(stagedCategory === 'none' ? null : stagedCategory);
      }
      if (stagedAllocations !== null) {
        await handleBulkProjectChange(stagedAllocations.length > 0 ? stagedAllocations : null);
      } else if (stagedProject !== null) {
        await handleBulkProjectChange(stagedProject === 'none' ? null : stagedProject);
      }
      setStagedCategory(null);
      setStagedProject(null);
      setStagedAllocations(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setStagedCategory(null);
    setStagedProject(null);
    setStagedAllocations(null);
    setIsMultiProjectOpen(false);
    clearSelection();
  };

  return (
    <FloatingBulkBar
      count={activeSelection.size}
      label={t('invoices:bulk_actions.label', 'Kijelölt számlák:')}
      details={
        sumStrings.length > 0 ? (
          <span>
            {t('invoices:bulk_actions.total_label', 'Összesen:')} <span className="font-bold text-foreground">{sumStrings.join(', ')}</span>
          </span>
        ) : undefined
      }
      onSave={handleSave}
      saveLabel={t('invoices:bulk_actions.save', 'Mentés')}
      isDirty={isDirty}
      isSaving={isSaving}
      onCancel={handleCancel}
    >
      {/* Category Select with search bar */}
      <FloatingBulkBar.Select
        value={stagedCategory}
        onValueChange={(val) => setStagedCategory(val)}
        placeholder={t('invoices:bulk_actions.category_placeholder', 'Kategória...')}
        searchPlaceholder={t('invoices:bulk_actions.category_search', 'Keresés kategóriára...')}
        emptyText={t('invoices:bulk_actions.category_empty', 'Nincs ilyen kategória')}
        icon={<Tag className="w-3.5 h-3.5" />}
        options={categoryOptions}
        popoverWidth="w-[220px]"
      />

      {/* Project Select with search bar & Multi-project allocation */}
      <div className="flex items-center gap-1.5">
        <FloatingBulkBar.Select
          value={effectiveProjectValue}
          onValueChange={(val) => {
            if (val === 'CUSTOM_SPLIT') {
              setIsMultiProjectOpen(true);
            } else {
              setStagedProject(val);
              setStagedAllocations(null);
            }
          }}
          placeholder={t('invoices:bulk_actions.project_placeholder', 'Projekt...')}
          searchPlaceholder={t('invoices:bulk_actions.project_search', 'Keresés projektre...')}
          emptyText={t('invoices:bulk_actions.project_empty', 'Nincs ilyen projekt')}
          icon={<Folder className="w-3.5 h-3.5" />}
          options={[
            ...projectOptions,
            {
              value: 'CUSTOM_SPLIT',
              label: `% ${t('invoices:bulk_actions.multi_project_split', 'Több projekt (% felosztás)...')}`,
            },
          ]}
          popoverWidth="w-[240px]"
        />

        <ItemProjectAllocationPopover
          open={isMultiProjectOpen}
          onOpenChange={setIsMultiProjectOpen}
          currentAllocations={effectiveAllocations}
          currentProjectId={effectiveSingleProjectId}
          projectList={projects}
          lineDescription={t('invoices:bulk_actions.items_count', {
            count: activeSelection.size,
            defaultValue: `${activeSelection.size} db számla`,
          })}
          onSave={async (allocs) => {
            setStagedAllocations(allocs);
            if (allocs && allocs.length > 0) {
              setStagedProject(allocs.length === 1 ? allocs[0].project_id : 'CUSTOM_SPLIT');
            } else {
              setStagedProject('none');
            }
            setIsMultiProjectOpen(false);
          }}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            style={{ outline: 'none' }}
            className={cn(
              "h-9 px-2.5 text-xs font-medium gap-1.5 rounded-lg",
              isMultiProjectOpen
                ? "border-primary/80 bg-accent/40 text-foreground"
                : effectiveAllocations && effectiveAllocations.length > 1
                ? "bg-primary/10 hover:bg-primary/15 border-primary/40 text-primary font-semibold"
                : "bg-background/80 hover:bg-primary/10 hover:text-primary border-border/70 hover:border-primary/40",
              "data-[state=open]:border-primary/80 data-[state=open]:bg-accent/40",
              "transition-colors duration-150",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
              "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
              "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
            )}
            title={
              effectiveAllocations && effectiveAllocations.length > 1
                ? "Költségmegosztás szerkesztése"
                : "Költségmegosztás több projekt között (%)"
            }
          >
            <Percent className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="hidden sm:inline">
              {effectiveAllocations && effectiveAllocations.length > 1
                ? `${effectiveAllocations.length} projekt (100%)`
                : 'Megosztás (%)'}
            </span>
          </Button>
        </ItemProjectAllocationPopover>

        {/* Clear multi-project allocation if explicitly staged */}
        {stagedAllocations && stagedAllocations.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            style={{ outline: 'none' }}
            className={cn(
              "h-8 w-8 text-muted-foreground hover:text-foreground",
              "transition-colors duration-150",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
              "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
              "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
            )}
            title="Allokáció törlése"
            onClick={() => {
              setStagedAllocations(null);
              setStagedProject('none');
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Accounting Exclusion Action (Nem könyvelem ▾) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            style={{ outline: 'none' }}
            className={cn(
              "h-9 px-2.5 text-xs font-medium gap-1.5 rounded-lg shrink-0",
              allExcluded
                ? "bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-400 font-semibold"
                : anyExcluded
                  ? "bg-primary/5 hover:bg-primary/10 border-primary/30 text-foreground"
                  : "bg-background border-border/80 hover:border-primary/50 hover:bg-accent/40 text-foreground",
              "transition-colors duration-150",
              "outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0",
              "[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]",
              "[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]"
            )}
            title={t('invoices:bulk_actions.accounting_title', 'Könyvelési státusz csoportos módosítása')}
          >
            <Ban className={cn("w-3.5 h-3.5 shrink-0", allExcluded ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")} />
            <span className="hidden sm:inline">
              {allExcluded
                ? t('invoices:bulk_actions.excluded_all', 'Kizárva')
                : t('invoices:bulk_actions.not_accounting', 'Nem könyvelem')}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          sideOffset={8}
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="z-50 w-64 p-1 bg-popover border border-border shadow-2xl rounded-lg text-xs"
        >
          <DropdownMenuItem
            className="flex items-center gap-2 py-2 px-2.5 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 rounded-md font-medium"
            onClick={async () => {
              await handleBulkExcludeFromAccounting('PERMANENT');
            }}
          >
            <Ban className="w-4 h-4 shrink-0 text-destructive" />
            <div className="flex flex-col">
              <span>{t('invoices:bulk_actions.exclude_permanent', 'Végleges kizárás (Nem könyvelem)')}</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {t('invoices:bulk_actions.exclude_permanent_hint', 'Magánjellegű, nem a cég költsége')}
              </span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            className="flex items-center gap-2 py-2 px-2.5 cursor-pointer focus:bg-amber-500/10 focus:text-amber-700 dark:focus:text-amber-300 rounded-md font-medium"
            onClick={() => {
              setExclusionDialogType('DEFERRED_VAT');
              setExclusionDialogOpen(true);
            }}
          >
            <Clock className="w-4 h-4 shrink-0 text-amber-500" />
            <div className="flex flex-col">
              <span>{t('invoices:bulk_actions.exclude_deferred', 'Kérdéses számla (Halasztott ÁFA)...')}</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                {t('invoices:bulk_actions.exclude_deferred_hint', '2 éves határidővel, indoklással')}
              </span>
            </div>
          </DropdownMenuItem>

          {(anyExcluded || allExcluded) && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem
                className="flex items-center gap-2 py-2 px-2.5 cursor-pointer text-emerald-600 dark:text-emerald-400 focus:bg-emerald-500/10 rounded-md font-medium"
                onClick={async () => {
                  await handleBulkExcludeFromAccounting(null);
                }}
              >
                <RotateCcw className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div className="flex flex-col">
                  <span>{t('invoices:bulk_actions.restore_accounting', 'Könyvelésbe visszaállítás')}</span>
                  <span className="text-[10px] text-muted-foreground font-normal">
                    {t('invoices:bulk_actions.restore_accounting_hint', 'Szerepeljen a feladásokban és az ÁFA-ban')}
                  </span>
                </div>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BulkExclusionDialog
        open={exclusionDialogOpen}
        onOpenChange={setExclusionDialogOpen}
        count={activeSelection.size}
        exclusionType={exclusionDialogType}
        onConfirm={async (reason) => {
          setIsExclusionLoading(true);
          try {
            await handleBulkExcludeFromAccounting(exclusionDialogType, reason);
          } finally {
            setIsExclusionLoading(false);
          }
        }}
        isSubmitting={isExclusionLoading}
      />

      {/* Delete action on submitted tab */}
      {isSubmittedTab && (
        <Button
          variant="destructive"
          size="sm"
          className="h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm hover:shadow transition-colors duration-150 shrink-0"
          onClick={() => setBulkDeleteDialogOpen(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('invoices:bulk_actions.delete', 'Törlés')}
        </Button>
      )}
    </FloatingBulkBar>
  );
}
