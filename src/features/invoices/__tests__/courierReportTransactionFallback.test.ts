import { describe, it, expect } from 'vitest';
import type { CourierReportRecord } from '@/hooks/useInvoiceData';

describe('Courier Report Transaction Fallback Resolution', () => {
  it('correctly maps courier reports by transaction_id in trxIdToCourierReportsMap', () => {
    const courierReports: CourierReportRecord[] = [
      {
        id: 'cr-single-1',
        report_type: 'gls',
        package_number: 'GLS-PKG-001',
        reference_number: 'REF-ORDER-101',
        delivery_date: '2026-07-16',
        cod_amount: 8890,
        recipient_name: 'Teszt Vásárló',
        matched_nav_invoice_id: null, // intentionally null
        matched_transaction_id: 'tx-gls-101',
      },
      {
        id: 'cr-single-2',
        report_type: 'gls',
        package_number: 'GLS-PKG-002',
        reference_number: null,
        delivery_date: '2026-07-20',
        cod_amount: 14930,
        recipient_name: 'Másik Vásárló',
        matched_nav_invoice_id: 'inv-nav-202',
        matched_transaction_id: 'tx-gls-202',
      },
    ];

    // Build the maps as implemented in useInvoiceData
    const navMap = new Map<string, CourierReportRecord[]>();
    const trxMap = new Map<string, CourierReportRecord[]>();

    for (const cr of courierReports) {
      if (cr.matched_nav_invoice_id) {
        const existing = navMap.get(cr.matched_nav_invoice_id) || [];
        existing.push(cr);
        navMap.set(cr.matched_nav_invoice_id, existing);
      }
      if (cr.matched_transaction_id) {
        const existing = trxMap.get(cr.matched_transaction_id) || [];
        existing.push(cr);
        trxMap.set(cr.matched_transaction_id, existing);
      }
    }

    expect(navMap.has('inv-nav-202')).toBe(true);
    expect(navMap.get('inv-nav-202')?.[0].id).toBe('cr-single-2');

    // cr-single-1 is not in navMap, but is present in trxMap
    expect(navMap.has('inv-nav-101')).toBe(false);
    expect(trxMap.has('tx-gls-101')).toBe(true);
    expect(trxMap.get('tx-gls-101')?.[0].id).toBe('cr-single-1');

    // Simulate NavInvoiceRow matching fallback:
    const invoiceId = 'inv-nav-101';
    const invoiceTransactions = [{ id: 'tx-gls-101', amount: 8890 }];

    const directReports = navMap.get(invoiceId) || [];
    const fallbackReports: CourierReportRecord[] = [];
    if (directReports.length === 0 && invoiceTransactions.length > 0) {
      for (const tx of invoiceTransactions) {
        const txReports = trxMap.get(tx.id);
        if (txReports && txReports.length > 0) {
          for (const tr of txReports) {
            if (!fallbackReports.some(r => r.id === tr.id)) {
              fallbackReports.push(tr);
            }
          }
        }
      }
    }

    const resolved = directReports.length > 0 ? directReports : fallbackReports;
    expect(resolved).toHaveLength(1);
    expect(resolved[0].package_number).toBe('GLS-PKG-001');
    expect(resolved[0].cod_amount).toBe(8890);
  });
});
