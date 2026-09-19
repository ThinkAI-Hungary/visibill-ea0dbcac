/**
 * Központi Bankszámla és IBAN Kezelő Modul
 * 
 * Támogatja:
 * - Magyar belföldi GIRO számlaszámok (16 vagy 24 jegy, CDV [9,7,3,1] súlyozott ellenőrzés)
 * - Nemzetközi és Magyar IBAN számlaszámok (ISO 7064 Modulo 97 ellenőrzés)
 * - Intelligens bankfelismerés (hazai bankok + nemzetközi/fintech bankok: Revolut, Wise, N26, Bunq, stb.)
 * - Automatikus formázás gépelés közben (4 karakteres IBAN csoportok vs. 3x8 jegyű kötőjeles maszk)
 * - Kétirányú konverzió (magyar GIRO ↔ magyar HUxx IBAN)
 */

// ── IBAN Hosszúságok Országonként ──
export const IBAN_LENGTHS: Record<string, number> = {
  AL: 28, AD: 24, AT: 20, AZ: 28, BH: 22, BY: 28, BE: 16, BA: 20, BR: 29,
  BG: 22, CR: 22, HR: 21, CY: 28, CZ: 24, DK: 18, DO: 28, EE: 20, FO: 18,
  FI: 18, FR: 27, GE: 22, DE: 22, GI: 23, GR: 27, GL: 18, GT: 28, HU: 28,
  IS: 26, IE: 22, IL: 23, IT: 27, JO: 30, KZ: 20, XK: 20, KW: 30, LV: 21,
  LB: 28, LI: 21, LT: 20, LU: 20, MK: 19, MT: 31, MR: 27, MU: 30, MD: 24,
  MC: 27, ME: 22, NL: 18, NO: 15, PK: 24, PS: 29, PL: 28, PT: 25, QA: 29,
  RO: 24, LC: 32, SM: 27, ST: 25, SA: 24, RS: 22, SC: 31, SK: 24, SI: 19,
  ES: 24, SE: 24, CH: 21, TN: 24, TR: 26, AE: 23, GB: 22, VA: 22, VG: 24,
};

// ── Országnevek Magyarul (Fallback Banknévhez) ──
export const COUNTRY_NAMES: Record<string, string> = {
  HU: 'Magyarország',
  DE: 'Németország',
  AT: 'Ausztria',
  SK: 'Szlovákia',
  RO: 'Románia',
  LT: 'Litvánia',
  BE: 'Belgium',
  NL: 'Hollandia',
  GB: 'Egyesült Királyság',
  FR: 'Franciaország',
  IT: 'Olaszország',
  ES: 'Spanyolország',
  CH: 'Svájc',
  PL: 'Lengyelország',
  CZ: 'Csehország',
  HR: 'Horvátország',
  SI: 'Szlovénia',
  IE: 'Írország',
  LU: 'Luxemburg',
  DK: 'Dánia',
  SE: 'Svédország',
  FI: 'Finnország',
  EE: 'Észtország',
  LV: 'Lettország',
  PT: 'Portugália',
  BG: 'Bulgária',
  GR: 'Görögország',
  CY: 'Ciprus',
  MT: 'Málta',
};

// ── Magyar Bank GIRO Kódok ──
export const HU_BANK_CODES: Record<string, string> = {
  '117': 'OTP Bank',
  '116': 'Erste Bank',
  '104': 'K&H Bank',
  '120': 'Raiffeisen Bank',
  '107': 'CIB Bank',
  '109': 'UniCredit Bank',
  '103': 'MBH Bank',
  '119': 'MBH Bank',
  '180': 'MBH Bank',
  '112': 'Gránit Bank',
  '121': 'MagNet Bank',
  '184': 'Oberbank',
  '162': 'BNP Paribas',
  '177': 'MFB',
  '126': 'Cetelem Bank',
  '100': 'Magyar Nemzeti Bank',
  '190': 'Magyar Államkincstár',
  '102': 'KELER',
  '181': 'KDB Bank',
};

/**
 * Számlaszám formátum detektálása (IBAN vagy belföldi GIRO).
 */
export function detectAccountFormat(account: string | null | undefined): 'giro' | 'iban' | 'unknown' {
  if (!account) return 'unknown';
  const clean = account.replace(/[\s-]/g, '').toUpperCase();
  if (!clean) return 'unknown';
  if (/^[A-Z]{2}/.test(clean)) return 'iban';
  if (/^\d/.test(clean)) return 'giro';
  return 'unknown';
}

