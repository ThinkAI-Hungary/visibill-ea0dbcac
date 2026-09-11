import { describe, it, expect } from 'vitest';
import { filterInvoicesByDate } from '@/lib/kintlevo-helpers';
import type { UnifiedInvoice } from '@/lib/kintlevo-helpers';

const mockInvoices: UnifiedInvoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'VY001/2026',
    issueDate: '2026-07-15',
    dueDate: '2026-08-15',
    amount: 100000,
    netAmount: 78740,
    currency: 'HUF',
    companyName: 'Alfa Kft.',
    taxNumber: '11111111-2-41',
    source: 'nav',
    attachmentUrl: null,
    daysOverdue: 27,
    category: 'yellow',
  },
  {
    id: 'inv-2',
    invoiceNumber: 'VY002/2026',
    issueDate: '2026-08-01',
    dueDate: '2026-08-31',
    amount: 250000,
    netAmount: 196850,
    currency: 'HUF',
    companyName: 'Beta Zrt.',
    taxNumber: '22222222-2-42',
    source: 'manual',
    attachmentUrl: null,
    daysOverdue: 11,
    category: 'yellow',
  },
  {
    id: 'inv-3',
    invoiceNumber: 'VY003/2026',
    issueDate: '2026-08-20T14:30:00Z',
    dueDate: '2026-09-20',
    amount: 50000,
    netAmount: 39370,
    currency: 'HUF',
    companyName: 'Gamma Kft.',
    taxNumber: '33333333-2-43',
    source: 'nav',
    attachmentUrl: null,
    daysOverdue: -9,
    category: 'green',
  },
  {
    id: 'inv-4',
    invoiceNumber: 'VY004/2026',
    issueDate: null, // missing issue date, falls back to dueDate
    dueDate: '2026-08-10',
    amount: 80000,
    netAmount: 62992,
    currency: 'HUF',
    companyName: 'Delta Bt.',
    taxNumber: '44444444-2-44',
    source: 'nav',
    attachmentUrl: null,
    daysOverdue: 32,
    category: 'red',
  },
];

describe('filterInvoicesByDate', () => {
  const dateFrom = '2026-08-01';
  const dateTo = '2026-08-31';

  it('filters by due_date correctly including boundaries', () => {
    const filtered = filterInvoicesByDate(mockInvoices, 'due_date', dateFrom, dateTo);
    // inv-1: due 2026-08-15 (included)
    // inv-2: due 2026-08-31 (included, boundary)
    // inv-3: due 2026-09-20 (excluded)
    // inv-4: due 2026-08-10 (included)
    expect(filtered.map(i => i.id)).toEqual(['inv-1', 'inv-2', 'inv-4']);
  });

  it('filters by issue_date correctly including ISO timestamps and null fallback', () => {
    const filtered = filterInvoicesByDate(mockInvoices, 'issue_date', dateFrom, dateTo);
    // inv-1: issue 2026-07-15 (excluded)
    // inv-2: issue 2026-08-01 (included, boundary)
    // inv-3: issue 2026-08-20T14:30:00Z -> 2026-08-20 (included)
    // inv-4: issue null -> fallback to dueDate 2026-08-10 (included)
    expect(filtered.map(i => i.id)).toEqual(['inv-2', 'inv-3', 'inv-4']);
  });

  it('returns all invoices unfiltered when basis is "all"', () => {
    const filtered = filterInvoicesByDate(mockInvoices, 'all', dateFrom, dateTo);
    expect(filtered.length).toBe(4);
    expect(filtered.map(i => i.id)).toEqual(['inv-1', 'inv-2', 'inv-3', 'inv-4']);
  });

  it('handles empty invoice arrays gracefully', () => {
    const filtered = filterInvoicesByDate([], 'due_date', dateFrom, dateTo);
    expect(filtered).toEqual([]);
  });

  it('excludes all invoices when date range does not match any invoice', () => {
    const filtered = filterInvoicesByDate(mockInvoices, 'due_date', '2025-01-01', '2025-01-31');
    expect(filtered).toEqual([]);
  });
});
