import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildVatReturnHtml,
  generateVatReturnPreviewUrl,
  type VatReturnPdfData,
} from '../vatReturnPdf';

describe('VAT Return PDF / HTML Exporter (ÁFA 2665 Nyomtatvány)', () => {
  const baseData: VatReturnPdfData = {
    companyName: 'Alfa & Béta Szolgáltató Kft.',
    companyTaxNumber: '11223344-2-42',
    companyAddress: '1111 Budapest, Fő utca 10.',
    periodYear: 2026,
    periodMonth: 3,
    frequency: 'H', // monthly
    formRows: [
      {
        row_number: '01',
        label: '27%-os adókulcs alá tartozó értékesítés',
        section: 'payable',
        has_base: true,
        has_tax: true,
        is_summary: false,
        sort_order: 1,
      },
      {
        row_number: '20',
        label: 'Fizetendő adó összesen',
        section: 'payable',
        has_base: true,
        has_tax: true,
        is_summary: true,
        sort_order: 20,
      },
      {
        row_number: '64',
        label: '27%-os levonható adó tárgyi eszközök után',
        section: 'deductible',
        has_base: true,
        has_tax: true,
        is_summary: false,
        sort_order: 64,
      },
      {
        row_number: '80',
        label: 'Levonható adó összesen',
        section: 'deductible',
        has_base: true,
        has_tax: true,
        is_summary: true,
        sort_order: 80,
      },
      {
        row_number: '85',
        label: 'Fizetendő vagy visszaigényelhető adó',
        section: 'settlement',
        has_base: false,
        has_tax: true,
        is_summary: true,
        sort_order: 85,
      },
    ],
    lines: [
      {
        row_number: '01',
        base_amount_rounded: 10000, // 10,000 eFt = 10M Ft
        tax_amount_rounded: 2700,   // 2,700 eFt = 2.7M Ft
        is_calculated: false,
      },
      {
        row_number: '20',
        base_amount_rounded: 10000,
        tax_amount_rounded: 2700,
        is_calculated: true,
      },
      {
        row_number: '64',
        base_amount_rounded: 4000,
        tax_amount_rounded: 1080,
        is_calculated: false,
      },
      {
        row_number: '80',
        base_amount_rounded: 4000,
        tax_amount_rounded: 1080,
        is_calculated: true,
      },
      {
        row_number: '85',
        base_amount_rounded: null,
        tax_amount_rounded: 1620, // 2700 - 1080
        is_calculated: true,
      },
    ],
    mLines: [
      {
        partner_name: 'Beszállító & Fia Zrt.',
        partner_tax_number: '99887766-2-41',
        invoice_count: 5,
        base_amount_rounded: 4000,
        tax_amount_rounded: 1080,
        tax_5_amount: 0,
        tax_18_amount: 0,
        tax_27_amount: 1080,
      },
    ],
  };

  it('generates HTML with properly formatted monthly period title', () => {
    const html = buildVatReturnHtml(baseData);

    expect(html).toContain('ÁFA Bevallás 2665 — 2026. március hó');
    expect(html).toContain('2026. március hó');
  });

  it('formats quarterly frequency label correctly', () => {
    const qData: VatReturnPdfData = {
      ...baseData,
      frequency: 'N',
      periodMonth: 6, // Q2
    };
    const html = buildVatReturnHtml(qData);

    expect(html).toContain('2026. 2. negyedév');
  });

  it('formats annual frequency label correctly', () => {
    const aData: VatReturnPdfData = {
      ...baseData,
      frequency: 'E',
    };
    const html = buildVatReturnHtml(aData);

    expect(html).toContain('2026. év');
  });

  it('escapes company information and includes tax number', () => {
    const html = buildVatReturnHtml(baseData);

    expect(html).toContain('Alfa &amp; Béta Szolgáltató Kft.');
    expect(html).toContain('11223344-2-42');
    expect(html).toContain('1111 Budapest, Fő utca 10.');
  });

  it('formats thousands with Hungarian space grouping (e.g. 10 000 eFt)', () => {
    const html = buildVatReturnHtml(baseData);

    expect(html).toContain('10 000');
    expect(html).toContain('2 700');
    expect(html).toContain('1 620');
  });

  it('renders section headers and row classes (summary-row)', () => {
    const html = buildVatReturnHtml(baseData);

    expect(html).toContain('I. A FIZETENDŐ ADÓ MEGÁLLAPÍTÁSA');
    expect(html).toContain('III. A LEVONHATÓ ADÓ MEGÁLLAPÍTÁSA');
    expect(html).toContain('IV. ELSZÁMOLÁS');
    expect(html).toContain('class="summary-row "');
  });

  it('renders M-Lap partner table with counts and amounts', () => {
    const html = buildVatReturnHtml(baseData);

    expect(html).toContain('Beszállító &amp; Fia Zrt.');
    expect(html).toContain('99887766-2-41');
    expect(html).toContain('<td class="num">5</td>');
    expect(html).toContain('<td class="num">4 000</td>');
    expect(html).toContain('<td class="num">1 080</td>');
  });

  it('renders no-data message when M-Lap has no invoices', () => {
    const emptyMData: VatReturnPdfData = {
      ...baseData,
      mLines: [],
    };
    const html = buildVatReturnHtml(emptyMData);

    expect(html).toContain('Nincs belföldi levonható számla az időszakban.');
  });

  it('generateVatReturnPreviewUrl generates a blob URL string', () => {
    const blobUrl = generateVatReturnPreviewUrl(baseData);
    expect(typeof blobUrl).toBe('string');
  });
});
