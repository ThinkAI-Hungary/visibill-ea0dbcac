/**
 * ÁFA Bevallás (2665 / 2565 / 2465) — ÁNYK XML Export (Facade & Generator).
 * Generates official NAV ÁNYK-compatible XML files for VAT returns and M-sheets
 * strictly conforming to the official AbevJava schema (see docs/think_ai_2465_11.xml).
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';
import { parseTaxNumber } from './validationUtils';

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
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null }[];
  mLines: {
    partner_name: string;
    partner_tax_number: string;
    invoice_count: number;
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
 * By database and app contract (vat_return_m_lines.invoice_details), amounts in invoice_details
 * are stored in exact HUF (whole currency, e.g. 567000 Ft or micro-invoices like 450 Ft).
 * If explicitly flagged with is_e_ft: true or amount_unit: 'E_FT', it is treated as already in E Ft.
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
 * Computes partner-level totals and chunked M-02 pages (max 36 invoices per page).
 */
function getPartnerComputedTotals(m: XmlExportData['mLines'][0], periodTo: string) {
  const invCount = (m.invoice_details && m.invoice_details.length > 0)
    ? m.invoice_details.length
    : (m.invoice_count || 1);

  if (!m.invoice_details || m.invoice_details.length === 0) {
    return {
      invCount,
      totalBase: m.base_amount_rounded || 0,
      totalTax: m.tax_amount_rounded || 0,
      pages: [],
    };
  }

  const isPartnerEFt = m.amount_unit === 'E_FT';
  const pages: {
    pageNum: number;
    invoices: {
      invNum: string;
      invDate: string;
      net: number;
      vat: number;
    }[];
    pageBaseTotal: number;
    pageTaxTotal: number;
  }[] = [];

  let partnerBaseTotal = 0;
  let partnerTaxTotal = 0;

  for (let i = 0; i < m.invoice_details.length; i += INVOICES_PER_M02_PAGE) {
    const chunk = m.invoice_details.slice(i, i + INVOICES_PER_M02_PAGE);
    const pageNum = Math.floor(i / INVOICES_PER_M02_PAGE) + 1;
    let pageBaseTotal = 0;
    let pageTaxTotal = 0;

    const invoices = chunk.map((inv, idx) => {
      const invNum = inv.invoice_number || `SZ-${i + idx + 1}`;
      const rawDate = inv.delivery_date || inv.issue_date || periodTo;
      const invDate = String(rawDate).replace(/\D/g, '').slice(0, 8);
      const isEFt = inv.is_e_ft ?? (inv.amount_unit === 'E_FT' ? true : isPartnerEFt);
      const net = convertToEFt(inv.net, isEFt);
      const vat = convertToEFt(inv.vat, isEFt);

      pageBaseTotal += net;
      pageTaxTotal += vat;

      return {
        invNum,
        invDate,
        net,
        vat,
      };
    });

    partnerBaseTotal += pageBaseTotal;
    partnerTaxTotal += pageTaxTotal;

    pages.push({
      pageNum,
      invoices,
      pageBaseTotal,
      pageTaxTotal,
    });
  }

  return {
    invCount,
    totalBase: partnerBaseTotal,
    totalTax: partnerTaxTotal,
    pages,
  };
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
  const formId = `${year2Digit}65`;
  const formVersion = data.periodYear >= 2026 ? '2.0' : data.periodYear === 2025 ? '2.0' : '4.0';
  const mPartnerCount = data.mLines ? data.mLines.length : 0;

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
  xml += `        <nev>${escapeXml(data.companyName)}</nev>\n`;
  xml += `        <adoszam>${taxNum11}</adoszam>\n`;
  xml += `      </adozo>\n`;
  xml += `      <idoszak>\n`;
  xml += `        <tol>${periodFrom}</tol>\n`;
  xml += `        <ig>${periodTo}</ig>\n`;
  xml += `      </idoszak>\n`;
  xml += `      <megjegyzes>${escapeXml(data.companyName)} - Áfa bevallás</megjegyzes>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;

  // 0A lap: Fejléc, azonosítás és keltezés
  xml += `      <mezo eazon="0A0001E001A">${taxNum11}</mezo>\n`;
  xml += `      <mezo eazon="0A0001E006A">${escapeXml(data.companyName)}</mezo>\n`;
  if (data.representativeName) {
    xml += `      <mezo eazon="0A0001E007A">${escapeXml(data.representativeName)}</mezo>\n`;
  }
  if (data.phone) {
    xml += `      <mezo eazon="0A0001E008A">${escapeXml(data.phone.replace(/\D/g, ''))}</mezo>\n`;
  }
  xml += `      <mezo eazon="0A0001F001A">${periodFrom}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F002A">${periodTo}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F006A">${escapeXml(data.frequency)}</mezo>\n`;
  xml += `      <mezo eazon="0A0001F021A">${mPartnerCount}</mezo>\n`;
  xml += `      <mezo eazon="0A0001I001A">Budapest</mezo>\n`;
  xml += `      <mezo eazon="0A0001I002A">${currentDate}</mezo>\n`;

  // 0B lap: Fizetendő adó sorai (01..36)
  xml += `      <mezo eazon="0B0001B001A">${taxNum11}</mezo>\n`;
  data.lines.forEach((line) => {
    const rowNum = parseInt(line.row_number, 10);
    if (!isNaN(rowNum) && rowNum >= 1 && rowNum <= 36) {
      const rowPad = String(rowNum).padStart(4, '0');
      if (line.base_amount_rounded != null) {
        xml += `      <mezo eazon="0B0001C${rowPad}BA">${line.base_amount_rounded}</mezo>\n`;
      }
      // Kizárólag az adóval rendelkező sorok kaphatnak CA (adó) mezőkódot a hivatalos NAV sablonban
      if (ROWS_WITH_TAX_ON_0B.has(rowNum) && line.tax_amount_rounded != null) {
        xml += `      <mezo eazon="0B0001C${rowPad}CA">${line.tax_amount_rounded}</mezo>\n`;
      }
    }
  });

  // 0C lap: Levonható adó sorai (37..75)
  xml += `      <mezo eazon="0C0001B001A">${taxNum11}</mezo>\n`;
  data.lines.forEach((line) => {
    const rowNum = parseInt(line.row_number, 10);
    if (!isNaN(rowNum) && rowNum >= 37 && rowNum <= 75) {
      if (line.row_number === '66_fad') {
        if (line.tax_amount_rounded != null && line.tax_amount_rounded > 0) {
          xml += `      <mezo eazon="0C0001C0066DA">${line.tax_amount_rounded}</mezo>\n`;
        }
        return;
      }
      const rowPad = String(rowNum).padStart(4, '0');
      if (line.base_amount_rounded != null) {
        xml += `      <mezo eazon="0C0001C${rowPad}BA">${line.base_amount_rounded}</mezo>\n`;
      }
      // 63. sor adómentes belföldi beszerzés (nincs adóoszlop)
      if (rowNum !== 63 && line.tax_amount_rounded != null) {
        xml += `      <mezo eazon="0C0001C${rowPad}CA">${line.tax_amount_rounded}</mezo>\n`;
      }
      if (rowNum === 66 && !data.lines.some((l) => l.row_number === '66_fad')) {
        const line29 = data.lines.find((l) => l.row_number === '29');
        if (line29?.tax_amount_rounded != null && line29.tax_amount_rounded > 0) {
          xml += `      <mezo eazon="0C0001C0066DA">${line29.tax_amount_rounded}</mezo>\n`;
        }
      }
    }
  });

  // 0D lap: Elszámolás sorai (76..86)
  xml += `      <mezo eazon="0D0001B001A">${taxNum11}</mezo>\n`;
  data.lines.forEach((line) => {
    const rowNum = parseInt(line.row_number, 10);
    if (rowNum === 76) {
      if (line.base_amount_rounded != null) {
        xml += `      <mezo eazon="0D0001C0076BA">${line.base_amount_rounded}</mezo>\n`;
      }
      if (line.tax_amount_rounded != null) {
        xml += `      <mezo eazon="0D0001C0076CA">${line.tax_amount_rounded}</mezo>\n`;
      }
    } else if (rowNum >= 77 && rowNum <= 86) {
      const rowPad = String(rowNum).padStart(4, '0');
      if (line.tax_amount_rounded != null) {
        xml += `      <mezo eazon="0D0001D${rowPad}CA">${line.tax_amount_rounded}</mezo>\n`;
      }
    }
  });

  // 0E lap
  xml += `      <mezo eazon="0E0001B001A">${taxNum11}</mezo>\n`;

  // 0F lap: M-lap összesítő
  xml += `      <mezo eazon="0F0001B001A">${taxNum11}</mezo>\n`;
  let mTotalInvoices = 0;
  let mTotalBase = 0;
  let mTotalTax = 0;
  if (data.mLines && data.mLines.length > 0) {
    data.mLines.forEach((m) => {
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
  xml += `      <mezo eazon="0F0001D0109CA">${mTotalTax}</mezo>\n`;
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
  if (data.mLines && data.mLines.length > 0) {
    data.mLines.forEach((m) => {
      const partnerParsed = parseTaxNumber(m.partner_tax_number);
      const partnerTaxBase = partnerParsed.base || m.partner_tax_number.replace(/\D/g, '').slice(0, 8);
      const summary = getPartnerComputedTotals(m, periodTo);

      xml += `  <nyomtatvany>\n`;
      xml += `    <nyomtatvanyinformacio>\n`;
      xml += `      <nyomtatvanyazonosito>${formId}M</nyomtatvanyazonosito>\n`;
      xml += `      <nyomtatvanyverzio>${formVersion}</nyomtatvanyverzio>\n`;
      xml += `      <adozo>\n`;
      xml += `        <nev>${escapeXml(data.companyName)}</nev>\n`;
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
      xml += `      <megjegyzes>${escapeXml(data.companyName)} - ${formId}M</megjegyzes>\n`;
      xml += `    </nyomtatvanyinformacio>\n`;
      xml += `    <mezok>\n`;

      // 0A lap (M-01: partner összesítő)
      xml += `      <mezo eazon="0A0001C001A">${taxNum11}</mezo>\n`;
      xml += `      <mezo eazon="0A0001C004A">${escapeXml(data.companyName)}</mezo>\n`;
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
        // Nincs tételes számlarészletezés: 1 szintetikus oldal
        xml += `      <mezo eazon="0B0001B001A">1</mezo>\n`;
        xml += `      <mezo eazon="0B0001B002A">${taxNum11}</mezo>\n`;
        xml += `      <mezo eazon="0B0001B004A">${escapeXml(partnerTaxBase)}</mezo>\n`;
        xml += `      <mezo eazon="0B0001B005A">${escapeXml(m.partner_name)}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001AA">SZ-${periodFrom}-01</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001BA">${periodTo}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001CA">${m.base_amount_rounded}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0001DA">${m.tax_amount_rounded}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0037CA">${m.base_amount_rounded}</mezo>\n`;
        xml += `      <mezo eazon="0B0001C0037DA">${m.tax_amount_rounded}</mezo>\n`;
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

export function getVatReturnFilename(data: { periodYear: number; periodMonth: number; companyName?: string }): string {
  const formId = `${data.periodYear % 100}65`;
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
