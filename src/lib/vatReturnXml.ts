/**
 * ÁFA Bevallás (2665) — ÁNYK XML Export (Facade & Generator).
 * Uses shared DocumentEngine XML sanitizer and download helper.
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
    periodFrom = `${data.periodYear}-01-01`;
    periodTo = `${data.periodYear}-12-31`;
  }

  const mLapEntries = data.mLines.map((m, idx) => `
      <partner sorszam="${idx + 1}">
        <partner_adoszam>${escapeXml(m.partner_tax_number)}</partner_adoszam>
        <partner_nev>${escapeXml(m.partner_name)}</partner_nev>
        <szamlak_szama>${m.invoice_count}</szamlak_szama>
        <adoalap_osszesen>${m.base_amount_rounded}</adoalap_osszesen>
        <afa_osszesen>${m.tax_amount_rounded}</afa_osszesen>
        <afa_5>${m.tax_5_amount}</afa_5>
        <afa_18>${m.tax_18_amount}</afa_18>
        <afa_27>${m.tax_27_amount}</afa_27>
      </partner>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<nyomtatvany xmlns="http://schema.nav.gov.hu/anyk/1.0">
  <fejlec>
    <nyomtatvany_azonosito>2665</nyomtatvany_azonosito>
    <verzio>1.0</verzio>
    <program>Visibill / eaisyBooks</program>
    <idoszak>
      <tol>${periodFrom}</tol>
      <ig>${periodTo}</ig>
      <gyakorisag>${data.frequency}</gyakorisag>
    </idoszak>
    <adozo>
      <adoszam>${escapeXml(taxNum8)}</adoszam>
      <afa_kod>${escapeXml(taxNumVat)}</afa_kod>
      <megye_kod>${escapeXml(taxNumCounty)}</megye_kod>
      <nev>${escapeXml(data.companyName)}</nev>
      <cim>${escapeXml(data.companyAddress)}</cim>
    </adozo>
  </fejlec>

  <fobevallas>
    <fizetendo_ado>
      <sor_01_alap>${getBase('01')}</sor_01_alap>
      <sor_01_ado>${getTax('01')}</sor_01_ado>
      <sor_02_alap>${getBase('02')}</sor_02_alap>
      <sor_02_ado>${getTax('02')}</sor_02_ado>
      <sor_03_alap>${getBase('03')}</sor_03_alap>
      <sor_03_ado>${getTax('03')}</sor_03_ado>
      <sor_04_alap>${getBase('04')}</sor_04_alap>
      <sor_04_ado>${getTax('04')}</sor_04_ado>
      <sor_05_alap>${getBase('05')}</sor_05_alap>
      <sor_05_ado>${getTax('05')}</sor_05_ado>
      <sor_06_alap>${getBase('06')}</sor_06_alap>
      <sor_06_ado>${getTax('06')}</sor_06_ado>
      <sor_07_alap>${getBase('07')}</sor_07_alap>
      <sor_07_ado>${getTax('07')}</sor_07_ado>
      <sor_08_alap>${getBase('08')}</sor_08_alap>
      <sor_08_ado>${getTax('08')}</sor_08_ado>
      <sor_09_alap>${getBase('09')}</sor_09_alap>
      <sor_09_ado>${getTax('09')}</sor_09_ado>
      <sor_10_alap>${getBase('10')}</sor_10_alap>
      <sor_10_ado>${getTax('10')}</sor_10_ado>
      <sor_20_ado>${getTax('20')}</sor_20_ado>
    </fizetendo_ado>

    <levonhato_ado>
      <sor_64_alap>${getBase('64')}</sor_64_alap>
      <sor_64_ado>${getTax('64')}</sor_64_ado>
      <sor_65_alap>${getBase('65')}</sor_65_alap>
      <sor_65_ado>${getTax('65')}</sor_65_ado>
      <sor_66_alap>${getBase('66')}</sor_66_alap>
      <sor_66_ado>${getTax('66')}</sor_66_ado>
      <sor_67_alap>${getBase('67')}</sor_67_alap>
      <sor_67_ado>${getTax('67')}</sor_67_ado>
      <sor_68_alap>${getBase('68')}</sor_68_alap>
      <sor_68_ado>${getTax('68')}</sor_68_ado>
      <sor_69_alap>${getBase('69')}</sor_69_alap>
      <sor_69_ado>${getTax('69')}</sor_69_ado>
      <sor_70_alap>${getBase('70')}</sor_70_alap>
      <sor_70_ado>${getTax('70')}</sor_70_ado>
      <sor_71_alap>${getBase('71')}</sor_71_alap>
      <sor_71_ado>${getTax('71')}</sor_71_ado>
      <sor_72_alap>${getBase('72')}</sor_72_alap>
      <sor_72_ado>${getTax('72')}</sor_72_ado>
      <sor_73_alap>${getBase('73')}</sor_73_alap>
      <sor_73_ado>${getTax('73')}</sor_73_ado>
      <sor_80_ado>${getTax('80')}</sor_80_ado>
    </levonhato_ado>

    <elszamolas>
      <sor_85_ado>${getTax('85')}</sor_85_ado>
    </elszamolas>
  </fobevallas>

  <m_lap>
    <partner_szam>${data.mLines.length}</partner_szam>
    <reszletezo>
${mLapEntries}
    </reszletezo>
  </m_lap>

  <nyilatkozat>
    <kelt>${new Date().toISOString().substring(0, 10)}</kelt>
    <adat_igaz>true</adat_igaz>
  </nyilatkozat>
</nyomtatvany>`;
}

export const generateVatReturnXml = (data: XmlExportData) => {
  const xml = buildVatReturnXml(data);
  const filename = `AFA_2665_${data.periodYear}_${String(data.periodMonth).padStart(2, '0')}.xml`;
  downloadString(xml, filename, 'application/xml;charset=utf-8');
};

export const getVatReturnXmlString = (data: XmlExportData): string => {
  return buildVatReturnXml(data);
};
