// =============================================================================
// NAV Online Számla v3 – XML Válasz Elemző (Parser)
// =============================================================================
import { NavInvoiceDigest, InvoiceDetails, InvoiceLineItem } from './types.ts';

/**
 * Segédfüggvény: XML tag érték kinyerése (önzáró, üres és namespace-prefixelt tag támogatással).
 */
export function extractTag(xmlChunk: string, tag: string): string {
  const regex = new RegExp(`(?:<(?:\\w+:)?${tag}\\/>|<(?:\\w+:)?${tag}[^>]*>([^<]*)<\\/(?:\\w+:)?${tag}>)`);
  const m = xmlChunk.match(regex);
  return m && m[1] ? m[1].trim() : '';
}

/**
 * Segédfüggvény: Adószám kinyerése szülő tagből (pl. supplierTaxNumber/taxpayerId).
 */
export function extractTaxNumber(xmlChunk: string, parentTag: string): string {
  const parentMatch = xmlChunk.match(new RegExp(`<(?:\\w+:)?${parentTag}[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${parentTag}>`));
  if (!parentMatch) return '';
  return extractTag(parentMatch[1], 'taxpayerId') || extractTag(xmlChunk, parentTag);
}

/**
 * NAV hibaüzenet kinyerése XML válaszból.
 */
export function parseNavError(xmlResponse: string): string {
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

/**
 * TokenExchange válasz XML feldolgozása.
 */
export function parseTokenResponse(xmlResponse: string): string {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Token hiba: ${errorMsg}`);
  }

  const tokenMatch = xmlResponse.match(/<(?:\w+:)?encodedExchangeToken>(.+?)<\/(?:\w+:)?encodedExchangeToken>/);
  const token = tokenMatch ? tokenMatch[1] : null;

  if (!token) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(errorMsg || 'Nem sikerült kinyerni az exchange tokent a NAV válaszból');
  }

  return token;
}

/**
 * QueryInvoiceDigest válasz XML feldolgozása számlalistává.
 */
export function parseInvoiceDigestXml(xmlResponse: string): NavInvoiceDigest[] {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Query hiba: ${errorMsg}`);
  }

  const invoices: NavInvoiceDigest[] = [];
  const digestRegex = /<(?:\w+:)?invoiceDigest>([\s\S]*?)<\/(?:\w+:)?invoiceDigest>/g;
  let match: RegExpExecArray | null;

  while ((match = digestRegex.exec(xmlResponse)) !== null) {
    const chunk = match[1];
    const invoiceNumber = extractTag(chunk, 'invoiceNumber');
    if (!invoiceNumber) continue;

    const supplierTax = extractTaxNumber(chunk, 'supplierTaxNumber') || extractTag(chunk, 'supplierTaxNumber');
    const customerTax = extractTaxNumber(chunk, 'customerTaxNumber') || extractTag(chunk, 'customerTaxNumber');

    const netAmount = parseFloat(extractTag(chunk, 'invoiceNetAmount')) || 0;
    const vatAmount = parseFloat(extractTag(chunk, 'invoiceVatAmount')) || 0;
    let grossAmount = parseFloat(extractTag(chunk, 'invoiceGrossAmount'));

    // ADR A-012: Ha a bruttó összeg hiányzik vagy NaN, számítsuk ki a nettó + áfa összegéből
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
      invoice_gross_amount: grossAmount || 0,
      payment_method: extractTag(chunk, 'paymentMethod') || 'OTHER',
      currency: extractTag(chunk, 'currency') || extractTag(chunk, 'invoiceCurrency') || 'HUF',
    });
  }

  return invoices;
}

/**
 * QueryInvoiceData válasz XML feldolgozása részletes számla adatokká (beleértve a tételsorokat).
 */