/**
 * Normalizálja a számlaszámot adatbázisba mentéshez (szóközök és kötőjelek nélkül, nagybetűsen).
 */
export function normalizeAccountNumber(account: string | null | undefined): string {
  if (!account) return '';
  return account.replace(/[\s-]/g, '').toUpperCase();
}

/**
 * Modulo 97 számítás tetszőleges hosszúságú numerikus sztringre.
 */
export function bigMod97(numStr: string): number {
  let remainder = 0;
  for (let i = 0; i < numStr.length; i++) {
    const digit = parseInt(numStr[i], 10);
    if (isNaN(digit)) return -1;
    remainder = (remainder * 10 + digit) % 97;
  }
  return remainder;
}

/**
 * Magyar belföldi számlaszám GIRO CDV validációja (16 vagy 24 számjegy).
 * Súlyozás: [9, 7, 3, 1, 9, 7, 3, 1] blokkonként.
 */
export function validateGiro(account: string): { valid: boolean; error?: string } {
  const clean = account.replace(/[-\s]/g, '');

  if (!clean) {
    return { valid: false, error: 'A bankszámlaszám nem lehet üres' };
  }

  if (!/^\d+$/.test(clean)) {
    return { valid: false, error: 'A belföldi bankszámlaszám csak számjegyeket tartalmazhat' };
  }

  if (clean.length !== 16 && clean.length !== 24) {
    return { valid: false, error: 'A magyar bankszámlaszámnak 16 vagy 24 számjegyből kell állnia' };
  }

  // Csupa nulla kizárása
  if (/^0+$/.test(clean)) {
    return { valid: false, error: 'A számlaszám nem lehet csupa nulla' };
  }

  const weights = [9, 7, 3, 1, 9, 7, 3, 1];

  // Routing blokk (1-8. számjegy)
  const routingDigits = clean.slice(0, 8).split('').map(Number);
  let routingSum = 0;
  for (let i = 0; i < 8; i++) {
    routingSum += routingDigits[i] * weights[i];
  }
  if (routingSum % 10 !== 0) {
    return { valid: false, error: 'Érvénytelen bankszámlaszám (bankazonosító ellenőrzőösszeg hibás)' };
  }

  // Számlaszám blokk (9-16. számjegy)
  const accountDigits = clean.slice(8, 16).split('').map(Number);
  let accountSum = 0;
  for (let i = 0; i < 8; i++) {
    accountSum += accountDigits[i] * weights[i];
  }
  if (accountSum % 10 !== 0) {
    return { valid: false, error: 'Érvénytelen bankszámlaszám (főszámlaszám ellenőrzőösszeg hibás)' };
  }

  // 3. blokk (ha 24 jegyű: 17-24. számjegy)
  if (clean.length === 24) {
    const subDigits = clean.slice(16, 24).split('').map(Number);
    let subSum = 0;
    for (let i = 0; i < 8; i++) {
      subSum += subDigits[i] * weights[i];
    }
    if (subSum % 10 !== 0) {
      return { valid: false, error: 'Érvénytelen bankszámlaszám (alszámlaszám ellenőrzőösszeg hibás)' };
    }
  }

  return { valid: true };
}

/**
 * ISO 7064 Modulo 97-10 szerinti nemzetközi és magyar IBAN validáció.
 */
