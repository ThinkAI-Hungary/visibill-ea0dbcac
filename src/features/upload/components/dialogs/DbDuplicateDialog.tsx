import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslation } from 'react-i18next';

interface DbDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateFileNames: string[];
  selectedDuplicates: Set<string>;
  onToggleDuplicate: (fileName: string) => void;
  onSelectAllDuplicates: (selectAll: boolean) => void;
  onConfirm: (reuploadNames: Set<string>) => void;
  nonDuplicateCount: number;
}

export function DbDuplicateDialog({
  open,
  onOpenChange,
  duplicateFileNames,
  selectedDuplicates,
  onToggleDuplicate,
  onSelectAllDuplicates,
  onConfirm,
  nonDuplicateCount,
}: DbDuplicateDialogProps) {
  const { t } = useTranslation(['upload', 'common']);
  const allSelected = duplicateFileNames.length > 0 && duplicateFileNames.every(name => selectedDuplicates.has(name));
  const totalFilesToUpload = nonDuplicateCount + selectedDuplicates.size;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            {t('upload:dialogs.db_duplicate.title', 'Már feltöltött fájlok észlelve')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span>
              {t('upload:dialogs.db_duplicate.description', 'A kiválasztott fájlok közül az alábbiak már korábban fel lettek töltve ehhez a céghez. Jelöld be azokat a fájlokat, amelyeket szándékosan újra szeretnél tölteni:')}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 my-2 max-h-60 overflow-y-auto pr-1">
          {duplicateFileNames.length > 1 && (
            <div className="flex items-center space-x-2 pb-2 border-b">
              <Checkbox
                id="select-all-duplicates"
                checked={allSelected}
                onCheckedChange={(checked) => onSelectAllDuplicates(!!checked)}
              />
              <label
                htmlFor="select-all-duplicates"
                className="text-xs font-semibold cursor-pointer select-none"
              >
                {t('upload:dialogs.db_duplicate.select_all', 'Összes duplikátum kijelölése újrafeltöltésre')}
              </label>
            </div>
          )}

          {duplicateFileNames.map((name) => (
            <div key={name} className="flex items-center space-x-2 p-2 rounded bg-muted/40 hover:bg-muted/70 transition-colors">
              <Checkbox
                id={`dupe-${name}`}
                checked={selectedDuplicates.has(name)}
                onCheckedChange={() => onToggleDuplicate(name)}
              />
              <label
                htmlFor={`dupe-${name}`}
                className="text-xs font-medium truncate cursor-pointer select-none"
                title={name}
              >
                {name}
              </label>
            </div>
          ))}
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:space-x-0">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('upload:dialogs.db_duplicate.cancel', 'Mégse')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(selectedDuplicates)}
            disabled={totalFilesToUpload === 0}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {selectedDuplicates.size > 0
              ? t('upload:dialogs.db_duplicate.upload_count', { count: totalFilesToUpload, defaultValue: `Feltöltés (${totalFilesToUpload} fájl)` })
              : nonDuplicateCount > 0
              ? t('upload:dialogs.db_duplicate.upload_new_only', { count: nonDuplicateCount, defaultValue: `Csak az új fájlok feltöltése (${nonDuplicateCount})` })
              : t('upload:dialogs.db_duplicate.none_selected', 'Nincs kijelölve')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

