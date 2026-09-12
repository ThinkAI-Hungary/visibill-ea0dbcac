/**
 * Profit and Loss (Eredménykimutatás / Račun dobiti i gubitka) localization utilities.
 */

const KNOWN_PNL_ROW_CODES = new Set([
  'I', 'II', 'III', 'IV', 'V', 'VI', 'VII',
  'A', 'VIII', 'IX', 'B', 'C', 'X', 'D'
]);

/**
 * Returns the localized name for a statutory P&L row code.
 * Falls back to the provided default name (e.g. from the database table public.pnl_structure).
 */
export function getLocalizedPnlRowName(
  rowCode: string | null | undefined,
  defaultName: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!rowCode) return defaultName || '';
  const cleanCode = rowCode.replace(/\.$/, '').trim().toUpperCase();

  if (KNOWN_PNL_ROW_CODES.has(cleanCode)) {
    return t(`accounting:profit_and_loss.rows.${cleanCode}`, {
      defaultValue: defaultName || ''
    });
  }

  return defaultName || '';
}
