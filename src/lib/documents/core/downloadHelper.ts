/**
 * Safe client-side file download helper for DocumentEngine.
 * Handles Blob generation, UTF-8 BOM prefixing, programmatic clicks,
 * and automatic memory cleanup (URL.revokeObjectURL).
 */

export interface DownloadOptions {
  filename: string;
  mimeType: string;
  addUtf8Bom?: boolean;
}

/**
 * Initiates a browser file download for a given Blob.
 * Cleans up DOM elements and revokes ObjectURL automatically.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  link.setAttribute('aria-hidden', 'true');

  document.body.appendChild(link);
  link.click();

  // Defer removal and cleanup to allow browser download to start
  setTimeout(() => {
    try {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if element is already detached
    }
  }, 1000);
}

/**
 * Creates a Blob from string content and triggers browser download.
 * Adds UTF-8 BOM if requested (crucial for Hungarian Excel CSV compatibility).
 */
export function downloadString(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8',
  addUtf8Bom: boolean = false
): void {
  const parts: BlobPart[] = [];
  if (addUtf8Bom) {
    parts.push('\uFEFF');
  }
  parts.push(content);

  const blob = new Blob(parts, { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Creates an ephemeral Object URL for previewing in iframes or new tabs.
 */
export function createPreviewBlobUrl(content: string, mimeType: string = 'text/html;charset=utf-8'): string {
  if (typeof window === 'undefined') return '';
  const blob = new Blob([content], { type: mimeType });
  return URL.createObjectURL(blob);
}
