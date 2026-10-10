/**
 * Turizmusfejlesztési Hozzájárulás (26TFEJLH) — ÁNYK XML Export
 * 
 * Hivatalos NAV ÁNYK (AbevJava) kompatibilis XML állomány generáló a 26TFEJLH v3.0
 * nyomtatványhoz a tests/docs/eb0148/26TFEJLH.xml benchmark és a hatályos
 * jogszabályi előírások alapján.
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';

export interface TfejlhXmlData {
  companyName: string;
  companyTaxNumber: string;
  year: number;
  month: number;
  frequency: string; // 'H' | 'N' | 'E'
  baseEtkezohely: number;
  baseEtterem: number;
  baseSzallas: number;
  baseBusz: number;
  agentName?: string;
  agentPhone?: string;
  isSelfRevision?: boolean;
  isRepeatedSelfRevision?: boolean;
  selfRevisionTaxDiff?: number;
  selfRevisionSurcharge?: number;
}

/**
 * Normalizes phone numbers to standard Hungarian ÁNYK format (e.g. 36704240024)
 */
export function formatAnykPhoneNumber(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('06')) {
    return '36' + digits.slice(2);
  }
  if (digits.startsWith('36')) {
    return digits;
  }
  if (digits.length === 9) {
    return '36' + digits;
  }
  return digits;
}

/**
 * Normalizes company tax numbers to 11-digit continuous format
 */
export function formatAnykTaxNumber(taxNumber?: string): string {
  if (!taxNumber) return '';
  return taxNumber.replace(/\D/g, '');
}

/**
 * Builds the official ÁNYK XML string conforming to NAV 26TFEJLH v3.0 AbevJava schema.
 */
