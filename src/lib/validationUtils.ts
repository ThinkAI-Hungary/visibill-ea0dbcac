/**
 * Univerzális input validációs segédfüggvények.
 * Használható űrlapoknál (ManualUpload, Onboarding, stb.)
 */

/**
 * Email formátum ellenőrzése regex-el.
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Pozitív szám ellenőrzése (0-nál szigorúan nagyobb).
 * String inputot is elfogad és megpróbálja parse-olni.
 */
export function isValidAmount(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (typeof num !== "number" || isNaN(num)) return false;
  return num > 0;
}

/**
 * Ellenőrzi, hogy a szöveg nem üres és nem csak szóközökből áll.
 */
export function isNotBlank(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  return text.trim().length > 0;
}

/**
 * Magyar adószám formátum ellenőrzése.
 * Elfogadott formátumok:
 * - 8 számjegy + kötőjel + 1 számjegy + kötőjel + 2 számjegy (pl. "12345678-1-42")
 * - 10 vagy 11 egybefüggő számjegy
 */
export function isValidTaxId(taxId: string): boolean {
  if (!taxId || typeof taxId !== "string") return false;
  const trimmed = taxId.trim();

  // Format: 12345678-1-42
  const dashFormat = /^\d{8}-\d-\d{2}$/;
  if (dashFormat.test(trimmed)) return true;

  // Egybefüggő számjegyek (10 vagy 11 karakter)
  const plainFormat = /^\d{10,11}$/;
  return plainFormat.test(trimmed);
}

export interface ParsedTaxNumber {
  raw: string;
  base: string;           // 8 számjegyű törzsszám
  vat: string;            // 1 számjegyű áfakód
  county: string;         // 2 számjegyű megyekód
  fullFormatted: string;  // Formázott: "12345678-1-42" vagy ha hiányos, a raw
}

/**
 * Normalizálja és felbontja a magyar adószámot (törzsszám, áfakód, megyekód).
 * Kezeli mind a kötőjeles (12345678-1-42), mind az egybefüggő 11 jegyű (12345678142),
 * mind a szóközös vagy csak törzsszámot tartalmazó formátumokat.
 */
export function parseTaxNumber(taxNum: string | null | undefined): ParsedTaxNumber {
  if (!taxNum || typeof taxNum !== 'string') {
    return { raw: '', base: '', vat: '', county: '', fullFormatted: '' };
  }

  const raw = taxNum.trim();
  const digits = raw.replace(/\D/g, '');

  let base = '';
  let vat = '';
  let county = '';

  if (raw.includes('-')) {
    const parts = raw.split('-').map(p => p.trim());
    base = parts[0] ? parts[0].replace(/\D/g, '').slice(0, 8) : '';
    vat = parts[1] ? parts[1].replace(/\D/g, '').slice(0, 1) : '';
    county = parts[2] ? parts[2].replace(/\D/g, '').slice(0, 2) : '';
  } else if (digits.length >= 11) {
    base = digits.slice(0, 8);
    vat = digits.slice(8, 9);
    county = digits.slice(9, 11);
  } else if (digits.length >= 8) {
    base = digits.slice(0, 8);
    vat = digits.slice(8, 9) || '';
    county = digits.slice(9, 11) || '';
  } else {
    base = digits;
  }

  const fullFormatted = base && vat && county ? `${base}-${vat}-${county}` : raw;

  return {
    raw,
    base,
    vat,
    county,
    fullFormatted,
  };
}

