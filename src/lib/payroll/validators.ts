/**
 * Accounty Bérszámfejtési Modul - Validátorok
 *
 * TAJ-szám, adóazonosító jel, bankszámlaszám, FEOR kód validáció.
 * A frontend élő validációjához és a DB-mentés előtti ellenőrzéshez.
 */

// ── TAJ-szám validáció (CDV - check digit verification) ──

/**
 * TAJ-szám validáció a CDV algoritmus szerint.
 * Formátum: 000-000-000 (kötőjelekkel vagy anélkül)
 *
 * Algoritmus:
 * - Páratlan pozíciókon álló számjegyek × 3
 * - Páros pozíciókon álló számjegyek × 7
 * - Az összeg mod 10 = utolsó (9.) számjegy
 */
export function validateTajNumber(taj: string): { valid: boolean; error?: string } {
  // Kötőjelek eltávolítása, szóközök
  const cleaned = taj.replace(/[-\s]/g, '');

  if (cleaned.length !== 9) {
    return { valid: false, error: 'A TAJ-számnak 9 számjegyből kell állnia' };
  }

  if (!/^\d{9}$/.test(cleaned)) {
    return { valid: false, error: 'A TAJ-szám csak számjegyeket tartalmazhat' };
  }

  // 000-000-000 nem érvényes
  if (cleaned === '000000000') {
    return { valid: false, error: 'A TAJ-szám nem lehet csupa nulla' };
  }

  const digits = cleaned.split('').map(Number);
  const weights = [3, 7, 3, 7, 3, 7, 3, 7]; // 1-8 pozíció
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }

  const checkDigit = sum % 10;

  if (checkDigit !== digits[8]) {
    return { valid: false, error: 'Érvénytelen TAJ-szám (ellenőrző számjegy hibás)' };
  }

  return { valid: true };
}

/**
 * TAJ-szám formázása: 000-000-000
 */
export function formatTajNumber(taj: string): string {
  const cleaned = taj.replace(/[-\s]/g, '');
  if (cleaned.length !== 9) return taj;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6, 9)}`;
}

// ── Adóazonosító jel validáció ──

/**
 * Adóazonosító jel validáció.
 * 10 jegyű szám, ahol:
 * - Az 1. jegy mindig 8
 * - A 10. jegy ellenőrző számjegy (súlyozott összeg mod 11)
 */
export function validateTaxId(taxId: string): { valid: boolean; error?: string } {
  const cleaned = taxId.replace(/[-\s]/g, '');

  if (cleaned.length !== 10) {
    return { valid: false, error: 'Az adóazonosító jelnek 10 számjegyből kell állnia' };
  }

  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: 'Az adóazonosító jel csak számjegyeket tartalmazhat' };
  }

  if (cleaned[0] !== '8') {
    return { valid: false, error: 'Az adóazonosító jel 8-cal kell kezdődjön' };
  }

  const digits = cleaned.split('').map(Number);
  const weights = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;

  for (let i = 0; i < 9; i++) {
    sum += digits[i] * weights[i];
  }

  const checkDigit = sum % 11;

  if (checkDigit !== digits[9]) {
    return { valid: false, error: 'Érvénytelen adóazonosító jel (ellenőrző számjegy hibás)' };
  }

  return { valid: true };
}

// ── Bankszámlaszám validáció ──

/**
 * Magyar bankszámlaszám validáció.
 * Formátum: 3×8 jegyű (GIRO formátum) vagy 2×8 jegyű
 * A harmadik 8-as blokk opcionális (alszámla).
 *
 * GIRO ellenőrzés:
 * - Routing (első 8): súlyozott összeg mod 10 = 0
 * - Account (második 8): súlyozott összeg mod 10 = 0
 */
export function validateBankAccount(account: string): { valid: boolean; error?: string } {
  const cleaned = account.replace(/[-\s]/g, '');

  if (![16, 24].includes(cleaned.length)) {
    return { valid: false, error: 'A bankszámlaszámnak 16 vagy 24 számjegyből kell állnia' };
  }

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'A bankszámlaszám csak számjegyeket tartalmazhat' };
  }

  // GIRO CDV validáció
  const giroWeights = [9, 7, 3, 1, 9, 7, 3, 1];

  // Routing (1-8)
  const routingDigits = cleaned.slice(0, 8).split('').map(Number);
  let routingSum = 0;
  for (let i = 0; i < 8; i++) {
    routingSum += routingDigits[i] * giroWeights[i];
  }
  if (routingSum % 10 !== 0) {
    return { valid: false, error: 'Érvénytelen bankszámlaszám (routing ellenőrzés hibás)' };
  }

  // Account (9-16)
  const accountDigits = cleaned.slice(8, 16).split('').map(Number);
  let accountSum = 0;
  for (let i = 0; i < 8; i++) {
    accountSum += accountDigits[i] * giroWeights[i];
  }
  if (accountSum % 10 !== 0) {
    return { valid: false, error: 'Érvénytelen bankszámlaszám (account ellenőrzés hibás)' };
  }

  return { valid: true };
}

/**
 * Bankszámlaszám formázása: XXXXXXXX-XXXXXXXX(-XXXXXXXX)
 */
export function formatBankAccount(account: string): string {
  const cleaned = account.replace(/[-\s]/g, '');
  if (cleaned.length === 16) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 16)}`;
  }
  if (cleaned.length === 24) {
    return `${cleaned.slice(0, 8)}-${cleaned.slice(8, 16)}-${cleaned.slice(16, 24)}`;
  }
  return account;
}

