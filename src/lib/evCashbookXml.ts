/**
 * EV Cashbook XML Export Utility for ÁNYK and ONYA formats.
 */

export interface EvCashbookExportData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  taxYear: number;
  periodFrom: string;
  periodTo: string;
  entries: Array<{
    id: string;
    serialNumber: number;
    entryDate: string;
    documentNumber: string;
    description: string;
    direction: 'bevetel' | 'kiadas';
    category: string;
    categoryLabel: string;
    amount: number;
    vatAmount: number;
    periodClosed: boolean;
    isStorno: boolean;
  }>;
}

// Escape special XML characters
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates and downloads ÁNYK XML for the EV cashbook
 */
export function exportEvCashbookAnykXml(data: EvCashbookExportData) {
  const {
    companyName,
    companyTaxNumber,
    companyAddress,
    taxYear,
    periodFrom,
    periodTo,
    entries,
  } = data;

  const totalBevetel = entries
    .filter(e => e.direction === 'bevetel' && !e.isStorno)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalKiadas = entries
    .filter(e => e.direction === 'kiadas' && !e.isStorno)
    .reduce((sum, e) => sum + e.amount, 0);

  const balance = totalBevetel - totalKiadas;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<penztarkonyv xmlns="http://www.nav.gov.hu/penztarkonyv" verzio="2026.1">\n`;
  
  // Headings / Metadata
  xml += `  <fejlec>\n`;
  xml += `    <adozo>\n`;
  xml += `      <nev>${escapeXml(companyName || 'Egyéni Vállalkozó')}</nev>\n`;
  xml += `      <adoszam>${escapeXml(companyTaxNumber || '')}</adoszam>\n`;
  xml += `      <cim>${escapeXml(companyAddress || '')}</cim>\n`;
  xml += `    </adozo>\n`;
  xml += `    <idoszak>\n`;
  xml += `      <adoev>${taxYear}</adoev>\n`;
  xml += `      <tol>${escapeXml(periodFrom || `${taxYear}-01-01`)}</tol>\n`;
  xml += `      <ig>${escapeXml(periodTo || `${taxYear}-12-31`)}</ig>\n`;
  xml += `    </idoszak>\n`;
  xml += `  </fejlec>\n`;

  // Itemized transactions
  xml += `  <tetelek>\n`;
  entries.forEach(e => {
    xml += `    <tetel id="${e.id}">\n`;
    xml += `      <sorszam>${e.serialNumber}</sorszam>\n`;
    xml += `      <datum>${e.entryDate}</datum>\n`;
    xml += `      <bizonylatszam>${escapeXml(e.documentNumber)}</bizonylatszam>\n`;
    xml += `      <megnevezes>${escapeXml(e.description)}</megnevezes>\n`;
    xml += `      <irany>${e.direction}</irany>\n`;
    xml += `      <kategoria>${escapeXml(e.category)}</kategoria>\n`;
    xml += `      <kategoria_megnevezes>${escapeXml(e.categoryLabel)}</kategoria_megnevezes>\n`;
    xml += `      <osszeg>${e.amount}</osszeg>\n`;
    xml += `      <afa_osszeg>${e.vatAmount}</afa_osszeg>\n`;
    xml += `      <lezart>${e.periodClosed ? 'igen' : 'nem'}</lezart>\n`;
    xml += `      <storno>${e.isStorno ? 'igen' : 'nem'}</storno>\n`;
    xml += `    </tetel>\n`;
  });
  xml += `  </tetelek>\n`;

  // Summary / Totals
  xml += `  <osszesites>\n`;
  xml += `    <osszes_bevetel>${totalBevetel}</osszes_bevetel>\n`;
  xml += `    <osszes_kiadas>${totalKiadas}</osszes_kiadas>\n`;
  xml += `    <egyenleg>${balance}</egyenleg>\n`;
  xml += `  </osszesites>\n`;

  xml += `</penztarkonyv>\n`;

  // Trigger download
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ANYK_PENZTARKONYV_${taxYear}_${(companyName || 'EV').replace(/\s+/g, '_')}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads ONYA XML for the EV cashbook
 */
export function exportEvCashbookOnyaXml(data: EvCashbookExportData) {
  const {
    companyName,
    companyTaxNumber,
    taxYear,
    periodFrom,
    periodTo,
    entries,
  } = data;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<onya_penztarkonyv xmlns="http://www.nav.gov.hu/onya" verzio="1.0">\n`;
  
  xml += `  <meta>\n`;
  xml += `    <adoszam>${escapeXml(companyTaxNumber || '')}</adoszam>\n`;
  xml += `    <nev>${escapeXml(companyName || '')}</nev>\n`;
  xml += `    <idoszak_tol>${escapeXml(periodFrom || `${taxYear}-01-01`)}</idoszak_tol>\n`;
  xml += `    <idoszak_ig>${escapeXml(periodTo || `${taxYear}-12-31`)}</idoszak_ig>\n`;
  xml += `  </meta>\n`;

  xml += `  <bizonylatok>\n`;
  entries.forEach(e => {
    xml += `    <bizonylat>\n`;
    xml += `      <sorszam>${e.serialNumber}</sorszam>\n`;
    xml += `      <teljesites_datum>${e.entryDate}</teljesites_datum>\n`;
    xml += `      <bizonylatszam>${escapeXml(e.documentNumber)}</bizonylatszam>\n`;
    xml += `      <megnevezes>${escapeXml(e.description)}</megnevezes>\n`;
    xml += `      <tipus>${e.direction === 'bevetel' ? 'Bevétel' : 'Kiadás'}</tipus>\n`;
    xml += `      <kategoria_kod>${escapeXml(e.category)}</kategoria_kod>\n`;
    xml += `      <kategoria_nev>${escapeXml(e.categoryLabel)}</kategoria_nev>\n`;
    xml += `      <osszeg_huf>${e.amount}</osszeg_huf>\n`;
    xml += `      <afa_huf>${e.vatAmount}</afa_huf>\n`;
    xml += `      <stornozott>${e.isStorno ? '1' : '0'}</stornozott>\n`;
    xml += `    </bizonylat>\n`;
  });
  xml += `  </bizonylatok>\n`;

  xml += `</onya_penztarkonyv>\n`;

  // Trigger download
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ONYA_PENZTARKONYV_${taxYear}_${(companyName || 'EV').replace(/\s+/g, '_')}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}
