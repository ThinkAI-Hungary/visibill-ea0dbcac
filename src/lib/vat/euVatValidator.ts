/**
 * Hivatalos EU Tagállami Közösségi Adószám Validátor és Segédkönyvtár
 * (VIES kompatibilis szintaxis-ellenőrzés mind a 27 tagállamra)
 */

export interface EuVatCountryRule {
  countryCode: string;
  countryName: string;
  regex: RegExp;
  formatDescription: string;
  example: string;
}

export const EU_VAT_RULES: Record<string, EuVatCountryRule> = {
  AT: {
    countryCode: 'AT',
    countryName: 'Ausztria',
    regex: /^ATU[0-9]{8}$/,
    formatDescription: 'ATU + 8 számjegy',
    example: 'ATU12345678',
  },
  BE: {
    countryCode: 'BE',
    countryName: 'Belgium',
    regex: /^BE[0-1][0-9]{9}$/,
    formatDescription: 'BE + 10 számjegy (0-val vagy 1-gyel kezdődik)',
    example: 'BE0123456789',
  },
  BG: {
    countryCode: 'BG',
    countryName: 'Bulgária',
    regex: /^BG[0-9]{9,10}$/,
    formatDescription: 'BG + 9 vagy 10 számjegy',
    example: 'BG123456789',
  },
  CY: {
    countryCode: 'CY',
    countryName: 'Ciprus',
    regex: /^CY[0-9]{8}[A-Z]$/,
    formatDescription: 'CY + 8 számjegy + 1 betű',
    example: 'CY12345678X',
  },
  CZ: {
    countryCode: 'CZ',
    countryName: 'Csehország',
    regex: /^CZ[0-9]{8,10}$/,
    formatDescription: 'CZ + 8, 9 vagy 10 számjegy',
    example: 'CZ12345678',
  },
  DE: {
    countryCode: 'DE',
    countryName: 'Németország',
    regex: /^DE[0-9]{9}$/,
    formatDescription: 'DE + 9 számjegy',
    example: 'DE123456789',
  },
  DK: {
    countryCode: 'DK',
    countryName: 'Dánia',
    regex: /^DK[0-9]{8}$/,
    formatDescription: 'DK + 8 számjegy',
    example: 'DK12345678',
  },
  EE: {
    countryCode: 'EE',
    countryName: 'Észtország',
    regex: /^EE[0-9]{9}$/,
    formatDescription: 'EE + 9 számjegy',
    example: 'EE123456789',
  },
  EL: {
    countryCode: 'EL',
    countryName: 'Görögország',
    regex: /^(EL|GR)[0-9]{9}$/,
    formatDescription: 'EL vagy GR + 9 számjegy',
    example: 'EL123456789',
  },
  ES: {
    countryCode: 'ES',
    countryName: 'Spanyolország',
    regex: /^ES[A-Z0-9][0-9]{7}[A-Z0-9]$/,
    formatDescription: 'ES + 9 karakter (betű/szám)',
    example: 'ESX1234567X',
  },
  FI: {
    countryCode: 'FI',
    countryName: 'Finnország',
    regex: /^FI[0-9]{8}$/,
    formatDescription: 'FI + 8 számjegy',
    example: 'FI12345678',
  },
  FR: {
    countryCode: 'FR',
    countryName: 'Franciaország',
    regex: /^FR[A-Z0-9]{2}[0-9]{9}$/,
    formatDescription: 'FR + 2 karakter + 9 számjegy',
    example: 'FRXX123456789',
  },
  HR: {
    countryCode: 'HR',
    countryName: 'Horvátország',
    regex: /^HR[0-9]{11}$/,
    formatDescription: 'HR + 11 számjegy (OIB)',
    example: 'HR12345678901',
  },
  HU: {
    countryCode: 'HU',
    countryName: 'Magyarország',
    regex: /^HU[0-9]{8}$/,
    formatDescription: 'HU + 8 számjegy (törzsszám)',
    example: 'HU12345678',
  },
  IE: {
    countryCode: 'IE',
    countryName: 'Írország',
    regex: /^IE([0-9]{7}[A-W][A-I]?|[0-9][A-Z0-9+*][0-9]{5}[A-W])$/,
    formatDescription: 'IE + 7 vagy 8 karakter',
    example: 'IE1234567T',
  },
  IT: {
    countryCode: 'IT',
    countryName: 'Olaszország',
    regex: /^IT[0-9]{11}$/,
    formatDescription: 'IT + 11 számjegy',
    example: 'IT12345678901',
  },
  LT: {
    countryCode: 'LT',
    countryName: 'Litvánia',
    regex: /^LT([0-9]{9}|[0-9]{12})$/,
    formatDescription: 'LT + 9 vagy 12 számjegy',
    example: 'LT123456789',
  },
  LU: {
    countryCode: 'LU',
    countryName: 'Luxemburg',
    regex: /^LU[0-9]{8}$/,
    formatDescription: 'LU + 8 számjegy',
    example: 'LU12345678',
  },
  LV: {
    countryCode: 'LV',
    countryName: 'Lettország',
    regex: /^LV[0-9]{11}$/,
    formatDescription: 'LV + 11 számjegy',
    example: 'LV12345678901',
  },
  MT: {
    countryCode: 'MT',
    countryName: 'Málta',
    regex: /^MT[0-9]{8}$/,
    formatDescription: 'MT + 8 számjegy',
    example: 'MT12345678',
  },
  NL: {
    countryCode: 'NL',
    countryName: 'Hollandia',
    regex: /^NL[0-9]{9}B[0-9]{2}$/,
    formatDescription: 'NL + 9 számjegy + B + 2 számjegy',
    example: 'NL123456789B01',
  },
  PL: {
    countryCode: 'PL',
    countryName: 'Lengyelország',
    regex: /^PL[0-9]{10}$/,
    formatDescription: 'PL + 10 számjegy (NIP)',
    example: 'PL1234567890',
  },
  PT: {
    countryCode: 'PT',
    countryName: 'Portugália',
    regex: /^PT[0-9]{9}$/,
    formatDescription: 'PT + 9 számjegy',
    example: 'PT123456789',
  },
  RO: {
    countryCode: 'RO',
    countryName: 'Románia',
    regex: /^RO[0-9]{2,10}$/,
    formatDescription: 'RO + 2-10 számjegy',
    example: 'RO12345678',
  },
  SE: {
    countryCode: 'SE',
    countryName: 'Svédország',
    regex: /^SE[0-9]{12}$/,
    formatDescription: 'SE + 12 számjegy',
    example: 'SE123456789012',
  },
  SI: {
    countryCode: 'SI',
    countryName: 'Szlovénia',
    regex: /^SI[0-9]{8}$/,
    formatDescription: 'SI + 8 számjegy',
    example: 'SI12345678',
  },
  SK: {
    countryCode: 'SK',
    countryName: 'Szlovákia',
    regex: /^SK[0-9]{10}$/,
    formatDescription: 'SK + 10 számjegy (IČ DPH)',
    example: 'SK2020123456',
  },
};

