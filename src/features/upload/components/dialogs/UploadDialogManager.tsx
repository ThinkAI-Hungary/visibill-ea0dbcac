import React from 'react';
import { DbDuplicateDialog } from './DbDuplicateDialog';
import { ListDuplicateDialog } from './ListDuplicateDialog';
import type { useDocumentUpload } from '../../hooks/useDocumentUpload';

interface UploadDialogManagerProps {
  activeUploadState: ReturnType<typeof useDocumentUpload>;
}

export function UploadDialogManager({ activeUploadState }: UploadDialogManagerProps) {
  const {
    dbDuplicateDialogOpen,
    setDbDuplicateDialogOpen,
    dbDuplicateFileNames,
    selectedDbDuplicates,
    setSelectedDbDuplicates,
    confirmDbDuplicates,
    listDuplicateDialogOpen,
    setListDuplicateDialogOpen,
    listDuplicateFileNames,
    confirmListDuplicates,
    selectedFiles,
  } = activeUploadState;

  const nonDuplicateCount = Math.max(0, selectedFiles.length - dbDuplicateFileNames.length);

  const handleToggleDuplicate = (name: string) => {
    setSelectedDbDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectAllDuplicates = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedDbDuplicates(new Set(dbDuplicateFileNames));
    } else {
      setSelectedDbDuplicates(new Set());
    }
  };

  return (
    <>
      <DbDuplicateDialog
        open={dbDuplicateDialogOpen}
        onOpenChange={setDbDuplicateDialogOpen}
        duplicateFileNames={dbDuplicateFileNames}
        selectedDuplicates={selectedDbDuplicates}
        onToggleDuplicate={handleToggleDuplicate}
        onSelectAllDuplicates={handleSelectAllDuplicates}
        onConfirm={confirmDbDuplicates}
        nonDuplicateCount={nonDuplicateCount}
      />

      <ListDuplicateDialog
        open={listDuplicateDialogOpen}
        onOpenChange={setListDuplicateDialogOpen}
        fileNames={listDuplicateFileNames}
        onConfirm={confirmListDuplicates}
      />
    </>
  );
}
