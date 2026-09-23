import { HU_GL_NAME_TO_KEY, normalizeGlAccountName, normalizeGlKey } from './glAccountDictionary';

/**
 * Főkönyvi számlák és számlaosztályok lokalizációs segédfüggvényei.
 */
export function getLocalizedGlAccountName(
  glNumber: string | null | undefined,
  name: string | null | undefined,
  t?: (key: any, ...args: any[]) => any,
  isHrPreset?: boolean
): string {
  if (!name && !glNumber) return '';
  const trimmedName = (name || '').trim();
  const num = (glNumber || '').trim().replace(/\.$/, '');

  // If this is a Croatian preset, or the name is already a Croatian class name, keep the native Croatian name
  if (isHrPreset || trimmedName.toUpperCase().startsWith('RAZRED')) {
    return trimmedName || glNumber || '';
  }

  // 1. Root classes (0-9)
  // Check either by glNumber ('0', '1', '2', etc.) or if name contains class indicator
  if (
    ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(num) ||
    trimmedName.toUpperCase().startsWith('SZÁMLAOSZTÁLY:')
  ) {
    let classNum = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(num) ? num : null;
    if (!classNum) {
      const match =
        trimmedName.match(/^SZ[AÁ]MLAOSZT[AÁ]LY:\s*(\d)\.?/i) ||
        trimmedName.match(/(\d)\.?\s*SZ[AÁ]MLAOSZT[AÁ]LY/i) ||
        trimmedName.match(/^RAZRED\s+KONTA:\s*(\d)\.?/i) ||
        trimmedName.match(/(\d)\.?\s*RAZRED\s+KONTA/i);
      if (match) {
        classNum = match[1];
      }
    }

    if (classNum && t) {
      const translationKey = `accounting:general_ledger.gl_classes.${classNum}`;
      const translated = t(translationKey, { defaultValue: '' });
      if (translated) {
        return translated;
      }
    }
  }

  // 2. Custom account name starting with SZÁMLAOSZTÁLY:
  if (trimmedName.toUpperCase().startsWith('SZÁMLAOSZTÁLY:')) {
    const rest = trimmedName.substring('SZÁMLAOSZTÁLY:'.length).trim();
    const prefix = t ? t('accounting:general_ledger.gl_classes.prefix', { defaultValue: 'SZÁMLAOSZTÁLY:' }) : 'SZÁMLAOSZTÁLY:';
    return `${prefix} ${rest}`;
  }

  // 3. Match standard account by glNumber (e.g. '311.', '311', '41.', '411.', '17-19.', etc.)
  if (glNumber && t) {
    const safeKey = normalizeGlKey(glNumber);
    const translationKey = `accounting:general_ledger.accounts.${safeKey}`;
    const translated = t(translationKey, { defaultValue: '' });
    if (translated) {
      return translated;
    }
  }

  // 4. Match standard account by Hungarian name
  if (trimmedName && t) {
    const norm = normalizeGlAccountName(trimmedName);
    const keyByName = HU_GL_NAME_TO_KEY[norm];
    if (keyByName) {
      const translationKey = `accounting:general_ledger.accounts.${keyByName}`;
      const translated = t(translationKey, { defaultValue: '' });
      if (translated) {
        return translated;
      }
    }
  }

  return trimmedName || glNumber || '';
}

/**
 * Főkönyvi tételek típusának (pl. Nyitó tétel, Záró tétel, Számla, Banki tranzakció) lokalizációs segédfüggvénye.
 */
