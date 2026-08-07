/**
 * ÁFA Bevallás (2665) — ÁNYK XML Export
 * Generates a NAV-compatible XML file for the 2665 VAT return form.
 * 
 * The XML structure follows the ÁNYK (Általános Nyomtatványkitöltő) format
 * which NAV uses for electronic submission.
 */

interface XmlExportData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string;
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null }[];
  mLines: { partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount: number; tax_18_amount: number; tax_27_amount: number }[];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Builds the full 2665 ÁNYK-compatible XML document.
 */
function buildVatReturnXml(data: XmlExportData): string {
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
    // data.frequency === 'E' (Annual)
    periodFrom = `${data.periodYear}-01-01`;
    periodTo = `${data.periodYear}-12-31`;
  }

  // All A-lap rows that have data
  const aLapRows = data.lines
    .filter(l => l.row_number !== '105' && l.row_number !== '106' && l.row_number !== '108' && l.row_number !== '109')
    .map(l => {
      const hasBase = l.base_amount_rounded !== null && l.base_amount_rounded !== 0;
      const hasTax = l.tax_amount_rounded !== null && l.tax_amount_rounded !== 0;
      if (!hasBase && !hasTax) return '';
      return `      <sor>
        <sorszam>${escapeXml(l.row_number)}</sorszam>
        ${hasBase ? `<adoalap>${l.base_amount_rounded}</adoalap>` : ''}
        ${hasTax ? `<ado>${l.tax_amount_rounded}</ado>` : ''}
      </sor>`;
    })
    .filter(Boolean)
    .join('\n');

  // M-lap entries
  const mLapEntries = data.mLines.map((ml, idx) => `
      <m_tetel sorszam="${idx + 1}">
        <partner_nev>${escapeXml(ml.partner_name)}</partner_nev>
        <partner_adoszam>${escapeXml(ml.partner_tax_number)}</partner_adoszam>
        <szamla_darab>${ml.invoice_count}</szamla_darab>
        <adoalap>${ml.base_amount_rounded}</adoalap>
        <ado_osszeg>${ml.tax_amount_rounded}</ado_osszeg>
        ${ml.tax_5_amount ? `<ado_5>${Math.round(ml.tax_5_amount / 1000)}</ado_5>` : ''}
        ${ml.tax_18_amount ? `<ado_18>${Math.round(ml.tax_18_amount / 1000)}</ado_18>` : ''}
        ${ml.tax_27_amount ? `<ado_27>${Math.round(ml.tax_27_amount / 1000)}</ado_27>` : ''}
      </m_tetel>`).join('\n');

  // M-lap summary rows
  const mSummaryRows = data.lines
    .filter(l => ['105', '106', '108', '109'].includes(l.row_number))
    .map(l => {
      const hasBase = l.base_amount_rounded !== null && l.base_amount_rounded !== 0;
      const hasTax = l.tax_amount_rounded !== null && l.tax_amount_rounded !== 0;
      if (!hasBase && !hasTax) return '';
      return `      <sor>
        <sorszam>${escapeXml(l.row_number)}</sorszam>
        ${hasBase ? `<adoalap>${l.base_amount_rounded}</adoalap>` : ''}
        ${hasTax ? `<ado>${l.tax_amount_rounded}</ado>` : ''}
      </sor>`;
    })
    .filter(Boolean)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvany xmlns="http://www.nav.gov.hu/afa2665">
  <fejlec>
    <nyomtatvany_azonosito>2665</nyomtatvany_azonosito>
    <verzio>01</verzio>
    <bevallasiIdoszak>
      <idoszak_kezdet>${periodFrom}</idoszak_kezdet>
      <idoszak_veg>${periodTo}</idoszak_veg>
      <gyakorisag>${data.frequency === 'H' ? 'HAVI' : data.frequency === 'N' ? 'NEGYEDEVES' : 'EVES'}</gyakorisag>
    </bevallasiIdoszak>
    <adozo>
      <nev>${escapeXml(data.companyName)}</nev>
      <adoszam>
        <torzsszam>${taxNum8}</torzsszam>
        <afakod>${taxNumVat}</afakod>
        <teruletkod>${taxNumCounty}</teruletkod>
      </adoszam>
      <cim>${escapeXml(data.companyAddress)}</cim>
    </adozo>
  </fejlec>

  <a_lap>
    <!-- Fizetendő és levonható ÁFA sorok -->
${aLapRows}
  </a_lap>

  <m_lap>
    <osszesito>
      <!-- M-lap összesítő sorok (105, 106, 108, 109) -->
${mSummaryRows}
    </osszesito>
    <reszletezo>
      <!-- Partnerenkénti bontás -->
${mLapEntries}
    </reszletezo>
  </m_lap>

  <nyilatkozat>
    <kelt>${new Date().toISOString().substring(0, 10)}</kelt>
    <adat_igaz>true</adat_igaz>
  </nyilatkozat>
</nyomtatvany>`;
}

/**
 * Generates and downloads the ÁNYK XML file.
 */
export const generateVatReturnXml = (data: XmlExportData) => {
  const xml = buildVatReturnXml(data);
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `AFA_2665_${data.periodYear}_${String(data.periodMonth).padStart(2, '0')}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Returns the XML as a string for preview purposes.
 */
export const getVatReturnXmlString = (data: XmlExportData): string => {
  return buildVatReturnXml(data);
};
