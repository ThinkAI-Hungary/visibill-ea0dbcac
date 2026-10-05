import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Image as ImageIcon, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';

interface InvoiceDocumentDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function InvoiceDocumentDropzone({
  file,
  onFileChange,
  disabled = false,
}: InvoiceDocumentDropzoneProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (disabled) return;
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(f.type) && !f.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: t('common:status.error'),
        description: t('invoices:manual_create.dropzone.alert_invalid_type'),
        variant: 'destructive',
      });
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast({
        title: t('common:status.error'),
        description: t('invoices:manual_create.dropzone.alert_file_too_large'),
        variant: 'destructive',
      });
      return;
    }
    onFileChange(f);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPdf = file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <UploadCloud className="h-3.5 w-3.5 text-primary" />
        {t('invoices:manual_create.dropzone.label')}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {file ? (
        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn(
              "w-8 h-8 rounded-md flex items-center justify-center shrink-0",
              isPdf ? "bg-rose-500/10 text-rose-500" : "bg-blue-500/10 text-blue-500"
            )}>
              {isPdf ? <FileText className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground truncate max-w-[280px]">
                {file.name}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span className="text-emerald-500 font-medium flex items-center gap-0.5">
                  <CheckCircle2 className="h-3 w-3" /> {t('invoices:manual_create.dropzone.attached_badge')}
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onFileChange(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            disabled={disabled}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={cn(
            "border border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center gap-1",
            isDragOver ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/50 hover:bg-muted/10",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <div className="text-xs font-medium text-foreground">
            {t('invoices:manual_create.dropzone.prompt')} <span className="text-primary underline">{t('invoices:manual_create.dropzone.browse')}</span>
          </div>
          <div className="text-[10px] text-muted-foreground">
            {t('invoices:manual_create.dropzone.supported_formats')}
          </div>
        </div>
      )}
    </div>
  );
}
