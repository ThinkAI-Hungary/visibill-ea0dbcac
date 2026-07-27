import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = 'HUF', compact?: boolean): string {
  if (compact && Math.abs(amount) >= 1000000) {
    return `${(amount / 1000000).toFixed(2).replace('.', ',')} M Ft`;
  }
  const isHUF = currency.toUpperCase() === 'HUF';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: isHUF ? 0 : 2,
    maximumFractionDigits: isHUF ? 0 : 2,
  }).format(amount);
}

/** Format a byte count into a human-readable string (e.g. 1.2 KB, 3.4 MB). */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Extract the storage path from a Supabase public URL.
 * E.g. "https://xxx.supabase.co/storage/v1/object/public/invoice-uploads/userId/file.pdf"
 * → "userId/file.pdf"
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  try {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(publicUrl.slice(idx + marker.length));
  } catch {
    return null;
  }
}

/** Fix Hungarian character encoding bugs where accents are replaced by ? due to database migration encoding issues. */
export function fixCharacterEncoding(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/Besorolatlan t\?telek/gi, (m) => m.toUpperCase() === m ? 'BESOROLATLAN TÉTELEK' : 'Besorolatlan tételek')
    .replace(/elt\?r\? sablonb\?l/gi, (m) => m.toUpperCase() === m ? 'ELTÉRŐ SABLONBÓL' : 'Eltérő sablonból')
    .replace(/sablonb\?l/gi, (m) => m.toUpperCase() === m ? 'SABLONBÓL' : 'sablonból');
}
