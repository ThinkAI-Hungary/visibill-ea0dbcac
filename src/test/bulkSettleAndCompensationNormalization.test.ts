import { describe, it, expect } from 'vitest';

describe('Bulk Settle & Date Resolution Logic', () => {
  it('correctly resolves payment date based on bulk settle date mode', () => {
    const todayStr = '2026-10-08';
    const customDate = '2026-09-15';

    const testInvoices = [
      { id: '1', invoice_number: 'INV-001', issue_date: '2026-04-12', due_date: '2026-05-12' },
      { id: '2', invoice_number: 'INV-002', issue_date: '2026-08-20', due_date: '2026-09-20' },
      { id: '3', invoice_number: 'INV-003', issue_date: undefined, due_date: '2026-10-01' },
    ];

    const resolvePaymentDate = (
      inv: { issue_date?: string; due_date?: string },
      mode: 'issue_date' | 'today' | 'custom'
    ) => {
      if (mode === 'issue_date') {
        return inv.issue_date || inv.due_date || todayStr;
      }
      if (mode === 'custom') {
        return customDate || todayStr;
      }
      return todayStr;
    };

    // Mode: issue_date
    expect(resolvePaymentDate(testInvoices[0], 'issue_date')).toBe('2026-04-12');
    expect(resolvePaymentDate(testInvoices[1], 'issue_date')).toBe('2026-08-20');
    expect(resolvePaymentDate(testInvoices[2], 'issue_date')).toBe('2026-10-01');

    // Mode: today
    expect(resolvePaymentDate(testInvoices[0], 'today')).toBe(todayStr);

    // Mode: custom
    expect(resolvePaymentDate(testInvoices[0], 'custom')).toBe('2026-09-15');
  });

  it('defaults single settlement payment date to invoice issue date if available', () => {
    const todayStr = '2026-10-08';
    const invoiceWithIssueDate = { issue_date: '2026-07-15' };
    const invoiceWithoutIssueDate = { issue_date: undefined };

    const getDefaultDate = (inv?: { issue_date?: string }) => {
      return inv?.issue_date || todayStr;
    };

    expect(getDefaultDate(invoiceWithIssueDate)).toBe('2026-07-15');
    expect(getDefaultDate(invoiceWithoutIssueDate)).toBe(todayStr);
  });
});

describe('GLS Compensation Invoice Normalization', () => {
  const normalizeInvoiceOrPackageNumber = (num?: string): string | undefined => {
    if (!num) return num;
    let s = num.trim();
    // Strip leading "0 " or "0" if followed by HU
    s = s.replace(/^0+\s*(HU\d+)/i, '$1');
    // Normalize HU000xxxxxx (11 chars) to HU00xxxxxx (10 chars)
    const m = s.match(/^HU000(\d{6})$/i);
    if (m) {
      s = `HU00${m[1]}`;
    }
    return s;
  };

  it('normalizes extra zeroes prepended to GLS invoice numbers', () => {
    expect(normalizeInvoiceOrPackageNumber('HU00929915')).toBe('HU00929915');
    expect(normalizeInvoiceOrPackageNumber('HU000929915')).toBe('HU00929915');
    expect(normalizeInvoiceOrPackageNumber('0 HU00929915')).toBe('HU00929915');
    expect(normalizeInvoiceOrPackageNumber('0HU00929915')).toBe('HU00929915');
    expect(normalizeInvoiceOrPackageNumber('00 HU00879073')).toBe('HU00879073');
  });

  it('preserves non-GLS reference numbers', () => {
    expect(normalizeInvoiceOrPackageNumber('3480009112')).toBe('3480009112');
    expect(normalizeInvoiceOrPackageNumber('MPL-2026-99')).toBe('MPL-2026-99');
  });
});