export function validateIban(iban: string): { valid: boolean; error?: string; country?: string } {
  const clean = iban.replace(/[\s-]/g, '').toUpperCase();

  if (!clean) {
    return { valid: false, error: 'Az IBAN számlaszám nem lehet üres' };
  }

  if (clean.length < 15 || clean.length > 34) {
    return { valid: false, error: 'Az IBAN hossza 15 és 34 karakter között kell legyen' };
  }

  // Országkód formátum
  const countryCode = clean.slice(0, 2);
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { valid: false, error: 'Az IBAN-nak 2 betűs országkóddal kell kezdődnie' };
  }

  // Ellenőrző számjegyek
  const checkDigits = clean.slice(2, 4);
  if (!/^\d{2}$/.test(checkDigits)) {
    return { valid: false, error: 'Az országkód után 2 ellenőrző számjegynek kell állnia' };
  }

  // Ismert ország hossz ellenőrzése
  const expectedLength = IBAN_LENGTHS[countryCode];
  if (expectedLength && clean.length !== expectedLength) {
    return {
      valid: false,
      error: `A(z) ${countryCode} országkódú IBAN hossza pontosan ${expectedLength} karakter kell legyen (jelenleg: ${clean.length})`,
      country: countryCode,
    };
  }

  // Csak alfanumerikus karakterek
  if (!/^[A-Z0-9]+$/.test(clean)) {
    return { valid: false, error: 'Az IBAN csak betűket és számokat tartalmazhat', country: countryCode };
  }

  // ISO 7064 Modulo 97 ellenőrzés
  // Átrendezés: első 4 karakter a végére
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Betűk átalakítása (A=10, B=11, ..., Z=35)
  let numericStr = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericStr += (code - 55).toString();
    } else {
      numericStr += rearranged[i];
    }
  }

  if (bigMod97(numericStr) !== 1) {
    return { valid: false, error: 'Érvénytelen IBAN (ellenőrző kód nem egyezik meg)', country: countryCode };
  }

  // Magyar IBAN esetén a belső 24 jegyű számla CDV validációja
  if (countryCode === 'HU' && clean.length === 28) {
    const domesticPart = clean.slice(4);
    const giroCheck = validateGiro(domesticPart);
    if (!giroCheck.valid) {
      return { valid: false, error: `Magyar IBAN belső számla hiba: ${giroCheck.error}`, country: 'HU' };
    }
  }

  return { valid: true, country: countryCode };
}

/**
 * Univerzális bankszámlaszám validátor (GIRO és IBAN).
 */
export function validateAccountNumber(account: string): {
  valid: boolean;
  type: 'giro' | 'iban' | 'unknown';
  error?: string;
  bankName?: string;
  country?: string;
} {
  const format = detectAccountFormat(account);

  if (format === 'iban') {
    const res = validateIban(account);
    const bankInfo = detectBankFromAccountNumber(account);
    return {
      valid: res.valid,
      type: 'iban',
      error: res.error,
      bankName: bankInfo?.bankName,
      country: res.country,
    };
  }

  if (format === 'giro') {
    const res = validateGiro(account);
    const bankInfo = detectBankFromAccountNumber(account);
    return {
      valid: res.valid,
      type: 'giro',
      error: res.error,
      bankName: bankInfo?.bankName,
      country: 'HU',
    };
  }

  return {
    valid: false,
    type: 'unknown',
    error: 'Kérjük, adj meg egy 16/24 jegyű magyar bankszámlaszámot vagy nemzetközi IBAN-t',
  };
}

/**
 * IBAN formázása 4 karakteres blokkokba: HU42 1177 3016 1111 2222 3333 4444
 */
export function formatIban(iban: string): string {
  const clean = iban.replace(/[\s-]/g, '').toUpperCase();
  if (!clean) return '';
  const chunks = clean.match(/.{1,4}/g);
  return chunks ? chunks.join(' ') : clean;
}

/**
 * Magyar GIRO számlaszám formázása: XXXXXXXX-XXXXXXXX(-XXXXXXXX)
 */
export function formatGiro(giro: string): string {
  const digits = giro.replace(/\D/g, '');
  if (digits.length <= 8) return digits;
  if (digits.length <= 16) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  return `${digits.slice(0, 8)}-${digits.slice(8, 16)}-${digits.slice(16, 24)}`;
}

/**
 * Gépelés közbeni intelligens számlaszám maszkolás.
 * Ha az első karakter betű -> IBAN mód (4-es csoportok).
 * Ha szám -> GIRO mód (8-as csoportok kötőjellel).
 */
export function formatAccountOnType(value: string): string {
  if (!value) return '';

  const trimmed = value.trimStart();
  if (!trimmed) return '';

  // Ha betűvel indul, IBAN formázás
  if (/^[A-Za-z]/.test(trimmed)) {
    const clean = trimmed.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 34);
    const chunks = clean.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : clean;
  }

  // Ha számmal indul, belföldi GIRO formázás
  const digits = trimmed.replace(/\D/g, '').slice(0, 24);
  if (digits.length <= 8) return digits;
  if (digits.length <= 16) return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  return `${digits.slice(0, 8)}-${digits.slice(8, 16)}-${digits.slice(16, 24)}`;
}

