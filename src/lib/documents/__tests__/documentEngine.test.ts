import { describe, it, expect } from 'vitest';
import { DocumentEngine } from '../core/DocumentEngine';
import { DocumentDescriptor } from '../core/types';
import { buildPayslipDescriptor } from '../templates/payslipTemplate';
import { buildCashReceiptDescriptor, numberToWordsHu } from '../templates/cashReceiptTemplate';
import { buildTableExportDescriptor } from '../templates/tableExportTemplate';
import { buildVatReturnDescriptor } from '../templates/vatReturnTemplate';
import { buildAnnualReportDescriptor } from '../templates/annualReportTemplate';

describe('DocumentEngine', () => {
  const sampleDescriptor: DocumentDescriptor = {
    type: 'custom',
    metadata: {
      title: 'Teszt Dokumentum',
      subtitle: 'Alcím teszteléshez',
      companyName: 'ThinkAI Kft.',
      companyTaxNumber: '12345678-2-42',
      period: '2026.08',
      filename: 'teszt_dok',
    },
    sections: [
      {
        type: 'key-value',
        title: 'Általános Információk',
        items: [
          { label: 'Státusz', value: 'Aktív', highlight: true },
          { label: 'Felhasználó', value: 'Teszt Elek' },
        ],
      },
      {
        type: 'table',
        title: 'Tételek',
        headers: ['Tétel', 'Mennyiség', 'Egységár', 'Összesen'],
        rows: [
          ['Szoftver licenc', 1, '100 000 Ft', '100 000 Ft'],
          ['Támogatás', 2, '50 000 Ft', '100 000 Ft'],
        ],
        footers: [{ label: 'Végösszeg', value: '200 000 Ft' }],
      },
      {
        type: 'text',
        title: 'Megjegyzés',
        content: 'Ez egy automatikusan generált teszt dokumentum.',
      },
    ],
  };

  it('renders a document into CSV format with UTF-8 support', async () => {
    const { contentString, mimeType } = await DocumentEngine.render(sampleDescriptor, 'csv');
    expect(mimeType).toBe('text/csv;charset=utf-8');
    expect(contentString).toBeDefined();
    expect(contentString).toContain('"Teszt Dokumentum"');
    expect(contentString).toContain('ThinkAI Kft.');
    expect(contentString).toContain('"Szoftver licenc"');
  });

  it('renders a document into XML format', async () => {
    const { contentString, mimeType } = await DocumentEngine.render(sampleDescriptor, 'xml');
    expect(mimeType).toBe('application/xml;charset=utf-8');
    expect(contentString).toBeDefined();
    expect(contentString).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(contentString).toContain('company="ThinkAI Kft."');
    expect(contentString).toContain('<col_1>Szoftver licenc</col_1>');
  });

  it('renders a document into HTML format for preview and print', async () => {
    const { contentString, mimeType } = await DocumentEngine.render(sampleDescriptor, 'html');
    expect(mimeType).toBe('text/html;charset=utf-8');
    expect(contentString).toBeDefined();
    expect(contentString).toContain('<!DOCTYPE html>');
    expect(contentString).toContain('<h1 class="doc-title">Teszt Dokumentum</h1>');
    expect(contentString).toContain('ThinkAI Kft.');
    expect(contentString).toContain('Szoftver licenc');
  });

  describe('Template Descriptors', () => {
    it('builds a valid Payslip descriptor', () => {
      const descriptor = buildPayslipDescriptor({
        employeeName: 'Kovács János',
        period: '2026.08',
        grossSalary: 600000,
        szjaAmount: 90000,
        tbAmount: 111000,
        szochoAmount: 78000,
        netSalary: 399000,
        totalDeductions: 201000,
        companyName: 'Teszt Kft.',
      });

      expect(descriptor.type).toBe('payslip');
      expect(descriptor.metadata.title).toBe('BÉRJEGYZÉK');
      expect(descriptor.sections.length).toBe(3);
    });

    it('builds a valid Cash Receipt descriptor and converts numbers to words', () => {
      expect(numberToWordsHu(1250000)).toBe('egymillió-kettőszázötvenezer forint');
      expect(numberToWordsHu(1500)).toBe('ezerötszáz forint');

      const descriptor = buildCashReceiptDescriptor({
        receiptNumber: 'BEV-2026/001',
        companyName: 'Teszt Kft.',
        partnerName: 'Vevő Kft.',
        amount: 250000,
        paymentReason: 'Számla kiegyenlítés',
        receiptDate: '2026-08-31',
      });

      expect(descriptor.type).toBe('cash_receipt');
      expect(descriptor.metadata.title).toBe('KÉSZPÉNZ ÁTVÉTELI ELISMERVÉNY');
      expect(descriptor.sections[0].type).toBe('key-value');
    });

    it('builds a valid Table Export descriptor', () => {
      const descriptor = buildTableExportDescriptor({
        title: 'Számlák listája',
        headers: ['Sorszám', 'Partner', 'Összeg'],
        rows: [['INV-001', 'Partner A', '50 000 Ft']],
      });

      expect(descriptor.type).toBe('table_export');
      expect(descriptor.metadata.title).toBe('Számlák listája');
      expect(descriptor.sections[0].type).toBe('table');
    });

    it('builds a valid VAT Return descriptor with ÁNYK payload', () => {
      const descriptor = buildVatReturnDescriptor({
        companyName: 'Példa Kft.',
        companyTaxNumber: '11223344-2-41',
        companyAddress: 'Budapest, Fő utca 1.',
        periodYear: 2026,
        periodMonth: 8,
        frequency: 'H',
        lines: [
          { row_number: '01', base_amount_rounded: 1000, tax_amount_rounded: 270 },
        ],
      });

      expect(descriptor.type).toBe('vat_return');
      expect(descriptor.rawPayload?.anykOptions?.formId).toBe('2665');
      expect(descriptor.rawPayload?.fields['01_adoszam_torzs']).toBe('11223344');
    });

    it('builds a valid Annual Report descriptor', () => {
      const descriptor = buildAnnualReportDescriptor({
        companyName: 'Minta Zrt.',
        fiscalYear: 2025,
        representativeName: 'Igazgató Úr',
        representativeRole: 'Ügyvezető',
        reportDate: '2026-05-31',
        frozenBsData: [{ row_code: '01', name: 'Befektetett eszközök', current_balance: 5000000, prior_year_balance: 4500000 }],
        frozenPnlData: [{ row_code: 'I', name: 'Értékesítés nettó árbevétele', current_balance: 25000000, prior_year_balance: 20000000 }],
        notesSections: [],
        notesTemplates: [],
        netIncome: 3000000,
        dividendAmount: 0,
        retainedEarnings: 3000000,
        dividendResolutionDate: '2026-05-31',
      });

      expect(descriptor.type).toBe('annual_report');
      expect(descriptor.metadata.title).toBe('ÉVES BESZÁMOLÓ (2025. üzleti év)');
      expect(descriptor.sections.length).toBe(3);
    });
  });
});
