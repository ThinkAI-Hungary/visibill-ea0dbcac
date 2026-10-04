/**
 * A60 Közösségi Összesítő Nyilatkozat (26A60) — ÁNYK XML Export Generator.
 * Generates official NAV ÁNYK-compatible XML files conforming to the official AbevJava schema
 * based on live tax authority XML samples (docs/NAV_26A60_2026_07_Taxology_Kft.xml).
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';
import { parseTaxNumber } from './validationUtils';

export type A60Category = 'goods_out' | 'goods_in' | 'services_out' | 'services_in';

export interface VatA60Line {
  id?: string;
  category: A60Category;
  country_code: string | null;
  partner_vat_number: string;
  partner_name?: string | null;
  invoice_count?: number;
  base_amount?: number;
  base_amount_rounded: number; // eFt
  invoice_details?: unknown;
}

export interface VatA60XmlExportData {
  companyName: string;
  companyTaxNumber: string; // 8 or 11 digits (e.g. 14160877 or 14160877-2-43)
  companyAddress?: string;
  periodYear: number;
  periodMonth: number;
  periodFrom?: string; // YYYYMMDD
  periodTo?: string;   // YYYYMMDD
  frequency?: string;  // 'H' | 'N' | 'E' (default 'H')
  representativeName?: string;
  phone?: string;
  formIdOverride?: string;     // default e.g. '26A60'
  formVersionOverride?: string; // default '3.0'
  lines?: VatA60Line[];
  a60Lines?: VatA60Line[];
}

export const A60_ROWS_PER_PAGE = 24;

/**
 * Mapping between A60 transaction category and ÁNYK 26A60 sheet identifier:
 * - goods_out    (A60-01, 65: 02)    -> '0B'
 * - goods_in     (A60-02, 65: 11-16) -> '0C'
 * - services_out (A60-03, 65: 91/92) -> '0D'
 * - services_in  (A60-04, 65: 18)    -> '0E'
 */
export const CATEGORY_SHEET_MAP: Record<A60Category, string> = {
  goods_out: '0B',
  goods_in: '0C',
  services_out: '0D',
  services_in: '0E',
};

/**
 * Valid EU member state country codes (ISO 3166-1 alpha-2, with EL for Greece).
 * Technical prefix 'EU' (used by OSS / non-EU sellers) is NOT a valid EU member state.
 */
export const VALID_EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'EL', 'ES', 'FI', 'FR',
  'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE',
  'SI', 'SK', 'XI' // Northern Ireland protocol
]);

/**
 * Formats phone number strictly to '06...' format expected by 26A60 ÁNYK template.
 * e.g. '+36704240024' -> '06704240024', '36704240024' -> '06704240024'.
 */
export function formatA60PhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('36') && digits.length >= 10) {
    return '06' + digits.slice(2);
  }
  if (digits.startsWith('06')) {
    return digits;
  }
  if (digits.length === 9) {
    return '06' + digits;
  }
  return digits;
}

/**
 * Normalizes country code: converts Greece 'GR' -> 'EL', trims and uppercases.
 */
export function normalizeCountryCode(cc?: string | null): string {
  if (!cc) return '';
  const clean = cc.trim().toUpperCase();
  return clean === 'GR' ? 'EL' : clean;
}

/**
 * Computes default start and end dates in YYYYMMDD format for the given period.
 */
