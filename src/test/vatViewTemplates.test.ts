import { describe, it, expect, vi, beforeEach } from 'vitest';
import { inferVatField, parseVatTemplateFile, MAX_VAT_TEMPLATE_COLUMNS } from '@/lib/vatTemplateParser';
import { BUILTIN_VAT_TEMPLATES } from '@/hooks/useVatViewTemplates';
import { exportVatJournalExcel, exportVatJournalCsv, VatJournalExportItem } from '@/lib/vatExport';
import type { VatViewTemplate } from '@/types/vatTemplate';

describe('VAT View Templates - Parser & Inference', () => {
  it('correctly infers VAT field types from Hungarian and English header labels', () => {
    // Invoice number
    expect(inferVatField('Bizonylatszám').field).toBe('invoiceNumber');
    expect(inferVatField('Számlaszám').field).toBe('invoiceNumber');
    expect(inferVatField('Invoice Number').field).toBe('invoiceNumber');
    expect(inferVatField('Doc Num').field).toBe('invoiceNumber');

    // Partner
    expect(inferVatField('Partner neve').field).toBe('partnerName');
    expect(inferVatField('Partner').field).toBe('partnerName');
    expect(inferVatField('Customer').field).toBe('partnerName');
    expect(inferVatField('Szállító').field).toBe('partnerName');
    expect(inferVatField('Adószám').field).toBe('partnerCode');

    // Due date
    expect(inferVatField('ÁFA esedékesség').field).toBe('vatDueDate');
    expect(inferVatField('Teljesítés dátuma').field).toBe('vatDueDate');
    expect(inferVatField('Delivery Date').field).toBe('vatDueDate');

    // Amounts
    expect(inferVatField('Nettó összeg').field).toBe('netAmount');
    expect(inferVatField('Adóalap').field).toBe('netAmount');
    expect(inferVatField('ÁFA összeg').field).toBe('vatAmount');
    expect(inferVatField('ÁFA').field).toBe('vatAmount');
    expect(inferVatField('Bruttó összeg').field).toBe('grossAmount');
    expect(inferVatField('Bruttó').field).toBe('grossAmount');

    // Two-sided amounts
    expect(inferVatField('Fizetendő nettó').field).toBe('payableNetAmount');
    expect(inferVatField('Fizetendő ÁFA').field).toBe('payableVatAmount');
    expect(inferVatField('Levonható nettó').field).toBe('deductibleNetAmount');
    expect(inferVatField('Levonható ÁFA').field).toBe('deductibleVatAmount');
    expect(inferVatField('ÁFA pozíció').field).toBe('netVatPosition');

    // Tax rate and return row
    expect(inferVatField('ÁFA kulcs').field).toBe('vatRateLabel');
    expect(inferVatField('ÁFA%').field).toBe('vatRateLabel');
    expect(inferVatField('Bev. sor').field).toBe('returnRowCode');
    expect(inferVatField('NAV sor').field).toBe('returnRowCode');

    // GL accounts
    expect(inferVatField('Nettó fsz').field).toBe('netGlAccount');
    expect(inferVatField('ÁFA fsz').field).toBe('vatGlAccount');
    expect(inferVatField('Bruttó fsz').field).toBe('grossGlAccount');
  });

  it('parses CSV sample content into structured VAT template columns', async () => {
    const csvContent = 'Bizonylatszám;Partner neve;ÁFA esedékesség;Nettó összeg;ÁFA összeg;Bruttó összeg;Bev. sor\nSZ-2026/001;Teszt Partner Kft.;2026-03-15;100000;27000;127000;01\n';
    const file = new File([csvContent], 'test_afa_sablon.csv', { type: 'text/csv' });

    const result = await parseVatTemplateFile(file, 'Irodai ÁFA ellenőrző analitika');

    expect(result.name).toBe('Irodai ÁFA ellenőrző analitika');
    expect(result.columns).toHaveLength(7);

    expect(result.columns[0].field).toBe('invoiceNumber');
    expect(result.columns[1].field).toBe('partnerName');
    expect(result.columns[2].field).toBe('vatDueDate');
    expect(result.columns[3].field).toBe('netAmount');
    expect(result.columns[4].field).toBe('vatAmount');
    expect(result.columns[5].field).toBe('grossAmount');
    expect(result.columns[6].field).toBe('returnRowCode');

    expect(result.columns[3].format).toBe('currency');
    expect(result.columns[3].align).toBe('right');
    expect(result.columns[0].align).toBe('left');
  });

  it('caps column count at MAX_VAT_TEMPLATE_COLUMNS (16) and generates a warning', async () => {
    const headers = Array.from({ length: 20 }, (_, i) => `Oszlop ${i + 1}`).join(';') + ';Bizonylatszám;Partner neve;ÁFA összeg';
    const rowValues = Array.from({ length: 23 }, (_, i) => `Érték ${i + 1}`).join(';');
    const csvContent = `${headers}\n${rowValues}\n`;
    const file = new File([csvContent], 'sok_oszlop_afa.csv', { type: 'text/csv' });

    const result = await parseVatTemplateFile(file, 'Sok Oszlopos ÁFA Sablon');
    expect(result.columns.length).toBe(MAX_VAT_TEMPLATE_COLUMNS);
    expect(result.warnings.some((w) => w.includes('16 oszlop'))).toBe(true);
  });
});

