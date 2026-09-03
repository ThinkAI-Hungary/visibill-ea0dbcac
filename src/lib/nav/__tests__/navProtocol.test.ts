import { describe, it, expect } from 'vitest';
import { sha3_512 } from 'js-sha3';

// ── Pure implementations matching supabase/functions/_shared/nav for Node/Vitest test runner ──

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 13; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function formatCompactTimestamp(isoTimestamp: string | Date): string {
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

function createSignature(signKey: string, requestId: string, timestamp: string): string {
  const compactTimestamp = formatCompactTimestamp(timestamp);
  const signatureBase = requestId + compactTimestamp + signKey;
  return sha3_512(signatureBase).toUpperCase();
}

function extractTag(xmlChunk: string, tag: string): string {
  const regex = new RegExp(`(?:<(?:\\w+:)?${tag}\\/>|<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}>)`);
  const m = xmlChunk.match(regex);
  return m && m[1] ? m[1].trim() : '';
}

function extractTaxNumber(xmlChunk: string, parentTag: string): string {
  const parentMatch = xmlChunk.match(new RegExp(`<(?:\\w+:)?${parentTag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${parentTag}>`));
  if (!parentMatch) return '';
  return extractTag(parentMatch[1], 'taxpayerId') || extractTag(xmlChunk, parentTag);
}

function parseNavError(xmlResponse: string): string {
  const errorMatch = xmlResponse.match(/<(?:\w+:)?message>(.+?)<\/(?:\w+:)?message>/);
  const errorCodeMatch = xmlResponse.match(/<(?:\w+:)?errorCode>(.+?)<\/(?:\w+:)?errorCode>/);

  if (errorMatch && errorCodeMatch) {
    return `${errorCodeMatch[1]}: ${errorMatch[1]}`;
  } else if (errorMatch) {
    return errorMatch[1];
  } else if (errorCodeMatch) {
    return errorCodeMatch[1];
  }
  return 'Ismeretlen NAV API hiba';
}

function parseInvoiceDigestXml(xmlResponse: string) {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Query hiba: ${errorMsg}`);
  }

  const invoices: any[] = [];
  const digestRegex = /<(?:\w+:)?invoiceDigest>([\s\S]*?)<\/(?:\w+:)?invoiceDigest>/g;
  let match: RegExpExecArray | null;

  while ((match = digestRegex.exec(xmlResponse)) !== null) {
    const chunk = match[1];
    const invoiceNumber = extractTag(chunk, 'invoiceNumber');
    if (!invoiceNumber) continue;

    const supplierTax = extractTaxNumber(chunk, 'supplierTaxNumber');
    const customerTax = extractTaxNumber(chunk, 'customerTaxNumber');

    const netAmount = parseFloat(extractTag(chunk, 'invoiceNetAmount')) || 0;
    const vatAmount = parseFloat(extractTag(chunk, 'invoiceVatAmount')) || 0;
    let grossAmount = parseFloat(extractTag(chunk, 'invoiceGrossAmount'));

    if (isNaN(grossAmount) || (grossAmount === 0 && (netAmount !== 0 || vatAmount !== 0))) {
      grossAmount = netAmount + vatAmount;
    }

    invoices.push({
      invoice_number: invoiceNumber,
      invoice_operation: extractTag(chunk, 'invoiceOperation') || 'CREATE',
      supplier_tax_number: supplierTax,
      customer_tax_number: customerTax,
      supplier_name: extractTag(chunk, 'supplierName') || undefined,
      customer_name: extractTag(chunk, 'customerName') || undefined,
      invoice_issue_date: extractTag(chunk, 'invoiceIssueDate'),
      invoice_delivery_date: extractTag(chunk, 'invoiceDeliveryDate') || extractTag(chunk, 'invoiceIssueDate'),
      payment_date: extractTag(chunk, 'paymentDate') || undefined,
      invoice_net_amount: netAmount,
      invoice_vat_amount: vatAmount,
      invoice_gross_amount: grossAmount,
      payment_method: extractTag(chunk, 'paymentMethod') || 'OTHER',
      currency: extractTag(chunk, 'currency') || extractTag(chunk, 'invoiceCurrency') || 'HUF'
    });
  }

  return invoices;
}

function parseSimplifiedVat(lineGrossAmount: number, vatContent: number) {
  const vatAmount = Math.round(lineGrossAmount * vatContent);
  const netAmount = lineGrossAmount - vatAmount;
  let vatRate = String(vatContent);

  if (Math.abs(vatContent - 0.2126) < 0.005) vatRate = '0.27';
  else if (Math.abs(vatContent - 0.1525) < 0.005) vatRate = '0.18';
  else if (Math.abs(vatContent - 0.0476) < 0.005) vatRate = '0.05';

  return { netAmount, vatAmount, vatRate };
}

describe('NAV Online Számla Protocol Engine', () => {
  describe('Kriptográfiai & Segédfüggvények', () => {
    it('generates a valid 16-character Request ID starting with RID', () => {
      const requestId = generateRequestId();
      expect(requestId).toMatch(/^RID[A-Z0-9]{13}$/);
      expect(requestId.length).toBe(16);
    });

    it('formats ISO timestamps to compact UTC yyyyMMddHHmmss', () => {
      const iso = '2026-08-31T14:25:30.000Z';
      const compact = formatCompactTimestamp(iso);
      expect(compact).toBe('20260831142530');
    });

    it('calculates uppercase SHA3-512 signature per NAV v3 spec', () => {
      const requestId = 'RID1234567890123';
      const timestamp = '2026-08-31T12:00:00.000Z';
      const signKey = 'TEST_SIGN_KEY_ABC123';
      const signature = createSignature(signKey, requestId, timestamp);

      expect(signature).toMatch(/^[A-F0-9]{128}$/);
      expect(signature).toBe(sha3_512('RID123456789012320260831120000TEST_SIGN_KEY_ABC123').toUpperCase());
    });

    it('extracts tags handling self-closing and empty tags cleanly', () => {
      const xml = '<root><name>Test Corp</name><empty></empty><selfClosing/><space>  hello  </space></root>';
      expect(extractTag(xml, 'name')).toBe('Test Corp');
      expect(extractTag(xml, 'empty')).toBe('');
      expect(extractTag(xml, 'selfClosing')).toBe('');
      expect(extractTag(xml, 'space')).toBe('hello');
      expect(extractTag(xml, 'missing')).toBe('');
    });
  });

  describe('XML Parserek & Hibakezelés', () => {
    it('parses structured NAV error codes and messages', () => {
      const errorXml = `
        <GeneralErrorResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
          <result>
            <funcCode>ERROR</funcCode>
            <errorCode>INVALID_SECURITY_USER</errorCode>
            <message>A megadott felhasználói név vagy jelszó érvénytelen.</message>
          </result>
        </GeneralErrorResponse>
      `;
      const error = parseNavError(errorXml);
      expect(error).toBe('INVALID_SECURITY_USER: A megadott felhasználói név vagy jelszó érvénytelen.');
    });

    it('parses invoice digest XML list with fallback gross calculations and nested tax numbers', () => {
      const digestXml = `
        <QueryInvoiceDigestResponse xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
          <result><funcCode>OK</funcCode></result>
          <invoiceDigestResult>
            <invoiceDigest>
              <invoiceNumber>2026/001</invoiceNumber>
              <invoiceOperation>CREATE</invoiceOperation>
              <supplierTaxNumber><taxpayerId>12345678</taxpayerId></supplierTaxNumber>
              <customerTaxNumber><taxpayerId>87654321</taxpayerId></customerTaxNumber>
              <invoiceIssueDate>2026-08-15</invoiceIssueDate>
              <invoiceNetAmount>100000</invoiceNetAmount>
              <invoiceVatAmount>27000</invoiceVatAmount>
              <invoiceGrossAmount>127000</invoiceGrossAmount>
              <invoiceCurrency>HUF</invoiceCurrency>
            </invoiceDigest>
            <invoiceDigest>
              <invoiceNumber>2026/002</invoiceNumber>
              <invoiceOperation>CREATE</invoiceOperation>
              <supplierTaxNumber><taxpayerId>12345678</taxpayerId></supplierTaxNumber>
              <customerTaxNumber><taxpayerId>87654321</taxpayerId></customerTaxNumber>
              <invoiceIssueDate>2026-08-16</invoiceIssueDate>
              <invoiceNetAmount>50000</invoiceNetAmount>
              <invoiceVatAmount>13500</invoiceVatAmount>
              <invoiceGrossAmount>0</invoiceGrossAmount>
              <invoiceCurrency>HUF</invoiceCurrency>
            </invoiceDigest>
          </invoiceDigestResult>
        </QueryInvoiceDigestResponse>
      `;

      const invoices = parseInvoiceDigestXml(digestXml);
      expect(invoices.length).toBe(2);
      expect(invoices[0].invoice_number).toBe('2026/001');
      expect(invoices[0].supplier_tax_number).toBe('12345678');
      expect(invoices[0].customer_tax_number).toBe('87654321');
      expect(invoices[0].invoice_gross_amount).toBe(127000);
      
      // Fallback calculation when gross is 0 but net + vat exist
      expect(invoices[1].invoice_number).toBe('2026/002');
      expect(invoices[1].invoice_gross_amount).toBe(63500);
    });

    it('calculates 27%, 18%, 5% VAT and net amounts for simplified invoices per ADR A-012', () => {
      // 27% VAT content: 0.2126
      const vat27 = parseSimplifiedVat(12700, 0.2126);
      expect(vat27.vatAmount).toBe(2700);
      expect(vat27.netAmount).toBe(10000);
      expect(vat27.vatRate).toBe('0.27');

      // 18% VAT content: 0.1525
      const vat18 = parseSimplifiedVat(11800, 0.1525);
      expect(vat18.vatAmount).toBe(1800);
      expect(vat18.netAmount).toBe(10000);
      expect(vat18.vatRate).toBe('0.18');

      // 5% VAT content: 0.0476
      const vat5 = parseSimplifiedVat(10500, 0.0476);
      expect(vat5.vatAmount).toBe(500);
      expect(vat5.netAmount).toBe(10000);
      expect(vat5.vatRate).toBe('0.05');
    });

    it('splits date ranges exceeding 30 days into valid NAV-compliant chunks', () => {
      function splitDateRange(dateFrom: string, dateTo: string, maxDays = 30): Array<{ from: string; to: string }> {
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

      // 20-day range -> 1 chunk
      const shortChunks = splitDateRange('2026-08-01', '2026-08-20', 30);
      expect(shortChunks.length).toBe(1);
      expect(shortChunks[0]).toEqual({ from: '2026-08-01', to: '2026-08-20' });

      // 60-day range -> 2 chunks
      const sixtyDayChunks = splitDateRange('2026-07-01', '2026-08-30', 30);
      expect(sixtyDayChunks.length).toBe(2);

      // 90-day range (nav-auto-sync default) -> 3 chunks
      const ninetyDayChunks = splitDateRange('2026-06-01', '2026-08-30', 30);
      expect(ninetyDayChunks.length).toBe(3);
      expect(ninetyDayChunks[0].from).toBe('2026-06-01');
      expect(ninetyDayChunks[2].to).toBe('2026-08-30');
    });

    it('correctly parses NAV Online Számla v3 XML responses with ns2: and common: namespace prefixes', () => {
      const namespacedXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <ns2:QueryInvoiceDigestResponse xmlns="http://schemas.nav.gov.hu/NTCA/1.0/common" xmlns:ns2="http://schemas.nav.gov.hu/OSA/3.0/api">
          <header>
            <requestId>RIDTEST12345678</requestId>
            <timestamp>2026-08-31T22:50:00.000Z</timestamp>
            <requestVersion>3.0</requestVersion>
            <headerVersion>1.0</headerVersion>
          </header>
          <result>
            <funcCode>OK</funcCode>
          </result>
          <ns2:invoiceDigestResult>
            <ns2:currentPage>1</ns2:currentPage>
            <ns2:availablePage>1</ns2:availablePage>
            <ns2:invoiceDigest>
              <ns2:invoiceNumber>E-THINK-2026-80</ns2:invoiceNumber>
              <ns2:invoiceOperation>CREATE</ns2:invoiceOperation>
              <ns2:invoiceCategory>NORMAL</ns2:invoiceCategory>
              <ns2:invoiceIssueDate>2026-07-01</ns2:invoiceIssueDate>
              <ns2:supplierTaxNumber>32478620</ns2:supplierTaxNumber>
              <ns2:customerTaxNumber>
                <taxpayerId>12345678</taxpayerId>
              </ns2:customerTaxNumber>
              <ns2:invoiceNetAmount>100000</ns2:invoiceNetAmount>
              <ns2:invoiceVatAmount>27000</ns2:invoiceVatAmount>
              <ns2:invoiceGrossAmount>127000</ns2:invoiceGrossAmount>
              <ns2:paymentMethod>TRANSFER</ns2:paymentMethod>
              <ns2:currency>HUF</ns2:currency>
            </ns2:invoiceDigest>
          </ns2:invoiceDigestResult>
        </ns2:QueryInvoiceDigestResponse>`;

      const invoices = parseInvoiceDigestXml(namespacedXml);
      expect(invoices.length).toBe(1);
      expect(invoices[0].invoice_number).toBe('E-THINK-2026-80');
      expect(invoices[0].supplier_tax_number).toBe('32478620');
      expect(invoices[0].customer_tax_number).toBe('12345678');
      expect(invoices[0].invoice_gross_amount).toBe(127000);
      expect(invoices[0].invoice_issue_date).toBe('2026-07-01');
      expect(invoices[0].payment_method).toBe('TRANSFER');
    });

    it('generates QueryInvoiceDataRequest XML without batchIndex so NAV returns full invoice data', () => {
      function buildQueryInvoiceDataXmlLocal(invoiceNumber: string, invoiceDirection: string): string {
        return `<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api">
  <invoiceNumberQuery>
    <invoiceNumber>${invoiceNumber}</invoiceNumber>
    <invoiceDirection>${invoiceDirection}</invoiceDirection>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;
      }

      const xml = buildQueryInvoiceDataXmlLocal('VBV-2026-19', 'OUTBOUND');
      expect(xml).toContain('<invoiceNumber>VBV-2026-19</invoiceNumber>');
      expect(xml).toContain('<invoiceDirection>OUTBOUND</invoiceDirection>');
      expect(xml).not.toContain('<batchIndex>');
    });

    it('correctly extracts detailedAddress and simpleAddress from NAV 3.0 invoice XML', () => {
      function extractAddressLocal(infoChunk: string): string | undefined {
        const detailedMatch = infoChunk.match(/<(?:\w+:)?detailedAddress>([\s\S]*?)<\/(?:\w+:)?detailedAddress>/);
        if (detailedMatch) {
          const d = detailedMatch[1];
          const parts = [
            extractTag(d, 'postalCode'),
            extractTag(d, 'city'),
            extractTag(d, 'streetName'),
            extractTag(d, 'publicPlaceCategory'),
            extractTag(d, 'number')
          ].filter(Boolean);
          if (parts.length > 0) return parts.join(' ');
        }
        return undefined;
      }

      const supplierXml = `
        <supplierInfo>
          <supplierName>VBV VISION KFT</supplierName>
          <supplierAddress>
            <detailedAddress>
              <countryCode>HU</countryCode>
              <postalCode>6400</postalCode>
              <city>KISKUNHALAS</city>
              <streetName>KŐRÖSI</streetName>
              <publicPlaceCategory>ÚT</publicPlaceCategory>
              <number>8</number>
            </detailedAddress>
          </supplierAddress>
        </supplierInfo>
      `;

      const address = extractAddressLocal(supplierXml);
      expect(address).toBe('6400 KISKUNHALAS KŐRÖSI ÚT 8');
    });
  });
});
