import { describe, it, expect } from 'vitest';
import { buildVatReturnXml, getVatReturnFilename, convertToEFt, INVOICES_PER_M02_PAGE } from '../vatReturnXml';

describe('vatReturnXml (NAV ÁNYK 2665A / 2665M Generator)', () => {
  it('generates valid ÁNYK XML envelope with correct header, 65A main form, 65M subforms, and positional eazon fields', () => {
    const xml = buildVatReturnXml({
      companyName: 'TS Consult Kft. & Társa',
      companyTaxNumber: '13086905-2-08',
      companyAddress: '9024 Győr, Hunyadi u. 6.',
      periodYear: 2026,
      periodMonth: 7,
      frequency: 'H',
      representativeName: 'Surányi Pál',
      phone: '+36 30 123 4567',
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
          invoice_count: 2,
          base_amount_rounded: 72,
          tax_amount_rounded: 7,
          tax_5_amount: 1,
          tax_18_amount: 0,
          tax_27_amount: 6,
          invoice_details: [
            { invoice_number: 'INV-2026-001', delivery_date: '2026-07-10', net: 32000, vat: 3000 },
            { invoice_number: 'INV-2026-002', delivery_date: '2026-07-20', net: 40000, vat: 4000 },
          ],
        },
      ],
    });

    // Valid XML header, namespace and abev envelope
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<nyomtatvanyok xmlns="http://www.apeh.hu/abev/nyomtatvanyok/2005/01">');
    expect(xml).toContain('<abev>');
    expect(xml).toContain('<hibakszama>0</hibakszama>');

    // Főnyomtatvány: 2665A
    expect(xml).toContain('<nyomtatvanyazonosito>2665A</nyomtatvanyazonosito>');
    expect(xml).toContain('<nyomtatvanyverzio>4.0</nyomtatvanyverzio>');
    expect(xml).toContain('<adoszam>13086905208</adoszam>');
    expect(xml).toContain('<tol>20260701</tol>');
    expect(xml).toContain('<ig>20260731</ig>');

    // 0A Főlap fields
    expect(xml).toContain('<mezo eazon="0A0001E001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E006A">TS Consult Kft. &amp; Társa</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E007A">Surányi Pál</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E008A">36301234567</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F001A">20260701</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F002A">20260731</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F006A">H</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F021A">1</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001I001A">Budapest</mezo>');

    // 0B Fizetendő sorok (pos-coded: 0B0001C{row}BA/CA)
    expect(xml).toContain('<mezo eazon="0B0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001BA">1</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001CA">0</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0007BA">7375</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0007CA">1991</mezo>');

    // 0C Levonható sorok
    expect(xml).toContain('<mezo eazon="0C0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0064BA">17</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0064CA">1</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0066BA">54</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0066CA">6</mezo>');

    // 0D Elszámolás sorok
    expect(xml).toContain('<mezo eazon="0D0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0D0001D0083CA">1984</mezo>');

    // 0F M-lap összesítő
    expect(xml).toContain('<mezo eazon="0F0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0F0001D0105BA">1</mezo>');
    expect(xml).toContain('<mezo eazon="0F0001D0105DA">72</mezo>');
    expect(xml).toContain('<mezo eazon="0F0001D0105EA">7</mezo>');

    // 65M Alnyomtatvány (önálló <nyomtatvany> blokk)
    expect(xml).toContain('<nyomtatvanyazonosito>2665M</nyomtatvanyazonosito>');
    expect(xml).toContain('<albizonylatazonositas>');
    expect(xml).toContain('<megnevezes>Partner &lt;Alpha&gt; Kft.</megnevezes>');
    expect(xml).toContain('<azonosito>12345678</azonosito>');

    // 65M 0A partner összesítő
    expect(xml).toContain('<mezo eazon="0A0001C001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001C005A">12345678</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001C006A">Partner &lt;Alpha&gt; Kft.</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E0004CA">72</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E0004DA">7</mezo>');

    // 65M 0B tételes számlák
    expect(xml).toContain('<mezo eazon="0B0001C0001AA">INV-2026-001</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001BA">20260710</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001CA">32</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001DA">3</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002AA">INV-2026-002</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002BA">20260720</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002CA">40</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002DA">4</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0037CA">72</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0037DA">7</mezo>');

    // Záró gyökércímke
    expect(xml).toContain('</nyomtatvanyok>');
  });

  it('handles undashed 11-digit tax numbers for company and M-lap partners', () => {
    const xml = buildVatReturnXml({
      companyName: 'NoDash Cég',
      companyTaxNumber: '13086905208',
      companyAddress: 'Budapest',
      periodYear: 2026,
      periodMonth: 8,
      frequency: 'H',
      lines: [],
      mLines: [
        {
          partner_name: 'Partner Bt.',
          partner_tax_number: '98765432142',
          invoice_count: 1,
          base_amount_rounded: 100,
          tax_amount_rounded: 27,
          tax_5_amount: 0,
          tax_18_amount: 0,
          tax_27_amount: 27,
        },
      ],
    });

    // Főlap felbontott adószám
    expect(xml).toContain('<mezo eazon="0A0001E001A">13086905208</mezo>');
    // M-lap partner törzsszám (8 karakter)
    expect(xml).toContain('<mezo eazon="0A0001C005A">98765432</mezo>');
  });

  it('correctly encodes Hungarian accented characters and XML escaping without corruption', () => {
    const xml = buildVatReturnXml({
      companyName: 'Árvíztűrő tükörfúrógép Kft. & Fia',
      companyTaxNumber: '11223344-2-13',
      companyAddress: '9021 Győr, Széchenyi tér 1. 2. em. 4/A',
      periodYear: 2026,
      periodMonth: 5,
      frequency: 'H',
      lines: [],
      mLines: [
        {
          partner_name: 'Márvány & Öntvény Építőipari Kkt. <Bp>',
          partner_tax_number: '88776655-1-41',
          invoice_count: 1,
          base_amount_rounded: 500,
          tax_amount_rounded: 135,
          tax_5_amount: 0,
          tax_18_amount: 0,
          tax_27_amount: 135,
        },
      ],
    });

    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml).toContain('Árvíztűrő tükörfúrógép Kft. &amp; Fia');
    expect(xml).toContain('Márvány &amp; Öntvény Építőipari Kkt. &lt;Bp&gt;');

    const filename = getVatReturnFilename({
      companyName: 'Árvíztűrő tükörfúrógép Kft.',
      periodYear: 2026,
      periodMonth: 5,
    });
    expect(filename).toBe('NAV_2665_2026_05_Árvíztűrő_tükörfúrógép_Kft.xml');
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

    expect(xmlQ).toContain('<nyomtatvanyazonosito>2565A</nyomtatvanyazonosito>');
    expect(xmlQ).toContain('<mezo eazon="0A0001F001A">20250401</mezo>');
    expect(xmlQ).toContain('<mezo eazon="0A0001F002A">20250630</mezo>');
    expect(xmlQ).toContain('<mezo eazon="0A0001F006A">N</mezo>');
  });

  it('generates clean filename without trailing dots or double dots for Kft./Bt. company names', () => {
    const filename = getVatReturnFilename({
      companyName: 'TS Consult Kft.',
      periodYear: 2026,
      periodMonth: 7,
    });

    expect(filename).toBe('NAV_2665_2026_07_TS_Consult_Kft.xml');
    expect(filename).not.toContain('..');
  });

  describe('2. Vakfolt: convertToEFt és mikroszámlák kerekítési heurisztikájának kiküszöbölése', () => {
    it('correctly rounds micro-invoices in HUF without mistakenly treating them as E Ft', () => {
      // 450 Ft net -> 0 E Ft (Math.round(450 / 1000) = 0), NOT 450 E Ft!
      expect(convertToEFt(450)).toBe(0);
      expect(convertToEFt(500)).toBe(1);
      expect(convertToEFt(122)).toBe(0);
      expect(convertToEFt(567000)).toBe(567);
      expect(convertToEFt(153000)).toBe(153);
    });

    it('preserves already E Ft values when explicitly flagged', () => {
      expect(convertToEFt(32, true)).toBe(32);
      expect(convertToEFt(450, true)).toBe(450);
    });

    it('exports micro-invoices (< 500 Ft) as 0 E Ft in XML rather than 450 E Ft', () => {
      const xml = buildVatReturnXml({
        companyName: 'Micro Test Kft.',
        companyTaxNumber: '11223344-1-01',
        companyAddress: 'Budapest',
        periodYear: 2026,
        periodMonth: 7,
        frequency: 'H',
        lines: [],
        mLines: [
          {
            partner_name: 'Micro Partner Kft.',
            partner_tax_number: '99887766-2-41',
            invoice_count: 1,
            base_amount_rounded: 0,
            tax_amount_rounded: 0,
            invoice_details: [
              {
                invoice_number: 'MICRO-001',
                delivery_date: '2026-07-05',
                net: 450, // 450 Ft
                vat: 122, // 122 Ft
              },
            ],
          },
        ],
      });

      // Net and VAT on M-02 lap should be 0, not 450
      expect(xml).toContain('<mezo eazon="0B0001C0001CA">0</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0001DA">0</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037CA">0</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037DA">0</mezo>');
      expect(xml).not.toContain('<mezo eazon="0B0001C0001CA">450</mezo>');
    });
  });

  describe('1. Vakfolt: M-02 alnyomtatvány tördelése 36 számlánál nagyobb tételeknél', () => {
    it('chunks invoices into multiple 0B pages when a partner has more than 36 invoices', () => {
      expect(INVOICES_PER_M02_PAGE).toBe(36);

      // Generate 40 invoices for a single partner
      const invoiceDetails = Array.from({ length: 40 }, (_, idx) => ({
        invoice_number: `INV-PAGE-${String(idx + 1).padStart(3, '0')}`,
        delivery_date: '2026-07-15',
        net: 10000, // 10 E Ft each
        vat: 2700,  // 3 E Ft (rounded) each (2700 / 1000 = 2.7 -> 3)
      }));

      const xml = buildVatReturnXml({
        companyName: 'High Volume Kft.',
        companyTaxNumber: '33445566-2-13',
        companyAddress: 'Budapest',
        periodYear: 2026,
        periodMonth: 7,
        frequency: 'H',
        lines: [],
        mLines: [
          {
            partner_name: 'Big Supplier Zrt.',
            partner_tax_number: '88776655-2-42',
            invoice_count: 40,
            base_amount_rounded: 400,
            tax_amount_rounded: 120,
            invoice_details: invoiceDetails,
          },
        ],
      });

      // 1. Oldal (0B0001): 1..36. számlák
      expect(xml).toContain('<mezo eazon="0B0001B001A">1</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0001AA">INV-PAGE-001</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0036AA">INV-PAGE-036</mezo>');
      // 1. Oldal összesítő (36 * 10 = 360, 36 * 3 = 108)
      expect(xml).toContain('<mezo eazon="0B0001C0037CA">360</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037DA">108</mezo>');

      // 2. Oldal (0B0002): 37..40. számlák (a 2. oldalon a sorszám újra 0001..0004)
      expect(xml).toContain('<mezo eazon="0B0002B001A">2</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0001AA">INV-PAGE-037</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0004AA">INV-PAGE-040</mezo>');
      // 2. Oldal összesítő (4 * 10 = 40, 4 * 3 = 12)
      expect(xml).toContain('<mezo eazon="0B0002C0037CA">40</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0037DA">12</mezo>');

      // Partner 0A összefoglaló: 40 számla, összesen 360 + 40 = 400 net, 108 + 12 = 120 vat
      expect(xml).toContain('<mezo eazon="0A0001E0004BA">40</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004CA">400</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004DA">120</mezo>');

      // Főlap 0F összesítő: 40 számla, 400 net, 120 vat
      expect(xml).toContain('<mezo eazon="0F0001D0105CA">40</mezo>');
      expect(xml).toContain('<mezo eazon="0F0001D0105DA">400</mezo>');
      expect(xml).toContain('<mezo eazon="0F0001D0105EA">120</mezo>');
    });
  });
});


