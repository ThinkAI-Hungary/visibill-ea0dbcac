// =============================================================================
// NAV Online Számla v3 – XML Válasz Elemző (Parser)
// =============================================================================
import { 
  NavInvoiceDigest, 
  InvoiceDetails, 
  InvoiceLineItem, 
  TaxpayerDetails, 
  TaxpayerAddress,
  InvoiceVatSummaryItem,
  InvoiceSummaryDetails,
  VatRateCategory
} from './types.ts';

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

    // If vatAmount and grossAmount are omitted by NAV Online Számla (e.g. MVM, utility invoices),
    // calculate them from netAmount and numeric vatPercentage if available
    if (isNaN(vatAmount) && isNaN(grossAmount) && !isNaN(netAmount) && netAmount > 0 && vatRate) {
      const rateNum = parseFloat(vatRate);
      if (!isNaN(rateNum) && rateNum > 0) {
        const normalizedRate = rateNum >= 1 ? rateNum / 100 : rateNum;
        vatAmount = Math.round(netAmount * normalizedRate);
        grossAmount = netAmount + vatAmount;
      } else if (!isNaN(rateNum) && rateNum === 0) {
        vatAmount = 0;
        grossAmount = netAmount;
      }
    } else if (isNaN(grossAmount) && !isNaN(netAmount) && !isNaN(vatAmount)) {
      grossAmount = netAmount + vatAmount;
    } else if (isNaN(vatAmount) && !isNaN(grossAmount) && !isNaN(netAmount)) {
      vatAmount = grossAmount - netAmount;
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

  // Hivatalos ÁFA Összesítő Blokk kinyerése (invoiceSummary)
  const vatSummary = parseInvoiceSummary(decodedXml);
  if (vatSummary) {
    details.vatSummary = vatSummary;
    if (vatSummary.invoiceGrossAmount !== undefined && details.invoiceGrossAmount === undefined) {
      details.invoiceGrossAmount = vatSummary.invoiceGrossAmount;
    }

    // Ha a tételsorokból hiányoznak az ÁFA összegek (pl. közműszámlák),
    // de a summary-ben pontosan egy kulcs van, intelligensen pótoljuk (D-3)
    if (lineItems.length > 0 && vatSummary.vatSummaries.length === 1) {
      const singleVat = vatSummary.vatSummaries[0];
      for (const item of lineItems) {
        if (item.vatAmount === undefined && item.netAmount !== undefined && item.netAmount > 0) {
          if (singleVat.vatPercentage !== undefined && singleVat.vatPercentage > 0) {
            const normRate = singleVat.vatPercentage >= 1 ? singleVat.vatPercentage / 100 : singleVat.vatPercentage;
            item.vatAmount = Math.round(item.netAmount * normRate);
            item.grossAmount = item.netAmount + item.vatAmount;
            if (!item.vatRate) item.vatRate = String(singleVat.vatPercentage);
          } else if (singleVat.category === 'exemption' || singleVat.category === 'reverse_charge' || singleVat.vatPercentage === 0) {
            item.vatAmount = 0;
            item.grossAmount = item.netAmount;
            if (!item.vatRate) item.vatRate = singleVat.vatRateLiteral;
          }
        }
      }
    }
  }

  if (lineItems.length > 0) {
    details.lineItems = lineItems;
  }

  return details;
}

/**
 * Hivatalos NAV ÁFA Összesítő Blokk (<invoiceSummary>) feldolgozása.
 * Kinyeri az áfakulcsonkénti megbontást (<summaryByVatRate>), devizás és HUF összegeket,
 * valamint a különleges jogcímeket (AAM, TAM, FAD, különbözeti adózás).
 */
