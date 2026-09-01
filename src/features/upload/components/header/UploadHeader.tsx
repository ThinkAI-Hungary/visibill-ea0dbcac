import React from 'react';
import { Upload, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadHeaderProps {
  onOpenFilesModal: () => void;
}

export function UploadHeader({ onOpenFilesModal }: UploadHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-8 w-8 text-primary" />
          Dokumentumok feltöltése
        </h1>
        <p className="text-muted-foreground mt-1">
          Tölts fel számlákat, pénztárbizonylatokat, béradatokat, tranzakciókat vagy futár riportokat automatikus feldolgozásra.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onOpenFilesModal}
          className="gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          Feltöltött fájlok
        </Button>
      </div>
    </div>
  );
}