export function buildTfejlhXml(data: TfejlhXmlData): string {
  const formYear = data.year % 100;
  const formId = `${formYear}TFEJLH`;
  const formVersion = '3.0';

  const cleanCompanyName = (data.companyName || '').trim();
  const cleanTaxNumber = formatAnykTaxNumber(data.companyTaxNumber);
  const cleanPhone = formatAnykPhoneNumber(data.agentPhone);
  const agentName = (data.agentName || '').trim();

  // 1. Period calculation
  const y = String(data.year);
  let periodFrom = `${y}0101`;
  let periodTo = `${y}1231`;

  if (data.frequency === 'H') {
    const m = String(data.month).padStart(2, '0');
    const lastDay = new Date(data.year, data.month, 0).getDate();
    periodFrom = `${y}${m}01`;
    periodTo = `${y}${m}${String(lastDay).padStart(2, '0')}`;
  } else if (data.frequency === 'N') {
    const q = Math.max(1, Math.min(4, data.month));
    const startM = String((q - 1) * 3 + 1).padStart(2, '0');
    const endM = q * 3;
    const lastDay = new Date(data.year, endM, 0).getDate();
    periodFrom = `${y}${startM}01`;
    periodTo = `${y}${String(endM).padStart(2, '0')}${String(lastDay).padStart(2, '0')}`;
  }

  // 2. Bases in thousand HUF (ezer Ft), as required by official NAV 26TFEJLH form
  const toEzer = (n: number | null | undefined): number => Math.round((n || 0) / 1000);

  // Étkezőhelyi vendéglátás (1. sor: étel- és helyben készített italforgalom + éttermi szolgáltatások)
  const ezerEtkezohely = toEzer(data.baseEtkezohely) + toEzer(data.baseEtterem);
  // Szálláshely-szolgáltatás (2. sor)
  const ezerSzallas = toEzer(data.baseSzallas);
  // Buszos városnézés (3. sor)
  const ezerBusz = toEzer(data.baseBusz);

  // 4. sor: Összes hozzájárulási alap (ezer Ft)
  const ezerTotalBase = ezerEtkezohely + ezerSzallas + ezerBusz;

  // 4. sor b) oszlop: 4% mértékű hozzájárulás (ezer Ft)
  const ezerTaxPayable = Math.round(ezerTotalBase * 0.04);

  // Főlap fizetendő kötelezettség (forintban, 0A0001A003A)
  const totalTaxPayableFt = ezerTaxPayable * 1000;

  // Self-revision values
  const isRevision = !!data.isSelfRevision;
  const revisionDiff = toEzer(data.selfRevisionTaxDiff);

  // XML Assembly
  let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
  xml += `<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">\n`;
  xml += `  <abev>\n`;
  xml += `    <hibakszama>0</hibakszama>\n`;
  xml += `    <hash>b5acf8e2e8ff9205bcfb9c108f85da602d72f911</hash>\n`;
  xml += `    <programverzio>v.3.50.0</programverzio>\n`;
  xml += `  </abev>\n`;
  xml += `  <nyomtatvany>\n`;
  xml += `    <nyomtatvanyinformacio>\n`;
  xml += `      <nyomtatvanyazonosito>${formId}</nyomtatvanyazonosito>\n`;
  xml += `      <nyomtatvanyverzio>${formVersion}</nyomtatvanyverzio>\n`;
  xml += `      <adozo>\n`;
  xml += `        <nev>${escapeXml(cleanCompanyName)}</nev>\n`;
  xml += `        <adoszam>${cleanTaxNumber}</adoszam>\n`;
  xml += `      </adozo>\n`;
  xml += `      <idoszak>\n`;
  xml += `        <tol>${periodFrom}</tol>\n`;
  xml += `        <ig>${periodTo}</ig>\n`;
  xml += `      </idoszak>\n`;
  xml += `      <megjegyzes>${escapeXml(cleanCompanyName)} - ${formId}</megjegyzes>\n`;
  xml += `    </nyomtatvanyinformacio>\n`;
  xml += `    <mezok>\n`;

  // Főlap adatok
  // 0A0001A001A: Bevallás jellege (2 = Normál, 3 = Önellenőrzés)
  xml += `      <mezo eazon="0A0001A001A">${isRevision ? '3' : '2'}</mezo>\n`;

  // 0A0001A003A: Fizetendő hozzájárulás forintban
  xml += `      <mezo eazon="0A0001A003A">${totalTaxPayableFt}</mezo>\n`;

  // 0A0001C001A: Adózó adószáma (11 számjegy)
  xml += `      <mezo eazon="0A0001C001A">${cleanTaxNumber}</mezo>\n`;

  // 0A0001C005A: Adózó neve
  xml += `      <mezo eazon="0A0001C005A">${escapeXml(cleanCompanyName)}</mezo>\n`;

  // 0A0001C006A: Ügyintéző neve
  if (agentName) {
    xml += `      <mezo eazon="0A0001C006A">${escapeXml(agentName)}</mezo>\n`;
  }

  // 0A0001C007A: Ügyintéző telefonszáma
  if (cleanPhone) {
    xml += `      <mezo eazon="0A0001C007A">${cleanPhone}</mezo>\n`;
  }

  // 0A0001D001A: Időszak kezdete YYYYMMDD
  xml += `      <mezo eazon="0A0001D001A">${periodFrom}</mezo>\n`;

  // 0A0001D002A: Időszak vége YYYYMMDD
  xml += `      <mezo eazon="0A0001D002A">${periodTo}</mezo>\n`;

  // 0A0001D007A: Gyakoriság kód (H, N, E)
  xml += `      <mezo eazon="0A0001D007A">${data.frequency || 'H'}</mezo>\n`;

  // 0A0001E0001AA: 1. sor - Étkezőhelyi vendéglátás forgalma (ezer Ft)
  xml += `      <mezo eazon="0A0001E0001AA">${ezerEtkezohely}</mezo>\n`;

  // 0A0001E0002AA: 2. sor - Kereskedelmi szálláshely-szolgáltatás forgalma (ezer Ft)
  xml += `      <mezo eazon="0A0001E0002AA">${ezerSzallas}</mezo>\n`;

  // 0A0001E0003AA: 3. sor - Buszos városnézés turisztikai szolgáltatás forgalma (ezer Ft)
  xml += `      <mezo eazon="0A0001E0003AA">${ezerBusz}</mezo>\n`;

  // 0A0001E0004AA: 4. sor - Turizmusfejlesztési hozzájárulás alapja összesen (ezer Ft)
  xml += `      <mezo eazon="0A0001E0004AA">${ezerTotalBase}</mezo>\n`;

  // 0A0001E0004BA: 4. sor - Turizmusfejlesztési hozzájárulás összege (4%) (ezer Ft)
  xml += `      <mezo eazon="0A0001E0004BA">${ezerTaxPayable}</mezo>\n`;

  // 0A0001F50001A: 5. sor - Elszámolandó különbözet (ezer Ft)
  xml += `      <mezo eazon="0A0001F50001A">${isRevision ? revisionDiff : 0}</mezo>\n`;

  xml += `    </mezok>\n`;
  xml += `  </nyomtatvany>\n`;
  xml += `</nyomtatvanyok>\n`;

  return xml;
}

/**
 * Triggers client-side download of the 26TFEJLH ÁNYK XML file.
 */
export function downloadTfejlhXml(data: TfejlhXmlData): void {
  const formYear = data.year % 100;
  const formId = `${formYear}TFEJLH`;
  const cleanTax = formatAnykTaxNumber(data.companyTaxNumber) || 'ADOSZAM';
  
  const periodTag = data.frequency === 'H' 
    ? `${data.year}_${String(data.month).padStart(2, '0')}`
    : data.frequency === 'N'
    ? `${data.year}_Q${data.month}`
    : `${data.year}`;

  const filename = `${formId}_${cleanTax}_${periodTag}.xml`;
  const xmlContent = buildTfejlhXml(data);

  downloadString(xmlContent, filename, 'application/xml;charset=utf-8');
}