/**
 * Magyar bankszámlaszám → IBAN konverzió.
 * HU + 2 ellenőrzőjegy + bankszámlaszám (24 jegy, ha 16 jegyű → 0-kkal kiegészítve)
 */
export function convertToIban(account: string): string {
  const cleaned = account.replace(/[-\s]/g, '');
  const padded = cleaned.length === 16 ? cleaned + '00000000' : cleaned;
  if (padded.length !== 24) return '';

  // IBAN ellenőrzőjegy számítás (mod 97)
  // HU00 + 24 jegy → numerikus érték: 24 jegy + "1721" (H=17, U=30) + "00"
  const numericStr = padded + '173000'; // H=17, U=30, ellenőrző=00
  const remainder = bigMod97(numericStr);
  const checkDigits = String(98 - remainder).padStart(2, '0');

  return `HU${checkDigits}${padded}`;
}

/** Mod 97 nagy számokra (string-ként kezelve) */
function bigMod97(numStr: string): number {
  let remainder = 0;
  for (const char of numStr) {
    remainder = (remainder * 10 + parseInt(char, 10)) % 97;
  }
  return remainder;
}

// ── FEOR kód validáció ──

/**
 * FEOR kód validáció (4 számjegyű KSH foglalkozási kód).
 */
export function validateFeorCode(feor: string): { valid: boolean; error?: string } {
  const cleaned = feor.replace(/\s/g, '');

  if (cleaned.length !== 4) {
    return { valid: false, error: 'A FEOR kódnak 4 számjegyből kell állnia' };
  }

  if (!/^\d{4}$/.test(cleaned)) {
    return { valid: false, error: 'A FEOR kód csak számjegyeket tartalmazhat' };
  }

  // A FEOR kód első jegye 1-9 (főcsoport)
  const firstDigit = parseInt(cleaned[0], 10);
  if (firstDigit < 1 || firstDigit > 9) {
    return { valid: false, error: 'Érvénytelen FEOR kód (a főcsoport 1-9 közötti)' };
  }

  return { valid: true };
}

/**
 * FEOR kód alapján megállapítja, hogy szakképzettséget igénylő munkakör-e.
 * Főcsoport 1-4 = szellemi/szakképzett (garantált bérminimum)
 * Főcsoport 5-9 = fizikai/szakképzettség nélküli (minimálbér)
 */
export function isSkilled(feor: string): boolean {
  const firstDigit = parseInt(feor[0], 10);
  return firstDigit >= 1 && firstDigit <= 4;
}

// ── Minimálbér validáció ──

export interface MinWageValidation {
  valid: boolean;
  minimumRequired: number;
  error?: string;
}

/**
 * Minimálbér validáció a FEOR kód és heti óraszám alapján.
 *
 * - Teljes munkaidő (40 óra): minimálbér / garantált bérminimum
 * - Részmunkaidő: arányosítva (weekly_hours / 40)
 */
export function validateMinimumWage(
  salary: number,
  feor: string,
  weeklyHours: number = 40,
  params: { minimumWage: number; guaranteedMinimum: number }
): MinWageValidation {
  const { minimumWage, guaranteedMinimum } = params;
  const baseMW = isSkilled(feor) ? guaranteedMinimum : minimumWage;
  const ratio = weeklyHours / 40;
  const minimumRequired = Math.round(baseMW * ratio);

  if (salary < minimumRequired) {
    return {
      valid: false,
      minimumRequired,
      error: `Az alapbér (${formatAmount(salary)}) alacsonyabb a minimálbérnél (${formatAmount(minimumRequired)})`,
    };
  }

  return { valid: true, minimumRequired };
}

/**
 * Összeg formázás (HUF)
 */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency: 'HUF',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Egyéb validátorok ──

/**
 * Magyar adószám validáció (cégek: 11 jegyű, formátum: XXXXXXXX-Y-ZZ)
 */
export function validateCompanyTaxNumber(taxNumber: string): { valid: boolean; error?: string } {
  const cleaned = taxNumber.replace(/[-\s]/g, '');

  if (cleaned.length !== 11) {
    return { valid: false, error: 'Az adószámnak 11 számjegyből kell állnia' };
  }

  if (!/^\d{11}$/.test(cleaned)) {
    return { valid: false, error: 'Az adószám csak számjegyeket tartalmazhat' };
  }

  // Első 8 jegy: törzsszám (CDV)
  const digits = cleaned.slice(0, 8).split('').map(Number);
  const weights = [9, 7, 3, 1, 9, 7, 3, 1];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += digits[i] * weights[i];
  }
  if (sum % 10 !== 0) {
    return { valid: false, error: 'Érvénytelen adószám (ellenőrző számjegy hibás)' };
  }

  return { valid: true };
}