// Aliases (e.g. GR for EL)
EU_VAT_RULES['GR'] = EU_VAT_RULES['EL'];

export const FAKE_TAX_NUMBER_KEYWORDS = [
  'INVALID',
  'FAKE',
  'TEST',
  'NINCS',
  'EMPTY',
  'SAMPLE',
  'DUMMY',
  'HIÁNYZIK',
  '00000000',
  'XXXXXXXX',
];

/**
 * Közösségi adószám tisztítása: eltávolítja a szóközöket, pontokat, kötőjeleket, és nagybetűsíti.
 */
export function cleanEuVatNumber(taxNumber: string | null | undefined): string {
  if (!taxNumber) return '';
  return taxNumber.replace(/[\s.\-_/]/g, '').trim().toUpperCase();
}

export interface EuVatValidationResult {
  isValid: boolean;
  countryCode: string | null;
  cleanVatNumber: string;
  errorMessage?: string;
  formatDescription?: string;
}

/**
 * Szigorú EU tagállami adószám validáció.
 * Kiszűri a dummy/fake szövegeket és tagállamonként ellenőrzi a szintaxist.
 */
export function validateEuVatNumber(rawTaxNumber: string | null | undefined): EuVatValidationResult {
  const clean = cleanEuVatNumber(rawTaxNumber);

  if (!clean) {
    return {
      isValid: false,
      countryCode: null,
      cleanVatNumber: '',
      errorMessage: 'Közösségi adószám hiányzik!',
    };
  }

  // 1. Fake / Dummy check
  for (const fakeWord of FAKE_TAX_NUMBER_KEYWORDS) {
    if (clean.includes(fakeWord)) {
      return {
        isValid: false,
        countryCode: clean.slice(0, 2),
        cleanVatNumber: clean,
        errorMessage: `Érvénytelen teszt / placeholder szöveg: "${clean}"`,
      };
    }
  }

  // 2. Minimum length check
  if (clean.length < 4) {
    return {
      isValid: false,
      countryCode: clean.slice(0, 2),
      cleanVatNumber: clean,
      errorMessage: 'Túl rövid közösségi adószám!',
    };
  }

  // 3. Country code identification
  let countryCode = clean.slice(0, 2);
  if (countryCode === 'GR') countryCode = 'EL';

  const rule = EU_VAT_RULES[countryCode];
  if (!rule) {
    return {
      isValid: false,
      countryCode,
      cleanVatNumber: clean,
      errorMessage: `Ismeretlen EU tagállami kód: "${countryCode}"`,
    };
  }

  // 4. Strict member state regex verification
  const isMatch = rule.regex.test(clean);
  if (!isMatch) {
    return {
      isValid: false,
      countryCode,
      cleanVatNumber: clean,
      errorMessage: `Hibás formátum (${rule.countryName}): elvárt "${rule.formatDescription}" (pl. ${rule.example})`,
      formatDescription: rule.formatDescription,
    };
  }

  return {
    isValid: true,
    countryCode,
    cleanVatNumber: clean,
    formatDescription: rule.formatDescription,
  };
}
