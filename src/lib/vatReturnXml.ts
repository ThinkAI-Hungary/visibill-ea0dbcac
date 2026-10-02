/**
 * ÁFA Bevallás (2665 / 2565 / 2465) — ÁNYK XML Export (Facade & Generator).
 * Generates official NAV ÁNYK-compatible XML files for VAT returns and M-sheets
 * strictly conforming to the official AbevJava schema (see docs/think_ai_2465_11.xml).
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';
import { parseTaxNumber } from './validationUtils';
import { shouldExcludeFromMLine } from '@/features/vat/types';

export interface VatInvoiceDetail {
  invoice_number?: string;
  delivery_date?: string;
  issue_date?: string;
  net?: number | null;
  vat?: number | null;
  gross?: number | null;
  amount_unit?: 'HUF' | 'E_FT';
  is_e_ft?: boolean;
}

export interface XmlExportData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string;
  representativeName?: string;
  phone?: string;
  formIdOverride?: string;
  formVersionOverride?: string;
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null }[];
  mLines: {
    partner_name: string;
    partner_tax_number: string;
    invoice_count: number;
    base_amount?: number | null;
    tax_amount?: number | null;
    base_amount_rounded: number;
    tax_amount_rounded: number;
    tax_5_amount?: number;
    tax_18_amount?: number;
    tax_27_amount?: number;
    amount_unit?: 'HUF' | 'E_FT';
    invoice_details?: VatInvoiceDetail[];
  }[];
}

export const INVOICES_PER_M02_PAGE = 36;

/**
 * Rows on the official NAV 65A 0B lap that have a payable tax (CA) column.
 * Tax-exempt rows (01 export, 02 intra-EU, 03 new vehicles, 04 reverse charge, 08 TAM, 11, 17, 23)
 * only have a base (BA) column. Emitting CA causes ÁNYK rejection:
 * "A sablon nem tartalmazza az adatállományban található (0B0001C0001CA mezőkódú) mezőt".
 */
export const ROWS_WITH_TAX_ON_0B = new Set([
  5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 35, 36
]);

/**
 * Converts invoice net/vat amounts to thousand HUF (E Ft).
 * Used for 65A main return and 65M-01 partner summary.
 */
export function convertToEFt(amount: number | null | undefined, isEFt?: boolean): number {
  if (amount == null || isNaN(Number(amount))) return 0;
  const num = Number(amount);
  if (isEFt === true) {
    return Math.round(num);
  }
  return Math.round(num / 1000);
}

/**
 * Converts invoice net/vat amounts to exact whole HUF (Forint).
 * Used for 65M-02 (and 65M-02-K) itemized invoice lines and the 37. total row,
 * which by statutory NAV ÁNYK instruction must be filled in FORINT (whole currency),
 * not in thousand HUF.
 */
export function convertToHuf(amount: number | null | undefined, isEFt?: boolean): number {
  if (amount == null || isNaN(Number(amount))) return 0;
  const num = Number(amount);
  if (isEFt === true) {
    return Math.round(num * 1000);
  }
  return Math.round(num);
}

/**
 * Computes partner-level totals (in thousands for 65M-01) and chunked M-02 pages (in exact HUF for 65M-02, max 36 invoices per page).
 */
