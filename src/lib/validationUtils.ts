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
