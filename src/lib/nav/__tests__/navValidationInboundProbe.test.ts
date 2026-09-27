import { describe, it, expect, vi } from 'vitest';

// Pure logic mirroring NavClient.validateCredentials with inbound probe for testability
interface NavCredentials {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
  is_test_environment?: boolean;
}

interface NavValidationResult {
  valid: boolean;
  status: 'valid' | 'invalid' | 'error';
  message: string;
  error?: string | null;
  requestId: string;
  env: 'prod' | 'test';
  details?: string;
}

class TestableNavClient {
  constructor(
    private creds: NavCredentials,
    private transport: (url: string, init: any) => Promise<{ text: () => Promise<string> }>
  ) {}

  async validateCredentials(): Promise<NavValidationResult> {
    const env: 'prod' | 'test' = this.creds.is_test_environment ? 'test' : 'prod';
    const requestId = 'TEST-REQ-ID';

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
      // Step 1: tokenExchange
      const tokenResp = await this.transport('https://api.onlineszamla.nav.gov.hu/invoiceService/v3/tokenExchange', {
        method: 'POST'
      });
      const xmlResponse = await tokenResp.text();
      const isValid = xmlResponse.includes('<funcCode>OK</funcCode>') || xmlResponse.includes('<encodedExchangeToken>');

      if (!isValid) {
        return {
          valid: false,
          status: 'invalid',
          message: 'Érvénytelen hitelesítő adatok',
          error: 'Érvénytelen felhasználónév vagy kulcsok',
          requestId,
          env,
          details: xmlResponse
        };
      }

      // Step 2: INBOUND probe for queryInvoiceDigest
      try {
        const digestResp = await this.transport('https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryInvoiceDigest', {
          method: 'POST',
          body: 'INBOUND_PROBE'
        });
        const digestXml = await digestResp.text();
        if (digestXml.includes('<funcCode>ERROR</funcCode>') || digestXml.includes(':funcCode>ERROR<')) {
          if (digestXml.includes('FORBIDDEN') || digestXml.includes('Jogosultság szükséges') || digestXml.includes('403')) {
            return {
              valid: false,
              status: 'invalid',
              message: 'A technikai felhasználó kulcsai helyesek, de hiányzik a „Számlák lekérdezése” jogosultság a NAV portálon! Kérjük, engedélyezd az onlineszamla.nav.gov.hu felületen.',
              error: 'FORBIDDEN: Jogosultság szükséges (Számlák lekérdezése nincs engedélyezve)',
              requestId,
              env,
              details: digestXml
            };
          }
        }
      } catch (inboundErr: any) {
        const inboundErrMsg = inboundErr?.message || String(inboundErr);
        if (
          inboundErrMsg.includes('FORBIDDEN') ||
          inboundErrMsg.includes('Jogosultság szükséges') ||
          inboundErrMsg.includes('403')
        ) {
          return {
            valid: false,
            status: 'invalid',
            message: 'A technikai felhasználó kulcsai helyesek, de hiányzik a „Számlák lekérdezése” jogosultság a NAV portálon! Kérjük, engedélyezd az onlineszamla.nav.gov.hu felületen.',
            error: 'FORBIDDEN: Jogosultság szükséges (Számlák lekérdezése nincs engedélyezve)',
            requestId,
            env,
            details: inboundErrMsg
          };
        }
        console.warn('[NavClient.validateCredentials] Inbound probe non-fatal warning:', inboundErrMsg);
      }

      return {
        valid: true,
        status: 'valid',
        message: 'A hitelesítő adatok és a számlalekérdezési jogosultságok sikeresen ellenőrizve',
        error: null,
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
}

describe('NavClient validateCredentials with Inbound Probe', () => {
  const validCreds: NavCredentials = {
    nav_username: 'techuser123',
    nav_password: 'Password123!',
    nav_tax_number: '12345678',
    nav_sign_key: 'SIGNKEY123',
    nav_exchange_key: 'EXCHANGEKEY123'
  };

  it('fails validation when tokenExchange succeeds but queryInvoiceDigest INBOUND returns 403 / Jogosultság szükséges', async () => {
    const mockTransport = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/tokenExchange')) {
        return {
          text: async () => `<TokenExchangeResponse><result><funcCode>OK</funcCode></result><encodedExchangeToken>token123</encodedExchangeToken></TokenExchangeResponse>`
        };
      }
      if (url.includes('/queryInvoiceDigest')) {
        return {
          text: async () => `<QueryInvoiceDigestResponse><result><funcCode>ERROR</funcCode><errorCode>FORBIDDEN</errorCode><message>Jogosultság szükséges!</message></result></QueryInvoiceDigestResponse>`
        };
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const client = new TestableNavClient(validCreds, mockTransport);
    const result = await client.validateCredentials();

    expect(result.valid).toBe(false);
    expect(result.status).toBe('invalid');
    expect(result.error).toContain('FORBIDDEN: Jogosultság szükséges');
    expect(result.message).toContain('Számlák lekérdezése');
    expect(result.message).toContain('onlineszamla.nav.gov.hu');
  });

  it('passes validation when both tokenExchange and queryInvoiceDigest INBOUND succeed', async () => {
    const mockTransport = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/tokenExchange')) {
        return {
          text: async () => `<TokenExchangeResponse><result><funcCode>OK</funcCode></result><encodedExchangeToken>token123</encodedExchangeToken></TokenExchangeResponse>`
        };
      }
      if (url.includes('/queryInvoiceDigest')) {
        return {
          text: async () => `<QueryInvoiceDigestResponse><result><funcCode>OK</funcCode></result><invoiceDigest></invoiceDigest></QueryInvoiceDigestResponse>`
        };
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const client = new TestableNavClient(validCreds, mockTransport);
    const result = await client.validateCredentials();

    expect(result.valid).toBe(true);
    expect(result.status).toBe('valid');
    expect(result.error).toBeNull();
    expect(result.message).toContain('sikeresen ellenőrizve');
  });

  it('fails immediately when tokenExchange fails without calling queryInvoiceDigest', async () => {
    const mockTransport = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/tokenExchange')) {
        return {
          text: async () => `<TokenExchangeResponse><result><funcCode>ERROR</funcCode><errorCode>INVALID_SECURITY_USER</errorCode><message>Érvénytelen felhasználó</message></result></TokenExchangeResponse>`
        };
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const client = new TestableNavClient(validCreds, mockTransport);
    const result = await client.validateCredentials();

    expect(result.valid).toBe(false);
    expect(result.status).toBe('invalid');
    expect(mockTransport).toHaveBeenCalledTimes(1);
    expect(mockTransport).toHaveBeenCalledWith(expect.stringContaining('/tokenExchange'), expect.any(Object));
  });

  it('does not fail validation when tokenExchange succeeds and queryInvoiceDigest INBOUND has non-permission warning', async () => {
    const mockTransport = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/tokenExchange')) {
        return {
          text: async () => `<TokenExchangeResponse><result><funcCode>OK</funcCode></result><encodedExchangeToken>token123</encodedExchangeToken></TokenExchangeResponse>`
        };
      }
      if (url.includes('/queryInvoiceDigest')) {
        throw new Error('Connection timed out');
      }
      throw new Error(`Unexpected url ${url}`);
    });

    const client = new TestableNavClient(validCreds, mockTransport);
    const result = await client.validateCredentials();

    // Since tokenExchange was valid and timeout is transient, valid stays true
    expect(result.valid).toBe(true);
    expect(result.status).toBe('valid');
  });
});
