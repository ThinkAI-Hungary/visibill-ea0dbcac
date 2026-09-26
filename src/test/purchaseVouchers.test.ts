import { describe, it, expect } from 'vitest';
import {
  calculateItemTotals,
  calculateVoucherTotals,
  calculateVouchersSummary,
  filterVouchers,
  validateVoucherForm,
} from '@/features/purchase-vouchers/utils';
import { PurchaseVoucher } from '@/features/purchase-vouchers/types';

describe('Purchase Vouchers (Felvásárlási jegyek) - Business Logic & Math', () => {
  describe('calculateItemTotals', () => {
    it('correctly calculates 12% compensation surcharge for plant products (növénytermesztés)', () => {
      // 2500 kg búza @ 85 Ft/kg = 212,500 Ft net
      // 12% surcharge = 25,500 Ft
      // Gross = 238,000 Ft
      const result = calculateItemTotals(2500, 85, 12);
      expect(result.net_amount).toBe(212500);
      expect(result.compensation_amount).toBe(25500);
      expect(result.gross_amount).toBe(238000);
    });

    it('correctly calculates 7% compensation surcharge for livestock (állattenyésztés)', () => {
      // 1200 kg sertés @ 620 Ft/kg = 744,000 Ft net
      // 7% surcharge = 52,080 Ft
      // Gross = 796,080 Ft
      const result = calculateItemTotals(1200, 620, 7);
      expect(result.net_amount).toBe(744000);
      expect(result.compensation_amount).toBe(52080);
      expect(result.gross_amount).toBe(796080);
    });

    it('handles 0% compensation surcharge', () => {
      const result = calculateItemTotals(10, 5000, 0);
      expect(result.net_amount).toBe(50000);
      expect(result.compensation_amount).toBe(0);
      expect(result.gross_amount).toBe(50000);
    });

    it('rounds decimal fillér amounts correctly according to Hungarian tax rules', () => {
      // 3.33 kg @ 100.50 Ft/kg = 334.665 -> 334.67 Ft net
      // 12% on 334.67 = 40.1604 -> 40.16 Ft surcharge
      // Gross = 374.83 Ft
      const result = calculateItemTotals(3.33, 100.5, 12);
      expect(result.net_amount).toBe(334.67);
      expect(result.compensation_amount).toBe(40.16);
      expect(result.gross_amount).toBe(374.83);
    });
  });

  describe('calculateVoucherTotals', () => {
    it('aggregates multiple line items and applies compensation surcharge and tax deductions', () => {
      const items = [
        { quantity: 1000, unit_price: 80 },  // 80,000
        { quantity: 500, unit_price: 120 },  // 60,000
      ];
      // Total net = 140,000 Ft
      // 12% surcharge = 16,800 Ft
      // Tax deducted (pl. SZJA előleg) = 5,000 Ft
      // Gross = 140,000 + 16,800 - 5,000 = 151,800 Ft
      const totals = calculateVoucherTotals(items, 12, 5000);

      expect(totals.net).toBe(140000);
      expect(totals.compensation).toBe(16800);
      expect(totals.gross).toBe(151800);
    });

    it('defaults tax deduction to 0 if omitted', () => {
      const items = [{ quantity: 100, unit_price: 250 }]; // 25,000
      const totals = calculateVoucherTotals(items, 7);

      expect(totals.net).toBe(25000);
      expect(totals.compensation).toBe(1750);
      expect(totals.gross).toBe(26750);
    });
  });

  describe('calculateVouchersSummary', () => {
    const mockVouchers: PurchaseVoucher[] = [
      {
        id: '1',
        company_id: 'comp-1',
        voucher_number: 'FJ-2026/001',
        producer_name: 'Kovács János',
        producer_tax_id: '8412345678',
        issue_date: '2026-03-01',
        fulfillment_date: '2026-03-01',
        payment_method: 'TRANSFER',
        net_amount: 200000,
        compensation_surcharge_rate: 12,
        compensation_surcharge_amount: 24000,
        gross_amount: 224000,
        tax_deducted: 0,
        paid_amount: 224000,
        payment_status: 'paid',
        payroll_processed: false,
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
      },
      {
        id: '2',
        company_id: 'comp-1',
        voucher_number: 'FJ-2026/002',
        producer_name: 'Szabó István',
        producer_tax_id: '8398765432',
        issue_date: '2026-03-05',
        fulfillment_date: '2026-03-05',
        payment_method: 'CASH',
        net_amount: 100000,
        compensation_surcharge_rate: 7,
        compensation_surcharge_amount: 7000,
        gross_amount: 107000,
        tax_deducted: 0,
        paid_amount: 0,
        payment_status: 'unpaid',
        payroll_processed: false,
        created_at: '2026-03-05T10:00:00Z',
        updated_at: '2026-03-05T10:00:00Z',
      },
      {
        id: '3',
        company_id: 'comp-1',
        voucher_number: 'FJ-2026/003',
        producer_name: 'Kovács János',
        producer_tax_id: '8412345678',
        issue_date: '2026-03-10',
        fulfillment_date: '2026-03-10',
        payment_method: 'TRANSFER',
        net_amount: 50000,
        compensation_surcharge_rate: 12,
        compensation_surcharge_amount: 6000,
        gross_amount: 56000,
        tax_deducted: 0,
        paid_amount: 0,
        payment_status: 'unpaid',
        payroll_processed: false,
        created_at: '2026-03-10T10:00:00Z',
        updated_at: '2026-03-10T10:00:00Z',
      },
    ];

    it('calculates total net, compensation, gross, paid, unpaid, and distinct producers correctly', () => {
      const summary = calculateVouchersSummary(mockVouchers);

      expect(summary.total_count).toBe(3);
      expect(summary.total_net).toBe(350000);
      expect(summary.total_compensation).toBe(37000);
      expect(summary.total_gross).toBe(387000);
      expect(summary.paid_gross).toBe(224000);
      expect(summary.unpaid_gross).toBe(163000); // 107000 + 56000
      expect(summary.unique_producers).toBe(2); // Kovács János & Szabó István
    });
  });

  describe('filterVouchers', () => {
    const vouchers: PurchaseVoucher[] = [
      {
        id: '1',
        company_id: 'comp-1',
        voucher_number: 'FJ-2026/001',
        producer_name: 'Kovács János',
        producer_tax_id: '8412345678',
        producer_card_number: 'FELIR-9912',
        issue_date: '2026-03-01',
        fulfillment_date: '2026-03-01',
        payment_method: 'TRANSFER',
        net_amount: 100000,
        compensation_surcharge_rate: 12,
        compensation_surcharge_amount: 12000,
        gross_amount: 112000,
        tax_deducted: 0,
        paid_amount: 112000,
        payment_status: 'paid',
        payroll_processed: false,
        created_at: '',
        updated_at: '',
        items: [
          {
            item_name: 'Búza étkezési',
            quantity: 1000,
            unit_of_measure: 'kg',
            unit_price: 100,
            net_amount: 100000,
            compensation_rate: 12,
            compensation_amount: 12000,
            gross_amount: 112000,
          },
        ],
      },
      {
        id: '2',
        company_id: 'comp-1',
        voucher_number: 'FJ-2026/002',
        producer_name: 'Nagy Béla',
        producer_tax_id: '8311223344',
        producer_card_number: 'IG-5544',
        issue_date: '2026-03-02',
        fulfillment_date: '2026-03-02',
        payment_method: 'CASH',
        net_amount: 50000,
        compensation_surcharge_rate: 7,
        compensation_surcharge_amount: 3500,
        gross_amount: 53500,
        tax_deducted: 0,
        paid_amount: 0,
        payment_status: 'unpaid',
        payroll_processed: false,
        created_at: '',
        updated_at: '',
        items: [
          {
            item_name: 'Kukorica szemes',
            quantity: 500,
            unit_of_measure: 'kg',
            unit_price: 100,
            net_amount: 50000,
            compensation_rate: 7,
            compensation_amount: 3500,
            gross_amount: 53500,
          },
        ],
      },
    ];

    it('filters by statusFilter unpaid', () => {
      const results = filterVouchers(vouchers, { statusFilter: 'unpaid' });
      expect(results.length).toBe(1);
      expect(results[0].voucher_number).toBe('FJ-2026/002');
    });

    it('filters by statusFilter paid', () => {
      const results = filterVouchers(vouchers, { statusFilter: 'paid' });
      expect(results.length).toBe(1);
      expect(results[0].voucher_number).toBe('FJ-2026/001');
    });

    it('searches by producer name', () => {
      const results = filterVouchers(vouchers, { search: 'kovács' });
      expect(results.length).toBe(1);
      expect(results[0].producer_name).toBe('Kovács János');
    });

    it('searches by voucher number', () => {
      const results = filterVouchers(vouchers, { search: '002' });
      expect(results.length).toBe(1);
      expect(results[0].voucher_number).toBe('FJ-2026/002');
    });

    it('searches by line item name', () => {
      const results = filterVouchers(vouchers, { search: 'kukorica' });
      expect(results.length).toBe(1);
      expect(results[0].producer_name).toBe('Nagy Béla');
    });

    it('searches by producer FELIR or card number', () => {
      const results = filterVouchers(vouchers, { search: 'FELIR-9912' });
      expect(results.length).toBe(1);
      expect(results[0].producer_name).toBe('Kovács János');
    });
  });

  describe('validateVoucherForm', () => {
    it('fails when mandatory fields are missing', () => {
      const res = validateVoucherForm({});
      expect(res.isValid).toBe(false);
      expect(res.errors.voucher_number).toBeDefined();
      expect(res.errors.producer_name).toBeDefined();
      expect(res.errors.fulfillment_date).toBeDefined();
      expect(res.errors.items).toBeDefined();
    });

    it('fails when items list has empty item_name or non-positive quantity', () => {
      const res = validateVoucherForm({
        voucher_number: 'FJ-2026/001',
        producer_name: 'Kovács János',
        fulfillment_date: '2026-03-01',
        items: [
          {
            item_name: '',
            quantity: 0,
            unit_of_measure: 'kg',
            unit_price: 100,
          },
        ],
      });
      expect(res.isValid).toBe(false);
      expect(res.errors['item_0_name']).toBeDefined();
      expect(res.errors['item_0_quantity']).toBeDefined();
    });

    it('passes when all required fields and items are valid', () => {
      const res = validateVoucherForm({
        voucher_number: 'FJ-2026/001',
        producer_name: 'Kovács János',
        fulfillment_date: '2026-03-01',
        items: [
          {
            item_name: 'Búza étkezési',
            quantity: 1000,
            unit_of_measure: 'kg',
            unit_price: 85,
          },
        ],
      });
      expect(res.isValid).toBe(true);
      expect(Object.keys(res.errors).length).toBe(0);
    });
  });
});