/**
 * Intelligens bankfelismerés számlaszám vagy IBAN alapján.
 * Felismeri a magyar bankokat, nemzetközi fintech szolgáltatókat és vezető európai bankokat.
 */
export function detectBankFromAccountNumber(account: string | null | undefined): {
  bankName: string;
  isKnown: boolean;
  country?: string;
} | null {
  if (!account) return null;

  const clean = account.replace(/[\s-]/g, '').toUpperCase();
  if (clean.length < 3) return null;

  // ── 1. Magyar belföldi számlaszám (számmal kezdődik) ──
  if (/^\d/.test(clean)) {
    const giroCode = clean.slice(0, 3);
    const numGiro = parseInt(giroCode, 10);

    // MBH Bank takarékszövetkezeti tartomány (500-799)
    if (numGiro >= 500 && numGiro <= 799) {
      return { bankName: 'MBH Bank', isKnown: true, country: 'HU' };
    }

    if (HU_BANK_CODES[giroCode]) {
      return { bankName: HU_BANK_CODES[giroCode], isKnown: true, country: 'HU' };
    }

    return { bankName: 'Egyéb magyar bank', isKnown: false, country: 'HU' };
  }

  // ── 2. IBAN azonosítás (betűvel kezdődik) ──
  if (/^[A-Z]{2}/.test(clean)) {
    const country = clean.slice(0, 2);

    // Magyar IBAN (HUxx ...)
    if (country === 'HU' && clean.length >= 7) {
      const giroCode = clean.slice(4, 7);
      const numGiro = parseInt(giroCode, 10);

      if (numGiro >= 500 && numGiro <= 799) {
        return { bankName: 'MBH Bank', isKnown: true, country: 'HU' };
      }

      if (HU_BANK_CODES[giroCode]) {
        return { bankName: HU_BANK_CODES[giroCode], isKnown: true, country: 'HU' };
      }

      return { bankName: 'Magyarországi bank', isKnown: false, country: 'HU' };
    }

    // Litvánia (LTxx) — Revolut & Paysera
    if (country === 'LT') {
      const bankId = clean.slice(4, 9);
      if (bankId === '35000') return { bankName: 'Revolut Bank', isKnown: true, country: 'LT' };
      if (bankId === '30800') return { bankName: 'Paysera', isKnown: true, country: 'LT' };
      return { bankName: 'Litvániai bankszámla (LT)', isKnown: false, country: 'LT' };
    }

    // Belgium (BExx) — Wise Europe
    if (country === 'BE') {
      const bankId = clean.slice(4, 7);
      if (bankId === '967' || bankId === '968') return { bankName: 'Wise (TransferWise)', isKnown: true, country: 'BE' };
      return { bankName: 'Belgiumi bankszámla (BE)', isKnown: false, country: 'BE' };
    }

    // Németország (DExx) — N26, Deutsche Bank, Commerzbank, ING
    if (country === 'DE') {
      const blz = clean.slice(4, 12);
      if (blz === '10011001') return { bankName: 'N26 Bank', isKnown: true, country: 'DE' };
      if (blz === '50070010') return { bankName: 'Deutsche Bank', isKnown: true, country: 'DE' };
      if (blz === '50040000') return { bankName: 'Commerzbank', isKnown: true, country: 'DE' };
      if (blz === '50010517') return { bankName: 'ING-DiBa', isKnown: true, country: 'DE' };
      return { bankName: 'Németországi bankszámla (DE)', isKnown: false, country: 'DE' };
    }

    // Hollandia (NLxx) — Bunq, ING, ABN, Rabo
    if (country === 'NL') {
      const bic = clean.slice(4, 8);
      if (bic === 'BUNQ') return { bankName: 'Bunq', isKnown: true, country: 'NL' };
      if (bic === 'INGB') return { bankName: 'ING Bank', isKnown: true, country: 'NL' };
      if (bic === 'ABNA') return { bankName: 'ABN AMRO', isKnown: true, country: 'NL' };
      if (bic === 'RABO') return { bankName: 'Rabobank', isKnown: true, country: 'NL' };
      return { bankName: 'Hollandiai bankszámla (NL)', isKnown: false, country: 'NL' };
    }

    // Ausztria (ATxx) — Erste, Raiffeisen, Bank Austria
    if (country === 'AT') {
      const blz = clean.slice(4, 9);
      if (blz === '20111') return { bankName: 'Erste Bank Österreich', isKnown: true, country: 'AT' };
      if (blz === '32000') return { bankName: 'Raiffeisen Bank International', isKnown: true, country: 'AT' };
      if (blz === '12000') return { bankName: 'Bank Austria (UniCredit)', isKnown: true, country: 'AT' };
      return { bankName: 'Ausztriai bankszámla (AT)', isKnown: false, country: 'AT' };
    }

    // Szlovákia (SKxx) — VÚB, Slovenská sporiteľňa, Tatra banka
    if (country === 'SK') {
      const bankId = clean.slice(4, 8);
      if (bankId === '0200') return { bankName: 'VÚB Banka', isKnown: true, country: 'SK' };
      if (bankId === '0900') return { bankName: 'Slovenská sporiteľňa (Erste)', isKnown: true, country: 'SK' };
      if (bankId === '1100') return { bankName: 'Tatra banka (Raiffeisen)', isKnown: true, country: 'SK' };
      if (bankId === '7500') return { bankName: 'ČSOB', isKnown: true, country: 'SK' };
      return { bankName: 'Szlovákiai bankszámla (SK)', isKnown: false, country: 'SK' };
    }

    // Románia (ROxx) — Banca Transilvania, Raiffeisen, ING, BCR
    if (country === 'RO') {
      const bic = clean.slice(4, 8);
      if (bic === 'BTRL') return { bankName: 'Banca Transilvania', isKnown: true, country: 'RO' };
      if (bic === 'RZBR') return { bankName: 'Raiffeisen Bank Romania', isKnown: true, country: 'RO' };
      if (bic === 'INGB') return { bankName: 'ING Bank Romania', isKnown: true, country: 'RO' };
      if (bic === 'BCYR') return { bankName: 'Banca Comercială Română (BCR)', isKnown: true, country: 'RO' };
      return { bankName: 'Romániai bankszámla (RO)', isKnown: false, country: 'RO' };
    }

    // Egyesült Királyság (GBxx) — Wise, Revolut, Barclays, HSBC
    if (country === 'GB') {
      const bic = clean.slice(4, 8);
      if (bic === 'TRWI') return { bankName: 'Wise (UK)', isKnown: true, country: 'GB' };
      if (bic === 'REVO') return { bankName: 'Revolut (UK)', isKnown: true, country: 'GB' };
      if (bic === 'BARC') return { bankName: 'Barclays Bank', isKnown: true, country: 'GB' };
      if (bic === 'HBUK') return { bankName: 'HSBC UK', isKnown: true, country: 'GB' };
      return { bankName: 'Egyesült Királyságbeli számla (GB)', isKnown: false, country: 'GB' };
    }

    // Általános ország fallback
    const countryName = COUNTRY_NAMES[country] || country;
    return {
      bankName: `${countryName}i bankszámla (${country})`,
      isKnown: false,
      country,
    };
  }

  return null;
}

