import React, { useRef } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ChannelConfig } from '../../types';

interface UploadDropzoneProps {
  config: ChannelConfig;
  dragOver: boolean;
  setDragOver: (dragOver: boolean) => void;
  onFilesAdded: (files: File[]) => void;
  writable: boolean;
}

export function UploadDropzone({
  config,
  dragOver,
  setDragOver,
  onFilesAdded,
  writable,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const Icon = config.icon;

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (writable) setDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (!writable) return;

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      onFilesAdded(files);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFilesAdded(files);
    }
    e.target.value = '';
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
        dragOver
          ? 'border-primary bg-primary/5 scale-[1.01] shadow-sm'
          : 'border-muted-foreground/25 hover:border-muted-foreground/40'
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Icon
        className={cn(
          'h-12 w-12 mb-4 transition-colors',
          dragOver ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      <div className="space-y-2">
        <p className="text-sm font-medium">
          {dragOver
            ? 'Engedd el a fájlokat a feltöltéshez'
            : config.dragPrompt}
        </p>
        <p className="text-xs text-muted-foreground">
          Több fájlt is kiválaszthatsz egyszerre vagy egyenként is feltöltheted
        </p>
      </div>
      <Button
        className="mt-4"
        onClick={() => inputRef.current?.click()}
        disabled={!writable}
      >
        <Upload className="h-4 w-4 mr-2" />
        Fájlok tallózása
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={config.allowedExtensions.join(',')}
        onChange={handleInputChange}
        className="hidden"
      />
    </div>
  );
}
