/**
 * Croatian Tax Authority (Porezna uprava — ePorezna) XML Export Generator.
 * Conforms strictly to official XML schemas:
 *   - Obrazac PDV-S (v1-0): Prijava za stjecanje dobara i primljene usluge iz drugih država članica EU
 *   - Obrazac ZP (v1-0): Zbirna prijava za isporuke dobara i usluga u druge države članice EU (VIES)
 */

import { escapeXml } from './documents/encoding/xmlSanitizer';
import { downloadString } from './documents/core/downloadHelper';

export interface CroatianPreparerInfo {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  ispostava: string;
}

export interface CroatianCompanyTaxInfo {
  name: string;
  oib: string;
  address?: string;
  city?: string;
  street?: string;
  houseNumber?: string;
}

export interface PdvSItem {
  row_number: number;
  country_code: string;
  pdv_id: string;
  partner_name?: string;
  i1: number; // Stjecanje dobara (Goods)
  i2: number; // Primljene usluge (Services)
  invoice_count?: number;
}

export interface ZpItem {
  row_number: number;
  country_code: string;
  pdv_id: string;
  partner_name?: string;
  i1: number; // Isporuke dobara (Goods supply)
  i2: number; // Trostrani posao (Triangular transaction)
  i3: number; // Premještanje dobara (Call-off stock)
  i4: number; // Obavljene usluge (Services supply)
  invoice_count?: number;
}

export interface CroatianEuStatementsData {
  company: CroatianCompanyTaxInfo;
  periodYear: number;
  periodMonth: number;
  frequency: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  preparer: CroatianPreparerInfo;
  pdv_s: {
    items: PdvSItem[];
    totals: { i1: number; i2: number; total: number };
  };
  zp: {
    items: ZpItem[];
    totals: { i1: number; i2: number; i3: number; i4: number; total: number };
  };
}

/**
 * Formats a numeric currency value to Croatian tax XML format (2 decimal places, e.g. "45000.00").
 */
export function formatPoreznaAmount(val: number | null | undefined): string {
  if (val == null || isNaN(Number(val))) return '0.00';
  return Number(val).toFixed(2);
}

/**
 * Parses a combined address string into street, house number, and city.
 * E.g. "Ribarska 10, 31000 osijek" -> { street: "Ribarska", houseNumber: "10", city: "osijek" }
 * E.g. "SV. IVANA KRSTITELJA 15" -> { street: "SV. IVANA KRSTITELJA", houseNumber: "15", city: "" }
 */
export function parseCroatianAddress(rawAddress?: string): { city: string; street: string; houseNumber: string } {
  if (!rawAddress || !rawAddress.trim()) {
    return { city: '', street: '', houseNumber: '' };
  }

  const parts = rawAddress.split(',').map((p) => p.trim());
  let streetAndNumber = parts[0] || '';
  let cityPart = parts[1] || '';

  // Clean postal code from city part if present (e.g. "31000 Osijek" -> "Osijek")
  cityPart = cityPart.replace(/^[0-9]{4,5}\s*/, '').trim();

  // Extract trailing house number (e.g. "Ribarska 10" or "Kralja Tomislava 15/A")
  let street = streetAndNumber;
  let houseNumber = '';
  const match = streetAndNumber.match(/^(.*?)\s+([0-9]+[a-zA-Z0-9\/\-\.]*)$/);
  if (match) {
    street = match[1].trim();
    houseNumber = match[2].trim();
  }

  return {
    street: street || streetAndNumber,
    houseNumber: houseNumber || '1',
    city: cityPart || 'ZAGREB',
  };
}

/**
 * Cleans OIB of non-digits and HR prefix. Must be 11 digits.
 */
export function cleanOib(oib?: string): string {
  if (!oib) return '';
  return oib.replace(/^HR/i, '').replace(/[^0-9]/g, '').slice(0, 11);
}

/**
 * Generates ISO timestamp formatted as YYYY-MM-DDTHH:mm:ss
 */
function getIsoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '');
}

/**
 * Generates an RFC4122 v4 UUID.
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Generates official XML for Obrazac PDV-S (EU Acquisitions & Received Services).
 */
