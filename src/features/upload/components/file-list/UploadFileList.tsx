import React from 'react';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UploadFileItem } from './UploadFileItem';
import type { ChannelConfig, SelectedFileItem } from '../../types';

interface UploadFileListProps {
  files: SelectedFileItem[];
  config: ChannelConfig;
  uploading: boolean;
  writable: boolean;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onStartUpload: () => void;
}

export function UploadFileList({
  files,
  config,
  uploading,
  writable,
  onRemoveFile,
  onClearFiles,
  onStartUpload,
}: UploadFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm text-foreground">
          Kiválasztott fájlok ({files.length})
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFiles}
          disabled={uploading || !writable}
          className="text-xs text-muted-foreground hover:text-destructive gap-1 h-7 px-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Összes törlése
        </Button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {files.map((item, index) => (
          <UploadFileItem
            key={`${item.file.name}-${index}`}
            item={item}
            index={index}
            config={config}
            onRemove={onRemoveFile}
            disabled={uploading || !writable}
          />
        ))}
      </div>

      <Button
        onClick={onStartUpload}
        disabled={uploading || !writable || files.length === 0}
        className="w-full h-10 font-medium"
      >
        {uploading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Feldolgozás folyamatban...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            {config.actionButtonLabel(files.length)}
          </>
        )}
      </Button>
    </div>
  );
}
