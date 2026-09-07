/**
 * T101 Adatbejelentő Nyomtatvány — ÁNYK XML Export
 * Generates a NAV-compatible XML file for the T101 registration/change form.
 */

import { parseTaxNumber } from './validationUtils';

interface T101Data {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  selectedRegime: 'standard' | 'cash_basis' | 'exempt';
  declarationDate: string;
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildT101Xml(data: T101Data): string {
  // Tax number normalization: handles 12345678-1-23, undashed 12345678123, or 8-digit base
  const parsedTax = parseTaxNumber(data.companyTaxNumber);
  const taxNum8 = parsedTax.base;
  const taxNumVat = parsedTax.vat;
  const taxNumCounty = parsedTax.county;
  const fullTaxNumber = parsedTax.fullFormatted;

  let afaValasztas = 'alanyi_mentes';
  if (data.selectedRegime === 'standard') afaValasztas = 'altalanos_szabalyok';
  else if (data.selectedRegime === 'cash_basis') afaValasztas = 'penzforgalmi_afa';

  const year = new Date().getFullYear();
  // Form identifier: e.g. 26T101
  const formId = `${year % 100}T101`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!-- Nemzeti Adó- és Vámhivatal ÁNYK XML Export -->\n`;
  xml += `<nyomtatvanyok xmlns="http://iop.gov.hu/2007/01/nyk/altalanosnyomtatvany">\n`;
  xml += `  <nyomtatvany>\n`;
  xml += `    <nyomtatvanyinformacio>\n`;
  xml += `      <nyomtatvanyazonosito>${formId}</nyomtatvanyazonosito>\n`;
  xml += `      <nyomtatvanyverzio>1.0</nyomtatvanyverzio>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <!-- A) FŐLAP - AZONOSÍTÓ ADATOK -->\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <mezo eazon="01_0001_adoszam_torzs">${taxNum8}</mezo>\n`;
  xml += `      <mezo eazon="01_0002_adoszam_afa">${taxNumVat}</mezo>\n`;
  xml += `      <mezo eazon="01_0003_adoszam_megye">${taxNumCounty}</mezo>\n`;
  xml += `      <mezo eazon="01_0004_adoszam_teljes">${escapeXml(fullTaxNumber)}</mezo>\n`;
  xml += `      <mezo eazon="01_0006_adozo_nev">${escapeXml(data.companyName)}</mezo>\n`;
  xml += `      <mezo eazon="01_0007_szekhely_cim">${escapeXml(data.companyAddress)}</mezo>\n`;
  xml += `\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <!-- B) VÁLTOZÁSBEJELENTÉS ÉS ÁFA STÁTUSZ -->\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <mezo eazon="02_0001_valtozas_oka">afa_statusz_valtozas</mezo>\n`;
  xml += `      <mezo eazon="02_0002_valasztott_afa_mod">${afaValasztas}</mezo>\n`;
  xml += `      <mezo eazon="02_0003_hataly_kezdete">${data.declarationDate}</mezo>\n`;
  xml += `\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <!-- D) NYILATKOZAT ÉS KELTEZÉS -->\n`;
  xml += `      <!-- ========================================== -->\n`;
  xml += `      <mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>\n`;
  xml += `      <mezo eazon="03_0002_kelt_hely">Budapest</mezo>\n`;
  xml += `      <mezo eazon="03_0003_kelt_datum">${data.declarationDate}</mezo>\n`;
  xml += `    </mezok>\n`;
  xml += `  </nyomtatvany>\n`;
  xml += `</nyomtatvanyok>`;
  return xml;
}

/**
 * Generates and downloads the ÁNYK T101 XML file.
 */
export const generateT101Xml = (data: T101Data) => {
  const xml = buildT101Xml(data);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NAV_T101_${data.companyName.replace(/\s+/g, '_')}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