export function generatePdvSXmlString(data: CroatianEuStatementsData): string {
  const oib = cleanOib(data.company.oib);
  const parsedAddr = parseCroatianAddress(data.company.address);
  const city = escapeXml(data.company.city || parsedAddr.city || 'DARDA');
  const street = escapeXml(data.company.street || parsedAddr.street || 'SV. IVANA KRSTITELJA');
  const houseNumber = escapeXml(data.company.houseNumber || parsedAddr.houseNumber || '15');
  const companyName = escapeXml(data.company.name || '');

  const preparerFirst = escapeXml(data.preparer.firstName || '');
  const preparerLast = escapeXml(data.preparer.lastName || '');
  const preparerPhone = escapeXml(data.preparer.phone || '');
  const preparerEmail = escapeXml(data.preparer.email || '');
  const ispostava = escapeXml(data.preparer.ispostava || '3301');

  const timestamp = getIsoTimestamp();
  const docUuid = generateUuid();

  let itemsXml = '';
  let sumI1 = 0;
  let sumI2 = 0;

  data.pdv_s.items.forEach((item, idx) => {
    const redBr = item.row_number || idx + 1;
    const kodDrzave = escapeXml(item.country_code);
    const pdvId = escapeXml(item.pdv_id);
    const i1Formatted = formatPoreznaAmount(item.i1);
    const i2Formatted = formatPoreznaAmount(item.i2);

    sumI1 += Number(item.i1 || 0);
    sumI2 += Number(item.i2 || 0);

    itemsXml += `<Isporuka><RedBr>${redBr}</RedBr><KodDrzave>${kodDrzave}</KodDrzave><PDVID>${pdvId}</PDVID><I1>${i1Formatted}</I1><I2>${i2Formatted}</I2></Isporuka>`;
  });

  const totalI1Formatted = formatPoreznaAmount(data.pdv_s.totals?.i1 ?? sumI1);
  const totalI2Formatted = formatPoreznaAmount(data.pdv_s.totals?.i2 ?? sumI2);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ObrazacPDVS verzijaSheme="1.0" xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacPDVS/v1-0">` +
    `<Metapodaci xmlns="http://e-porezna.porezna-uprava.hr/sheme/Metapodaci/v2-0">` +
    `<Naslov dc="http://purl.org/dc/elements/1.1/title">Prijava za stjecanje dobara i primljene usluge iz drugih država članica Europske unije</Naslov>` +
    `<Autor dc="http://purl.org/dc/elements/1.1/creator">${companyName}</Autor>` +
    `<Datum dc="http://purl.org/dc/elements/1.1/date">${timestamp}</Datum>` +
    `<Format dc="http://purl.org/dc/elements/1.1/format">text/xml</Format>` +
    `<Jezik dc="http://purl.org/dc/elements/1.1/language">hr-HR</Jezik>` +
    `<Identifikator dc="http://purl.org/dc/elements/1.1/identifier">${docUuid}</Identifikator>` +
    `<Uskladjenost dc="http://purl.org/dc/terms/conformsTo">ObrazacPDVS-v1-0</Uskladjenost>` +
    `<Tip dc="http://purl.org/dc/elements/1.1/type">Elektronički obrazac</Tip>` +
    `<Adresant>Ministarstvo Financija, Porezna uprava, Zagreb</Adresant>` +
    `</Metapodaci>` +
    `<Zaglavlje>` +
    `<Razdoblje><DatumOd>${data.dateFrom}</DatumOd><DatumDo>${data.dateTo}</DatumDo></Razdoblje>` +
    `<Obveznik><Naziv>${companyName}</Naziv><OIB>${oib}</OIB><Adresa><Mjesto>${city}</Mjesto><Ulica>${street}</Ulica><Broj>${houseNumber}</Broj></Adresa></Obveznik>` +
    `<ObracunSastavio><Ime>${preparerFirst}</Ime><Prezime>${preparerLast}</Prezime><Telefon>${preparerPhone}</Telefon><Email>${preparerEmail}</Email></ObracunSastavio>` +
    `<Ispostava>${ispostava}</Ispostava>` +
    `</Zaglavlje>` +
    `<Tijelo>` +
    `<Isporuke>${itemsXml}</Isporuke>` +
    `<IsporukeUkupno><I1>${totalI1Formatted}</I1><I2>${totalI2Formatted}</I2></IsporukeUkupno>` +
    `</Tijelo>` +
    `</ObrazacPDVS>`
  );
}

/**
 * Generates official XML for Obrazac ZP (VIES Recapitulative Statement for EU Supplies).
 */