function extractAddress(infoChunk: string): string | undefined {
  const detailedMatch = infoChunk.match(/<(?:\w+:)?detailedAddress>([\s\S]*?)<\/(?:\w+:)?detailedAddress>/);
  if (detailedMatch) {
    const d = detailedMatch[1];
    const parts = [
      extractTag(d, 'postalCode'),
      extractTag(d, 'city'),
      extractTag(d, 'streetName'),
      extractTag(d, 'publicPlaceCategory'),
      extractTag(d, 'number'),
      extractTag(d, 'building'),
      extractTag(d, 'staircase'),
      extractTag(d, 'floor'),
      extractTag(d, 'door')
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const simpleMatch = infoChunk.match(/<(?:\w+:)?simpleAddress>([\s\S]*?)<\/(?:\w+:)?simpleAddress>/);
  if (simpleMatch) {
    const s = simpleMatch[1];
    const parts = [
      extractTag(s, 'postalCode'),
      extractTag(s, 'city'),
      extractTag(s, 'additionalAddressDetail')
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  const addrMatch = infoChunk.match(/<(?:\w+:)?postalAddress>([\s\S]*?)<\/(?:\w+:)?postalAddress>/);
  if (addrMatch) {
    const a = addrMatch[1];
    const parts = [
      extractTag(a, 'postalCode'),
      extractTag(a, 'city'),
      extractTag(a, 'streetName'),
      extractTag(a, 'publicPlaceCategory'),
      extractTag(a, 'number')
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }

  return undefined;
}

export function parseInvoiceDataXml(xmlResponse: string): InvoiceDetails {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Számla Részlet hiba: ${errorMsg}`);
  }

  // Ha az invoiceData base64 kódolású
  let decodedXml = xmlResponse;
  const base64Match = xmlResponse.match(/<(?:\w+:)?invoiceData>([A-Za-z0-9+/=\s]+)<\/(?:\w+:)?invoiceData>/);
  if (base64Match) {
    try {
      const cleanBase64 = base64Match[1].replace(/\s+/g, '');
      const binaryString = atob(cleanBase64);
      const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
      decodedXml = new TextDecoder('utf-8').decode(bytes);
    } catch {
      // Ha nem sikerült dekódolni, marad az eredeti XML
    }
  }

  const details: InvoiceDetails = {};

  // Fejléc adatok kinyerése
  const supplierMatch = decodedXml.match(/<(?:\w+:)?supplierInfo>([\s\S]*?)<\/(?:\w+:)?supplierInfo>/);
  if (supplierMatch) {
    details.supplierName = extractTag(supplierMatch[1], 'supplierName');
    details.supplierAddress = extractAddress(supplierMatch[1]);
  }

  const customerMatch = decodedXml.match(/<(?:\w+:)?customerInfo>([\s\S]*?)<\/(?:\w+:)?customerInfo>/);
  if (customerMatch) {
    details.customerName = extractTag(customerMatch[1], 'customerName');
    details.customerAddress = extractAddress(customerMatch[1]);
  }

  details.paymentDate = extractTag(decodedXml, 'paymentDate') || undefined;
  details.isCashAccounting = decodedXml.includes('<cashAccountingIndicator>true</cashAccountingIndicator>') || decodedXml.includes(':cashAccountingIndicator>true<');

  const origInv = extractTag(decodedXml, 'originalInvoiceNumber');
  if (origInv) details.originalInvoiceNumber = origInv;

  // Tételsorok kinyerése
  const lineItems: InvoiceLineItem[] = [];
  const lineRegex = /<(?:\w+:)?line>([\s\S]*?)<\/(?:\w+:)?line>/g;
  let lineMatch: RegExpExecArray | null;

  while ((lineMatch = lineRegex.exec(decodedXml)) !== null) {
    const lChunk = lineMatch[1];
    const lineNum = parseInt(extractTag(lChunk, 'lineNumber'), 10) || lineItems.length + 1;
    const lineDesc = extractTag(lChunk, 'lineDescription');
    const quantity = parseFloat(extractTag(lChunk, 'quantity')) || undefined;
    const unitOfMeasure = extractTag(lChunk, 'unitOfMeasure') || undefined;
    const unitPrice = parseFloat(extractTag(lChunk, 'unitPrice')) || undefined;
    const productCode = extractTag(lChunk, 'productCodeValue') || undefined;

    let netAmount = parseFloat(extractTag(lChunk, 'lineNetAmount'));
    let vatAmount = parseFloat(extractTag(lChunk, 'lineVatAmount'));
    let grossAmount = parseFloat(extractTag(lChunk, 'lineGrossAmountNormal')) || parseFloat(extractTag(lChunk, 'lineGrossAmountSimplified'));
    let vatRate = extractTag(lChunk, 'vatPercentage');

    // ADR A-012: Egyszerűsített számla ÁFA és nettó kalkuláció
    const vatContent = parseFloat(extractTag(lChunk, 'vatContent'));
    if (!isNaN(vatContent) && !isNaN(grossAmount) && grossAmount !== 0) {
      vatAmount = Math.round(grossAmount * vatContent);
      netAmount = grossAmount - vatAmount;
      if (Math.abs(vatContent - 0.2126) < 0.005) vatRate = '0.27';
      else if (Math.abs(vatContent - 0.1525) < 0.005) vatRate = '0.18';
      else if (Math.abs(vatContent - 0.0476) < 0.005) vatRate = '0.05';
      else vatRate = String(vatContent);
    }

    if (isNaN(grossAmount) && !isNaN(netAmount) && !isNaN(vatAmount)) {
      grossAmount = netAmount + vatAmount;
    }

    lineItems.push({
      lineNumber: lineNum,
      lineDescription: lineDesc,
      quantity,
      unitOfMeasure,
      unitPrice,
      netAmount: isNaN(netAmount) ? undefined : netAmount,
      vatAmount: isNaN(vatAmount) ? undefined : vatAmount,
      grossAmount: isNaN(grossAmount) ? undefined : grossAmount,
      vatRate: vatRate || undefined,
      productCode,
      lineDeliveryPeriodFrom: extractTag(lChunk, 'lineDeliveryPeriodFrom') || undefined,
      lineDeliveryPeriodTo: extractTag(lChunk, 'lineDeliveryPeriodTo') || undefined,
    });
  }

  if (lineItems.length > 0) {
    details.lineItems = lineItems;
  }

  return details;
}
