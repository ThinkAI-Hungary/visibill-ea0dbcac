import { describe, it, expect } from 'vitest';
import type { ExportableInvoice } from '@/components/invoices/InvoiceDataExportDialog';

describe('Invoice Export Payment Dates and Routing (Ticket Support)', () => {
  // Test helper replicating the bank/card detection from handleDataExportConfirm
  const createIsBankOrCard = (txDateMap: Map<string, string>) => {
    return (inv: ExportableInvoice) => {
      if (txDateMap.has(inv.id) || inv.transaction_id) return true;
      const p = (inv.payment_method || '').toLowerCase();
      return (
        p.includes('átutalás') ||
        p.includes('transfer') ||
        p.includes('bankkártya') ||
        p.includes('card') ||
        p.includes('kártya') ||
        p.includes('utalás') ||
        p.includes('beszedés') ||
        p.includes('sepa') ||
        p.includes('direct debit') ||
        p.includes('bank')
      );
    };
  };

  // Test helper replicating the payment date formatting from handleDataExportConfirm
  const createPaymentDateDisplay = (txDateMap: Map<string, string>) => {
    return (inv: ExportableInvoice) => {
      const txDate = txDateMap.get(inv.id);
      if (txDate) return txDate;
      if (inv.payment_date) return inv.payment_date;
      if (inv.paid || inv.match_status === 'paid') {
        return inv.due_date || 'Fizetve';
      }
      if (inv.match_status === 'partially_paid') {
        return 'Részben fizetve';
      }
      return '—';
    };
  };

  it('routes MVM invoice with payment_method="OTHER" to bank tab if transaction_id is present', () => {
    const txDateMap = new Map<string, string>();
    const isBankOrCard = createIsBankOrCard(txDateMap);

    const mvmInvoice: ExportableInvoice = {
      id: 'inv-mvm-1',
      invoice_number: '101220546320',
      direction: 'INBOUND',
      partner_name: 'MVM Next Energiakereskedelmi Zrt.',
      issue_date: '2026-08-25',
      delivery_date: '2026-08-25',
      due_date: '2026-09-09',
      payment_method: 'OTHER',
      net_amount: 53157,
      vat_amount: 14352,
      gross_amount: 67509,
      currency: 'HUF',
      paid: true,
      transaction_id: 'tx-bank-140632',
      source: 'nav',
    };

    expect(isBankOrCard(mvmInvoice)).toBe(true);
  });

  it('routes invoice to bank tab if transaction_invoice_matches exists in txDateMap even without direct transaction_id', () => {
    const txDateMap = new Map<string, string>([['inv-mvm-multi', '2026-09-09']]);
    const isBankOrCard = createIsBankOrCard(txDateMap);

    const mvmMultiInvoice: ExportableInvoice = {
      id: 'inv-mvm-multi',
      invoice_number: '101416723653',
      direction: 'INBOUND',
      partner_name: 'MVM Next Energiakereskedelmi Zrt.',
      issue_date: '2026-08-25',
      payment_method: 'OTHER',
      net_amount: 57577,
      vat_amount: 15546,
      gross_amount: 73123,
      currency: 'HUF',
      paid: true,
      source: 'nav',
    };

    expect(isBankOrCard(mvmMultiInvoice)).toBe(true);
  });

  it('routes csoportos beszedés and SEPA invoices to bank tab', () => {
    const txDateMap = new Map<string, string>();
    const isBankOrCard = createIsBankOrCard(txDateMap);

    const beszedesInvoice: ExportableInvoice = {
      id: 'inv-besz',
      invoice_number: 'BESZ-001',
      direction: 'INBOUND',
      partner_name: 'Telekom Zrt.',
      issue_date: '2026-08-01',
      payment_method: 'Csoportos beszedés',
      net_amount: 10000,
      vat_amount: 2700,
      gross_amount: 12700,
      currency: 'HUF',
      source: 'nav',
    };

    const sepaInvoice: ExportableInvoice = {
      id: 'inv-sepa',
      invoice_number: 'SEPA-001',
      direction: 'INBOUND',
      partner_name: 'EU Supplier GmbH',
      issue_date: '2026-08-01',
      payment_method: 'SEPA direct debit',
      net_amount: 500,
      vat_amount: 0,
      gross_amount: 500,
      currency: 'EUR',
      source: 'nav',
    };

    expect(isBankOrCard(beszedesInvoice)).toBe(true);
    expect(isBankOrCard(sepaInvoice)).toBe(true);
  });

  it('correctly resolves payment date display with bank transaction date for skonto tracking', () => {
    const txDateMap = new Map<string, string>([['inv-skonto', '2026-09-21']]);
    const getPaymentDateDisplay = createPaymentDateDisplay(txDateMap);

    const skontoInvoice: ExportableInvoice = {
      id: 'inv-skonto',
      invoice_number: 'SLA-00260/2026',
      direction: 'INBOUND',
      partner_name: 'Music Supplier Kft.',
      issue_date: '2026-09-17',
      delivery_date: '2026-09-30',
      due_date: '2026-09-30',
      payment_method: 'átutalás',
      net_amount: 100000,
      vat_amount: 27000,
      gross_amount: 127000,
      currency: 'HUF',
      paid: true,
      transaction_id: 'tx-bank-skonto',
      source: 'nav',
    };

    // Bank transaction date is 2026-09-21 (9 days before due date 2026-09-30)
    expect(getPaymentDateDisplay(skontoInvoice)).toBe('2026-09-21');
    expect(skontoInvoice.due_date).toBe('2026-09-30');
  });

  it('shows manual payment date when invoice was manually marked as paid', () => {
    const txDateMap = new Map<string, string>();
    const getPaymentDateDisplay = createPaymentDateDisplay(txDateMap);

    const manualPaidInvoice: ExportableInvoice = {
      id: 'inv-manual',
      invoice_number: 'MAN-001',
      direction: 'INBOUND',
      partner_name: 'Local Shop',
      issue_date: '2026-08-10',
      due_date: '2026-08-18',
      payment_date: '2026-08-12',
      payment_method: 'készpénz',
      net_amount: 5000,
      vat_amount: 1350,
      gross_amount: 6350,
      currency: 'HUF',
      paid: true,
      source: 'submitted',
    };

    expect(getPaymentDateDisplay(manualPaidInvoice)).toBe('2026-08-12');
  });

  it('shows "—" when invoice is not paid and has no transaction match', () => {
    const txDateMap = new Map<string, string>();
    const getPaymentDateDisplay = createPaymentDateDisplay(txDateMap);

    const unpaidInvoice: ExportableInvoice = {
      id: 'inv-unpaid',
      invoice_number: 'VMusic00684/2026',
      direction: 'OUTBOUND',
      partner_name: 'Concert Hall',
      issue_date: '2026-09-16',
      delivery_date: '2026-09-19',
      due_date: '2026-09-19',
      payment_method: 'átutalás',
      net_amount: 50000,
      vat_amount: 13500,
      gross_amount: 63500,
      currency: 'HUF',
      paid: false,
      match_status: 'unmatched',
      source: 'nav',
    };

    expect(getPaymentDateDisplay(unpaidInvoice)).toBe('—');
  });
});
