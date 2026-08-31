// =============================================================================
// NAV Online Számla v3 – XML Boríték Generátor
// =============================================================================
import { NavCredentials, NavSyncOptions } from './types.ts';

/**
 * Közös szoftver blokk generálása a NAV specifikáció szerint.
 */
function buildSoftwareBlock(creds: NavCredentials): string {
  const softwareId = creds.software_id || `HU${creds.nav_tax_number}00000001`;
  const softwareName = 'VisiBill NAV Integration';
  const softwareDevName = creds.software_dev_name || 'VisiBill';
  const softwareDevContact = creds.software_dev_contact || 'support@visibill.hu';
  const softwareDevCountryCode = creds.software_dev_country_code || 'HU';

  return `  <software>
    <softwareId>${softwareId}</softwareId>
    <softwareName>${softwareName}</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${softwareDevName}</softwareDevName>
    <softwareDevContact>${softwareDevContact}</softwareDevContact>
    <softwareDevCountryCode>${softwareDevCountryCode}</softwareDevCountryCode>
  </software>`;
}

/**
 * Közös header és user XML blokk felépítése.
 */
function buildCommonBlocks(
  creds: NavCredentials,
  requestId: string,
  timestamp: string,
  passwordHash: string,
  requestSignature: string
): string {
  return `  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${creds.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${creds.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
${buildSoftwareBlock(creds)}`;
}

/**
 * TokenExchangeRequest XML generálása.
 */
export function buildTokenExchangeXml(
  creds: NavCredentials,
  requestId: string,
  timestamp: string,
  passwordHash: string,
  requestSignature: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TokenExchangeRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                      xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
${buildCommonBlocks(creds, requestId, timestamp, passwordHash, requestSignature)}
</TokenExchangeRequest>`;
}

/**
 * QueryInvoiceDigestRequest XML generálása.
 */
export function buildQueryDigestXml(
  creds: NavCredentials,
  params: NavSyncOptions,
  requestId: string,
  timestamp: string,
  passwordHash: string,
  requestSignature: string
): string {
  const page = params.page || 1;
  const direction = params.direction;

  let additionalQueryParams = '';
  if (params.additionalFilters?.partnerTaxNumber) {
    const taxNum = params.additionalFilters.partnerTaxNumber.replace(/[^0-9]/g, '').slice(0, 8);
    if (taxNum) {
      const tag = direction === 'OUTBOUND' ? 'customerTaxNumber' : 'supplierTaxNumber';
      additionalQueryParams += `
        <${tag}>
          <taxpayerId>${taxNum}</taxpayerId>
        </${tag}>`;
    }
  }

  if (params.additionalFilters?.invoiceNumber) {
    additionalQueryParams += `
      <invoiceNumber>${params.additionalFilters.invoiceNumber}</invoiceNumber>`;
  }

  const dateFilter = params.dateFrom && params.dateTo
    ? `<invoiceQueryParams>
        <mandatoryQueryParams>
          <invoiceIssueDate>
            <dateFrom>${params.dateFrom}</dateFrom>
            <dateTo>${params.dateTo}</dateTo>
          </invoiceIssueDate>
        </mandatoryQueryParams>
        ${additionalQueryParams ? `<additionalQueryParams>${additionalQueryParams}</additionalQueryParams>` : ''}
      </invoiceQueryParams>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                          xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
${buildCommonBlocks(creds, requestId, timestamp, passwordHash, requestSignature)}
  <page>${page}</page>
  <invoiceDirection>${direction}</invoiceDirection>
  ${dateFilter}
</QueryInvoiceDigestRequest>`;
}

/**
 * QueryInvoiceDataRequest XML generálása számla részletes lekéréséhez.
 */
export function buildQueryInvoiceDataXml(
  creds: NavCredentials,
  invoiceNumber: string,
  invoiceDirection: 'INBOUND' | 'OUTBOUND',
  requestId: string,
  timestamp: string,
  passwordHash: string,
  requestSignature: string
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDataRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" 
                        xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
${buildCommonBlocks(creds, requestId, timestamp, passwordHash, requestSignature)}
  <invoiceNumberQuery>
    <invoiceNumber>${invoiceNumber}</invoiceNumber>
    <invoiceDirection>${invoiceDirection}</invoiceDirection>
    <batchIndex>1</batchIndex>
  </invoiceNumberQuery>
</QueryInvoiceDataRequest>`;
}
