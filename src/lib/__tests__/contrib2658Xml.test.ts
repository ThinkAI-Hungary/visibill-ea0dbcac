import { describe, it, expect } from 'vitest';
import { buildContrib2658Xml, type Contrib2658Data } from '../contrib2658Xml';

describe('NAV 2658 ÁNYK XML Builder (TB Járulékbevallás)', () => {
  const baseData: Contrib2658Data = {
    companyName: 'Kovács & Társa Bt.',
    companyTaxNumber: '12345678-2-41',
    periodYear: 2026,
    periodQuarter: 1,
    tbBase: 968400,
    tbAmount: 179154,
    szochoBase: 968400,
    szochoAmount: 125892,
    isFoallasu: true,
    taxId: '8401011234',
    address: '1054 Budapest, Hold utca 1.',
    email: 'kovacs@gmail.com',
    phone: '+36 20 111 2233',
  };

  it('generates valid ÁNYK envelope with year-specific form ID (2658)', () => {
    const xml = buildContrib2658Xml(baseData);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<nyomtatvanyazonosito>2658</nyomtatvanyazonosito>');
    expect(xml).toContain('<nyomtatvanyok xmlns="http://iop.gov.hu/2007/01/nyk/altalanosnyomtatvany">');
  });

  it('parses and formats Hungarian tax number into trunk, vat, and county segments', () => {
    const xml = buildContrib2658Xml(baseData);

    expect(xml).toContain('<mezo eazon="01_0001_adoszam_torzs">12345678</mezo>');
    expect(xml).toContain('<mezo eazon="01_0002_adoszam_afa">2</mezo>');
    expect(xml).toContain('<mezo eazon="01_0003_adoszam_megye">41</mezo>');
    expect(xml).toContain('<mezo eazon="01_0004_adoszam_teljes">12345678-2-41</mezo>');
  });

  it('calculates quarterly period ranges correctly for Q1, Q2, Q3, Q4', () => {
    const q1Xml = buildContrib2658Xml({ ...baseData, periodQuarter: 1 });
    expect(q1Xml).toContain('<mezo eazon="01_0011_idoszak_tol">2026-01-01</mezo>');
    expect(q1Xml).toContain('<mezo eazon="01_0012_idoszak_ig">2026-03-31</mezo>');

    const q2Xml = buildContrib2658Xml({ ...baseData, periodQuarter: 2 });
    expect(q2Xml).toContain('<mezo eazon="01_0011_idoszak_tol">2026-04-01</mezo>');
    expect(q2Xml).toContain('<mezo eazon="01_0012_idoszak_ig">2026-06-30</mezo>');

    const q3Xml = buildContrib2658Xml({ ...baseData, periodQuarter: 3 });
    expect(q3Xml).toContain('<mezo eazon="01_0011_idoszak_tol">2026-07-01</mezo>');
    expect(q3Xml).toContain('<mezo eazon="01_0012_idoszak_ig">2026-09-30</mezo>');

    const q4Xml = buildContrib2658Xml({ ...baseData, periodQuarter: 4 });
    expect(q4Xml).toContain('<mezo eazon="01_0011_idoszak_tol">2026-10-01</mezo>');
    expect(q4Xml).toContain('<mezo eazon="01_0012_idoszak_ig">2026-12-31</mezo>');
  });

  it('formats contribution amounts and calculates total liability', () => {
    const xml = buildContrib2658Xml(baseData);

    expect(xml).toContain('<mezo eazon="02_0001_tb_jarulekalap">968400</mezo>');
    expect(xml).toContain('<mezo eazon="02_0002_tb_jarulekosszeg">179154</mezo>');
    expect(xml).toContain('<mezo eazon="02_0003_szocho_alap">968400</mezo>');
    expect(xml).toContain('<mezo eazon="02_0004_szocho_osszeg">125892</mezo>');
    // Total = 179,154 + 125,892 = 305,046
    expect(xml).toContain('<mezo eazon="02_0005_osszesen_fizetendo">305046</mezo>');
  });

  it('escapes XML special characters in company name and address', () => {
    const xml = buildContrib2658Xml(baseData);
    expect(xml).toContain('Kovács &amp; Társa Bt.');
  });
});
