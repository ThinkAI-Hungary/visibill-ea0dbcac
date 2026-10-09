import { supabase } from "@/integrations/supabase/client";
import { reportError } from '@/lib/errorReporter';

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/xml",
  "text/xml",
  "text/markdown",
  "text/x-markdown",
];
export const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp",
  "pdf",
  "csv",
  "xls", "xlsx",
  "xml",
  "md",
  "markdown",
];

export function isAllowedTicketFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Standardizes files pasted from clipboard (e.g. Snipping tool, screenshots)
 * which often have generic names like "image.png" or "blob".
 */
export function sanitizeClipboardFile(file: File): File {
  if (file.type.startsWith('image/') && (!file.name || file.name === 'image.png' || file.name === 'blob')) {
    const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return new File([file], `beillesztett_kep_${timestamp}.${ext}`, {
      type: file.type,
      lastModified: Date.now(),
    });
  }
  return file;
}

/**
 * Extracts all valid files from a clipboard paste event (e.g. Ctrl+V with image or copied files).
 */
export function extractFilesFromClipboard(event: React.ClipboardEvent | ClipboardEvent): File[] {
  const files: File[] = [];
  const clipboardData = (event as any).clipboardData;
  if (!clipboardData) return files;

  // 1. Check direct clipboardData.files (e.g. copied files in file manager)
  if (clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f && f.size > 0) {
        files.push(sanitizeClipboardFile(f));
      }
    }
  }

  // 2. Check clipboardData.items (e.g. PrtScn / Snipping tool screenshots in clipboard)
  if (files.length === 0 && clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file') {
        const blob = item.getAsFile();
        if (blob) {
          files.push(sanitizeClipboardFile(blob));
        }
      }
    }
  }

  const uniqueFiles: File[] = [];
  const seen = new Set<string>();
  for (const f of files) {
    const key = `${f.size}-${f.type}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFiles.push(f);
    }
  }

  return uniqueFiles;
}

const BUCKET = "ticket-attachments";

export async function uploadTicketImage(
  file: File,
  userId: string,
  ticketId: string
): Promise<string> {
  if (!isAllowedTicketFile(file)) {
    throw new Error("Csak kép (JPEG, PNG, GIF, WebP), PDF, CSV, Excel, XML és Markdown (.md) fájlok engedélyezettek.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A fájl mérete nem haladhatja meg a 10 MB-ot.");
  }

  const rawExt = file.name.split(".").pop() || "png";
  const ext = rawExt.toLowerCase();
  const path = `${ticketId}/${userId}/${crypto.randomUUID()}.${ext}`;

  const contentType = (file.type && ALLOWED_TYPES.includes(file.type))
    ? file.type
    : (ext === 'xml'
        ? 'application/xml'
        : ext === 'csv'
        ? 'text/csv'
        : ext === 'pdf'
        ? 'application/pdf'
        : (ext === 'md' || ext === 'markdown')
        ? 'text/markdown; charset=utf-8'
        : file.type || undefined);

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType,
  });

  if (error) {
    reportError({ type: 'upload', component: 'uploadTicketImage', action: 'storageUpload', message: 'Ticket attachment upload failed', error, context: { ticketId, fileType: file.type, fileSize: file.size } });
    throw error;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

