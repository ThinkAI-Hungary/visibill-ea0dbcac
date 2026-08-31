/**
 * Hungarian character encoding, transliteration, and formatting utilities.
 */

/**
 * jsPDF standard Helvetica only supports Latin-1 (ISO 8859-1).
 * Hungarian double-acute letters ő/ő/ű/Ű are Latin-2 (ISO 8859-2).
 * This function transliterates ő->ö, Ő->Ö, ű->ü, Ű->Ü for clear, error-free PDF rendering.
 */
export function normalizeHungarianForPdf(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .replace(/ő/g, 'ö')
    .replace(/Ő/g, 'Ö')
    .replace(/ű/g, 'ü')
    .replace(/Ű/g, 'Ü');
}

/**
 * Formats a number according to Hungarian locale standards (space separator).
 */
export function formatHungarianNumber(value: unknown, decimals: number = 0): string {
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

/**
 * Formats monetary amounts with Hungarian currency symbol.
 */
export function formatHungarianCurrency(amount: unknown, currency: string = 'HUF'): string {
  const num = typeof amount === 'number' ? amount : Number(amount);
  if (isNaN(num)) return `0 ${currency}`;
  const formatted = formatHungarianNumber(num, 0);
  return `${formatted} ${currency}`;
}

/**
 * Formats dates in standard Hungarian YYYY.MM.DD. format.
 */
export function formatHungarianDate(date: unknown): string {
  if (!date) return '';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : (date as Date);
    if (isNaN(d.getTime())) return String(date);
    return d.toLocaleDateString('hu-HU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).replace(/\s/g, '');
  } catch {
    return String(date);
  }
}

/**
 * Sanitizes a cell value for standard CSV export, quoting if commas or newlines are present.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value == null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}