describe('VAT View Templates - Built-in Catalog', () => {
  it('provides all 4 core built-in templates with valid configuration', () => {
    expect(BUILTIN_VAT_TEMPLATES).toHaveLength(4);

    const ids = BUILTIN_VAT_TEMPLATES.map((t) => t.id);
    expect(ids).toContain('official_nav65_12col');
    expect(ids).toContain('simplified_financial_7col');
    expect(ids).toContain('two_sided_payable_deductible_8col');
    expect(ids).toContain('gl_accounting_fad_10col');

    BUILTIN_VAT_TEMPLATES.forEach((tpl) => {
      expect(tpl.template_type).toBe('builtin');
      expect(tpl.columns.length).toBeGreaterThanOrEqual(7);
      tpl.columns.forEach((col) => {
        expect(col.id).toBeDefined();
        expect(col.label).toBeDefined();
        expect(col.field).toBeDefined();
        expect(['left', 'center', 'right']).toContain(col.align);
      });
    });
  });
});

describe('VAT View Templates - Export Engine', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-vat-url');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('exports Excel file using custom template columns layout', async () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const sampleItems: VatJournalExportItem[] = [
      {
        id: 'inv_1',
        entryNumber: 'SZ26/0001',
        journalType: 'vevő',
        vatDueDate: '2026-03-15',
        invoiceNumber: 'SZ-2026/001',
        partnerCode: '12345678-2-41',
        partnerName: 'Teszt Vevő Zrt.',
        description: 'Értékesítés',
        vatRateLabel: '27%-os',
        netAmount: 500000,
        netGlAccount: '911K',
        vatAmount: 135000,
        vatGlAccount: '467K',
        grossAmount: 635000,
        grossGlAccount: '311T',
        returnRowCode: '01',
      },
    ];

    const customTemplate: VatViewTemplate = {
      id: 'custom_vat_1',
      name: 'Teszt Egyedi ÁFA Sablon',
      template_type: 'custom',
      columns: [
        { id: 'c1', key: 'invoiceNumber', label: 'Bizonylatszám', field: 'invoiceNumber', align: 'left' },
        { id: 'c2', key: 'partnerName', label: 'Partner neve', field: 'partnerName', align: 'left' },
        { id: 'c3', key: 'netAmount', label: 'Nettó összeg', field: 'netAmount', align: 'right', format: 'currency' },
        { id: 'c4', key: 'vatAmount', label: 'ÁFA összeg', field: 'vatAmount', align: 'right', format: 'currency' },
      ],
    };

    await exportVatJournalExcel(sampleItems, 'Teszt Kft.', customTemplate, '2026. 03. hó', true);

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  }, 20000);

  it('exports CSV file using custom template columns layout', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');

    const sampleItems: VatJournalExportItem[] = [
      {
        id: 'inv_2',
        entryNumber: 'SZ26/0002',
        journalType: 'szállító',
        vatDueDate: '2026-03-20',
        invoiceNumber: 'BESZ-2026/002',
        partnerCode: '87654321-2-42',
        partnerName: 'Beszállító Kft.',
        description: 'Alkatrész beszerzés',
        vatRateLabel: '27%-os',
        netAmount: 200000,
        netGlAccount: '529T',
        vatAmount: 54000,
        vatGlAccount: '466T',
        grossAmount: 254000,
        grossGlAccount: '4541K',
        returnRowCode: '64',
      },
    ];

    const customTemplate: VatViewTemplate = {
      id: 'custom_vat_2',
      name: 'Teszt CSV Sablon',
      template_type: 'custom',
      columns: [
        { id: 'c1', key: 'invoiceNumber', label: 'Bizonylatszám', field: 'invoiceNumber', align: 'left' },
        { id: 'c2', key: 'grossAmount', label: 'Bruttó összeg', field: 'grossAmount', align: 'right', format: 'currency' },
      ],
    };

    exportVatJournalCsv(sampleItems, 'Teszt Kft.', customTemplate, '2026. 03. hó', true);

    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(global.URL.createObjectURL).toHaveBeenCalled();
  });
});
