import { describe, it, expect } from 'vitest';

// Test the pure partner mapping and user_id assignment logic from NavIngestionService

function sanitizeTaxNumber(taxNumber: string | null | undefined): string {
  if (!taxNumber) return '';
  const digits = taxNumber.replace(/\D/g, '');
  return digits.length >= 8 ? digits.substring(0, 8) : '';
}

interface NavInvoiceDigest {
  invoice_number: string;
  customer_name: string;
  customer_tax_number: string;
  supplier_name: string;
  supplier_tax_number: string;
}

interface PartnerInsertPayload {
  company_id: string;
  user_id: string | null;
  name: string;
  tax_number: string;
  partner_type: string;
}

function buildPartnerInserts(
  invoices: NavInvoiceDigest[],
  direction: 'INBOUND' | 'OUTBOUND',
  companyId: string,
  userId?: string | null
): PartnerInsertPayload[] {
  const requiredType = direction === 'OUTBOUND' ? 'customer' : 'supplier';
  const partnerMap = new Map<string, { name: string; taxNumber: string }>();

  for (const inv of invoices) {
    const taxNumber = direction === 'OUTBOUND' ? inv.customer_tax_number : inv.supplier_tax_number;
    const name = direction === 'OUTBOUND' ? inv.customer_name : inv.supplier_name;
    const baseTax = sanitizeTaxNumber(taxNumber);

    if (baseTax && name && !partnerMap.has(baseTax)) {
      partnerMap.set(baseTax, { name, taxNumber });
    }
  }

  const toInsert: PartnerInsertPayload[] = [];
  for (const [, partner] of partnerMap.entries()) {
    toInsert.push({
      company_id: companyId,
      user_id: userId || null,
      name: partner.name,
      tax_number: partner.taxNumber,
      partner_type: requiredType,
    });
  }

  return toInsert;
}

describe('NavIngestionService Partner Sync user_id Handling', () => {
  const sampleInvoices: NavInvoiceDigest[] = [
    {
      invoice_number: 'NAV-2026-001',
      customer_name: 'Alpha Customer Kft.',
      customer_tax_number: '12345678-2-41',
      supplier_name: 'Beta Supplier Zrt.',
      supplier_tax_number: '87654321-1-42',
    },
    {
      invoice_number: 'NAV-2026-002',
      customer_name: 'Gamma Customer Nyrt.',
      customer_tax_number: '11223344-2-13',
      supplier_name: 'Beta Supplier Zrt.',
      supplier_tax_number: '87654321-1-42',
    },
  ];

  it('correctly sets user_id to null when automated cron runs without a user context', () => {
    const inserts = buildPartnerInserts(
      sampleInvoices,
      'INBOUND',
      'comp-123',
      null // cron execution has no user
    );

    expect(inserts).toHaveLength(1); // Only 1 unique supplier
    expect(inserts[0]).toEqual({
      company_id: 'comp-123',
      user_id: null,
      name: 'Beta Supplier Zrt.',
      tax_number: '87654321-1-42',
      partner_type: 'supplier',
    });
  });

  it('correctly assigns user_id when sync is triggered by an authenticated user', () => {
    const inserts = buildPartnerInserts(
      sampleInvoices,
      'OUTBOUND',
      'comp-123',
      'user-abc-456'
    );

    expect(inserts).toHaveLength(2); // Two unique customers
    expect(inserts[0].user_id).toBe('user-abc-456');
    expect(inserts[0].partner_type).toBe('customer');
    expect(inserts[1].user_id).toBe('user-abc-456');
  });

  it('deduplicates partners by 8-digit tax number prefix', () => {
    const duplicateInvoices: NavInvoiceDigest[] = [
      {
        invoice_number: 'INV-1',
        customer_name: 'Customer HU 1',
        customer_tax_number: '12345678-2-41',
        supplier_name: '',
        supplier_tax_number: '',
      },
      {
        invoice_number: 'INV-2',
        customer_name: 'Customer HU 1 (Alt branch)',
        customer_tax_number: '12345678-1-43',
        supplier_name: '',
        supplier_tax_number: '',
      },
    ];

    const inserts = buildPartnerInserts(duplicateInvoices, 'OUTBOUND', 'comp-123');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].tax_number).toBe('12345678-2-41');
  });
});
