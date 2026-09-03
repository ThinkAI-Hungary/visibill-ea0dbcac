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
];
export const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp",
  "pdf",
  "csv",
  "xls", "xlsx",
  "xml",
];

export function isAllowedTicketFile(file: File): boolean {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return ALLOWED_EXTENSIONS.includes(ext);
}

const BUCKET = "ticket-attachments";

export async function uploadTicketImage(
  file: File,
  userId: string,
  ticketId: string
): Promise<string> {
  if (!isAllowedTicketFile(file)) {
    throw new Error("Csak kép (JPEG, PNG, GIF, WebP), PDF, CSV, Excel és XML fájlok engedélyezettek.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A fájl mérete nem haladhatja meg a 10 MB-ot.");
  }

  const rawExt = file.name.split(".").pop() || "png";
  const ext = rawExt.toLowerCase();
  const path = `${ticketId}/${userId}/${crypto.randomUUID()}.${ext}`;

  const contentType = (file.type && ALLOWED_TYPES.includes(file.type))
    ? file.type
    : (ext === 'xml' ? 'application/xml' : ext === 'csv' ? 'text/csv' : ext === 'pdf' ? 'application/pdf' : file.type || undefined);

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