export function parseInvoiceSummary(decodedXml: string): InvoiceSummaryDetails | undefined {
  const summaryMatch = decodedXml.match(/<(?:\w+:)?invoiceSummary>([\s\S]*?)<\/(?:\w+:)?invoiceSummary>/);
  if (!summaryMatch) {
    return undefined;
  }

  const summaryChunk = summaryMatch[1];
  const vatSummaries: InvoiceVatSummaryItem[] = [];
  let hasReverseCharge = false;

  // Ciklus az összes <summaryByVatRate> elemen
  const rateRegex = /<(?:\w+:)?summaryByVatRate>([\s\S]*?)<\/(?:\w+:)?summaryByVatRate>/g;
  let rateMatch: RegExpExecArray | null;

  while ((rateMatch = rateRegex.exec(summaryChunk)) !== null) {
    const chunk = rateMatch[1];
    const vatRateChunkMatch = chunk.match(/<(?:\w+:)?vatRate>([\s\S]*?)<\/(?:\w+:)?vatRate>/);
    const vrChunk = vatRateChunkMatch ? vatRateChunkMatch[1] : chunk;

    let category: VatRateCategory = 'percentage';
    let vatRateLiteral = '';
    let vatPercentage: number | undefined;
    let vatContent: number | undefined;
    let exemptionCase: string | undefined;
    let exemptionReason: string | undefined;
    let outOfScopeCase: string | undefined;
    let outOfScopeReason: string | undefined;
    let isReverseCharge: boolean | undefined;
    let marginSchemeIndicator: string | undefined;

    // 1. vatPercentage (normál százalékos kulcs, pl. 0.27)
    const rawVatPerc = extractTag(vrChunk, 'vatPercentage');
    if (rawVatPerc) {
      category = 'percentage';
      const p = parseFloat(rawVatPerc);
      vatPercentage = isNaN(p) ? undefined : p;
      if (vatPercentage !== undefined) {
        const percDisplay = vatPercentage <= 1 ? Math.round(vatPercentage * 100) : vatPercentage;
        vatRateLiteral = `${percDisplay}%`;
      } else {
        vatRateLiteral = rawVatPerc;
      }
    }
    // 2. vatExemption (Adómentesség: AAM, TAM, KBAET, stb.)
    else if (vrChunk.includes('vatExemption')) {
      category = 'exemption';
      const exMatch = vrChunk.match(/<(?:\w+:)?vatExemption>([\s\S]*?)<\/(?:\w+:)?vatExemption>/);
      const exChunk = exMatch ? exMatch[1] : vrChunk;
      exemptionCase = extractTag(exChunk, 'case') || undefined;
      exemptionReason = extractTag(exChunk, 'reason') || undefined;
      vatRateLiteral = exemptionCase || 'Mentes';
    }
    // 3. vatDomesticReverseCharge (Belföldi fordított adózás)
    else if (vrChunk.includes('vatDomesticReverseCharge') || extractTag(vrChunk, 'vatDomesticReverseCharge') === 'true') {
      category = 'reverse_charge';
      isReverseCharge = true;
      hasReverseCharge = true;
      vatRateLiteral = 'FAD (Fordított adózás)';
    }
    // 4. vatOutOfScope (Áfa tárgyi hatályán kívüli)
    else if (vrChunk.includes('vatOutOfScope')) {
      category = 'out_of_scope';
      const oosMatch = vrChunk.match(/<(?:\w+:)?vatOutOfScope>([\s\S]*?)<\/(?:\w+:)?vatOutOfScope>/);
      const oosChunk = oosMatch ? oosMatch[1] : vrChunk;
      outOfScopeCase = extractTag(oosChunk, 'case') || undefined;
      outOfScopeReason = extractTag(oosChunk, 'reason') || undefined;
      vatRateLiteral = outOfScopeCase ? `Hatályon kívüli (${outOfScopeCase})` : 'Hatályon kívüli';
    }
    // 5. marginSchemeIndicator (Különbözet szerinti adózás)
    else if (vrChunk.includes('marginSchemeIndicator') || vrChunk.includes('marginScheme')) {
      category = 'margin_scheme';
      marginSchemeIndicator = extractTag(vrChunk, 'marginSchemeIndicator') || extractTag(vrChunk, 'marginScheme') || undefined;
      vatRateLiteral = marginSchemeIndicator ? `Különbözeti (${marginSchemeIndicator})` : 'Különbözeti adózás';
    }
    // 6. vatContent (Egyszerűsített számla adótartalom)
    else if (extractTag(vrChunk, 'vatContent')) {
      category = 'content';
      const c = parseFloat(extractTag(vrChunk, 'vatContent'));
      vatContent = isNaN(c) ? undefined : c;
      if (vatContent !== undefined) {
        if (Math.abs(vatContent - 0.2126) < 0.005) vatRateLiteral = '27% (adótartalom)';
        else if (Math.abs(vatContent - 0.1525) < 0.005) vatRateLiteral = '18% (adótartalom)';
        else if (Math.abs(vatContent - 0.0476) < 0.005) vatRateLiteral = '5% (adótartalom)';
        else vatRateLiteral = `${(vatContent * 100).toFixed(2)}% (adótartalom)`;
      } else {
        vatRateLiteral = 'Adótartalom';
      }
    } else {
      vatRateLiteral = 'Egyéb';
    }

    // Pénzügyi adatok kinyerése
    const netMatch = chunk.match(/<(?:\w+:)?vatRateNetData>([\s\S]*?)<\/(?:\w+:)?vatRateNetData>/);
    const nChunk = netMatch ? netMatch[1] : chunk;
    const rawNetAmount = parseFloat(extractTag(nChunk, 'vatRateNetAmount'));
    const rawNetAmountHUF = parseFloat(extractTag(nChunk, 'vatRateNetAmountHUF'));
    const netAmount = isNaN(rawNetAmount) ? 0 : rawNetAmount;
    const netAmountHUF = isNaN(rawNetAmountHUF) ? undefined : rawNetAmountHUF;

    const vatMatch = chunk.match(/<(?:\w+:)?vatRateVatData>([\s\S]*?)<\/(?:\w+:)?vatRateVatData>/);
    const vChunk = vatMatch ? vatMatch[1] : chunk;
    const rawVatAmount = parseFloat(extractTag(vChunk, 'vatRateVatAmount'));
    const rawVatAmountHUF = parseFloat(extractTag(vChunk, 'vatRateVatAmountHUF'));
    const vatAmount = isNaN(rawVatAmount) ? 0 : rawVatAmount;
    const vatAmountHUF = isNaN(rawVatAmountHUF) ? undefined : rawVatAmountHUF;

    const grossMatch = chunk.match(/<(?:\w+:)?vatRateGrossData>([\s\S]*?)<\/(?:\w+:)?vatRateGrossData>/);
    const gChunk = grossMatch ? grossMatch[1] : chunk;
    const rawGrossAmount = parseFloat(extractTag(gChunk, 'vatRateGrossAmount'));
    const rawGrossAmountHUF = parseFloat(extractTag(gChunk, 'vatRateGrossAmountHUF'));
    const grossAmount = isNaN(rawGrossAmount) ? (netAmount + vatAmount) : rawGrossAmount;
    const grossAmountHUF = isNaN(rawGrossAmountHUF) ? (netAmountHUF !== undefined && vatAmountHUF !== undefined ? netAmountHUF + vatAmountHUF : undefined) : rawGrossAmountHUF;

    vatSummaries.push({
      category,
      vatRateLiteral,
      vatPercentage,
      vatContent,
      exemptionCase,
      exemptionReason,
      outOfScopeCase,
      outOfScopeReason,
      isReverseCharge,
      marginSchemeIndicator,
      netAmount,
      netAmountHUF,
      vatAmount,
      vatAmountHUF,
      grossAmount,
      grossAmountHUF
    });
  }

  // Számlaszintű összesítések
  const rawInvNet = parseFloat(extractTag(summaryChunk, 'invoiceNetAmount'));
  const rawInvNetHUF = parseFloat(extractTag(summaryChunk, 'invoiceNetAmountHUF'));
  const rawInvVat = parseFloat(extractTag(summaryChunk, 'invoiceVatAmount'));
  const rawInvVatHUF = parseFloat(extractTag(summaryChunk, 'invoiceVatAmountHUF'));
  const rawInvGross = parseFloat(extractTag(summaryChunk, 'invoiceGrossAmount'));
  const rawInvGrossHUF = parseFloat(extractTag(summaryChunk, 'invoiceGrossAmountHUF'));

  return {
    vatSummaries,
    invoiceNetAmount: isNaN(rawInvNet) ? undefined : rawInvNet,
    invoiceNetAmountHUF: isNaN(rawInvNetHUF) ? undefined : rawInvNetHUF,
    invoiceVatAmount: isNaN(rawInvVat) ? undefined : rawInvVat,
    invoiceVatAmountHUF: isNaN(rawInvVatHUF) ? undefined : rawInvVatHUF,
    invoiceGrossAmount: isNaN(rawInvGross) ? undefined : rawInvGross,
    invoiceGrossAmountHUF: isNaN(rawInvGrossHUF) ? undefined : rawInvGrossHUF,
    hasReverseCharge
  };
}