export function getA60PeriodDates(year: number, month: number, frequency: string = 'H') {
  if (frequency === 'N') {
    // Quarterly: month is the quarter end month (3, 6, 9, 12) or quarter index (1, 2, 3, 4)
    let startMonth = 1;
    let endMonth = 3;
    if (month >= 1 && month <= 4) {
      startMonth = (month - 1) * 3 + 1;
      endMonth = month * 3;
    } else {
      endMonth = month;
      startMonth = month - 2;
    }
    const lastDay = new Date(year, endMonth, 0).getDate();
    const fromStr = `${year}${String(startMonth).padStart(2, '0')}01`;
    const toStr = `${year}${String(endMonth).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
    return { from: fromStr, to: toStr };
  }

  // Monthly ('H')
  const lastDay = new Date(year, month, 0).getDate();
  const fromStr = `${year}${String(month).padStart(2, '0')}01`;
  const toStr = `${year}${String(month).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
  return { from: fromStr, to: toStr };
}

/**
 * Returns filename conforming to NAV standards: NAV_26A60_2026_07_Taxology_Kft.xml
 */
export function getVatA60Filename(data: {
  periodYear: number;
  periodMonth: number;
  companyName?: string;
  formIdOverride?: string;
}): string {
  const formId = data.formIdOverride || `${data.periodYear % 100}A60`;
  const monthStr = String(data.periodMonth).padStart(2, '0');
  const safeName = (data.companyName || 'Ceg')
    .replace(/\s+/g, '_')
    .replace(/[.,;:/\\?*|"<>!@#$%^&()+=~`{}[\]]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return `NAV_${formId}_${data.periodYear}_${monthStr}_${safeName || 'Ceg'}.xml`;
}

/**
 * Pure generator function: builds the complete AbevJava XML document for 26A60.
 */
export function buildVatA60Xml(data: VatA60XmlExportData): string {
  if (data.frequency === 'E') {
    throw new Error('Az A60-as összesítő nyilatkozat éves gyakorisággal (E) nem nyújtható be. Csak havi (H) vagy negyedéves (N) bevallók nyújthatják be.');
  }

  const year2 = data.periodYear % 100;
  const formId = data.formIdOverride || `${year2}A60`;
  const formVersion = data.formVersionOverride || '3.0';

  // 8-digit base tax number
  const parsedTax = parseTaxNumber(data.companyTaxNumber);
  const taxNumber8 = parsedTax.base || data.companyTaxNumber.replace(/\D/g, '').slice(0, 8);

  const cleanCompanyName = data.companyName.trim();
  const dates = getA60PeriodDates(data.periodYear, data.periodMonth, data.frequency || 'H');
  const periodFrom = data.periodFrom || dates.from;
  const periodTo = data.periodTo || dates.to;
  const frequency = (data.frequency || 'H').toUpperCase();
  const phone = formatA60PhoneNumber(data.phone);

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `  <nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">\n`;
  xml += `  <abev>\n`;
  xml += `    <hibakszama>0</hibakszama>\n`;
  xml += `    <hash>817c683d857b3aeedbeee8ac4d5583be9176082a</hash>\n`;
  xml += `    <programverzio>v.3.50.0</programverzio>\n`;
  xml += `  </abev>\n`;
  xml += `  <nyomtatvany>\n`;
  xml += `    <nyomtatvanyinformacio>\n`;
  xml += `      <nyomtatvanyazonosito>${formId}</nyomtatvanyazonosito>\n`;
  xml += `      <nyomtatvanyverzio>${formVersion}</nyomtatvanyverzio>\n`;
  xml += `      <adozo>\n`;
  xml += `        <nev>${escapeXml(cleanCompanyName)}</nev>\n`;
  xml += `        <adoszam>${escapeXml(taxNumber8)}</adoszam>\n`;
  xml += `      </adozo>\n`;
  xml += `      <idoszak>\n`;
  xml += `        <tol>${periodFrom}</tol>\n`;
  xml += `        <ig>${periodTo}</ig>\n`;
  xml += `      </idoszak>\n`;
  xml += `        <megjegyzes>${escapeXml(cleanCompanyName)} - ${formId}-as bevallás</megjegyzes>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;

  // 0A Főlap mezők
  xml += `      <mezo eazon="0A0001C003A">${escapeXml(taxNumber8)}</mezo>\n`;
  xml += `      <mezo eazon="0A0001C008A">${escapeXml(cleanCompanyName)}</mezo>\n`;
  if (data.representativeName && data.representativeName.trim()) {
    xml += `      <mezo eazon="0A0001C009A">${escapeXml(data.representativeName.trim())}</mezo>\n`;
  }
  if (phone) {
    xml += `      <mezo eazon="0A0001C010A">${escapeXml(phone)}</mezo>\n`;
  }
  xml += `      <mezo eazon="0A0001D001A">${periodFrom}</mezo>\n`;
  xml += `      <mezo eazon="0A0001D002A">${periodTo}</mezo>\n`;
  xml += `      <mezo eazon="0A0001D005A">${frequency}</mezo>\n`;

  // Categorize lines into the 4 sheets
  const categories: A60Category[] = ['goods_out', 'goods_in', 'services_out', 'services_in'];

  for (const cat of categories) {
    const sheetId = CATEGORY_SHEET_MAP[cat];
    const allLines = data.lines || data.a60Lines || [];
    const catLines = allLines.filter((line) => {
      if (line.category !== cat) return false;
      const cc = normalizeCountryCode(line.country_code);
      return VALID_EU_COUNTRY_CODES.has(cc);
    });

    if (catLines.length === 0) {
      continue;
    }

    // Sort consistently: country code, then vat number
    catLines.sort((a, b) => {
      const ccA = normalizeCountryCode(a.country_code);
      const ccB = normalizeCountryCode(b.country_code);
      if (ccA !== ccB) return ccA.localeCompare(ccB);
      return (a.partner_vat_number || '').localeCompare(b.partner_vat_number || '');
    });

    // Chunk into pages of max 24 partner rows
    const pages: VatA60Line[][] = [];
    for (let i = 0; i < catLines.length; i += A60_ROWS_PER_PAGE) {
      pages.push(catLines.slice(i, i + A60_ROWS_PER_PAGE));
    }

    pages.forEach((pageItems, pageIdx) => {
      const pageNum = pageIdx + 1;
      const pagePad = String(pageNum).padStart(4, '0');

      // Page index header
      xml += `      <mezo eazon="${sheetId}${pagePad}B001A">${pageNum}</mezo>\n`;

      let pageTotalEFt = 0;

      pageItems.forEach((item, itemIdx) => {
        const rowNum = itemIdx + 1;
        const rowPad = String(rowNum).padStart(4, '0');
        const cc = normalizeCountryCode(item.country_code);
        const vatNum = (item.partner_vat_number || '').trim().toUpperCase();
        const amountEFt = Math.round(Number(item.base_amount_rounded) || 0);

        pageTotalEFt += amountEFt;

        xml += `      <mezo eazon="${sheetId}${pagePad}C${rowPad}AA">${escapeXml(cc)}</mezo>\n`;
        xml += `      <mezo eazon="${sheetId}${pagePad}C${rowPad}BA">${escapeXml(vatNum)}</mezo>\n`;
        xml += `      <mezo eazon="${sheetId}${pagePad}C${rowPad}CA">${amountEFt}</mezo>\n`;
      });

      // Row 25 is the page total sum (eFt)
      xml += `      <mezo eazon="${sheetId}${pagePad}C0025CA">${pageTotalEFt}</mezo>\n`;
    });
  }

  xml += `    </mezok>\n`;
  xml += `  </nyomtatvany>\n`;
  xml += `</nyomtatvanyok>\n`;

  return xml;
}

/**
 * Triggers browser download of generated A60 XML.
 */
export function generateVatA60Xml(data: VatA60XmlExportData): void {
  const xml = buildVatA60Xml(data);
  const filename = getVatA60Filename(data);
  downloadString(xml, filename, 'application/xml;charset=utf-8');
}
