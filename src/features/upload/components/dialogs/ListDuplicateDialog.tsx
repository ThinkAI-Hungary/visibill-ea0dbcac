import React from 'react';
import { AlertCircle } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';

interface ListDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileNames: string[];
  onConfirm: (action: 'skip' | 'addAll') => void;
}

export function ListDuplicateDialog({
  open,
  onOpenChange,
  fileNames,
  onConfirm,
}: ListDuplicateDialogProps) {
  const { t } = useTranslation(['upload', 'common']);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0" />
            {t('upload:dialogs.list_duplicate.title', 'Fájl már szerepel a listában')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span>
              {t('upload:dialogs.list_duplicate.description', 'A kiválasztott fájlok közül az alábbiak már hozzá lettek adva a feltöltési listához:')}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-1.5 my-2 max-h-48 overflow-y-auto pr-1">
          {fileNames.map((name) => (
            <div key={name} className="text-xs p-2 rounded bg-muted/40 font-mono truncate" title={name}>
              {name}
            </div>
          ))}
        </div>

        <AlertDialogFooter className="flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:space-x-0">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('upload:dialogs.list_duplicate.cancel', 'Mégse')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm('addAll')}
            className="border border-border bg-background text-foreground hover:bg-accent/50 hover:text-accent-foreground shadow-sm"
          >
            {t('upload:dialogs.list_duplicate.add_all', 'Mind hozzáadása')}
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => onConfirm('skip')}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {t('upload:dialogs.list_duplicate.skip', 'Duplikátumok kihagyása')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

