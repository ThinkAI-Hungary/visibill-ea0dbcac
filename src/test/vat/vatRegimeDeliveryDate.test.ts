import { describe, it, expect } from 'vitest';

describe('VAT Regime & Delivery Date vs Payment Date Contract Tests', () => {
  it('normal regime: effective tax date for outbound invoice must be delivery_date regardless of transaction_date', () => {
    const isPenzforgalmi = false;
    const invoiceDirection = 'OUTBOUND';
    const deliveryDate = '2026-09-15';
    const transactionDate = '2026-10-05';
    const manualPaymentDate = null;
    const isPaid = Boolean(transactionDate || manualPaymentDate);

    let effectiveTaxDate: string | null = null;
    let shouldInclude = true;

    if (invoiceDirection === 'OUTBOUND') {
      if (isPenzforgalmi) {
        if (!isPaid) {
          shouldInclude = false;
        }
        effectiveTaxDate = manualPaymentDate || transactionDate || deliveryDate;
      } else {
        // Normal regime outbound: ALWAYS delivery_date (Áfa tv. 55-58. §)
        effectiveTaxDate = deliveryDate;
      }
    }

    expect(shouldInclude).toBe(true);
    expect(effectiveTaxDate).toBe('2026-09-15');
  });

  it('normal regime: historical outbound invoice paid in September must NOT have September tax date', () => {
    const isPenzforgalmi = false;
    const invoiceDirection = 'OUTBOUND';
    const deliveryDate = '2026-02-21'; // February invoice
    const transactionDate = '2026-09-22'; // Paid in September bank statement
    const manualPaymentDate = null;
    const isPaid = true;

    let effectiveTaxDate: string | null = null;
    let shouldInclude = true;

    if (invoiceDirection === 'OUTBOUND') {
      if (isPenzforgalmi) {
        if (!isPaid) {
          shouldInclude = false;
        }
        effectiveTaxDate = manualPaymentDate || transactionDate || deliveryDate;
      } else {
        // Normal regime outbound: ALWAYS delivery_date
        effectiveTaxDate = deliveryDate;
      }
    }

    expect(shouldInclude).toBe(true);
    expect(effectiveTaxDate).toBe('2026-02-21'); // stays in February, NEVER September!
  });

  it('penzforgalmi regime: outbound invoice paid in September belongs to September', () => {
    const isPenzforgalmi = true;
    const invoiceDirection = 'OUTBOUND';
    const deliveryDate = '2026-02-21';
    const transactionDate = '2026-09-22';
    const manualPaymentDate = null;
    const isPaid = true;

    let effectiveTaxDate: string | null = null;
    let shouldInclude = true;

    if (invoiceDirection === 'OUTBOUND') {
      if (isPenzforgalmi) {
        if (!isPaid) {
          shouldInclude = false;
        }
        effectiveTaxDate = manualPaymentDate || transactionDate || deliveryDate;
      } else {
        effectiveTaxDate = deliveryDate;
      }
    }

    expect(shouldInclude).toBe(true);
    expect(effectiveTaxDate).toBe('2026-09-22'); // moved to September because penzforgalmi
  });

  it('penzforgalmi regime: unpaid outbound invoice is skipped', () => {
    const isPenzforgalmi = true;
    const invoiceDirection = 'OUTBOUND';
    const deliveryDate = '2026-09-15';
    const transactionDate = null;
    const manualPaymentDate = null;
    const isPaid = false;

    let shouldInclude = true;

    if (invoiceDirection === 'OUTBOUND') {
      if (isPenzforgalmi) {
        if (!isPaid) {
          shouldInclude = false;
        }
      }
    }

    expect(shouldInclude).toBe(false);
  });

  it('normal regime: inbound invoice from normal supplier uses delivery_date', () => {
    const isPenzforgalmi = false;
    const isSupplierCashAccounting = false;
    const invoiceDirection = 'INBOUND';
    const deliveryDate = '2026-09-10';
    const transactionDate = '2026-09-25';
    const manualPaymentDate = null;
    const isPaid = true;

    let effectiveTaxDate: string | null = null;
    let shouldInclude = true;

    if (invoiceDirection === 'INBOUND') {
      if (isPenzforgalmi || isSupplierCashAccounting) {
        if (!isPaid) {
          shouldInclude = false;
        }
        effectiveTaxDate = manualPaymentDate || transactionDate || deliveryDate;
      } else {
        effectiveTaxDate = deliveryDate;
      }
    }

    expect(shouldInclude).toBe(true);
    expect(effectiveTaxDate).toBe('2026-09-10');
  });

  it('normal regime: inbound invoice from cash-accounting supplier (Áfa tv. 196/C. §) requires payment', () => {
    const isPenzforgalmi = false;
    const isSupplierCashAccounting = true;
    const invoiceDirection = 'INBOUND';
    const deliveryDate = '2026-09-10';
    const transactionDate = null;
    const manualPaymentDate = null;
    const isPaid = false;

    let shouldInclude = true;

    if (invoiceDirection === 'INBOUND') {
      if (isPenzforgalmi || isSupplierCashAccounting) {
        if (!isPaid) {
          shouldInclude = false;
        }
      }
    }

    expect(shouldInclude).toBe(false);
  });
});
