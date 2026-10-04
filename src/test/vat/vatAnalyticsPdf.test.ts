import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateVatAnalyticsPdf, VatAnalyticsPdfOptions } from '../../lib/vatAnalyticsPdf';

describe('Vat Analytics PDF Generator (RLB-60 layout)', () => {
  it('generates a valid A4 Portrait jsPDF instance with groups, subtotals and grand totals', () => {
    const journalMap = new Map<string, string>();
    journalMap.set('E-TXLG-2026-241', 'K26/000212');
    journalMap.set('260700745409', 'S26/000127');

    const options: VatAnalyticsPdfOptions = {
      companyName: 'TAXOLOGY Kft.',
      companyTaxNumber: '14160877-2-43',
      year: 2026,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      viewMode: 'row',
      journalMap,
      groups: [
        {
          code: 'nem_szerepel',
          label: 'Nem szerepel a bevallásban',
          total_net: 26177,
          total_vat: 0,
          total_gross: 26177,
          items: [
            {
              invoice_number: '260700745409',
              partner_name: 'Kifli.hu Shop Kft.',
              line_description: 'DRS csomagolás',
              fulfillment_date: '2026-07-12',
              direction: 'INBOUND',
              code: 'ÁHK',
              net_amount: 26177,
              vat_amount: 0,
              gross_amount: 26177,
            },
          ],
        },
        {
          code: '07',
          label: '07. sor — Belföldi 27%-os értékesítés fizetendő adója',
          total_net: 25000,
          total_vat: 6750,
          total_gross: 31750,
          items: [
            {
              invoice_number: 'E-TXLG-2026-241',
              partner_name: 'RAHIMI Kft.',
              line_description: 'Értékesítés árbevétele',
              fulfillment_date: '2026-07-02',
              direction: 'OUTBOUND',
              code: '25',
              net_amount: 25000,
              vat_amount: 6750,
              gross_amount: 31750,
            },
          ],
        },
        {
          code: '66',
          label: '66. sor — Belföldi 27%-os beszerzés levonható adója',
          total_net: 40820,
          total_vat: 11022,
          total_gross: 51842,
          items: [
            {
              invoice_number: '6331BK26',
              partner_name: 'ICON TECHNOLOGY Kft.',
              line_description: 'Genotherm, lefűzhető',
              fulfillment_date: '2026-07-01',
              direction: 'INBOUND',
              code: '25',
              net_amount: 40820,
              vat_amount: 11022,
              gross_amount: 51842,
            },
          ],
        },
      ],
    };

    const doc = generateVatAnalyticsPdf(options);
    expect(doc).toBeDefined();

    // Check dimensions: A4 Portrait is 210 x 297 mm
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    expect(Math.round(pw)).toBe(210);
    expect(Math.round(ph)).toBe(297);

    // Save to scratch for verification
    const scratchDir = path.resolve(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    fs.writeFileSync(path.join(scratchDir, 'generated_test_afa_lista.pdf'), pdfBuffer);
    expect(fs.existsSync(path.join(scratchDir, 'generated_test_afa_lista.pdf'))).toBe(true);

    // Verify page count is at least 1
    const pageCount = doc.internal.getNumberOfPages();
    expect(pageCount).toBeGreaterThanOrEqual(1);
  });

  it('handles empty groups gracefully without crashing', () => {
    const options: VatAnalyticsPdfOptions = {
      companyName: 'Üres Cég Kft.',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      viewMode: 'row',
      groups: [],
    };

    const doc = generateVatAnalyticsPdf(options);
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBe(1);
  });

  it('handles gyűjtőkód viewMode properly', () => {
    const options: VatAnalyticsPdfOptions = {
      companyName: 'Gyűjtőkód Teszt Kft.',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-31',
      viewMode: 'collector',
      groups: [
        {
          code: '25',
          label: 'Normál belföldi 27%',
          total_net: 100000,
          total_vat: 27000,
          total_gross: 127000,
          items: [
            {
              invoice_number: 'INV-001',
              partner_name: 'Partner Kft.',
              fulfillment_date: '2026-07-15',
              direction: 'OUTBOUND',
              code: '25',
              net_amount: 100000,
              vat_amount: 27000,
              gross_amount: 127000,
            },
          ],
        },
      ],
    };

    const doc = generateVatAnalyticsPdf(options);
    expect(doc).toBeDefined();
    expect(doc.internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
