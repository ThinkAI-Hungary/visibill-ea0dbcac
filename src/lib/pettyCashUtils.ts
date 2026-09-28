/**
 * Házipénztár segédfüggvények és dinamikus lokalizáció.
 */

export function getLocalizedRegisterName(
  name: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!name) return '';
  const trimmed = name.trim();
  if (trimmed === 'Központi pénztár') {
    return t('pettyCash:registers.default_name', { defaultValue: 'Központi pénztár' });
  }
  return name;
}

export function getLocalizedEntryDescription(
  desc: string | null | undefined,
  t: (key: any, ...args: any[]) => any
): string {
  if (!desc) return '—';

  // Check if starts with "Pénztári bevétel - "
  if (desc.startsWith('Pénztári bevétel - ')) {
    const partner = desc.substring('Pénztári bevétel - '.length).trim();
    const localizedPartner = partner === 'Ismeretlen'
      ? t('pettyCash:entries.unknown_partner', { defaultValue: 'Ismeretlen' })
      : partner;
    return t('pettyCash:entries.auto_desc_outbound', {
      partner: localizedPartner,
      defaultValue: desc,
    });
  }

  // Check if starts with "Pénztári kiadás - "
  if (desc.startsWith('Pénztári kiadás - ')) {
    const partner = desc.substring('Pénztári kiadás - '.length).trim();
    const localizedPartner = partner === 'Ismeretlen'
      ? t('pettyCash:entries.unknown_partner', { defaultValue: 'Ismeretlen' })
      : partner;
    return t('pettyCash:entries.auto_desc_inbound', {
      partner: localizedPartner,
      defaultValue: desc,
    });
  }

  return desc;
}

const CASH_PAYMENT_KEYWORDS = ['készpénz', 'keszpenz', 'cash', 'penztar', 'pénztár', 'kp'];

/**
 * Returns true if the payment method string indicates cash payment.
 */
export function isCashPaymentMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  const m = method.toLowerCase().trim();
  return CASH_PAYMENT_KEYWORDS.some(kw => m.includes(kw));
}

/**
 * Checks if an invoice qualifies as a pending petty cash entry.
 * - penztarbizonylat: Always cash voucher
 * - penztargep_zaras: Always cash register closure
 * - any other invoice (e.g. egyszerusitett_szla): Only if payment method is explicitly cash
 */
export function isPendingPettyCashInvoice(inv: {
  invoice_type?: string | null;
  fizetesi_mod?: string | null;
}): boolean {
  if (inv.invoice_type === 'penztarbizonylat' || inv.invoice_type === 'penztargep_zaras') {
    return true;
  }
  return isCashPaymentMethod(inv.fizetesi_mod);
}
