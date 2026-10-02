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
        { row_number: '66', base_amount_rounded: 22, tax_amount_rounded: 6 },
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
    expect(xml).toContain('<nyomtatvanyverzio>2.0</nyomtatvanyverzio>');
    expect(xml).toContain('<adoszam>13086905208</adoszam>');
    expect(xml).toContain('<tol>20260701</tol>');
    expect(xml).toContain('<ig>20260731</ig>');

    // 0A Főlap fields:
    // E001A: adószám, E007A: adózó neve, E008A: ügyintéző neve, E009A: ügyintéző telefonszáma
    // E006A (adózói státusz) sosem tartalmazhat cégnevet!
    expect(xml).toContain('<mezo eazon="0A0001E001A">13086905208</mezo>');
    expect(xml).not.toContain('0A0001E006A');
    expect(xml).toContain('<mezo eazon="0A0001E007A">TS Consult Kft. &amp; Társa</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E008A">Surányi Pál</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001E009A">36301234567</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F001A">20260701</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F002A">20260731</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F006A">H</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001F021A">1</mezo>');
    expect(xml).toContain('<mezo eazon="0A0001I001A">Budapest</mezo>');

    // 0B Fizetendő sorok (pos-coded: 0B0001C{row}BA/CA)
    expect(xml).toContain('<mezo eazon="0B0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001BA">1</mezo>');
    // 01. sor adómentes export a 65A főlapon: a NAV ÁNYK sablon nem tartalmaz CA mezőt (0B0001C0001CA)
    const mainFormXml = xml.split('<nyomtatvanyazonosito>2665M')[0];
    expect(mainFormXml).not.toContain('0B0001C0001CA');
    expect(xml).toContain('<mezo eazon="0B0001C0007BA">7375</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0007CA">1991</mezo>');

    // 0C Levonható sorok
    expect(xml).toContain('<mezo eazon="0C0001B001A">13086905208</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0064BA">17</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0064CA">1</mezo>');
    expect(xml).toContain('<mezo eazon="0C0001C0066BA">22</mezo>');
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

    // 65M 0B tételes számlák (forintban a 65M-02 előírásai szerint)
    expect(xml).toContain('<mezo eazon="0B0001C0001AA">INV-2026-001</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001BA">20260710</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001CA">32000</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0001DA">3000</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002AA">INV-2026-002</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002BA">20260720</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002CA">40000</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0002DA">4000</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0037CA">72000</mezo>');
    expect(xml).toContain('<mezo eazon="0B0001C0037DA">7000</mezo>');

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
          partner_tax_number: '98765432242',
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
          partner_tax_number: '88776655-2-41',
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

      // On M-02 lap, exact HUF (450 Ft and 122 Ft) is preserved; on M-01 lap it rounds to 0 E Ft
      expect(xml).toContain('<mezo eazon="0B0001C0001CA">450</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0001DA">122</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037CA">450</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037DA">122</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004CA">0</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004DA">0</mezo>');
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
      // 1. Oldal összesítő forintban (36 * 10000 = 360000, 36 * 2700 = 97200)
      expect(xml).toContain('<mezo eazon="0B0001C0037CA">360000</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0037DA">97200</mezo>');

      // 2. Oldal (0B0002): 37..40. számlák (a 2. oldalon a sorszám újra 0001..0004)
      expect(xml).toContain('<mezo eazon="0B0002B001A">2</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0001AA">INV-PAGE-037</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0004AA">INV-PAGE-040</mezo>');
      // 2. Oldal összesítő forintban (4 * 10000 = 40000, 4 * 2700 = 10800)
      expect(xml).toContain('<mezo eazon="0B0002C0037CA">40000</mezo>');
      expect(xml).toContain('<mezo eazon="0B0002C0037DA">10800</mezo>');

      // Partner 0A összefoglaló ezer forintban: 40 számla, összesen (360000 + 40000) / 1000 = 400 eFt net, (97200 + 10800) / 1000 = 108 eFt vat
      expect(xml).toContain('<mezo eazon="0A0001E0004BA">40</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004CA">400</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004DA">108</mezo>');

      // Főlap 0F összesítő ezer forintban: 40 számla, 400 net, 108 vat
      expect(xml).toContain('<mezo eazon="0F0001D0105CA">40</mezo>');
      expect(xml).toContain('<mezo eazon="0F0001D0105DA">400</mezo>');
      expect(xml).toContain('<mezo eazon="0F0001D0105EA">108</mezo>');
    });
  });

  describe('Row 66 validation and exclusion of invalid 0C0001C0066DA', () => {
    it('does not emit non-existent 0C0001C0066DA even if 66_fad line is provided', () => {
      const xml = buildVatReturnXml({
        companyName: 'Test FAD Kft',
        companyTaxNumber: '12345678-2-41',
        companyAddress: 'Budapest',
        periodYear: 2026,
        periodMonth: 2,
        frequency: 'H',
        lines: [
          { row_number: '66', base_amount_rounded: 262, tax_amount_rounded: 71 },
          { row_number: '66_fad', base_amount_rounded: 100, tax_amount_rounded: 27 },
        ],
        mLines: [],
      });

      expect(xml).toContain('<mezo eazon="0C0001C0066BA">262</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0066CA">71</mezo>');
      expect(xml).not.toContain('0C0001C0066DA');
    });

    it('emits row 29 on 0B and row 66 on 0C without invalid DA field', () => {
      const xml = buildVatReturnXml({
        companyName: 'Test FAD Kft',
        companyTaxNumber: '12345678-2-41',
        companyAddress: 'Budapest',
        periodYear: 2026,
        periodMonth: 2,
        frequency: 'H',
        lines: [
          { row_number: '29', base_amount_rounded: 100, tax_amount_rounded: 27 },
          { row_number: '66', base_amount_rounded: 262, tax_amount_rounded: 71 },
        ],
        mLines: [],
      });

      expect(xml).toContain('<mezo eazon="0B0001C0029BA">100</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0029CA">27</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0066BA">262</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0066CA">71</mezo>');
      expect(xml).not.toContain('0C0001C0066DA');
    });
  });

  describe('EB-0044: Exclude CA tax field for tax-exempt rows on 0B (01, 02, 03, 04, 08, 11, 17, 23) and 0C (63)', () => {
    it('does not emit CA field for row 01 (export) even if tax_amount_rounded is 0', () => {
      const xml = buildVatReturnXml({
        companyName: 'TS Consult Kft.',
        companyTaxNumber: '13086905-2-08',
        companyAddress: '9024 Győr, Hunyadi u. 6.',
        periodYear: 2026,
        periodMonth: 8,
        frequency: 'H',
        lines: [
          { row_number: '01', base_amount_rounded: 277, tax_amount_rounded: 0 },
          { row_number: '07', base_amount_rounded: 7159, tax_amount_rounded: 1933 },
          { row_number: '36', base_amount_rounded: 7436, tax_amount_rounded: 1933 },
          { row_number: '63', base_amount_rounded: 50, tax_amount_rounded: 0 },
          { row_number: '64', base_amount_rounded: 20, tax_amount_rounded: 1 },
          { row_number: '66', base_amount_rounded: 216, tax_amount_rounded: 58 },
          { row_number: '76', base_amount_rounded: 236, tax_amount_rounded: 59 },
          { row_number: '83', base_amount_rounded: 0, tax_amount_rounded: 1874 },
        ],
        mLines: [],
      });

      // 2026 form version is 2.0
      expect(xml).toContain('<nyomtatvanyverzio>2.0</nyomtatvanyverzio>');

      // Row 01 base is present, CA is NEVER emitted
      expect(xml).toContain('<mezo eazon="0B0001C0001BA">277</mezo>');
      expect(xml).not.toContain('0B0001C0001CA');

      // Row 63 base is present, CA is NEVER emitted
      expect(xml).toContain('<mezo eazon="0C0001C0063BA">50</mezo>');
      expect(xml).not.toContain('0C0001C0063CA');

      // Taxable rows (07, 36, 64, 66) have CA
      expect(xml).toContain('<mezo eazon="0B0001C0007CA">1933</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0036CA">1933</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0064CA">1</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0066CA">58</mezo>');
    });

    it('formats phone numbers properly with formatAnykPhoneNumber', async () => {
      const { formatAnykPhoneNumber } = await import('../vatReturnXml');
      expect(formatAnykPhoneNumber('+36 30 123 4567')).toBe('36301234567');
      expect(formatAnykPhoneNumber('06 70 424 0024')).toBe('36704240024');
      expect(formatAnykPhoneNumber('06301234567')).toBe('36301234567');
      expect(formatAnykPhoneNumber('36704240024')).toBe('36704240024');
      expect(formatAnykPhoneNumber(undefined)).toBe('');
    });

    it('strictly conforms to think_ai_2465_11.xml reference structure with representative and overrides', () => {
      const xml = buildVatReturnXml({
        companyName: '  THINK AI Kft.  ',
        companyTaxNumber: '32478620-2-43',
        companyAddress: '1052 Budapest, Petőfi Sándor u. 11.',
        periodYear: 2024,
        periodMonth: 11,
        frequency: 'H',
        representativeName: 'Jámbor Viktor',
        phone: '06 70 424 0024',
        formIdOverride: '2465',
        formVersionOverride: '4.0',
        lines: [
          { row_number: '07', base_amount_rounded: 1325, tax_amount_rounded: 358 },
          { row_number: '27', base_amount_rounded: 142, tax_amount_rounded: 38 },
          { row_number: '36', base_amount_rounded: 1467, tax_amount_rounded: 396 },
          { row_number: '45', base_amount_rounded: 1225, tax_amount_rounded: 331 },
          { row_number: '63', base_amount_rounded: 94, tax_amount_rounded: 0 },
          { row_number: '64', base_amount_rounded: 9, tax_amount_rounded: 0 },
          { row_number: '66', base_amount_rounded: 638, tax_amount_rounded: 172 },
          { row_number: '67', base_amount_rounded: 142, tax_amount_rounded: 38 },
          { row_number: '76', base_amount_rounded: 883, tax_amount_rounded: 210 },
          { row_number: '82', base_amount_rounded: 0, tax_amount_rounded: 0 },
          { row_number: '83', base_amount_rounded: 0, tax_amount_rounded: 186 },
          { row_number: '84', base_amount_rounded: 0, tax_amount_rounded: 186 },
        ],
        mLines: [],
      });

      // Form ID & Version overrides
      expect(xml).toContain('<nyomtatvanyazonosito>2465A</nyomtatvanyazonosito>');
      expect(xml).toContain('<nyomtatvanyverzio>4.0</nyomtatvanyverzio>');

      // Consistency between header and 0A sheet: trimmed company name on E007A (not E006A)
      expect(xml).toContain('<nev>THINK AI Kft.</nev>');
      expect(xml).toContain('<megjegyzes>THINK AI Kft. - Áfa bevallás</megjegyzes>');
      expect(xml).not.toContain('0A0001E006A');
      expect(xml).toContain('<mezo eazon="0A0001E007A">THINK AI Kft.</mezo>');

      // Mandatory representative fields on E008A and E009A
      expect(xml).toContain('<mezo eazon="0A0001E008A">Jámbor Viktor</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E009A">36704240024</mezo>');
    });
  });

  describe('ÁNYK validation rules: auto-computed row 36, row 76, row 83, row 109 and row 66 rate consistency', () => {
    it('resolves rounding mismatch between details and totals, adjusts row 66 tax, and computes row 109 (Taxology July 2026 case)', () => {
      const xml = buildVatReturnXml({
        companyName: 'Taxology Kft.',
        companyTaxNumber: '12345678-2-41',
        companyAddress: 'Budapest',
        periodYear: 2026,
        periodMonth: 7,
        frequency: 'H',
        lines: [
          // 0B sheet details
          { row_number: '07', base_amount_rounded: 3702, tax_amount_rounded: 1000 },
          { row_number: '18', base_amount_rounded: 31, tax_amount_rounded: 8 },
          { row_number: '27', base_amount_rounded: 7, tax_amount_rounded: 2 },
          { row_number: '29', base_amount_rounded: 13, tax_amount_rounded: 2 },
          // Summary row 36 in input has the unadjusted sum-then-round value from DB
          { row_number: '36', base_amount_rounded: 3752, tax_amount_rounded: 1013 },

          // 0C sheet details
          { row_number: '63', base_amount_rounded: 222, tax_amount_rounded: 0 },
          { row_number: '64', base_amount_rounded: 5, tax_amount_rounded: 0 },
          { row_number: '66', base_amount_rounded: 2528, tax_amount_rounded: 680 }, // deviates from 27% (683)
          { row_number: '67', base_amount_rounded: 38, tax_amount_rounded: 10 },
          // Summary row 76 in input has the unadjusted sum-then-round value from DB
          { row_number: '76', base_amount_rounded: 2794, tax_amount_rounded: 690 },

          // 0D sheet
          { row_number: '82', base_amount_rounded: 0, tax_amount_rounded: 0 },
          { row_number: '83', base_amount_rounded: 0, tax_amount_rounded: 323 },
          { row_number: '84', base_amount_rounded: 0, tax_amount_rounded: 323 },
        ],
        mLines: [
          {
            partner_tax_number: '98765432-1-42',
            partner_name: 'Partner Kft',
            invoice_count: 5,
            base_amount_rounded: 2000,
            tax_amount_rounded: 540,
            invoice_items: [],
          },
        ],
      });

      // 1. ÁNYK 1087150/R621 & 1087151/R622: Row 36 must equal detail sums (3753 / 1012), not DB raw (3752 / 1013)
      expect(xml).toContain('<mezo eazon="0B0001C0036BA">3753</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0036CA">1012</mezo>');
      expect(xml).not.toContain('<mezo eazon="0B0001C0036BA">3752</mezo>');
      expect(xml).not.toContain('<mezo eazon="0B0001C0036CA">1013</mezo>');

      // 2. ÁNYK 1087305/R914: Row 66c must strictly equal 27% of row 66b (2528 * 0.27 = 683)
      expect(xml).toContain('<mezo eazon="0C0001C0066BA">2528</mezo>');
      expect(xml).toContain('<mezo eazon="0C0001C0066CA">683</mezo>');
      expect(xml).not.toContain('<mezo eazon="0C0001C0066CA">680</mezo>');

      // 3. Template issue: 0C0001C0066DA must never be emitted
      expect(xml).not.toContain('0C0001C0066DA');

      // 4. ÁNYK 1087248/R767: Row 76 must equal deductible detail sums (2793 / 693), not DB raw (2794 / 690)
      expect(xml).toContain('<mezo eazon="0D0001C0076BA">2793</mezo>');
      expect(xml).toContain('<mezo eazon="0D0001C0076CA">693</mezo>');
      expect(xml).not.toContain('<mezo eazon="0D0001C0076BA">2794</mezo>');

      // 5. Settlement row 83 & 84: 1012 - 693 = 319
      expect(xml).toContain('<mezo eazon="0D0001D0083CA">319</mezo>');
      expect(xml).toContain('<mezo eazon="0D0001D0084CA">319</mezo>');

      // 6. ÁNYK 1095069/R975: Row 109c = 64c + 65c + 66c + 68c = 0 + 0 + 683 + 0 = 683 (NOT mTotalTax which is 540)
      expect(xml).toContain('<mezo eazon="0F0001D0109CA">683</mezo>');
      expect(xml).not.toContain('<mezo eazon="0F0001D0109CA">540</mezo>');
    });
  });
});


