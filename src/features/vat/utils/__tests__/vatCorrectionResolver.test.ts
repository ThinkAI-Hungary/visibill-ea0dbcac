import { describe, it, expect } from 'vitest';
import {
  detectCorrectionType,
  resolveCorrectionDetails,
  normalizeInvoiceNumber,
} from '../vatCorrectionResolver';

describe('vatCorrectionResolver', () => {
  it('normalizes invoice numbers consistently', () => {
    expect(normalizeInvoiceNumber('sz-2026/001')).toBe('SZ2026001');
    expect(normalizeInvoiceNumber('  INV 123-456 ')).toBe('INV123456');
    expect(normalizeInvoiceNumber(null)).toBe('');
  });

  it('detects normal invoices', () => {
    const inv = {
      invoice_number: 'SZ-2026-001',
      invoice_net_amount: 100000,
      invoice_vat_amount: 27000,
      invoice_operation: 'CREATE',
    };
    const res = detectCorrectionType(inv);
    expect(res.isCorrection).toBe(false);
    expect(res.corrType).toBe('Normál');

    const details = resolveCorrectionDetails(inv, []);
    expect(details.anykCode).toBe('02');
    expect(details.isCorrection).toBe(false);
    expect(details.correctionNet).toBe(100000);
    expect(details.correctionVat).toBe(27000);
  });

  it('detects and resolves storno invoice with matching original invoice in DB', () => {
    const originalInv = {
      invoice_number: 'SZ-2026-100',
      invoice_issue_date: '2026-05-10',
      invoice_delivery_date: '2026-05-12',
      invoice_net_amount: 500000,
      invoice_vat_amount: 135000,
    };

    const stornoInv = {
      invoice_number: 'ST-2026-001',
      invoice_issue_date: '2026-06-02',
      invoice_delivery_date: '2026-06-02',
      invoice_operation: 'STORNO',
      original_invoice_number: 'SZ-2026-100',
      invoice_net_amount: -500000,
      invoice_vat_amount: -135000,
    };

    const details = resolveCorrectionDetails(stornoInv, [originalInv]);

    expect(details.isCorrection).toBe(true);
    expect(details.corrType).toBe('Sztornó');
    expect(details.anykCode).toBe('02-K');
    expect(details.isOriginalFound).toBe(true);
    expect(details.originalInvoiceNumber).toBe('SZ-2026-100');
    expect(details.originalIssueDate).toBe('2026-05-10');
    expect(details.originalFulfillmentDate).toBe('2026-05-12');
    // Original must be positive
    expect(details.originalNet).toBe(500000);
    expect(details.originalVat).toBe(135000);
    // Correction must be negative with minus sign
    expect(details.correctionNet).toBe(-500000);
    expect(details.correctionVat).toBe(-135000);
  });

  it('detects and resolves modification (helyesbítő) invoice', () => {
    const originalInv = {
      invoice_number: 'SZ-2026-200',
      invoice_issue_date: '2026-03-01',
      invoice_delivery_date: '2026-03-05',
      invoice_net_amount: 200000,
      invoice_vat_amount: 54000,
    };

    const modInv = {
      invoice_number: 'MOD-2026-001',
      invoice_issue_date: '2026-04-15',
      invoice_delivery_date: '2026-03-05',
      invoice_operation: 'MODIFY',
      original_invoice_number: 'SZ-2026-200',
      invoice_net_amount: -50000, // árleszállítás 50e Ft
      invoice_vat_amount: -13500,
    };

    const details = resolveCorrectionDetails(modInv, [originalInv]);

    expect(details.isCorrection).toBe(true);
    expect(details.corrType).toBe('Helyesbítő');
    expect(details.anykCode).toBe('02-K');
    expect(details.originalInvoiceNumber).toBe('SZ-2026-200');
    expect(details.originalNet).toBe(200000);
    expect(details.originalVat).toBe(54000);
    expect(details.correctionNet).toBe(-50000);
    expect(details.correctionVat).toBe(-13500);
  });

  it('handles fallback when original invoice is missing from DB', () => {
    const stornoInv = {
      invoice_number: 'ST-2026-999',
      invoice_issue_date: '2026-06-15',
      invoice_delivery_date: '2026-06-15',
      invoice_operation: 'STORNO',
      original_invoice_number: 'SZ-2023-HISTORICAL',
      invoice_net_amount: -120000,
      invoice_vat_amount: -32400,
    };

    const details = resolveCorrectionDetails(stornoInv, []);

    expect(details.isCorrection).toBe(true);
    expect(details.corrType).toBe('Sztornó');
    expect(details.anykCode).toBe('02-K');
    expect(details.isOriginalFound).toBe(false);
    expect(details.originalInvoiceNumber).toBe('SZ-2023-HISTORICAL');
    expect(details.originalNet).toBe(120000);
    expect(details.originalVat).toBe(32400);
    expect(details.correctionNet).toBe(-120000);
    expect(details.correctionVat).toBe(-32400);
  });
});