function getPartnerComputedTotals(m: XmlExportData['mLines'][0], periodTo: string) {
  const invCount = (m.invoice_details && m.invoice_details.length > 0)
    ? m.invoice_details.length
    : (m.invoice_count || 1);

  if (!m.invoice_details || m.invoice_details.length === 0) {
    const totalBaseHuf = m.base_amount != null
      ? Math.round(m.base_amount)
      : Math.round((m.base_amount_rounded || 0) * 1000);
    const totalTaxHuf = m.tax_amount != null
      ? Math.round(m.tax_amount)
      : Math.round((m.tax_amount_rounded || 0) * 1000);

    return {
      invCount,
      totalBase: m.base_amount_rounded ?? Math.round(totalBaseHuf / 1000),
      totalTax: m.tax_amount_rounded ?? Math.round(totalTaxHuf / 1000),
      totalBaseHuf,
      totalTaxHuf,
      pages: [],
    };
  }

  const isPartnerEFt = m.amount_unit === 'E_FT';
  const pages: {
    pageNum: number;
    invoices: {
      invNum: string;
      invDate: string;
      net: number; // exact HUF for 65M-02
      vat: number; // exact HUF for 65M-02
    }[];
    pageBaseTotal: number; // exact HUF for 65M-02 37. row
    pageTaxTotal: number;  // exact HUF for 65M-02 37. row
  }[] = [];

  let partnerBaseTotalHuf = 0;
  let partnerTaxTotalHuf = 0;

  for (let i = 0; i < m.invoice_details.length; i += INVOICES_PER_M02_PAGE) {
    const chunk = m.invoice_details.slice(i, i + INVOICES_PER_M02_PAGE);
    const pageNum = Math.floor(i / INVOICES_PER_M02_PAGE) + 1;
    let pageBaseTotalHuf = 0;
    let pageTaxTotalHuf = 0;

    const invoices = chunk.map((inv: any, idx) => {
      const invNum = inv.invoice_number || inv.invNum || `SZ-${i + idx + 1}`;
      const rawDate = inv.delivery_date || inv.issue_date || inv.invDate || periodTo;
      const invDate = String(rawDate).replace(/\D/g, '').slice(0, 8);
      const isEFt = inv.is_e_ft ?? (inv.amount_unit === 'E_FT' ? true : isPartnerEFt);
      // Support both mock formats ({ net, vat }) and live DB formats ({ net_amount, vat_amount })
      const rawNet = inv.net ?? inv.net_amount ?? inv.netAmount ?? 0;
      const rawVat = inv.vat ?? inv.vat_amount ?? inv.vatAmount ?? 0;
      // NAV ÁNYK 2665M-02 lap: forintban kitöltendő!
      const net = convertToHuf(rawNet, isEFt);
      const vat = convertToHuf(rawVat, isEFt);

      pageBaseTotalHuf += net;
      pageTaxTotalHuf += vat;

      return {
        invNum,
        invDate,
        net,
        vat,
      };
    });

    partnerBaseTotalHuf += pageBaseTotalHuf;
    partnerTaxTotalHuf += pageTaxTotalHuf;

    pages.push({
      pageNum,
      invoices,
      pageBaseTotal: pageBaseTotalHuf,
      pageTaxTotal: pageTaxTotalHuf,
    });
  }

  return {
    invCount,
    totalBase: Math.round(partnerBaseTotalHuf / 1000), // eFt for 65M-01 and 65A 0F
    totalTax: Math.round(partnerTaxTotalHuf / 1000),   // eFt for 65M-01 and 65A 0F
    totalBaseHuf: partnerBaseTotalHuf,
    totalTaxHuf: partnerTaxTotalHuf,
    pages,
  };
}

/**
 * Formats phone numbers for NAV ÁNYK XML specifications (e.g. 36704240024).
 * Strips all non-digit characters, converts leading 06 to 36.
 */
export function formatAnykPhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = rawPhone.replace(/\D/g, '');
  if (digits.startsWith('06') && digits.length >= 10) {
    return '36' + digits.slice(2);
  }
  return digits;
}

/**
 * Builds the full NAV ÁNYK-compatible XML document for the 65 VAT return.
 * Conforms to AbevJava specifications:
 * - Namespace: http://www.apeh.hu/abev/nyomtatvanyok/2005/01
 * - <abev> header with hibakszama=0
 * - Main form: ${YY}65A with official positional eazon fields (0A..., 0B..., 0C..., 0D..., 0F...)
 * - Subforms: ${YY}65M for each partner with 0A (summary) and 0B (itemized invoices paginated at 36 rows/page)
 */
