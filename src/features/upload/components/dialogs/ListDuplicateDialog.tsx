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
import { buttonVariants } from '@/components/ui/button';

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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
            <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0" />
            Fájl már szerepel a listában
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left space-y-2">
            <span>
              A kiválasztott fájlok közül az alábbiak már hozzá lettek adva a feltöltési listához:
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

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Mégse
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onConfirm('skip')}
            className="bg-primary hover:bg-primary/90"
          >
            Duplikátumok kihagyása
          </AlertDialogAction>
          <AlertDialogAction
            onClick={() => onConfirm('addAll')}
            className={buttonVariants({ variant: 'outline' })}
          >
            Mind hozzáadása
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
