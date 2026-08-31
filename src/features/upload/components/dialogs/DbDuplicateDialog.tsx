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
  const allSelected = duplicateFileNames.length > 0 && duplicateFileNames.every(name => selectedDuplicates.has(name));
  const totalFilesToUpload = nonDuplicateCount + selectedDuplicates.size;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            Már feltöltött fájlok észlelve
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span>
              A kiválasztott fájlok közül az alábbiak már korábban fel lettek töltve ehhez a céghez.
              Jelöld be azokat a fájlokat, amelyeket szándékosan <strong>újra szeretnél tölteni</strong>:
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
                Összes duplikátum kijelölése újrafeltöltésre
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

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Mégse
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm(selectedDuplicates)}
            disabled={totalFilesToUpload === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {selectedDuplicates.size > 0
              ? `Feltöltés (${totalFilesToUpload} fájl)`
              : nonDuplicateCount > 0
              ? `Csak az új fájlok feltöltése (${nonDuplicateCount})`
              : 'Nincs kijelölve'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