/**
 * Székhely vagy telephely cím kinyerése adózói válaszból.
 */
function extractTaxpayerAddress(infoChunk: string): TaxpayerAddress | undefined {
  const simpleMatch = infoChunk.match(/<(?:\w+:)?simpleAddress>([\s\S]*?)<\/(?:\w+:)?simpleAddress>/);
  if (simpleMatch) {
    const s = simpleMatch[1];
    const postalCode = extractTag(s, 'postalCode') || undefined;
    const city = extractTag(s, 'city') || undefined;
    const streetName = extractTag(s, 'additionalAddressDetail') || extractTag(s, 'streetName') || undefined;
    const countryCode = extractTag(s, 'countryCode') || 'HU';
    const parts = [postalCode, city, streetName].filter(Boolean);
    return {
      postalCode,
      city,
      streetName,
      countryCode,
      formattedAddress: parts.join(' ')
    };
  }

  // A NAV taxpayerAddress közvetlenül vagy detailedAddress burkolóban tartalmazza a részletes címet
  const detailedMatch = infoChunk.match(/<(?:\w+:)?(?:detailedAddress|taxpayerAddress)>([\s\S]*?)<\/(?:\w+:)?(?:detailedAddress|taxpayerAddress)>/);
  const d = detailedMatch ? detailedMatch[1] : infoChunk;

  const postalCode = extractTag(d, 'postalCode') || undefined;
  const city = extractTag(d, 'city') || undefined;
  const streetName = extractTag(d, 'streetName') || undefined;
  const publicPlaceCategory = extractTag(d, 'publicPlaceCategory') || undefined;
  const number = extractTag(d, 'number') || undefined;
  const building = extractTag(d, 'building') || undefined;
  const staircase = extractTag(d, 'staircase') || undefined;
  const floor = extractTag(d, 'floor') || undefined;
  const door = extractTag(d, 'door') || undefined;
  const countryCode = extractTag(d, 'countryCode') || 'HU';

  if (!postalCode && !city && !streetName) {
    return undefined;
  }

  const formatBuilding = (b?: string) => {
    if (!b) return '';
    const trimmed = b.trim();
    if (/ép/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} ép.` : `${trimmed}. ép.`;
  };

  const formatStaircase = (s?: string) => {
    if (!s) return '';
    const trimmed = s.trim();
    if (/lph/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} lph.` : `${trimmed}. lph.`;
  };

  const formatFloor = (f?: string) => {
    if (!f) return '';
    const trimmed = f.trim();
    if (/^fszt\.?$/i.test(trimmed)) return 'fszt.';
    if (/em/i.test(trimmed)) return trimmed;
    return `${trimmed}. em.`;
  };

  const formatDoor = (dr?: string) => {
    if (!dr) return '';
    const trimmed = dr.trim();
    if (/ajtó/i.test(trimmed)) return trimmed;
    return trimmed.endsWith('.') ? `${trimmed} ajtó` : `${trimmed}. ajtó`;
  };

  const parts = [
    postalCode,
    city,
    streetName,
    publicPlaceCategory,
    number,
    formatBuilding(building),
    formatStaircase(staircase),
    formatFloor(floor),
    formatDoor(door)
  ].filter(Boolean);

  return {
    postalCode,
    city,
    streetName,
    publicPlaceCategory,
    number,
    building,
    staircase,
    floor,
    door,
    countryCode,
    formattedAddress: parts.join(' ')
  };
}

