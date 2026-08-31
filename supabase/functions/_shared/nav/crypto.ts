// =============================================================================
// NAV Online Számla v3 – Kriptográfiai & Segédfüggvények
// =============================================================================
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3';
import { NavCredentials } from './types.ts';

/**
 * NAV-kompatibilis requestId generálása (max 32 karakter).
 * Formátum: "RID" + 13 véletlenszerű alfanumerikus karakter (összesen 16 karakter).
 */
export function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * ISO dátum konvertálása kompakt UTC formátumra (yyyyMMddHHmmss).
 * A NAV v3 aláírásképzéshez kötelezően ezt a formátumot kell használni.
 */
export function formatCompactTimestamp(isoTimestamp: string | Date): string {
  const date = typeof isoTimestamp === 'string' ? new Date(isoTimestamp) : isoTimestamp;
  return (
    date.getUTCFullYear().toString() +
    (date.getUTCMonth() + 1).toString().padStart(2, '0') +
    date.getUTCDate().toString().padStart(2, '0') +
    date.getUTCHours().toString().padStart(2, '0') +
    date.getUTCMinutes().toString().padStart(2, '0') +
    date.getUTCSeconds().toString().padStart(2, '0')
  );
}

/**
 * SHA-512 jelszó hash generálása (NAV v3: csak a jelszót kell hashelni, csupa nagybetűs HEX).
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/**
 * SHA3-512 kérés aláírás készítése (NAV v3 specifikáció).
 * Alap: requestId + yyyyMMddHHmmss + signKey -> SHA3-512 -> UPPERCASE HEX.
 */
export function createSignature(creds: Pick<NavCredentials, 'nav_sign_key'>, requestId: string, timestamp: string): string {
  const compactTimestamp = formatCompactTimestamp(timestamp);
  const signatureBase = requestId + compactTimestamp + (creds.nav_sign_key || '');
  const encoder = new TextEncoder();
  const data = encoder.encode(signatureBase);
  const hash = sha3_512(data);
  return Array.from(hash)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Érzékeny adatok (jelszó hash, aláírás) maszkolása az XML-ből a biztonságos naplózáshoz.
 */
export function maskSensitiveXml(xml: string): string {
  return xml
    .replace(/<common:passwordHash[^>]*>.*?<\/common:passwordHash>/g, '<common:passwordHash>***MASKED***</common:passwordHash>')
    .replace(/<common:requestSignature[^>]*>.*?<\/common:requestSignature>/g, '<common:requestSignature>***MASKED***</common:requestSignature>')
    .replace(/<passwordHash[^>]*>.*?<\/passwordHash>/g, '<passwordHash>***MASKED***</passwordHash>')
    .replace(/<requestSignature[^>]*>.*?<\/requestSignature>/g, '<requestSignature>***MASKED***</requestSignature>');
}

/**
 * Adószám tisztítása és 8-jegyű törzsszám kinyerése.
 */
export function sanitizeTaxNumber(taxNumber: string | null | undefined): string {
  if (!taxNumber) return '';
  const clean = taxNumber.replace(/[^0-9]/g, '');
  return clean.slice(0, 8);
}
