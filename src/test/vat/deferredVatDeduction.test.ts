import { describe, it, expect } from 'vitest';

describe('ÁFA levonásba helyezés halasztása & Kérdéses számlák (Áfa tv. 153/A. § és 137. §)', () => {
  // 1. Statutory 2-year countdown calculation
  const calculateDaysRemainingStatutory = (deliveryDateStr: string, currentDateStr: string): number => {
    const delivery = new Date(deliveryDateStr);
    const deadline = new Date(delivery);
    deadline.setFullYear(deadline.getFullYear() + 2);

    const current = new Date(currentDateStr);
    const diffTime = deadline.getTime() - current.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getStatutoryUrgencyLevel = (daysRemaining: number): 'green' | 'amber' | 'red' => {
    if (daysRemaining < 180) return 'red';
    if (daysRemaining <= 365) return 'amber';
    return 'green';
  };

  it('correctly calculates 2-year statutory deduction window per Áfa tv. 153/A. §', () => {
    // Delivery on 2026-01-15, deadline is 2028-01-15
    const daysFromStart = calculateDaysRemainingStatutory('2026-01-15', '2026-01-15');
    expect(daysFromStart).toBe(730);
    expect(getStatutoryUrgencyLevel(daysFromStart)).toBe('green');

    // After 1.5 years (548 days), remaining is ~182 days
    const daysAtWarning = calculateDaysRemainingStatutory('2026-01-15', '2027-07-17');
    expect(daysAtWarning).toBe(182);
    expect(getStatutoryUrgencyLevel(daysAtWarning)).toBe('amber');

    // After 1 year 10 months, remaining is ~60 days (< 180 days -> RED)
    const daysAtCritical = calculateDaysRemainingStatutory('2026-01-15', '2027-11-16');
    expect(daysAtCritical).toBe(60);
    expect(getStatutoryUrgencyLevel(daysAtCritical)).toBe('red');

    // Past 2 years -> 0 days remaining (expired)
    const daysExpired = calculateDaysRemainingStatutory('2026-01-15', '2028-02-01');
    expect(daysExpired).toBe(0);
    expect(getStatutoryUrgencyLevel(daysExpired)).toBe('red');
  });

  // 2. Exclusion types and VAT return filtering logic
  describe('VAT Return filtering for PERMANENT vs DEFERRED_VAT', () => {
    interface TestInvoice {
      id: string;
      invoice_number: string;
      delivery_date: string;
      net_amount: number;
      vat_amount: number;
      exclude_from_accounting: boolean;
      accounting_exclusion_type?: 'PERMANENT' | 'DEFERRED_VAT';
      deferred_vat_target_period?: string | null;
    }

    const isInvoiceDeductibleInPeriod = (
      inv: TestInvoice,
      periodYearMonth: string // e.g. '2026-03'
    ): boolean => {
      // 1. Permanent exclusion -> NEVER deductible
      if (inv.accounting_exclusion_type === 'PERMANENT') {
        return false;
      }

      // 2. Deferred VAT with target period matching the return period
      if (inv.accounting_exclusion_type === 'DEFERRED_VAT') {
        if (inv.deferred_vat_target_period === periodYearMonth) {
          return true; // Included in target period!
        }
        return false; // Not in target period or deferred without target period
      }

      // 3. Normal invoice (not excluded)
      if (inv.exclude_from_accounting) {
        return false;
      }

      const invPeriod = inv.delivery_date.substring(0, 7);
      return invPeriod === periodYearMonth;
    };

    it('excludes PERMANENT invoices from all VAT returns regardless of date', () => {
      const inv: TestInvoice = {
        id: 'inv-perm',
        invoice_number: 'TEST-PERM-001',
        delivery_date: '2026-03-10',
        net_amount: 100000,
        vat_amount: 27000,
        exclude_from_accounting: true,
        accounting_exclusion_type: 'PERMANENT',
      };

      expect(isInvoiceDeductibleInPeriod(inv, '2026-03')).toBe(false);
      expect(isInvoiceDeductibleInPeriod(inv, '2026-04')).toBe(false);
    });

    it('suppresses DEFERRED_VAT invoice from original delivery period when no target period set', () => {
      const inv: TestInvoice = {
        id: 'inv-def',
        invoice_number: 'TEST-DEF-001',
        delivery_date: '2026-01-20',
        net_amount: 200000,
        vat_amount: 54000,
        exclude_from_accounting: true,
        accounting_exclusion_type: 'DEFERRED_VAT',
        deferred_vat_target_period: null,
      };

      // In original month (2026-01), it must NOT be deducted
      expect(isInvoiceDeductibleInPeriod(inv, '2026-01')).toBe(false);
      // In subsequent month (2026-03), it must NOT be deducted until explicitly targeted
      expect(isInvoiceDeductibleInPeriod(inv, '2026-03')).toBe(false);
    });

    it('includes DEFERRED_VAT invoice in the exact target period when deferred_vat_target_period is set', () => {
      const inv: TestInvoice = {
        id: 'inv-def',
        invoice_number: 'TEST-DEF-001',
        delivery_date: '2026-01-20',
        net_amount: 200000,
        vat_amount: 54000,
        exclude_from_accounting: false,
        accounting_exclusion_type: 'DEFERRED_VAT',
        deferred_vat_target_period: '2026-03',
      };

      // Excluded from original period
      expect(isInvoiceDeductibleInPeriod(inv, '2026-01')).toBe(false);
      // Deducted in target period 2026-03!
      expect(isInvoiceDeductibleInPeriod(inv, '2026-03')).toBe(true);
      // Excluded from other periods (e.g. 2026-04)
      expect(isInvoiceDeductibleInPeriod(inv, '2026-04')).toBe(false);
    });
  });

  // 3. Validation for target period format
  describe('Target Period Validation', () => {
    const isValidPeriodFormat = (period: string): boolean => {
      return /^\d{4}-\d{2}$/.test(period);
    };

    it('validates YYYY-MM period format', () => {
      expect(isValidPeriodFormat('2026-03')).toBe(true);
      expect(isValidPeriodFormat('2026-12')).toBe(true);
      expect(isValidPeriodFormat('2026-1')).toBe(false);
      expect(isValidPeriodFormat('2026/03')).toBe(false);
      expect(isValidPeriodFormat('2026-03-01')).toBe(false);
      expect(isValidPeriodFormat('invalid')).toBe(false);
    });
  });
});
