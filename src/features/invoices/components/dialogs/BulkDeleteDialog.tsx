import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useInvoiceContext } from '../../context/useInvoiceContext';
import { Trash2, Loader2 } from 'lucide-react';

export function BulkDeleteDialog() {
  const { t } = useTranslation(['invoices', 'common']);
  const {
    bulkDeleteDialogOpen,
    setBulkDeleteDialogOpen,
    activeSelection,
    handleBulkDeleteSubmitted,
  } = useInvoiceContext();

  const [isDeleting, setIsDeleting] = useState(false);

  const count = activeSelection.size;

  const handleDeleteOnlyRows = async () => {
    setIsDeleting(true);
    try {
      await handleBulkDeleteSubmitted('row_only');
      setBulkDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRowsAndFiles = async () => {
    setIsDeleting(true);
    try {
      await handleBulkDeleteSubmitted('row_and_file');
      setBulkDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog
      open={bulkDeleteDialogOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen && !isDeleting) setBulkDeleteDialogOpen(false);
      }}
    >
      <AlertDialogContent className="max-w-md border-border bg-card">
        <AlertDialogHeader className="w-full min-w-0">
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            {t('invoices:dialogs.bulk_delete.title', 'Kijelölt bizonylatok törlése')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1.5 w-full min-w-0">
              <p className="text-sm text-foreground">
                {t('invoices:dialogs.bulk_delete.description_prefix', 'Válaszd ki a kijelölt')}{' '}
                <span className="font-semibold text-primary">{count} {t('invoices:dialogs.bulk_delete.pieces', 'db')}</span>{' '}
                {t('invoices:dialogs.bulk_delete.description_suffix', 'számla törlésének módját:')}
              </p>
              <p className="text-xs text-muted-foreground">{t('invoices:dialogs.bulk_delete.cannot_undo', 'Ez a művelet nem vonható vissza.')}</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2.5 py-1 w-full min-w-0">
          {/* Opció 1: Csak a számlasorok törlése */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteOnlyRows}
            className="w-full text-left p-3.5 rounded-lg border border-border/70 hover:border-amber-500/60 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">1</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400">
                  {t('invoices:dialogs.bulk_delete.option_row_only_title', 'Csak a számlasorok törlése')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('invoices:dialogs.bulk_delete.option_row_only_desc', 'A kijelölt számlák sorai törlődnek a nyilvántartásból, de az eredetileg feltöltött dokumentumfájlok megmaradnak az adatbázisban.')}
                </p>
              </div>
            </div>
          </button>

          {/* Opció 2: Számlasorok és feltöltött fájlok törlése */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={handleDeleteRowsAndFiles}
            className="w-full text-left p-3.5 rounded-lg border border-red-200 dark:border-red-900/40 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="text-xs font-bold text-red-600 dark:text-red-400">2</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-destructive">
                  {t('invoices:dialogs.bulk_delete.option_row_and_file_title', 'Számlasorok és feltöltött fájlok törlése')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('invoices:dialogs.bulk_delete.option_row_and_file_desc', 'A kijelölt számlák sorai és a hozzájuk tartozó eredeti feltöltött fájlok is véglegesen törlődnek a tárhelyről és az adatbázisból.')}
                </p>
              </div>
            </div>
          </button>
        </div>

        {isDeleting && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">{t('invoices:dialogs.bulk_delete.deleting', 'Törlés folyamatban...')}</span>
          </div>
        )}

        <AlertDialogFooter className="w-full min-w-0 mt-2">
          <AlertDialogCancel disabled={isDeleting}>{t('common:actions.cancel', 'Mégse')}</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