export function buildVatReturnXml(data: XmlExportData): string {
  // Tax number normalization: handles 12345678-1-23, undashed 12345678123, or 8-digit base
  const parsedTax = parseTaxNumber(data.companyTaxNumber);
  const taxNum8 = parsedTax.base || data.companyTaxNumber.replace(/\D/g, '').slice(0, 8);
  const taxNumVat = parsedTax.vat || '2';
  const taxNumCounty = parsedTax.county || '08';
  const taxNum11 = (parsedTax.base && parsedTax.vat && parsedTax.county)
    ? `${parsedTax.base}${parsedTax.vat}${parsedTax.county}`
    : (data.companyTaxNumber.replace(/\D/g, '').slice(0, 11) || `${taxNum8}${taxNumVat}${taxNumCounty}`);

  let periodFrom = '';
  let periodTo = '';
  if (data.frequency === 'H') {
    const monthStr = String(data.periodMonth).padStart(2, '0');
    periodFrom = `${data.periodYear}${monthStr}01`;
    const lastDay = new Date(data.periodYear, data.periodMonth, 0).getDate();
    periodTo = `${data.periodYear}${monthStr}${String(lastDay).padStart(2, '0')}`;
  } else if (data.frequency === 'N') {
    const startMonth = (data.periodMonth - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    periodFrom = `${data.periodYear}${String(startMonth).padStart(2, '0')}01`;
    const lastDay = new Date(data.periodYear, endMonth, 0).getDate();
    periodTo = `${data.periodYear}${String(endMonth).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
  } else {
    periodFrom = `${data.periodYear}0101`;
    periodTo = `${data.periodYear}1231`;
  }

  const currentDate = new Date().toISOString().substring(0, 10).replace(/-/g, '');
  const year2Digit = String(data.periodYear % 100).padStart(2, '0');
  const formId = data.formIdOverride || `${year2Digit}65`;
  const formVersion = data.formVersionOverride || (data.periodYear >= 2026 ? '2.0' : data.periodYear === 2025 ? '2.0' : '4.0');
  // Exclude AAM, proforma, and insurance partners from 65M sheets
  const eligibleMLines = (data.mLines || []).filter((m) => !shouldExcludeFromMLine(m));
  const mPartnerCount = eligibleMLines.length;
  const cleanCompanyName = data.companyName.trim();
  const repName = data.representativeName?.trim() || '';
  const repPhone = formatAnykPhoneNumber(data.phone);

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">\n`;
  xml += `  <abev>\n`;
  xml += `    <hibakszama>0</hibakszama>\n`;
  xml += `    <hash>92cdcdebdf28f27b52e27850fac4b1ab26b443ca</hash>\n`;
  xml += `    <programverzio>v.3.50.0</programverzio>\n`;
  xml += `  </abev>\n`;

  // =========================================================================
  // FŐNYOMTATVÁNY (65A)
  // =========================================================================
  xml += `  <nyomtatvany>\n`;
  xml += `    <nyomtatvanyinformacio>\n`;
  xml += `      <nyomtatvanyazonosito>${formId}A</nyomtatvanyazonosito>\n`;
  xml += `      <nyomtatvanyverzio>${formVersion}</nyomtatvanyverzio>\n`;
  xml += `      <adozo>\n`;
  xml += `        <nev>${escapeXml(cleanCompanyName)}</nev>\n`;
  xml += `        <adoszam>${taxNum11}</adoszam>\n`;
  xml += `      </adozo>\n`;
  xml += `      <idoszak>\n`;
  xml += `        <tol>${periodFrom}</tol>\n`;
  xml += `        <ig>${periodTo}</ig>\n`;
  xml += `      </idoszak>\n`;
  xml += `      <megjegyzes>${escapeXml(cleanCompanyName)} - Áfa bevallás</megjegyzes>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;

  // 0A lap: Fejléc, azonosítás és keltezés
  // 0A0001E001A: Adózó adószáma
  xml += `      <mezo eazon="0A0001E001A">${taxNum11}</mezo>\n`;
  // 0A0001E006A: Adózói státusz (üresen hagyandó normál működő cégnél, nem ide való a cégnév!)
  // 0A0001E007A: Adózó neve (hivatalos cégnév, ami a fejléc <nev> mezővel egyezik)
  xml += `      <mezo eazon="0A0001E007A">${escapeXml(cleanCompanyName)}</mezo>\n`;
  if (repName) {
    // 0A0001E008A: Ügyintéző neve
    xml += `      <mezo eazon="0A0001E008A">${escapeXml(repName)}</mezo>\n`;
  }
  if (repPhone) {
    // 0A0001E009A: Ügyintéző telefonszáma
    xml += `      <mezo eazon="0A0001E009A">${escapeXml(repPhone)}</mezo>\n`;
  }
  xml += `      <mezo eazon="0A0001F001A">${periodFrom}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F002A">${periodTo}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F006A">${escapeXml(data.frequency)}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F021A">${mPartnerCount}</mezo>\n`;
  xml += `      <mezo eazon="0A0001I001A">Budapest</mezo>\n`;
  xml += `      <mezo eazon="0A0001I002A">${currentDate}</mezo>\n`;

  // =========================================================================
  // Normalized line mapping & ÁNYK mathematical consistency calculations
  // =========================================================================
  const lineMap = new Map<string, { base?: number | null; tax?: number | null }>();
  data.lines.forEach((line) => {
    lineMap.set(String(line.row_number), {
      base: line.base_amount_rounded,
      tax: line.tax_amount_rounded,
    });
  });

  // Calculate 0B detail rows sum (rows 01..35)
  let sum36Base = 0;
  let sum36Tax = 0;
  let has0BDetailRows = false;
  const detailRows0B: { rowNum: number; base: number | null; tax: number | null }[] = [];

  for (let r = 1; r <= 35; r++) {
    const rKey = String(r).padStart(2, '0');
    const rKeyUnpadded = String(r);
    const entry = lineMap.get(rKey) || lineMap.get(rKeyUnpadded);
    if (entry && (entry.base != null || entry.tax != null)) {
      has0BDetailRows = true;
      let rBase = entry.base ?? null;
      let rTax = entry.tax ?? null;

      // Rate consistency on 0B standard rates if tax not given
      if (r === 7 && rBase != null && rTax == null) {
        rTax = Math.round(rBase * 0.27);
      } else if (r === 6 && rBase != null && rTax == null) {
        rTax = Math.round(rBase * 0.18);
      } else if (r === 5 && rBase != null && rTax == null) {
        rTax = Math.round(rBase * 0.05);
      }

      if (rBase != null) sum36Base += rBase;
      if (rTax != null && ROWS_WITH_TAX_ON_0B.has(r)) sum36Tax += rTax;
      detailRows0B.push({ rowNum: r, base: rBase, tax: rTax });
    }
  }

  // Row 36: ÁNYK requires 36b and 36c to match the exact sum of detail rows 01..35 (R621, R622)
  const line36Entry = lineMap.get('36');
  const row36Base = has0BDetailRows ? sum36Base : (line36Entry?.base ?? null);
  const row36Tax = has0BDetailRows ? sum36Tax : (line36Entry?.tax ?? null);

  // 0B lap: Fizetendő adó sorai (01..36)
  xml += `      <mezo eazon="0B0001B001A">${taxNum11}</mezo>\n`;
  detailRows0B.forEach(({ rowNum, base, tax }) => {
    const rowPad = String(rowNum).padStart(4, '0');
    if (base != null) {
      xml += `      <mezo eazon="0B0001C${rowPad}BA">${base}</mezo>\n`;
    }
    if (ROWS_WITH_TAX_ON_0B.has(rowNum) && tax != null) {
      xml += `      <mezo eazon="0B0001C${rowPad}CA">${tax}</mezo>\n`;
    }
  });
  if (row36Base != null) {
    xml += `      <mezo eazon="0B0001C0036BA">${row36Base}</mezo>\n`;
  }
  if (row36Tax != null) {
    xml += `      <mezo eazon="0B0001C0036CA">${row36Tax}</mezo>\n`;
  }

  // =========================================================================
  // 0C lap: Levonható adó sorai (37..75, 111)
  // =========================================================================
  xml += `      <mezo eazon="0C0001B001A">${taxNum11}</mezo>\n`;

  // Calculate 0C detail rows sum for row 76 (rows 63..75 and 111)
  let sum76Base = 0;
  let sum76Tax = 0;
  let has0CDetailRows = false;
  const detailRows0C: { rowNum: number; base: number | null; tax: number | null }[] = [];

  // Deductible purchase rows contributing to row 76
  const deductibleRowNumbers = [63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 111];
  const other0CRowNumbers: number[] = [];
  for (let r = 37; r <= 62; r++) other0CRowNumbers.push(r);

  const all0CRowNumbers = [...other0CRowNumbers, ...deductibleRowNumbers].sort((a, b) => a - b);

  all0CRowNumbers.forEach((r) => {
    const rKey = String(r).padStart(2, '0');
    const rKeyUnpadded = String(r);
    const entry = lineMap.get(rKey) || lineMap.get(rKeyUnpadded);
    if (!entry || (entry.base == null && entry.tax == null)) return;

    let rBase = entry.base ?? null;
    let rTax = entry.tax ?? null;

    // ÁNYK rule 1087305/R914: row 66 tax (66c) MUST match 27% of base (66b)
    if (r === 66 && rBase != null) {
      const exp27 = Math.round(rBase * 0.27);
      if (rTax == null || Math.abs(rTax - exp27) > 1) {
        rTax = exp27;
      }
    } else if (r === 65 && rBase != null) {
      const exp18 = Math.round(rBase * 0.18);
      if (rTax == null || Math.abs(rTax - exp18) > 1) {
        rTax = exp18;
      }
    } else if (r === 64 && rBase != null) {
      const exp5 = Math.round(rBase * 0.05);
      if (rTax == null || Math.abs(rTax - exp5) > 1) {
        rTax = exp5;
      }
    }

    if (deductibleRowNumbers.includes(r)) {
      has0CDetailRows = true;
      if (rBase != null) sum76Base += rBase;
      if (rTax != null && r !== 63 && r !== 111) sum76Tax += rTax;
    }

    detailRows0C.push({ rowNum: r, base: rBase, tax: rTax });
  });

  // Emit 0C rows in ascending order
  detailRows0C.forEach(({ rowNum, base, tax }) => {
    const rowPad = String(rowNum).padStart(4, '0');
    if (base != null) {
      xml += `      <mezo eazon="0C0001C${rowPad}BA">${base}</mezo>\n`;
    }
    // 63 and 111 are tax-exempt (no CA column)
    if (rowNum !== 63 && rowNum !== 111 && tax != null) {
      xml += `      <mezo eazon="0C0001C${rowPad}CA">${tax}</mezo>\n`;
    }
  });

  // =========================================================================
  // 0D lap: Elszámolás sorai (76..86)
  // =========================================================================
  xml += `      <mezo eazon="0D0001B001A">${taxNum11}</mezo>\n`;

  // Row 76: ÁNYK requires 76b to match the exact sum of rows 63..75 and 111 (R767)
  const line76Entry = lineMap.get('76');
  const row76Base = has0CDetailRows ? sum76Base : (line76Entry?.base ?? null);
  const row76Tax = has0CDetailRows ? sum76Tax : (line76Entry?.tax ?? null);

  if (row76Base != null) {
    xml += `      <mezo eazon="0D0001C0076BA">${row76Base}</mezo>\n`;
  }
  if (row76Tax != null) {
    xml += `      <mezo eazon="0D0001C0076CA">${row76Tax}</mezo>\n`;
  }

  // Row 82: Előző időszaki különbözet
  const row82Entry = lineMap.get('82');
  const row82Tax = row82Entry?.tax ?? 0;
  if (row82Entry?.tax != null) {
    xml += `      <mezo eazon="0D0001D0082CA">${row82Tax}</mezo>\n`;
  }

  // Row 83: Különbözet (36. sor adó - 76. sor adó - 82. sor adó)
  const line83Entry = lineMap.get('83');
  const computed83Tax = (row36Tax != null && row76Tax != null)
    ? (row36Tax - row76Tax - row82Tax)
    : (line83Entry?.tax ?? null);
  if (computed83Tax != null) {
    xml += `      <mezo eazon="0D0001D0083CA">${computed83Tax}</mezo>\n`;
  }

  // Row 84: Befizetendő adó (a 83. sor adata, ha pozitív)
  const line84Entry = lineMap.get('84');
  const computed84Tax = computed83Tax != null
    ? (computed83Tax > 0 ? computed83Tax : 0)
    : (line84Entry?.tax ?? null);
  if (computed84Tax != null) {
    xml += `      <mezo eazon="0D0001D0084CA">${computed84Tax}</mezo>\n`;
  }

  // Row 85: Visszaigényelhető adó (a 83. sor adata, ha negatív)
  const line85Entry = lineMap.get('85');
  const computed85Tax = computed83Tax != null
    ? (computed83Tax < 0 ? Math.abs(computed83Tax) : 0)
    : (line85Entry?.tax ?? null);
  if (computed85Tax != null && computed85Tax > 0) {
    xml += `      <mezo eazon="0D0001D0085CA">${computed85Tax}</mezo>\n`;
  }

  // Emit remaining 0D rows (77..81, 86) if provided
  data.lines.forEach((line) => {
    const rowNum = parseInt(line.row_number, 10);
    if (!isNaN(rowNum) && ((rowNum >= 77 && rowNum <= 81) || rowNum === 86)) {
      const rowPad = String(rowNum).padStart(4, '0');
      if (line.tax_amount_rounded != null) {
        xml += `      <mezo eazon="0D0001D${rowPad}CA">${line.tax_amount_rounded}</mezo>\n`;
      }
    }
  });

  // 0E lap
  xml += `      <mezo eazon="0E0001B001A">${taxNum11}</mezo>\n`;

  // =========================================================================
  // 0F lap: M-lap összesítő & Főlap 109. sor
  // =========================================================================
  xml += `      <mezo eazon="0F0001B001A">${taxNum11}</mezo>\n`;
  let mTotalInvoices = 0;
  let mTotalBase = 0;
  let mTotalTax = 0;
  if (eligibleMLines && eligibleMLines.length > 0) {
    eligibleMLines.forEach((m) => {
      const summary = getPartnerComputedTotals(m, periodTo);
      mTotalInvoices += summary.invCount;
      mTotalBase += summary.totalBase;
      mTotalTax += summary.totalTax;
    });
  }
  xml += `      <mezo eazon="0F0001D0105BA">${mPartnerCount}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0105CA">${mTotalInvoices}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0105DA">${mTotalBase}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0105EA">${mTotalTax}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0106BA">0</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0106CA">0</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0106DA">0</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0106EA">0</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0108BA">${mPartnerCount}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0108CA">${mTotalInvoices}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0108DA">${mTotalBase}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0108EA">${mTotalTax}</mezo>\n`;

  // 109. sor: A levonásba helyezett, áthárított adó számított összege (ÁNYK 1095069/R975)
  // Képlet: 64c - 64a + 65c - 65a + 66c - 66a + 68c - 68a - 31a
  const row64TaxFor109 = detailRows0C.find((r) => r.rowNum === 64)?.tax ?? 0;
  const row65TaxFor109 = detailRows0C.find((r) => r.rowNum === 65)?.tax ?? 0;
  const row66TaxFor109 = detailRows0C.find((r) => r.rowNum === 66)?.tax ?? 0;
  const row68TaxFor109 = detailRows0C.find((r) => r.rowNum === 68)?.tax ?? 0;
  const row109c = row64TaxFor109 + row65TaxFor109 + row66TaxFor109 + row68TaxFor109;

  xml += `      <mezo eazon="0F0001D0109CA">${row109c}</mezo>\n`;
  xml += `      <mezo eazon="0F0001D0109EA">0</mezo>\n`;

  // 0K és 0N lapok
  xml += `      <mezo eazon="0K0001B001A">1</mezo>\n`;
  xml += `      <mezo eazon="0K0001B002A">${taxNum11}</mezo>\n`;
  xml += `      <mezo eazon="0N0001B001A">1</mezo>\n`;
  xml += `      <mezo eazon="0N0001B002A">${taxNum11}</mezo>\n`;
  xml += `    </mezok>\n`;
  xml += `  </nyomtatvany>\n`;

  // =========================================================================
  // 65M ALNYOMTATVÁNYOK (Belföldi Összesítő Jelentés partnerenként)
  // =========================================================================
  if (eligibleMLines && eligibleMLines.length > 0) {
    eligibleMLines.forEach((m) => {
      const partnerParsed = parseTaxNumber(m.partner_tax_number);
      const partnerTaxBase = partnerParsed.base || m.partner_tax_number.replace(/\D/g, '').slice(0, 8);
      const summary = getPartnerComputedTotals(m, periodTo);

      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${formId}M</nyomtatvanyazonosito>\n`;
      xml += `      <nyomtatvanyverzio>${formVersion}</nyomtatvanyverzio>\n`;
      xml += `      <adozo>\n`;
      xml += `        <nev>${escapeXml(cleanCompanyName)}</nev>\n`;
      xml += `        <adoszam>${taxNum11}</adoszam>\n`;
      xml += `      </adozo>\n`;
      xml += `      <albizonylatazonositas>\n`;
      xml += `        <megnevezes>${escapeXml(m.partner_name)}</megnevezes>\n`;
      xml += `        <azonosito>${escapeXml(partnerTaxBase)}</azonosito>\n`;
      xml += `      </albizonylatazonositas>\n`;
      xml += `      <idoszak>\n`;
      xml += `        <tol>${periodFrom}</tol>\n`;
      xml += `        <ig>${periodTo}</ig>\n`;
      xml += `      </idoszak>\n`;
      xml += `      <megjegyzes>${escapeXml(cleanCompanyName)} - ${formId}M</megjegyzes>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;

      // 0A lap (M-01: partner összesítő)
      xml += `      <mezo eazon="0A0001C001A">${taxNum11}</mezo>\n`;
      xml += `      <mezo eazon="0A0001C004A">${escapeXml(cleanCompanyName)}</mezo>\n`;
      xml += `      <mezo eazon="0A0001C005A">${escapeXml(partnerTaxBase)}</mezo>\n`;
      xml += `      <mezo eazon="0A0001C006A">${escapeXml(m.partner_name)}</mezo>\n`;
      xml += `      <mezo eazon="0A0001D001A">${periodFrom}</mezo>\n`;
      xml += `      <mezo eazon="0A0001D002A">${periodTo}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0004BA">${summary.invCount}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0004CA">${summary.totalBase}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0004DA">${summary.totalTax}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0007BA">${summary.invCount}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0007CA">${summary.totalBase}</mezo>\n`;
      xml += `      <mezo eazon="0A0001E0007DA">${summary.totalTax}</mezo>\n`;

      // 0B lap (M-02: tételes számlák oldalanként tördelve, max 36 számla/oldal)
      if (summary.pages.length > 0) {
        summary.pages.forEach((page) => {
          const pagePad = String(page.pageNum).padStart(4, '0');
          xml += `      <mezo eazon="0B${pagePad}B001A">${page.pageNum}</mezo>\n`;
          xml += `      <mezo eazon="0B${pagePad}B002A">${taxNum11}</mezo>\n`;
          xml += `      <mezo eazon="0B${pagePad}B004A">${escapeXml(partnerTaxBase)}</mezo>\n`;
          xml += `      <mezo eazon="0B${pagePad}B005A">${escapeXml(m.partner_name)}</mezo>\n`;

          page.invoices.forEach((inv, invIdx) => {
            const rowPad = String(invIdx + 1).padStart(4, '0');

            xml += `      <mezo eazon="0B${pagePad}C${rowPad}AA">${escapeXml(inv.invNum)}</mezo>\n`;
            xml += `      <mezo eazon="0B${pagePad}C${rowPad}BA">${inv.invDate}</mezo>\n`;
            xml += `      <mezo eazon="0B${pagePad}C${rowPad}CA">${inv.net}</mezo>\n`;
            xml += `      <mezo eazon="0B${pagePad}C${rowPad}DA">${inv.vat}</mezo>\n`;
          });

          // M-02 lap oldal-összesítő (0037. sor)
          xml += `      <mezo eazon="0B${pagePad}C0037CA">${page.pageBaseTotal}</mezo>\n`;
          xml += `      <mezo eazon="0B${pagePad}C0037DA">${page.pageTaxTotal}</mezo>\n`;
        });
      } else {
        // Nincs tételes számlarészletezés: 1 szintetikus oldal (forintban a 65M-02 előírásai szerint)
        xml += `      <mezo eazon="0B0001B001A">1</mezo>\n`;
        xml += `      <mezo eazon="0B0001B002A">${taxNum11}</mezo>\n`;
        xml += `      <mezo eazon="0B0001B004A">${escapeXml(partnerTaxBase)}</mezo>\n`;
        xml += `      <mezo eazon="0B0001B005A">${escapeXml(m.partner_name)}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001AA">SZ-${periodFrom}-01</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001BA">${periodTo}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001CA">${summary.totalBaseHuf}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001DA">${summary.totalTaxHuf}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0037CA">${summary.totalBaseHuf}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0037DA">${summary.totalTaxHuf}</mezo>\n`;
      }

      // 0C lap (M-03: korrekciós lap fejléc)
      xml += `      <mezo eazon="0C0001B001A">1</mezo>\n`;
      xml += `      <mezo eazon="0C0001B002A">${taxNum11}</mezo>\n`;
      xml += `      <mezo eazon="0C0001B004A">${escapeXml(partnerTaxBase)}</mezo>\n`;
      xml += `      <mezo eazon="0C0001B005A">${escapeXml(m.partner_name)}</mezo>\n`;
      xml += `    </mezok>\n`;
      xml += `  </nyomtatvany>\n`;
    });
  }

  xml += `</nyomtatvanyok>`;
  return xml;
}

export function getVatReturnFilename(data: { periodYear: number; periodMonth: number; companyName?: string; formIdOverride?: string }): string {
  const formId = data.formIdOverride || `${data.periodYear % 100}65`;
  const monthStr = String(data.periodMonth).padStart(2, '0');
  const safeName = (data.companyName || 'Ceg')
    .replace(/\s+/g, '_')
    .replace(/[.,;:/\\?*|"<>!@#$%^&()+=~`{}[\]]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');
  return `NAV_${formId}_${data.periodYear}_${monthStr}_${safeName || 'Ceg'}.xml`;
}

export const generateVatReturnXml = (data: XmlExportData) => {
  const xml = buildVatReturnXml(data);
  const filename = getVatReturnFilename(data);
  downloadString(xml, filename, 'application/xml;charset=utf-8');
};

export const getVatReturnXmlString = (data: XmlExportData): string => {
  return buildVatReturnXml(data);
};
