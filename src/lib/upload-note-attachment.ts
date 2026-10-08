import { supabase } from '@/integrations/supabase/client';
import { reportError } from '@/lib/errorReporter';
import type { NoteAttachment } from '@/types/notes';

export const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024; // 20 MB
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];

export const ATTACHMENT_BUCKET = 'invoice-attachments';

export function isAllowedAttachmentFile(file: File): boolean {
  if (ALLOWED_ATTACHMENT_TYPES.includes(file.type)) return true;
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext);
}

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getAttachmentPublicUrl(filePath: string): string {
  const { data } = supabase.storage.from(ATTACHMENT_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadNoteAttachment(
  file: File,
  companyId: string,
  noteId: string
): Promise<NoteAttachment> {
  if (!isAllowedAttachmentFile(file)) {
    throw new Error('Csak PDF és képformátumok (JPEG, PNG, WebP) engedélyezettek.');
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('A fájl mérete nem haladhatja meg a 20 MB-ot.');
  }

  const rawExt = file.name.split('.').pop() || 'pdf';
  const ext = rawExt.toLowerCase();
  const safeExt = ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext) ? ext : 'pdf';
  const fileName = file.name.trim();
  const filePath = `${companyId}/${noteId}/${crypto.randomUUID()}.${safeExt}`;

  const contentType = (file.type && ALLOWED_ATTACHMENT_TYPES.includes(file.type))
    ? file.type
    : (safeExt === 'pdf' ? 'application/pdf' : `image/${safeExt === 'jpg' ? 'jpeg' : safeExt}`);

  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (uploadError) {
    reportError({
      type: 'upload',
      component: 'uploadNoteAttachment',
      action: 'storageUpload',
      message: 'Note attachment upload failed',
      error: uploadError,
      context: { noteId, companyId, fileName, fileSize: file.size },
    });
    throw uploadError;
  }

  const { data: record, error: dbError } = await supabase
    .from('note_attachments')
    .insert({
      note_id: noteId,
      company_id: companyId,
      file_name: fileName,
      file_path: filePath,
      file_size: file.size,
      content_type: contentType,
    })
    .select()
    .single();

  if (dbError) {
    // Cleanup orphaned storage file
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([filePath]);
    reportError({
      type: 'database',
      component: 'uploadNoteAttachment',
      action: 'dbInsert',
      message: 'Note attachment metadata insert failed',
      error: dbError,
      context: { noteId, companyId, filePath },
    });
    throw dbError;
  }

  return {
    ...record,
    public_url: getAttachmentPublicUrl(record.file_path),
  };
}

export async function uploadMultipleNoteAttachments(
  files: File[],
  companyId: string,
  noteId: string
): Promise<NoteAttachment[]> {
  const uploaded: NoteAttachment[] = [];
  for (const file of files) {
    const item = await uploadNoteAttachment(file, companyId, noteId);
    uploaded.push(item);
  }
  return uploaded;
}

export async function deleteNoteAttachment(
  attachmentId: string,
  filePath: string
): Promise<void> {
  // 1. Remove storage file
  const { error: storageError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .remove([filePath]);

  if (storageError) {
    console.warn('Storage removal warning (might already be deleted):', storageError);
  }

  // 2. Remove DB record
  const { error: dbError } = await supabase
    .from('note_attachments')
    .delete()
    .eq('id', attachmentId);

  if (dbError) {
    reportError({
      type: 'database',
      component: 'deleteNoteAttachment',
      action: 'dbDelete',
      message: 'Note attachment deletion failed',
      error: dbError,
      context: { attachmentId, filePath },
    });
    throw dbError;
  }
}