export function getLocalizedGlItemType(
  itemType: string | null | undefined,
  t?: (key: any, ...args: any[]) => any
): string {
  if (!itemType) return '';
  const trimmed = itemType.trim();
  if (!t) return trimmed;

  const lower = trimmed.toLowerCase();

  // 1. Nyitó tétel
  if (lower.includes('nyitó') || lower === 'opening') {
    return t('accounting:general_ledger.item_types.opening', { defaultValue: 'Nyitó tétel' });
  }

  // 2. Záró tétel
  if (lower.includes('záró') || lower === 'closing') {
    return t('accounting:general_ledger.item_types.closing', { defaultValue: 'Záró tétel' });
  }

  // 3. XML / Könyvelt napló tétel (T)/(K)
  if (lower.includes('xml könyvelési tétel (t)') || lower.includes('könyvelt napló tétel (t)')) {
    return t('accounting:general_ledger.item_types.journal_debit', { defaultValue: 'Könyvelt napló tétel (T)' });
  }
  if (lower.includes('xml könyvelési tétel (k)') || lower.includes('könyvelt napló tétel (k)')) {
    return t('accounting:general_ledger.item_types.journal_credit', { defaultValue: 'Könyvelt napló tétel (K)' });
  }
  if (lower.includes('xml napló')) {
    return t('accounting:general_ledger.item_types.xml_journal', { defaultValue: 'XML Naplótétel' });
  }
  if (lower.includes('vegyes napló') || lower === 'vegyes') {
    return t('accounting:general_ledger.item_types.journal_general', { defaultValue: 'Vegyes napló tétel' });
  }

  // 4. NAV tétel (check before general bejövő/kimenő)
  if (lower.includes('nav bejövő')) {
    return t('accounting:general_ledger.item_types.nav_inbound', { defaultValue: 'NAV Bejövő tétel' });
  }
  if (lower.includes('nav kimenő')) {
    return t('accounting:general_ledger.item_types.nav_outbound', { defaultValue: 'NAV Kimenő tétel' });
  }

  // 5. Bejövő / Kimenő
  if (lower.includes('bejövő (költség)') || lower.includes('bejövő') || lower === 'inbound') {
    return t('accounting:general_ledger.item_types.incoming_cost', { defaultValue: 'Bejövő (Költség)' });
  }
  if (lower.includes('kimenő (bevétel)') || lower.includes('kimenő (árbevétel)') || lower.includes('kimenő') || lower === 'outbound') {
    return t('accounting:general_ledger.item_types.outgoing_revenue', { defaultValue: 'Kimenő (Árbevétel)' });
  }

  // 6. Banki tranzakció
  if (lower.includes('bank')) {
    return t('accounting:general_ledger.item_types.bank_tx', { defaultValue: 'Banki tranzakció' });
  }

  // 7. Házipénztár / Készpénz
  if (lower.includes('házipénztár') || lower.includes('pénztár')) {
    return t('accounting:general_ledger.item_types.petty_cash', { defaultValue: 'Házipénztár' });
  }
  if (lower === 'készpénz') {
    return t('accounting:general_ledger.item_types.cash', { defaultValue: 'Készpénz' });
  }

  // 8. Bérszámfejtés
  if (lower.includes('bérszámfejtés') || lower.includes('bérfeladás') || lower === 'payroll') {
    return t('accounting:general_ledger.item_types.payroll', { defaultValue: 'Bérszámfejtés' });
  }

  // 9. Számlák
  if (lower === 'díjbekérő' || lower === 'proforma') {
    return t('accounting:general_ledger.item_types.proforma', { defaultValue: 'Díjbekérő' });
  }
  if (lower === 'előlegszámla' || lower === 'advance') {
    return t('accounting:general_ledger.item_types.advance', { defaultValue: 'Előlegszámla' });
  }
  if (lower === 'végszámla' || lower === 'final_invoice') {
    return t('accounting:general_ledger.item_types.final_invoice', { defaultValue: 'Végszámla' });
  }
  if (lower === 'számla' || lower === 'invoice') {
    return t('accounting:general_ledger.item_types.invoice', { defaultValue: 'Számla' });
  }

  return trimmed;
}

/**
 * Főkönyvi tételek leírásának lokalizációja (pl. Nyitó egyenleg -> Početno stanje).
 */
export function getLocalizedGlItemDescription(
  description: string | null | undefined,
  t?: (key: any, ...args: any[]) => any
): string {
  if (!description) return '';
  if (!t) return description;

  if (description.includes('Nyitó egyenleg')) {
    const localized = t('accounting:general_ledger.opening_balance', { defaultValue: 'Nyitó egyenleg' });
    return description.replace(/Nyitó egyenleg/g, localized);
  }
  if (description.includes('Záró egyenleg')) {
    const localized = t('accounting:general_ledger.closing_balance', { defaultValue: 'Záró egyenleg' });
    return description.replace(/Záró egyenleg/g, localized);
  }

  return description;
}

