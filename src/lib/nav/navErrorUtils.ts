/**
 * NAV Online Számla szinkronizációs hiba-kinyerő és formázó segédprogramok.
 *
 * A Supabase functions.invoke alapértelmezetten elrejti a valódi HTTP 4xx/5xx hibaüzenetet
 * a FunctionsHttpError generic "Edge Function returned a non-2xx status code" üzenete mögé.
 * Ez a modul kinyeri az error.context-ből a valódi JSON választ, és a technikai
 * hibaüzeneteket (pl. NAV timeout, lejárt jelszó, rossz adatok) érthető magyar szöveggé alakítja.
 */

export async function extractNavSyncError(error: unknown, data?: any): Promise<string> {
  if (data?.error) {
    return formatNavErrorMessage(String(data.error));
  }

  if (!error) {
    return 'Ismeretlen hiba történt a NAV szinkronizálás során.';
  }

  let msg = (error as any)?.message || String(error);

  // Ha a Supabase FunctionsHttpError-t dobott, próbáljuk kinyerni a választestet
  if (error && typeof error === 'object' && 'context' in error) {
    try {
      const response = (error as any).context as Response;
      if (response && typeof response.json === 'function') {
        const body = await response.clone().json();
        if (body?.error) {
          msg = body.error;
        } else if (body?.message) {
          msg = body.message;
        }
      }
    } catch {
      try {
        const response = (error as any).context as Response;
        if (response && typeof response.text === 'function') {
          const text = await response.clone().text();
          if (text && text.length < 300) {
            msg = text;
          }
        }
      } catch {
        // Fallback to error.message
      }
    }
  }

  return formatNavErrorMessage(msg);
}

export function formatNavErrorMessage(rawMsg: string): string {
  if (!rawMsg) {
    return 'Ismeretlen hiba történt a NAV szinkronizálás során.';
  }

  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('connection timed out') ||
    lower.includes('connect error') ||
    lower.includes('os error 110') ||
    lower.includes('timeout') ||
    lower.includes('timed out')
  ) {
    return 'A NAV szerver átmenetileg nem érhető el (időtúllépés). Kérjük, próbáld újra pár perc múlva.';
  }

  if (
    lower.includes('incorrect_user_data') ||
    lower.includes('invalid_security_user') ||
    lower.includes('technical_user_not_exists')
  ) {
    return 'A megadott NAV technikai felhasználó adatai érvénytelenek. Kérjük, ellenőrizd az Integrációk menüpontban.';
  }

  if (lower.includes('password_expired')) {
    return 'A NAV technikai felhasználó jelszava lejárt. Kérjük, újítsd meg a NAV Online Számla felületén.';
  }

  if (lower.includes('not found') && (lower.includes('nav') || lower.includes('credentials'))) {
    return 'A céghez nincsenek beállítva érvényes NAV hitelesítő adatok.';
  }

  if (lower.includes('edge function returned a non-2xx status code')) {
    return 'A NAV szinkronizációs modul hibát jelzett. Kérjük, próbáld újra később.';
  }

  return rawMsg;
}

export function isNavTransientError(rawMsg: string): boolean {
  if (!rawMsg) return false;
  const lower = rawMsg.toLowerCase();
  return (
    lower.includes('időtúllépés') ||
    lower.includes('timed out') ||
    lower.includes('connection timed out') ||
    lower.includes('os error 110') ||
    lower.includes('átmenetileg nem érhető el')
  );
}
