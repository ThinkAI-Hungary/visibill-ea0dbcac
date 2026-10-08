/**
 * Accounting Journals (Könyvelési Naplók / Dnevnici knjiženja) localization utilities.
 */

export interface JournalLike {
  id?: string;
  code?: string | null;
  name?: string | null;
  type?: string | null;
  currency?: string | null;
}

export interface LocalizeJournalOptions {
  short?: boolean;
}

const CODE_TO_KEY: Record<string, string> = {
  NY: 'NY',
  V: 'V',
  SZ: 'SZ',
  VE: 'VE',
  BER: 'BER',
  'BÉR': 'BER',
  Z: 'Z',
  P1: 'P1',
  B1: 'B1',
  B2: 'B2',
  B_USD: 'B_USD',
  BUSD: 'B_USD',
  ALL: 'all',
};

const SHORT_CODE_TO_KEY: Record<string, string> = {
  NY: 'nyito',
  V: 'vevo',
  SZ: 'szallito',
  VE: 'vegyes',
  BER: 'BER',
  'BÉR': 'BER',
  Z: 'zaro',
  P1: 'penztar',
  B1: 'bank',
  B2: 'bank',
  B_USD: 'bank',
  BUSD: 'bank',
  ALL: 'all',
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const HU_NAME_TO_KEY: Record<string, string> = {
  'nyito tetelek': 'NY',
  'nyito naplo': 'NY',
  'nyito': 'NY',
  'vevo szamlak': 'V',
  'vevo naplo': 'V',
  'vevo': 'V',
  'szallito szamlak': 'SZ',
  'szallito naplo': 'SZ',
  'szallito': 'SZ',
  'vegyes tetelek': 'VE',
  'vegyes naplo': 'VE',
  'vegyes': 'VE',
  'berfeladas': 'BER',
  'berfeladas naplo': 'BER',
  'ber': 'BER',
  'zaro tetelek': 'Z',
  'zaro naplo': 'Z',
  'zaro': 'Z',
  'hazipenztar huf': 'P1',
  'hazipenztar': 'P1',
  'penztar huf': 'P1',
  'penztar': 'P1',
  'k h bank huf': 'B1',
  'kh bank huf': 'B1',
  'k h bank eur': 'B2',
  'kh bank eur': 'B2',
  'deviza bank usd': 'B_USD',
  'osszes naplo': 'all',
  'bank': 'bank',
};

/**
 * Localizes a journal name based on code or Hungarian name using i18next `accounting:journals.journal_names.*`
 */
export function getLocalizedJournalName(
  journalOrCode: JournalLike | string | null | undefined,
  defaultName?: string | null,
  t?: (key: any, ...args: any[]) => any,
  options?: LocalizeJournalOptions
): string {
  const fallback =
    defaultName ||
    (typeof journalOrCode === 'string'
      ? journalOrCode
      : journalOrCode?.name || journalOrCode?.code || '');

  if (!t || typeof t !== 'function') {
    return fallback;
  }

  let resolvedKey: string | undefined;

  if (journalOrCode && typeof journalOrCode === 'object') {
    const code = (journalOrCode.code || '').trim().toUpperCase();
    if (options?.short && SHORT_CODE_TO_KEY[code]) {
      resolvedKey = SHORT_CODE_TO_KEY[code];
    } else if (CODE_TO_KEY[code]) {
      // For bank journals (B1, B2, B_USD), if user gave a custom bank name, only translate if it matches default seed name
      if (['B1', 'B2', 'B_USD', 'BUSD'].includes(code)) {
        const norm = normalizeName(journalOrCode.name || defaultName || '');
        if (norm && (norm.includes('k h bank') || norm.includes('kh bank') || norm.includes('deviza bank'))) {
          resolvedKey = CODE_TO_KEY[code];
        } else if (!journalOrCode.name) {
          resolvedKey = CODE_TO_KEY[code];
        }
      } else {
        resolvedKey = CODE_TO_KEY[code];
      }
    }

    if (!resolvedKey && journalOrCode.name) {
      resolvedKey = HU_NAME_TO_KEY[normalizeName(journalOrCode.name)];
    }
  } else if (typeof journalOrCode === 'string') {
    const cleanCode = journalOrCode.trim().toUpperCase();
    if (options?.short && SHORT_CODE_TO_KEY[cleanCode]) {
      resolvedKey = SHORT_CODE_TO_KEY[cleanCode];
    } else if (CODE_TO_KEY[cleanCode]) {
      resolvedKey = CODE_TO_KEY[cleanCode];
    } else {
      resolvedKey = HU_NAME_TO_KEY[normalizeName(journalOrCode)];
    }
  }

  if (!resolvedKey && defaultName) {
    resolvedKey = HU_NAME_TO_KEY[normalizeName(defaultName)];
  }

  if (resolvedKey) {
    return t(`accounting:journals.journal_names.${resolvedKey}`, {
      defaultValue: fallback,
    });
  }

  return fallback;
}

/**
 * Computes the next document identifier by incrementing any trailing numeric sequence.
 * Examples:
 * - "2026/005" -> "2026/006"
 * - "VE-2026-01" -> "VE-2026-02"
 * - "BÉR/009" -> "BÉR/010"
 * - "1" -> "2"
 * - "" or undefined -> ""
 */
export function getNextDocumentId(lastId: string | null | undefined): string {
  if (!lastId) return '';
  const trimmed = lastId.trim();
  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (!match) return trimmed;
  const prefix = match[1];
  const numStr = match[2];
  const nextNum = parseInt(numStr, 10) + 1;
  const paddedNum = String(nextNum).padStart(numStr.length, '0');
  return `${prefix}${paddedNum}`;
}

export const COMMON_JOURNAL_DESCRIPTIONS = [
  'Bérfeladás',
  'Bérjárulékok elszámolása',
  'Év végi zárás / rendezés',
  'Árfolyam-különbözet elszámolása',
  'Kerekítési különbözet',
  'Tárgyi eszköz értékcsökkenés',
  'Adóátvezetés',
  'Tagi kölcsön elszámolása',
  'Késedelmi kamat / kötbér',
  'Nyitó rendezés',
];

export type JournalCategoryKey = 'ALL' | 'OPENING' | 'BANK' | 'PETTY_CASH' | 'INVOICE' | 'MIXED' | 'CLOSING';

export interface JournalCategoryDef {
  key: JournalCategoryKey;
  label: string;
  codeRange: string;
}

export const JOURNAL_CATEGORIES: JournalCategoryDef[] = [
  { key: 'ALL', label: 'Összes napló', codeRange: '' },
  { key: 'OPENING', label: 'Nyitó', codeRange: '101' },
  { key: 'BANK', label: 'Bankok', codeRange: '201..253' },
  { key: 'PETTY_CASH', label: 'Pénztárak', codeRange: '301..351' },
  { key: 'INVOICE', label: 'Számlák', codeRange: '401..552' },
  { key: 'MIXED', label: 'Vegyesek', codeRange: '601..605' },
  { key: 'CLOSING', label: 'Záró', codeRange: '901' },
];

export function getJournalCategory(journal: JournalLike): JournalCategoryKey {
  const code = (journal.code || '').trim().toUpperCase();
  const type = (journal.type || '').trim().toUpperCase();

  if (type === 'OPENING' || code === 'NY' || code.startsWith('1')) return 'OPENING';
  if (type === 'BANK' || code.startsWith('B') || (code.length === 3 && code.startsWith('2'))) return 'BANK';
  if (type === 'PETTY_CASH' || code.startsWith('P') || (code.length === 3 && code.startsWith('3'))) return 'PETTY_CASH';
  if (type === 'MIXED' || type === 'SYSTEM' || type === 'GENERAL' || code.startsWith('VE') || code.startsWith('BÉR') || code.startsWith('BER') || (code.length === 3 && code.startsWith('6'))) return 'MIXED';
  if (type === 'CUSTOMER' || type === 'SUPPLIER' || (code.startsWith('V') && !code.startsWith('VE')) || code.startsWith('SZ') || (code.length === 3 && (code.startsWith('4') || code.startsWith('5')))) return 'INVOICE';
  if (type === 'CLOSING' || code === 'Z' || code.startsWith('9')) return 'CLOSING';

  return 'MIXED';
}

export function isJournalSystemLocked(journal: JournalLike & { is_system_locked?: boolean }): boolean {
  if (journal.is_system_locked) return true;
  const code = (journal.code || '').trim().toUpperCase();
  return ['603', '605', '901'].includes(code);
}

export const MNB_CURRENCIES = [
  { code: 'HUF', name: 'Magyar forint', unit: 1, symbol: 'Ft' },
  { code: 'EUR', name: 'Euro', unit: 1, symbol: 'EUR' },
  { code: 'USD', name: 'Amerikai dollár', unit: 1, symbol: 'USD' },
  { code: 'GBP', name: 'Angol font', unit: 1, symbol: 'GBP' },
  { code: 'CHF', name: 'Svájci frank', unit: 1, symbol: 'CHF' },
  { code: 'CAD', name: 'Kanadai dollár', unit: 1, symbol: 'CAD' },
  { code: 'CZK', name: 'Cseh korona', unit: 1, symbol: 'CZK' },
  { code: 'DKK', name: 'Dán korona', unit: 1, symbol: 'Dkk' },
  { code: 'PLN', name: 'Lengyel zloty', unit: 1, symbol: 'Zlo' },
  { code: 'RON', name: 'Román lej', unit: 1, symbol: 'RON' },
  { code: 'RSD', name: 'Szerb dínár', unit: 1, symbol: 'RSD' },
  { code: 'BGN', name: 'Bulgár leva', unit: 1, symbol: 'BGN' },
  { code: 'SEK', name: 'Svéd korona', unit: 1, symbol: 'SEK' },
  { code: 'NOK', name: 'Norvég korona', unit: 1, symbol: 'NOK' },
  { code: 'TRY', name: 'Török líra', unit: 1, symbol: 'TRY' },
  { code: 'JPY', name: 'Japán jen (100)', unit: 100, symbol: 'JPY' },
  { code: 'CNY', name: 'Kínai jüan', unit: 1, symbol: 'CNY' },
  { code: 'HRK', name: 'Horvát kuna', unit: 1, symbol: 'HRK' },
  { code: 'INR', name: 'Indiai rúpia', unit: 1, symbol: 'INR' },
  { code: 'EGP', name: 'Egyiptomi font', unit: 1, symbol: 'EGP' },
  { code: 'QAR', name: 'Katari riál', unit: 1, symbol: 'QAR' },
  { code: 'RUB', name: 'Orosz rubel', unit: 1, symbol: 'Rub' },
  { code: 'LEJ', name: 'Román lej', unit: 1, symbol: 'LEJ' },
  { code: 'MKD', name: 'Macedón dénár', unit: 1, symbol: 'MKD' },
];

