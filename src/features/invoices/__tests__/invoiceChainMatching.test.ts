import { describe, it, expect } from 'vitest';
import { buildNavToSubmittedMap, buildSubmittedToNavMap } from '../utils/invoiceRelations';
import type { NavInvoice, SubmittedInvoice } from '../types';

describe('invoiceChainMatching - Proforma and Chain Propagation', () => {
  const mockProforma: SubmittedInvoice = {
    id: 'sub-dijbekero-144',
    bizonylatsorszam: 'D-THINK-144',
    invoice_type: 'dijbekero_proforma',
    invoice_direction: 'OUTBOUND',
    vevo_nev: 'UltraLog Kft.',
    vevo_vat_id: 'HU25933684',
    brutto_vegosszeg: 368300,
    penznem: 'HUF',
    transaction_id: 'tx-ultra-log-1',
  } as any;

  const mockNavInvoice: NavInvoice = {
    id: 'nav-final-36',
    invoice_number: 'THINK-2026-36',
    invoice_direction: 'OUTBOUND',
    customer_name: 'Ultra Log Kft.',
    customer_tax_number: '25933684',
    invoice_gross_amount: 368300,
    currency: 'HUF',
    transaction_id: 'tx-ultra-log-1',
  } as any;

  it('connects proforma invoice with final NAV invoice in buildNavToSubmittedMap via chain match', () => {
    const navMap = buildNavToSubmittedMap([mockProforma], [mockNavInvoice]);
    const matches = navMap.get('THINK-2026-36');

    expect(matches).toBeDefined();
    expect(matches?.length).toBe(1);
    expect(matches?.[0].id).toBe('sub-dijbekero-144');
    expect(matches?.[0].bizonylatsorszam).toBe('D-THINK-144');
  });

  it('connects proforma invoice with final NAV invoice in buildSubmittedToNavMap via chain match', () => {
    const subMap = buildSubmittedToNavMap([mockProforma], [mockNavInvoice]);
    const matches = subMap.get('D-THINK-144');

    expect(matches).toBeDefined();
    expect(matches?.length).toBe(1);
    expect(matches?.[0].id).toBe('nav-final-36');
    expect(matches?.[0].invoice_number).toBe('THINK-2026-36');
  });

  it('connects invoices with identical transaction_id even if numbers differ', () => {
    const subWithTx: SubmittedInvoice = {
      id: 'sub-custom-1',
      bizonylatsorszam: 'ADV-001',
      invoice_type: 'elolegszamla',
      invoice_direction: 'INBOUND',
      elado_vat_id: 'HU12345678',
      brutto_vegosszeg: 50000,
      transaction_id: 'shared-tx-123',
    } as any;

    const navWithTx: NavInvoice = {
      id: 'nav-custom-1',
      invoice_number: 'FINAL-999',
      invoice_direction: 'INBOUND',
      supplier_tax_number: '12345678',
      invoice_gross_amount: 50000,
      transaction_id: 'shared-tx-123',
    } as any;

    const navMap = buildNavToSubmittedMap([subWithTx], [navWithTx]);
    expect(navMap.get('FINAL-999')?.[0]?.id).toBe('sub-custom-1');
  });
});
