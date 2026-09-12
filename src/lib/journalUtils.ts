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
