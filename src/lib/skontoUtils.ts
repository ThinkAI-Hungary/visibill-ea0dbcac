import { addDays, differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';

export interface CalculateSkontoParams {
  grossAmount: number;
  issueDate: string | Date;
  skontoDays: number;
  skontoPercent: number;
  shippingAmount?: number | null;
  currentDate?: string | Date;
}

export interface SkontoCalculationResult {
  skontoDueDate: string;
  discountBase: number;
  discountAmount: number;
  skontoAmount: number;
  savedAmount: number;
  daysRemaining: number;
  isExpired: boolean;
}

/**
 * Calculates prompt payment discount (Skontó), due date, and remaining validity.
 * Excludes shipping costs from the discount base if shippingAmount is provided (GEWA-rule).
 */
export function calculateSkonto({
  grossAmount,
  issueDate,
  skontoDays,
  skontoPercent,
  shippingAmount = 0,
  currentDate,
}: CalculateSkontoParams): SkontoCalculationResult {
  const safeGross = Math.max(0, grossAmount || 0);
  const safeShipping = Math.max(0, shippingAmount || 0);
  const safePercent = Math.max(0, skontoPercent || 0);
  const safeDays = Math.max(0, skontoDays || 0);

  // Parse issue date
  let parsedIssueDate: Date;
  if (issueDate instanceof Date) {
    parsedIssueDate = issueDate;
  } else if (typeof issueDate === 'string' && issueDate) {
    parsedIssueDate = parseISO(issueDate);
  } else {
    parsedIssueDate = new Date();
  }

  if (!isValid(parsedIssueDate)) {
    parsedIssueDate = new Date();
  }

  // Calculate skonto due date
  const calculatedDueDate = addDays(parsedIssueDate, safeDays);
  const skontoDueDate = format(calculatedDueDate, 'yyyy-MM-dd');

  // Determine current reference date
  let parsedCurrentDate: Date;
  if (currentDate instanceof Date) {
    parsedCurrentDate = currentDate;
  } else if (typeof currentDate === 'string' && currentDate) {
    parsedCurrentDate = parseISO(currentDate);
  } else {
    parsedCurrentDate = new Date();
  }

  if (!isValid(parsedCurrentDate)) {
    parsedCurrentDate = new Date();
  }

  // Calculate calendar days remaining
  const daysRemaining = differenceInCalendarDays(calculatedDueDate, parsedCurrentDate);
  const isExpired = daysRemaining < 0;

  // Discount base: Gross amount minus shipping costs
  const discountBase = Math.max(0, safeGross - safeShipping);

  // Discount amount rounded to whole currency unit (HUF)
  const discountAmount = Math.round(discountBase * (safePercent / 100));
  const skontoAmount = Math.max(0, safeGross - discountAmount);

  return {
    skontoDueDate,
    discountBase,
    discountAmount,
    skontoAmount,
    savedAmount: discountAmount,
    daysRemaining,
    isExpired,
  };
}

/** Regex patterns detecting shipping/transportation items in invoices */
export const SHIPPING_ITEM_REGEX = /(?:transport|shipping|fracht|fuvard[ií]j|sz[aá]ll[ií]t[aá]s|posta|delivery|porto)/i;

export interface InvoiceLineItemCandidate {
  line_description?: string | null;
  termek_nev?: string | null;
  gross_amount?: number | null;
  brutto_ar?: number | null;
  net_amount?: number | null;
  unit_price?: number | null;
}

/**
 * Scans invoice line items for shipping / freight charges and calculates their total.
 */
export function detectShippingAmount(items?: InvoiceLineItemCandidate[] | null): number {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return 0;
  }

  let totalShipping = 0;
  for (const item of items) {
    const text = (item.line_description || item.termek_nev || '').trim();
    if (text && SHIPPING_ITEM_REGEX.test(text)) {
      const gross = item.gross_amount ?? item.brutto_ar ?? item.net_amount ?? item.unit_price ?? 0;
      totalShipping += Math.max(0, gross);
    }
  }

  return Math.round(totalShipping);
}

/**
 * Formats the payment transfer narrative (közlemény) with skonto indicator when active.
 * E.g.: "4000749568 (Skonto 2%)" or "4000749568"
 */
export function formatTransferNarrative(
  invoiceNumber: string,
  isSkonto: boolean,
  skontoPercent?: number | null
): string {
  const cleanNumber = (invoiceNumber || '').trim();
  if (!isSkonto) return cleanNumber;

  const percentLabel = skontoPercent && skontoPercent > 0 ? ` ${skontoPercent}%` : '';
  return `${cleanNumber} (Skonto${percentLabel})`.trim();
}
