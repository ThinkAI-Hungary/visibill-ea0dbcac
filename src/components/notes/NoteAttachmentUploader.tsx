import React, { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Paperclip, UploadCloud, X, FileText, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MAX_ATTACHMENT_SIZE,
  ALLOWED_ATTACHMENT_EXTENSIONS,
  isAllowedAttachmentFile,
  formatAttachmentSize,
} from '@/lib/upload-note-attachment';
import { cn } from '@/lib/utils';

export interface NoteAttachmentUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
  className?: string;
}

export function NoteAttachmentUploader({
  files,
  onFilesChange,
  disabled = false,
  className,
}: NoteAttachmentUploaderProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateAndAddFiles = useCallback(
    (newFiles: FileList | File[]) => {
      setErrorMessage(null);
      const validFiles: File[] = [];
      const rejectedReasons: string[] = [];

      Array.from(newFiles).forEach((file) => {
        if (!isAllowedAttachmentFile(file)) {
          rejectedReasons.push(`${file.name}: Nem támogatott típus (csak PDF vagy kép)`);
          return;
        }
        if (file.size > MAX_ATTACHMENT_SIZE) {
          rejectedReasons.push(`${file.name}: Túl nagy fájl (max 20 MB)`);
          return;
        }
        // Avoid duplicate by name + size
        const alreadyExists = files.some(
          (f) => f.name === file.name && f.size === file.size
        );
        if (!alreadyExists) {
          validFiles.push(file);
        }
      });

      if (rejectedReasons.length > 0) {
        setErrorMessage(rejectedReasons.join('; '));
      }

      if (validFiles.length > 0) {
        onFilesChange([...files, ...validFiles]);
      }
    },
    [files, onFilesChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        validateAndAddFiles(e.dataTransfer.files);
      }
    },
    [disabled, validateAndAddFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        validateAndAddFiles(e.target.files);
      }
      // Reset input value so re-selecting same file triggers onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [validateAndAddFiles]
  );

  const handleRemoveFile = useCallback(
    (index: number) => {
      const next = files.filter((_, i) => i !== index);
      onFilesChange(next);
      if (next.length === 0) {
        setErrorMessage(null);
      }
    },
    [files, onFilesChange]
  );

  return (
    <div className={cn('space-y-2.5', className)}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {/* Drop area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center p-3 rounded-lg border-2 border-dashed transition-all cursor-pointer select-none text-center',
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border/60 bg-muted/20 hover:bg-muted/40 hover:border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
          <UploadCloud className="h-4 w-4 text-primary shrink-0" />
          <span>{t('invoices:attachments.drop_or_browse', 'Húzd ide a fájlokat vagy kattints a tallózáshoz')}</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {t('invoices:attachments.supported_formats', 'PDF, JPEG, PNG, WebP (pl. TIG, szerződés, max 20 MB/fájl)')}
        </p>
      </div>

      {/* Validation error */}
      {errorMessage && (
        <div className="flex items-start gap-1.5 p-2 rounded-md bg-destructive/10 text-destructive text-[11px] leading-tight">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Selected file preview queue */}
      {files.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            {t('invoices:attachments.queued_files', 'Csatolásra kijelölt állományok ({{count}} db)', { count: files.length })}
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, idx) => {
              const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
              return (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 p-1.5 px-2 rounded-md bg-background border border-border/60 text-xs shadow-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isPdf ? (
                      <FileText className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                    )}
                    <span className="font-medium truncate max-w-[220px]" title={file.name}>
                      {file.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      ({formatAttachmentSize(file.size)})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(idx);
                    }}
                    disabled={disabled}
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