export function generateZpXmlString(data: CroatianEuStatementsData): string {
  const oib = cleanOib(data.company.oib);
  const parsedAddr = parseCroatianAddress(data.company.address);
  const city = escapeXml(data.company.city || parsedAddr.city || 'DARDA');
  const street = escapeXml(data.company.street || parsedAddr.street || 'SV. IVANA KRSTITELJA');
  const houseNumber = escapeXml(data.company.houseNumber || parsedAddr.houseNumber || '15');
  const companyName = escapeXml(data.company.name || '');

  const preparerFirst = escapeXml(data.preparer.firstName || '');
  const preparerLast = escapeXml(data.preparer.lastName || '');
  const preparerPhone = escapeXml(data.preparer.phone || '');
  const preparerEmail = escapeXml(data.preparer.email || '');
  const ispostava = escapeXml(data.preparer.ispostava || '3301');

  const timestamp = getIsoTimestamp();
  const docUuid = generateUuid();

  let itemsXml = '';
  let sumI1 = 0;
  let sumI2 = 0;
  let sumI3 = 0;
  let sumI4 = 0;

  data.zp.items.forEach((item, idx) => {
    const redBr = item.row_number || idx + 1;
    const kodDrzave = escapeXml(item.country_code);
    const pdvId = escapeXml(item.pdv_id);
    const i1Formatted = formatPoreznaAmount(item.i1);
    const i2Formatted = formatPoreznaAmount(item.i2);
    const i3Formatted = formatPoreznaAmount(item.i3);
    const i4Formatted = formatPoreznaAmount(item.i4);

    sumI1 += Number(item.i1 || 0);
    sumI2 += Number(item.i2 || 0);
    sumI3 += Number(item.i3 || 0);
    sumI4 += Number(item.i4 || 0);

    itemsXml += `<Isporuka><RedBr>${redBr}</RedBr><KodDrzave>${kodDrzave}</KodDrzave><PDVID>${pdvId}</PDVID><I1>${i1Formatted}</I1><I2>${i2Formatted}</I2><I3>${i3Formatted}</I3><I4>${i4Formatted}</I4></Isporuka>`;
  });

  const totalI1Formatted = formatPoreznaAmount(data.zp.totals?.i1 ?? sumI1);
  const totalI2Formatted = formatPoreznaAmount(data.zp.totals?.i2 ?? sumI2);
  const totalI3Formatted = formatPoreznaAmount(data.zp.totals?.i3 ?? sumI3);
  const totalI4Formatted = formatPoreznaAmount(data.zp.totals?.i4 ?? sumI4);

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<ObrazacZP verzijaSheme="1.0" xmlns="http://e-porezna.porezna-uprava.hr/sheme/zahtjevi/ObrazacZP/v1-0">` +
    `<Metapodaci xmlns="http://e-porezna.porezna-uprava.hr/sheme/Metapodaci/v2-0">` +
    `<Naslov dc="http://purl.org/dc/elements/1.1/title">Zbirna prijavu za isporuke dobara i usluga u druge države članice Europske unije</Naslov>` +
    `<Autor dc="http://purl.org/dc/elements/1.1/creator">${companyName}</Autor>` +
    `<Datum dc="http://purl.org/dc/elements/1.1/date">${timestamp}</Datum>` +
    `<Format dc="http://purl.org/dc/elements/1.1/format">text/xml</Format>` +
    `<Jezik dc="http://purl.org/dc/elements/1.1/language">hr-HR</Jezik>` +
    `<Identifikator dc="http://purl.org/dc/elements/1.1/identifier">${docUuid}</Identifikator>` +
    `<Uskladjenost dc="http://purl.org/dc/terms/conformsTo">ObrazacZP-v1-0</Uskladjenost>` +
    `<Tip dc="http://purl.org/dc/elements/1.1/type">Elektronički obrazac</Tip>` +
    `<Adresant>Ministarstvo Financija, Porezna uprava, Zagreb</Adresant>` +
    `</Metapodaci>` +
    `<Zaglavlje>` +
    `<Razdoblje><DatumOd>${data.dateFrom}</DatumOd><DatumDo>${data.dateTo}</DatumDo></Razdoblje>` +
    `<Obveznik><Naziv>${companyName}</Naziv><OIB>${oib}</OIB><Adresa><Mjesto>${city}</Mjesto><Ulica>${street}</Ulica><Broj>${houseNumber}</Broj></Adresa></Obveznik>` +
    `<ObracunSastavio><Ime>${preparerFirst}</Ime><Prezime>${preparerLast}</Prezime><Telefon>${preparerPhone}</Telefon><Email>${preparerEmail}</Email></ObracunSastavio>` +
    `<Ispostava>${ispostava}</Ispostava>` +
    `</Zaglavlje>` +
    `<Tijelo>` +
    `<Isporuke>${itemsXml}</Isporuke>` +
    `<IsporukeUkupno><I1>${totalI1Formatted}</I1><I2>${totalI2Formatted}</I2><I3>${totalI3Formatted}</I3><I4>${totalI4Formatted}</I4></IsporukeUkupno>` +
    `</Tijelo>` +
    `</ObrazacZP>`
  );
}

/**
 * Triggers client-side browser file download for Obrazac PDV-S XML.
 */
export function downloadPdvSXml(data: CroatianEuStatementsData, filename?: string): void {
  const xmlContent = generatePdvSXmlString(data);
  const m = String(data.periodMonth).padStart(2, '0');
  const defaultFilename = filename || `HR_PDV-S_${m}.${data.periodYear}.xml`;
  downloadString(xmlContent, defaultFilename, 'application/xml');
}

/**
 * Triggers client-side browser file download for Obrazac ZP XML.
 */
export function downloadZpXml(data: CroatianEuStatementsData, filename?: string): void {
  const xmlContent = generateZpXmlString(data);
  const m = String(data.periodMonth).padStart(2, '0');
  const defaultFilename = filename || `HR_ZP_${m}.${data.periodYear}.xml`;
  downloadString(xmlContent, defaultFilename, 'application/xml');
}
