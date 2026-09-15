import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Trash2, Tag, Folder } from 'lucide-react';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';

export function InvoiceBulkActionsBar() {
  const { t } = useTranslation(['invoices', 'common']);
  const {
    activeSelection,
    isSubmittedTab,
    categories,
    projects,
    exportableInvoices,
    handleBulkCategoryChange,
    handleBulkProjectChange,
    setBulkDeleteDialogOpen,
    clearSelection,
  } = useInvoiceContext();

  const [stagedCategory, setStagedCategory] = React.useState<string | null>(null);
  const [stagedProject, setStagedProject] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  // Reset staged changes whenever active selection is cleared
  React.useEffect(() => {
    if (activeSelection.size === 0) {
      setStagedCategory(null);
      setStagedProject(null);
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

  if (activeSelection.size === 0) return null;

  const selectedItems = exportableInvoices.filter(inv => activeSelection.has(inv.id));
  const sums: Record<string, number> = {};
  selectedItems.forEach(inv => {
    const currency = inv.currency || 'HUF';
    sums[currency] = (sums[currency] || 0) + (inv.gross_amount || 0);
  });
  const sumStrings = Object.entries(sums).map(([ccy, amt]) => formatCurrencyLocale(amt, ccy));

  const isDirty = stagedCategory !== null || stagedProject !== null;

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      if (stagedCategory !== null) {
        await handleBulkCategoryChange(stagedCategory === 'none' ? null : stagedCategory);
      }
      if (stagedProject !== null) {
        await handleBulkProjectChange(stagedProject === 'none' ? null : stagedProject);
      }
      setStagedCategory(null);
      setStagedProject(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setStagedCategory(null);
    setStagedProject(null);
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

      {/* Project Select with search bar */}
      <FloatingBulkBar.Select
        value={stagedProject}
        onValueChange={(val) => setStagedProject(val)}
        placeholder={t('invoices:bulk_actions.project_placeholder', 'Projekt...')}
        searchPlaceholder={t('invoices:bulk_actions.project_search', 'Keresés projektre...')}
        emptyText={t('invoices:bulk_actions.project_empty', 'Nincs ilyen projekt')}
        icon={<Folder className="w-3.5 h-3.5" />}
        options={projectOptions}
        popoverWidth="w-[220px]"
      />

      {/* Delete action on submitted tab */}
      {isSubmittedTab && (
        <Button
          variant="destructive"
          size="sm"
          className="h-9 text-xs gap-1.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all shrink-0"
          onClick={() => setBulkDeleteDialogOpen(true)}
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t('invoices:bulk_actions.delete', 'Törlés')}
        </Button>
      )}
    </FloatingBulkBar>
  );
}
