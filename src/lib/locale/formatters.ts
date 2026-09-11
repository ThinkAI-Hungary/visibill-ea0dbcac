import i18n from '@/lib/i18n';
import { format } from 'date-fns';
import { hu, hr } from 'date-fns/locale';

/**
 * Returns the currently active language code ('hu' | 'hr').
 */
export function getActiveLocale(): 'hu' | 'hr' {
  const lng = i18n.language || 'hu';
  return lng.startsWith('hr') ? 'hr' : 'hu';
}

/**
 * Returns the corresponding date-fns Locale object.
 */
export function getDateFnsLocale() {
  return getActiveLocale() === 'hr' ? hr : hu;
}

/**
 * Format currency amount taking the active language into account.
 * When in Croatian mode ('hr') and no currency is explicitly passed or default is used,
 * formats with 'EUR' and 'hr-HR' locale formatting.
 */
export function formatCurrencyLocale(
  amount: number,
  currency?: string,
  compact?: boolean
): string {
  const currentLang = getActiveLocale();
  const isHr = currentLang === 'hr';

  // In Croatian mode, default to EUR unless explicitly specified otherwise
  const targetCurrency = currency || (isHr ? 'EUR' : 'HUF');
  const isHUF = targetCurrency.toUpperCase() === 'HUF';

  if (compact && Math.abs(amount) >= 1000000) {
    const val = (amount / 1000000).toFixed(2).replace('.', ',');
    return isHr ? `${val} M €` : `${val} M Ft`;
  }

  const localeCode = isHr ? 'hr-HR' : 'hu-HU';
  return new Intl.NumberFormat(localeCode, {
    style: 'currency',
    currency: targetCurrency,
    minimumFractionDigits: isHUF ? 0 : 2,
    maximumFractionDigits: isHUF ? 0 : 2,
  }).format(amount);
}

/**
 * Format dates using localized patterns:
 * - HR default: 'dd.MM.yyyy.'
 * - HU default: 'yyyy. MMM dd.'
 */
export function formatDateLocale(
  date: Date | string | number | null | undefined,
  pattern?: string
): string {
  if (!date) return '';
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const currentLang = getActiveLocale();
  const defaultPattern = currentLang === 'hr' ? 'dd.MM.yyyy.' : 'yyyy. MMM dd.';

  return format(d, pattern || defaultPattern, { locale: getDateFnsLocale() });
}

/**
 * Alias for formatDateLocale.
 */
export const formatDate = formatDateLocale;

/**
 * Alias for formatCurrencyLocale.
 */
export const formatCurrency = formatCurrencyLocale;

/**
 * Format numbers with localized decimal and thousands separators.
 */
export function formatNumberLocale(
  amount: number,
  maxFractionDigits: number = 2
): string {
  const localeCode = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';
  return new Intl.NumberFormat(localeCode, {
    maximumFractionDigits: maxFractionDigits,
  }).format(amount);
}
