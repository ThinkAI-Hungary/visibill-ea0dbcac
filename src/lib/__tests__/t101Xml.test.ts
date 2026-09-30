import { describe, it, expect } from 'vitest';
import { buildT101Xml } from '../t101Xml';

describe('NAV T101 ÁNYK XML Builder (Adat- és Változásbejelentő)', () => {
  const baseData = {
    companyName: 'Nagy & Fiai Egyéni Vállalkozás',
    companyTaxNumber: '87654321-1-43',
    companyAddress: '4025 Debrecen, Piac utca 12.',
    selectedRegime: 'exempt' as const,
    declarationDate: '2026-01-01',
  };

  it('generates proper ÁNYK form identifier matching the current year (e.g. 26T101)', () => {
    const xml = buildT101Xml(baseData);
    const year2Digits = new Date().getFullYear() % 100;

    expect(xml).toContain(`nyomtatvanyazonosito>${year2Digits}T101</nyomtatvanyazonosito>`);
    expect(xml).toContain('<nyomtatvanyok xmlns="http://iop.gov.hu/2007/01/nyk/altalanosnyomtatvany">');
  });

  it('correctly maps VAT regimes (alanyi_mentes, altalanos_szabalyok, penzforgalmi_afa)', () => {
    const exemptXml = buildT101Xml({ ...baseData, selectedRegime: 'exempt' });
    expect(exemptXml).toContain('<mezo eazon="02_0002_valasztott_afa_mod">alanyi_mentes</mezo>');

    const standardXml = buildT101Xml({ ...baseData, selectedRegime: 'standard' });
    expect(standardXml).toContain('<mezo eazon="02_0002_valasztott_afa_mod">altalanos_szabalyok</mezo>');

    const cashBasisXml = buildT101Xml({ ...baseData, selectedRegime: 'cash_basis' });
    expect(cashBasisXml).toContain('<mezo eazon="02_0002_valasztott_afa_mod">penzforgalmi_afa</mezo>');
  });

  it('escapes XML special characters in metadata', () => {
    const xml = buildT101Xml(baseData);
    expect(xml).toContain('Nagy &amp; Fiai Egyéni Vállalkozás');
  });

  it('breaks down the tax number into base, vat, and county codes', () => {
    const xml = buildT101Xml(baseData);

    expect(xml).toContain('<mezo eazon="01_0001_adoszam_torzs">87654321</mezo>');
    expect(xml).toContain('<mezo eazon="01_0002_adoszam_afa">1</mezo>');
    expect(xml).toContain('<mezo eazon="01_0003_adoszam_megye">43</mezo>');
  });
});
