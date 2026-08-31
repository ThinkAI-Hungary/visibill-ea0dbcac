// =============================================================================
// NAV Online Számla v3 – Protokoll Kliens (NavClient)
// =============================================================================
import { NavCredentials, NavSyncOptions, NavInvoiceDigest, InvoiceDetails, NavValidationResult } from './types.ts';
import { generateRequestId, hashPassword, createSignature, maskSensitiveXml } from './crypto.ts';
import { buildTokenExchangeXml, buildQueryDigestXml, buildQueryInvoiceDataXml } from './xml-builder.ts';
import { parseTokenResponse, parseInvoiceDigestXml, parseInvoiceDataXml, parseNavError } from './xml-parser.ts';

export class NavClient {
  private baseUrl: string;
  private cachedToken: { token: string; expiresAt: number } | null = null;

  constructor(
    private creds: NavCredentials,
    private transport: typeof fetch = fetch
  ) {
    this.baseUrl = creds.is_test_environment
      ? 'https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3'
      : 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3';
  }

  /**
   * Hitelesítő adatok inline vagy tárolt validálása a tokenExchange végponton keresztül.
   */
  async validateCredentials(): Promise<NavValidationResult> {
    const env: 'prod' | 'test' = this.creds.is_test_environment ? 'test' : 'prod';
    const requestId = generateRequestId();
    const timestamp = new Date().toISOString();

    // Alapvető mező-ellenőrzések
    const username = this.creds.nav_username?.trim() || '';
    const password = this.creds.nav_password?.trim() || '';
    const taxNumber = this.creds.nav_tax_number?.trim() || '';
    const signKey = this.creds.nav_sign_key?.trim() || '';

    if (!username || !password || !taxNumber || !signKey) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Hiányzó NAV hitelesítő adatok',
        error: 'Hiányzó felhasználónév, jelszó, adószám vagy aláírókulcs',
        requestId,
        env
      };
    }

    if (!/^\d{8}$/.test(taxNumber)) {
      return {
        valid: false,
        status: 'invalid',
        message: 'Érvénytelen adószám formátum (pontosan 8 számjegy szükséges)',
        error: 'Adószám nem 8 számjegy',
        requestId,
        env
      };
    }

    try {
      const passwordHash = await hashPassword(password);
      const requestSignature = createSignature(this.creds, requestId, timestamp);
      const xmlRequest = buildTokenExchangeXml(this.creds, requestId, timestamp, passwordHash, requestSignature);

      const response = await this.transport(`${this.baseUrl}/tokenExchange`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=UTF-8',
          'Accept': 'application/xml'
        },
        body: xmlRequest
      });

      const xmlResponse = await response.text();
      const isValid = xmlResponse.includes('<funcCode>OK</funcCode>') || xmlResponse.includes('<encodedExchangeToken>');
      const validationError = !isValid ? parseNavError(xmlResponse) : null;

      return {
        valid: isValid,
        status: isValid ? 'valid' : 'invalid',
        message: isValid ? 'A hitelesítő adatok sikeresen ellenőrizve' : validationError || 'Érvénytelen hitelesítő adatok',
        error: validationError,
        requestId,
        env,
        details: xmlResponse
      };
    } catch (err: any) {
      return {
        valid: false,
        status: 'error',
        message: `NAV kapcsolat hiba: ${err?.message || err}`,
        error: err?.message || String(err),
        requestId,
        env
      };
    }
  }

  /**
   * Érvényes exchange token lekérése (vagy cache-elt token visszaadása).
   */
  async requestToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && this.cachedToken && this.cachedToken.expiresAt > now + 30000) {
      return this.cachedToken.token;
    }

    const requestId = generateRequestId();
    const timestamp = new Date().toISOString();
    const passwordHash = await hashPassword(this.creds.nav_password);
    const requestSignature = createSignature(this.creds, requestId, timestamp);

    const xmlRequest = buildTokenExchangeXml(this.creds, requestId, timestamp, passwordHash, requestSignature);

    const response = await this.transport(`${this.baseUrl}/tokenExchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: xmlRequest
    });

    const xmlResponse = await response.text();
    const token = parseTokenResponse(xmlResponse);

    // NAV token 10 percig érvényes (600s), cache-eljük 9 percre
    this.cachedToken = {
      token,
      expiresAt: now + 540000
    };

    return token;
  }

  /**
   * Számlák lekérdezése adott oldalon (QueryInvoiceDigest).
   */
  async queryInvoiceDigest(params: NavSyncOptions): Promise<NavInvoiceDigest[]> {
    const requestId = generateRequestId();
    const timestamp = new Date().toISOString();
    const passwordHash = await hashPassword(this.creds.nav_password);
    const requestSignature = createSignature(this.creds, requestId, timestamp);

    const xmlRequest = buildQueryDigestXml(this.creds, params, requestId, timestamp, passwordHash, requestSignature);

    const response = await this.transport(`${this.baseUrl}/queryInvoiceDigest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: xmlRequest
    });

    const xmlResponse = await response.text();
    return parseInvoiceDigestXml(xmlResponse);
  }

  /**
   * Egy adott számla részletes adatainak (tételsorok, címek) lekérdezése (QueryInvoiceData).
   */
  async queryInvoiceData(invoiceNumber: string, invoiceDirection: 'INBOUND' | 'OUTBOUND'): Promise<InvoiceDetails> {
    const requestId = generateRequestId();
    const timestamp = new Date().toISOString();
    const passwordHash = await hashPassword(this.creds.nav_password);
    const requestSignature = createSignature(this.creds, requestId, timestamp);

    const xmlRequest = buildQueryInvoiceDataXml(this.creds, invoiceNumber, invoiceDirection, requestId, timestamp, passwordHash, requestSignature);

    const response = await this.transport(`${this.baseUrl}/queryInvoiceData`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=UTF-8',
        'Accept': 'application/xml'
      },
      body: xmlRequest
    });

    const xmlResponse = await response.text();
    return parseInvoiceDataXml(xmlResponse);
  }

  /**
   * Számlák lekérése az összes elérhető lap (és szükség esetén 30 napos dátumszeletek) bejárásával.
   */
  async fetchAllInvoices(params: NavSyncOptions, maxPages = 50): Promise<NavInvoiceDigest[]> {
    if (params.dateFrom && params.dateTo) {
      const from = new Date(params.dateFrom);
      const to = new Date(params.dateTo);
      const daysDiff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));

      // Ha a dátumtartomány meghaladja a 30 napot, bontsuk fel NAV-kompatibilis 30 napos szeletekre
      if (daysDiff > 30) {
        const chunks = splitDateRange(params.dateFrom, params.dateTo, 30);
        const allChunkInvoices: NavInvoiceDigest[] = [];
        const seenInvoiceNumbers = new Set<string>();

        for (const chunk of chunks) {
          const chunkInvoices = await this.fetchAllInvoices({
            ...params,
            dateFrom: chunk.from,
            dateTo: chunk.to,
            page: 1
          }, maxPages);

          for (const inv of chunkInvoices) {
            if (!seenInvoiceNumbers.has(inv.invoice_number)) {
              seenInvoiceNumbers.add(inv.invoice_number);
              allChunkInvoices.push(inv);
            }
          }
        }
        return allChunkInvoices;
      }
    }

    const allInvoices: NavInvoiceDigest[] = [];
    let currentPage = params.page || 1;

    while (currentPage <= maxPages) {
      const pageResults = await this.queryInvoiceDigest({ ...params, page: currentPage });
      if (!pageResults || pageResults.length === 0) {
        break;
      }

      allInvoices.push(...pageResults);

      // NAV API oldalanként maximum 100 számlát ad vissza
      if (pageResults.length < 100) {
        break;
      }

      currentPage++;
    }

    return allInvoices;
  }
}

/**
 * Dátumintervallum felosztása kisebb szeletekre (NAV maximum 35 napos korlát támogatása).
 */
export function splitDateRange(dateFrom: string, dateTo: string, maxDays = 30): Array<{ from: string; to: string }> {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
    return [{ from: dateFrom, to: dateTo }];
  }

  const chunks: Array<{ from: string; to: string }> = [];
  let currentFrom = new Date(from);

  while (currentFrom < to) {
    const currentTo = new Date(currentFrom);
    currentTo.setDate(currentTo.getDate() + maxDays);
    const effectiveTo = currentTo > to ? to : currentTo;

    chunks.push({
      from: currentFrom.toISOString().split('T')[0],
      to: effectiveTo.toISOString().split('T')[0]
    });

    currentFrom = new Date(effectiveTo);
    currentFrom.setDate(currentFrom.getDate() + 1);
  }

  return chunks.length > 0 ? chunks : [{ from: dateFrom, to: dateTo }];
}
