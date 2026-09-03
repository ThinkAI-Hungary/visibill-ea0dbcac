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

/** Fix Hungarian character encoding bugs where accents are corrupted due to PDF font or DB encoding issues. */
export function fixCharacterEncoding(str: string | null | undefined): string {
  if (!str) return '';
  
  // Protect valid email addresses
  const emails: string[] = [];
  let s = str.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, (m) => {
    emails.push(m);
    return `___EMAIL_${emails.length - 1}___`;
  });

  s = s
    // Single character PDF font corruptions
    .replace(/ø/g, 'ó')
    .replace(/Ø/g, 'Ó')
    .replace(/ù/g, 'ő')
    .replace(/Ù/g, 'Ő')
    .replace(/ì/g, 'ő')
    .replace(/ï/g, 'ü')
    .replace(/î/g, 'ű')
    .replace(/›/g, 'í')
    .replace(/‹/g, 'í')
    .replace(/©/g, 'é')
    .replace(/@/g, 'é')
    .replace(/>/g, 'í')
    .replace(/</g, 'í')
    .replace(/£/g, 'á')
    .replace(/¶/g, 'Á')
    .replace(/½/g, ' É')
    .replace(/ë/g, 'ó')
    .replace(/õ/g, 'ő')
    .replace(/Õ/g, 'Ő')
    .replace(/û/g, 'ű')
    .replace(/Û/g, 'Ű')
    .replace(/ẽ/g, 'á')
    // Common multi-character corruptions from PDF bank statements
    .replace(/Kényvelés/g, 'Könyvelés')
    .replace(/Kézlem/g, 'Közlem')
    .replace(/El[ìíõi]jegyzett/g, 'Előjegyzett')
    .replace(/El[ìíõi]jegyzettd[íi›>]j/g, 'Előjegyzett díj')
    .replace(/Előjegyzettd[íi›>]j/g, 'Előjegyzett díj')
    .replace(/Elíjegyzettd>j/g, 'Előjegyzett díj')
    .replace(/Elíjegyzet/g, 'Előjegyzett')
    .replace(/Elõjegyzett/g, 'Előjegyzett')
    .replace(/Előjegyzettdíj/g, 'Előjegyzett díj')
    .replace(/\bésszeg/g, 'összeg')
    .replace(/\bésszes/g, 'összes')
    .replace(/bankonbelüli/g, 'bankon belüli')
    .replace(/bankonbelïli/g, 'bankon belüli')
    // Fix common ? replacements in system strings
    .replace(/Banki tranzakci\?/gi, 'Banki tranzakció')
    .replace(/tranzakci\?/gi, 'tranzakció')
    .replace(/Bej\?v\?/gi, 'Bejövő')
    .replace(/Kimen\?/gi, 'Kimenő')
    .replace(/K\?lts\?g/gi, 'Költség')
    .replace(/Bev\?tel/gi, 'Bevétel')
    .replace(/Besorolatlan t\?telek/gi, (m) => m.toUpperCase() === m ? 'BESOROLATLAN TÉTELEK' : 'Besorolatlan tételek')
    .replace(/elt\?r\? sablonb\?l/gi, (m) => m.toUpperCase() === m ? 'ELTÉRŐ SABLONBÓL' : 'Eltérő sablonból')
    .replace(/sablonb\?l/gi, (m) => m.toUpperCase() === m ? 'SABLONBÓL' : 'sablonból');

  // Restore emails
  emails.forEach((em, idx) => {
    s = s.replace(`___EMAIL_${idx}___`, em);
  });

  return s;
}

/**
 * Strips all HTML tags and decodes common HTML entities from a string.
 * Replaces block boundaries and breaks with a space to avoid accidental word concatenation.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return '';

  return html
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Helper to find a clean word break point near the preferred limit.
 */
function findWordBreak(text: string, preferredLimit: number): number {
  if (text.length <= preferredLimit) return text.length;
  const spaceIndex = text.lastIndexOf(' ', preferredLimit);
  if (spaceIndex > 25) {
    return spaceIndex;
  }
  return preferredLimit;
}

/**
 * Extracts a clean title and preview snippet from ticket message (which may contain rich HTML).
 * Uses intelligent word-boundary breaking and paragraph awareness (Option A) to prevent cutting words in half.
 */
export function getTicketSummary(message: string | null | undefined): { title: string; preview: string } {
  if (!message) return { title: '', preview: '' };

  // First convert HTML block tags and breaks to newlines so paragraph structure is preserved
  const formatted = message
    .replace(/<\/(p|div|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n');

  // Split by newlines into distinct blocks/paragraphs and strip HTML
  const lines = formatted
    .split('\n')
    .map(line => stripHtml(line))
    .filter(line => line.length > 0);

  if (lines.length === 0) {
    return { title: '', preview: '' };
  }

  // If there's only 1 line/paragraph
  if (lines.length === 1) {
    const single = lines[0];
    if (single.length <= 60) {
      return { title: single, preview: '' };
    }
    const breakPoint = findWordBreak(single, 55);
    const title = single.substring(0, breakPoint).trim();
    const rest = single.substring(breakPoint).trim();
    const preview = rest.length > 70 ? rest.substring(0, 70).trim() + '…' : rest;
    return { title, preview };
  }

  // Multiple lines/paragraphs:
  // If first line is a short greeting (e.g. "Szia!", "Helló!"), merge with second line
  let titleCandidate = lines[0];
  let restLines = lines.slice(1);

  if (titleCandidate.length <= 15 && restLines.length > 0) {
    titleCandidate = `${titleCandidate} ${restLines[0]}`.trim();
    restLines = restLines.slice(1);
  }

  if (titleCandidate.length <= 65) {
    const restText = restLines.join(' ').trim();
    const preview = restText.length > 70 ? restText.substring(0, 70).trim() + '…' : restText;
    return { title: titleCandidate, preview };
  }

  // First paragraph itself is very long: break it at word boundary
  const breakPoint = findWordBreak(titleCandidate, 55);
  const title = titleCandidate.substring(0, breakPoint).trim();
  const restOfFirst = titleCandidate.substring(breakPoint).trim();
  const allRest = [restOfFirst, ...restLines].filter(Boolean).join(' ').trim();
  const preview = allRest.length > 70 ? allRest.substring(0, 70).trim() + '…' : allRest;

  return { title, preview };
}
