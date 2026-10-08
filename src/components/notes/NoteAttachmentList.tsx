import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  Trash2,
  Paperclip,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FilePreviewModal,
  useFilePreview,
} from '@/components/ui/FilePreviewModal';
import {
  formatAttachmentSize,
  getAttachmentPublicUrl,
} from '@/lib/upload-note-attachment';
import type { NoteAttachment } from '@/types/notes';
import { cn } from '@/lib/utils';

export interface NoteAttachmentListProps {
  attachments: NoteAttachment[];
  canDelete?: boolean;
  onDelete?: (attachment: NoteAttachment) => Promise<void> | void;
  className?: string;
}

export function NoteAttachmentList({
  attachments,
  canDelete = false,
  onDelete,
  className,
}: NoteAttachmentListProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { previewFile, openPreview, closePreview } = useFilePreview();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) {
    return null;
  }

  const handleDelete = async (att: NoteAttachment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    setDeletingId(att.id);
    try {
      await onDelete(att);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (att: NoteAttachment, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = att.public_url || getAttachmentPublicUrl(att.file_path);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.file_name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenPreview = (att: NoteAttachment) => {
    const url = att.public_url || getAttachmentPublicUrl(att.file_path);
    openPreview({ url, name: att.file_name });
  };

  return (
    <>
      <div className={cn('space-y-1.5 pt-2', className)}>
        <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <Paperclip className="h-3 w-3 text-primary/70" />
          <span>{t('invoices:attachments.attached_files_title', 'Csatolt állományok ({{count}} db)', { count: attachments.length })}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const isPdf =
              att.content_type === 'application/pdf' ||
              att.file_name.toLowerCase().endsWith('.pdf');
            const isTig =
              att.file_name.toLowerCase().includes('tig') ||
              att.file_name.toLowerCase().includes('teljesites');
            const isDeleting = deletingId === att.id;

            return (
              <div
                key={att.id}
                onClick={() => handleOpenPreview(att)}
                className="group relative flex items-center justify-between gap-2 p-2 rounded-lg border border-border/60 bg-background/50 hover:bg-muted/40 hover:border-border transition-all cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-md bg-muted/60 shrink-0">
                    {isPdf ? (
                      <FileText className="h-4 w-4 text-rose-500" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className="text-xs font-medium text-foreground truncate max-w-[140px] sm:max-w-[170px]"
                        title={att.file_name}
                      >
                        {att.file_name}
                      </p>
                      {isTig && (
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        >
                          TIG
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      {formatAttachmentSize(att.file_size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenPreview(att);
                    }}
                    title={t('common:preview', 'Előnézet')}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={(e) => handleDownload(att, e)}
                    title={t('common:download', 'Letöltés')}
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete && onDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isDeleting}
                      onClick={(e) => handleDelete(att, e)}
                      title={t('common:delete', 'Törlés')}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </>
  );
}
