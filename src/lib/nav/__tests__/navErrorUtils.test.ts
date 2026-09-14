import { describe, it, expect } from 'vitest';
import { extractNavSyncError, formatNavErrorMessage, isNavTransientError } from '../navErrorUtils';

describe('navErrorUtils', () => {
  it('formats connection timeout as friendly Hungarian text', () => {
    const raw = 'error sending request for url (https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryInvoiceDigest): client error (Connect): tcp connect error: Connection timed out (os error 110)';
    const formatted = formatNavErrorMessage(raw);
    expect(formatted).toBe('A NAV szerver átmenetileg nem érhető el (időtúllépés). Kérjük, próbáld újra pár perc múlva.');
    expect(isNavTransientError(formatted)).toBe(true);
  });

  it('formats incorrect technical user credentials', () => {
    const raw = 'INCORRECT_USER_DATA: Nem megfelelő felhasználónév vagy jelszó';
    const formatted = formatNavErrorMessage(raw);
    expect(formatted).toBe('A megadott NAV technikai felhasználó adatai érvénytelenek. Kérjük, ellenőrizd az Integrációk menüpontban.');
    expect(isNavTransientError(formatted)).toBe(false);
  });

  it('formats expired password', () => {
    const raw = 'PASSWORD_EXPIRED';
    const formatted = formatNavErrorMessage(raw);
    expect(formatted).toBe('A NAV technikai felhasználó jelszava lejárt. Kérjük, újítsd meg a NAV Online Számla felületén.');
  });

  it('unpacks error context from FunctionsHttpError mock', async () => {
    const mockResponse = {
      clone: () => ({
        json: async () => ({ error: 'Connection timed out (os error 110)' }),
        text: async () => JSON.stringify({ error: 'Connection timed out (os error 110)' }),
      }),
      json: async () => ({ error: 'Connection timed out (os error 110)' }),
    };

    const mockFunctionsHttpError = {
      message: 'Edge Function returned a non-2xx status code',
      context: mockResponse,
    };

    const extracted = await extractNavSyncError(mockFunctionsHttpError);
    expect(extracted).toBe('A NAV szerver átmenetileg nem érhető el (időtúllépés). Kérjük, próbáld újra pár perc múlva.');
  });

  it('falls back to data.error if provided', async () => {
    const result = await extractNavSyncError(null, { error: 'PASSWORD_EXPIRED' });
    expect(result).toBe('A NAV technikai felhasználó jelszava lejárt. Kérjük, újítsd meg a NAV Online Számla felületén.');
  });
});
