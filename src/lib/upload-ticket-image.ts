import { supabase } from "@/integrations/supabase/client";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const BUCKET = "ticket-attachments";

export async function uploadTicketImage(
  file: File,
  userId: string,
  ticketId: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Csak kép (JPEG, PNG, GIF, WebP), PDF és CSV fájlok engedélyezettek.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("A fájl mérete nem haladhatja meg a 10 MB-ot.");
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${ticketId}/${userId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