/**
 * Magyar belföldi számlaszám konvertálása magyar IBAN-ná (HUxx...).
 */
export function giroToIban(giro: string): string {
  const clean = giro.replace(/[-\s]/g, '');
  if (clean.length !== 16 && clean.length !== 24) return '';

  const padded = clean.length === 16 ? clean + '00000000' : clean;

  // H=17, U=30, ellenőrző kód inicializálás: 00
  const numericStr = padded + '173000';
  const remainder = bigMod97(numericStr);
  if (remainder === -1) return '';

  const checkDigits = String(98 - remainder).padStart(2, '0');
  return `HU${checkDigits}${padded}`;
}

/**
 * Magyar IBAN-ból a belföldi 16 vagy 24 jegyű számlaszám kinyerése kötőjelezve.
 */
export function ibanToGiro(iban: string, prefer16IfZeroPadded = false): string | null {
  const clean = iban.replace(/[\s-]/g, '').toUpperCase();
  if (!clean.startsWith('HU') || clean.length !== 28) return null;

  const domestic = clean.slice(4); // 24 számjegy
  if (!/^\d{24}$/.test(domestic)) return null;

  // Ha explicit 16 jegyű formátumot preferálunk és az utolsó 8 jegy csupa 0
  if (prefer16IfZeroPadded && domestic.slice(16, 24) === '00000000') {
    return `${domestic.slice(0, 8)}-${domestic.slice(8, 16)}`;
  }

  return `${domestic.slice(0, 8)}-${domestic.slice(8, 16)}-${domestic.slice(16, 24)}`;
}
