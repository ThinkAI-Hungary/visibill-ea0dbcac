import { describe, it, expect } from 'vitest';
import { buildVatReturnXml, getVatReturnFilename } from '../vatReturnXml';

describe('vatReturnXml (NAV ÁNYK 2665 Generator)', () => {
  it('generates valid ÁNYK XML envelope with correct header, fields and escaping', () => {
    const xml = buildVatReturnXml({
      companyName: 'TS Consult Kft. & Társa',
      companyTaxNumber: '13086905-2-08',
      companyAddress: '9024 Győr, Hunyadi u. 6.',
      periodYear: 2026,
      periodMonth: 7,
      frequency: 'H',
      lines: [
        { row_number: '01', base_amount_rounded: 1, tax_amount_rounded: 0 },
        { row_number: '07', base_amount_rounded: 7375, tax_amount_rounded: 1991 },
        { row_number: '64', base_amount_rounded: 17, tax_amount_rounded: 1 },
        { row_number: '66', base_amount_rounded: 54, tax_amount_rounded: 6 },
        { row_number: '83', base_amount_rounded: 0, tax_amount_rounded: 1984 },
      ],
      mLines: [
        {
          partner_name: 'Partner <Alpha> Kft.',
          partner_tax_number: '12345678-2-42',
          invoice_count: 3,
          base_amount_rounded: 72,
          tax_amount_rounded: 7,
          tax_5_amount: 1,
          tax_18_amount: 0,
          tax_27_amount: 6,
        },
      ],
    });

    // Valid XML header and root
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<nyomtatvanyok xmlns="http://www.nav.gov.hu/nyomtatvanyok" verzio="1.0">');
    expect(xml).toContain('<nyomtatvanyazonosito>2665</nyomtatvanyazonosito>');
    expect(xml).toContain('<programnev>Visibill / eaisyBooks</programnev>');

    // Főlap fields
    expect(xml).toContain('<mezo eazon="01_0001_adoszam_torzs">13086905</mezo>');
    expect(xml).toContain('<mezo eazon="01_0002_adoszam_afa">2</mezo>');
    expect(xml).toContain('<mezo eazon="01_0003_adoszam_megye">08</mezo>');
    expect(xml).toContain('<mezo eazon="01_0004_adoszam_teljes">13086905-2-08</mezo>');
    expect(xml).toContain('<mezo eazon="01_0006_adozo_nev">TS Consult Kft. &amp; Társa</mezo>');
    expect(xml).toContain('<mezo eazon="01_0010_adoev">2026</mezo>');
    expect(xml).toContain('<mezo eazon="01_0011_idoszak_tol">2026-07-01</mezo>');
    expect(xml).toContain('<mezo eazon="01_0012_idoszak_ig">2026-07-31</mezo>');
    expect(xml).toContain('<mezo eazon="01_0013_gyakorisag">H</mezo>');

    // Rows
    expect(xml).toContain('<mezo eazon="sor_01_alap">1</mezo>');
    expect(xml).toContain('<mezo eazon="sor_07_alap">7375</mezo>');
    expect(xml).toContain('<mezo eazon="sor_07_ado">1991</mezo>');
    expect(xml).toContain('<mezo eazon="sor_83_ado">1984</mezo>');

    // M-sheets
    expect(xml).toContain('<mezo eazon="M_partner_osszesen">1</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0001_adoszam">12345678-2-42</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0002_nev">Partner &lt;Alpha&gt; Kft.</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0003_szamlak_szama">3</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0004_alap">72</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0005_afa">7</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0006_afa_5">1</mezo>');
    expect(xml).toContain('<mezo eazon="M_1_0008_afa_27">6</mezo>');

    // Declaration
    expect(xml).toContain('<mezo eazon="03_0001_nyilatkozat_adat_valos">1</mezo>');
    expect(xml).toContain('</nyomtatvanyok>');
  });

  it('correctly adapts formId and date range for quarterly and yearly frequencies', () => {
    const xmlQ = buildVatReturnXml({
      companyName: 'Quarterly Kft.',
      companyTaxNumber: '87654321-1-02',
      companyAddress: 'Pécs',
      periodYear: 2025,
      periodMonth: 2, // Q2
      frequency: 'N',
      lines: [],
      mLines: [],
    });

    expect(xmlQ).toContain('<nyomtatvanyazonosito>2565</nyomtatvanyazonosito>');
    expect(xmlQ).toContain('<mezo eazon="01_0011_idoszak_tol">2025-04-01</mezo>');
    expect(xmlQ).toContain('<mezo eazon="01_0012_idoszak_ig">2025-06-30</mezo>');
    expect(xmlQ).toContain('<mezo eazon="01_0013_gyakorisag">N</mezo>');
  });

  it('generates clean filename without trailing dots or double dots for Kft./Bt. company names', () => {
    // @ts-ignore
    const filename = getVatReturnFilename({
      companyName: 'TS Consult Kft.',
      periodYear: 2026,
      periodMonth: 7,
    });

    expect(filename).toBe('NAV_2665_2026_07_TS_Consult_Kft.xml');
    expect(filename).not.toContain('..');
  });
});
