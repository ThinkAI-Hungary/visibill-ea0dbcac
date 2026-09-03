/**
 * ÁFA Bevallás (2665 / 2565 / 2465) — ÁNYK XML Export (Facade & Generator).
 * Generates official NAV ÁNYK-compatible XML files for VAT returns and M-sheets.
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';

export interface XmlExportData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string;
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null }[];
  mLines: { partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount: number; tax_18_amount: number; tax_27_amount: number }[];
}

/**
 * Builds the full NAV ÁNYK-compatible XML document for the 65 VAT return.
 */
export function buildVatReturnXml(data: XmlExportData): string {
  const lineMap = new Map(data.lines.map(l => [l.row_number, l]));

  const getBase = (row: string): number => lineMap.get(row)?.base_amount_rounded ?? 0;
  const getTax = (row: string): number => lineMap.get(row)?.tax_amount_rounded ?? 0;

  // Tax number parts: 12345678-1-23
  const taxParts = (data.companyTaxNumber || '').split('-');
  const taxNum8 = taxParts[0] || '';
  const taxNumVat = taxParts[1] || '';
  const taxNumCounty = taxParts[2] || '';

  let periodFrom = '';
  let periodTo = '';
  if (data.frequency === 'H') {
    periodFrom = `${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(data.periodYear, data.periodMonth, 0).getDate();
    periodTo = `${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (data.frequency === 'N') {
    const startMonth = (data.periodMonth - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    periodFrom = `${data.periodYear}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(data.periodYear, endMonth, 0).getDate();
    periodTo = `${data.periodYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    periodFrom = `${data.periodYear}-01-01`;
    periodTo = `${data.periodYear}-12-31`;
  }

  const formId = `${data.periodYear % 100}65`;
  const currentDate = new Date().toISOString().substring(0, 10);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
  xml += `<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">\n`;
  xml += `  <nyomtatvany>\n`;
  xml += `    <nyomtatvanyinformacio>\n`;
  xml += `      <nyomtatvanyazonosito>${formId}</nyomtatvanyazonosito>\n`;
  xml += `      <verzio>1.0</verzio>\n`;
  xml += `      <programnev>Visibill / eaisyBooks</programnev>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;

  xml += `      <!-- ========================================== -->\n`;
  xml += `      <!-- A) FŐLAP - ADÓZÓ ÉS IDŐSZAK ADATOK -->\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
  xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
  xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
  xml += `      <mezo eazon="01_0004_adoszam_teljes">${escapeXml(data.companyTaxNumber)}</mezo>\n`;
  xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(data.companyName)}</mezo>\n`;
  xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(data.companyAddress)}</mezo>\n`;
  xml += `      <mezo eazon="01_0010_adoev">${data.periodYear}</mezo>\n`;
  xml += `      <mezo eazon="01_0011_idoszak_tol">${periodFrom}</mezo>\n`;
  xml += `      <mezo eazon="01_0012_idoszak_ig">${periodTo}</mezo>\n`;
  xml += `      <mezo eazon="01_0013_gyakorisag">${escapeXml(data.frequency)}</mezo>\n`;

  xml += `\n      <!-- ========================================== -->\n`;
  xml += `      <!-- B) FIZETENDŐ ÉS LEVONHATÓ ÁFA SOROK (E FT) -->\n`;
  xml += `      <!-- ========================================== -->\n`;

  // Standard Rows 01..85
  data.lines.forEach(line => {
    if (line.base_amount_rounded != null) {
      xml += `      <mezo eazon="sor_${line.row_number}_alap">${line.base_amount_rounded}</mezo>\n`;
    }
    if (line.tax_amount_rounded != null) {
      xml += `      <mezo eazon="sor_${line.row_number}_ado">${line.tax_amount_rounded}</mezo>\n`;
    }
  });

  if (data.mLines && data.mLines.length > 0) {
    xml += `\n      <!-- ========================================== -->\n`;
    xml += `      <!-- C) M-LAPOK (BELFÖLDI ÖSSZESÍTŐ JELENTÉS) -->\n`;
    xml += `      <!-- ========================================== -->\n`;
    xml += `      <mezo eazon="M_partner_osszesen">${data.mLines.length}</mezo>\n`;
    data.mLines.forEach((m, idx) => {
      const pIdx = idx + 1;
      xml += `      <mezo eazon="M_${pIdx}_0001_adoszam">${escapeXml(m.partner_tax_number)}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0002_nev">${escapeXml(m.partner_name)}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0003_szamlak_szama">${m.invoice_count}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0004_alap">${m.base_amount_rounded}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0005_afa">${m.tax_amount_rounded}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0006_afa_5">${m.tax_5_amount || 0}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0007_afa_18">${m.tax_18_amount || 0}</mezo>\n`;
      xml += `      <mezo eazon="M_${pIdx}_0008_afa_27">${m.tax_27_amount || 0}</mezo>\n`;
    });
  }

  xml += `\n      <!-- ========================================== -->\n`;
  xml += `      <!-- D) NYILATKOZAT ÉS KELTEZÉS -->\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
  xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
  xml += `      <mezo eazon="03_0003_kelt_datum">${currentDate}</mezo>\n`;
  xml += `    </mezok>\n`;
  xml += `  </nyomtatvany>\n`;
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