/**
 * QueryTaxpayer válasz XML feldolgozása strukturált adóalanyi adatokká.
 */
export function parseTaxpayerXml(xmlResponse: string): TaxpayerDetails {
  if (xmlResponse.includes('<funcCode>ERROR</funcCode>') || xmlResponse.includes(':funcCode>ERROR<')) {
    const errorMsg = parseNavError(xmlResponse);
    throw new Error(`NAV Adózó lekérdezési hiba: ${errorMsg}`);
  }

  const taxpayerValidity = extractTag(xmlResponse, 'taxpayerValidity') === 'true';

  const dataMatch = xmlResponse.match(/<(?:\w+:)?taxpayerData>([\s\S]*?)<\/(?:\w+:)?taxpayerData>/);
  const dataChunk = dataMatch ? dataMatch[1] : xmlResponse;

  const taxpayerName = extractTag(dataChunk, 'taxpayerName') || undefined;
  const taxpayerShortName = extractTag(dataChunk, 'taxpayerShortName') || undefined;

  const taxDetailMatch = dataChunk.match(/<(?:\w+:)?taxNumberDetail>([\s\S]*?)<\/(?:\w+:)?taxNumberDetail>/);
  const taxDetailChunk = taxDetailMatch ? taxDetailMatch[1] : dataChunk;

  const taxpayerId = extractTag(taxDetailChunk, 'taxpayerId') || extractTag(xmlResponse, 'taxNumber') || '';
  const vatCode = extractTag(taxDetailChunk, 'vatCode') || undefined;
  const countyCode = extractTag(taxDetailChunk, 'countyCode') || undefined;

  const fullTaxNumber = (taxpayerId && vatCode && countyCode)
    ? `${taxpayerId}-${vatCode}-${countyCode}`
    : taxpayerId;

  const rawIncorporation = extractTag(dataChunk, 'incorporation');
  let incorporation: 'ORGANIZATION' | 'SELF_EMPLOYED' | 'TAXABLE_PERSON' | undefined;
  if (rawIncorporation === 'ORGANIZATION' || rawIncorporation === 'SELF_EMPLOYED' || rawIncorporation === 'TAXABLE_PERSON') {
    incorporation = rawIncorporation;
  }

  // Cím feloldása: elsődlegesen a székhely (HQ) cím
  let address: TaxpayerAddress | undefined;
  const addressItems = dataChunk.match(/<(?:\w+:)?taxpayerAddressItem>([\s\S]*?)<\/(?:\w+:)?taxpayerAddressItem>/g);
  if (addressItems && addressItems.length > 0) {
    const hqItem = addressItems.find(item => extractTag(item, 'taxpayerAddressType') === 'HQ');
    const selectedItem = hqItem || addressItems[0];
    address = extractTaxpayerAddress(selectedItem);
  } else {
    address = extractTaxpayerAddress(dataChunk);
  }

  // Csoportos ÁFA-alanyiság vizsgálata
  let vatGroupMembership: { groupTaxNumber: string; groupMemberTaxNumber?: string } | undefined;
  const groupMatch = dataChunk.match(/<(?:\w+:)?vatGroupMembership>([\s\S]*?)<\/(?:\w+:)?vatGroupMembership>/);
  if (groupMatch) {
    const groupChunk = groupMatch[1];
    const groupTaxNumber = extractTag(groupChunk, 'groupTaxNumber');
    if (groupTaxNumber) {
      vatGroupMembership = {
        groupTaxNumber,
        groupMemberTaxNumber: extractTag(groupChunk, 'groupMemberTaxNumber') || undefined
      };
    }
  }

  return {
    taxpayerValidity,
    taxNumber: fullTaxNumber,
    taxpayerId,
    vatCode,
    countyCode,
    taxpayerName,
    taxpayerShortName,
    incorporation,
    address,
    vatGroupMembership
  };
}
