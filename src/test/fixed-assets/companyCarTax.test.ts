import { describe, it, expect } from 'vitest';
import {
  calculateMonthlyCompanyCarTaxRate,
  isMonthTaxable,
  getQuarterDueDate,
  getVehicleTaxDueDate,
  calculateCarQuarterTax,
} from '@/lib/fixed-assets/companyCarTaxService';
import type { CompanyCar, CompanyCarTaxPayment } from '@/types/company-car-tax';

describe('companyCarTaxService', () => {
  describe('calculateMonthlyCompanyCarTaxRate', () => {
    it('returns 0 for green electric or tax exempt vehicles', () => {
      expect(calculateMonthlyCompanyCarTaxRate(150, 'GREEN_ELECTRIC')).toBe(0);
      expect(calculateMonthlyCompanyCarTaxRate(200, 'EURO_5_6', true)).toBe(0);
    });

    it('calculates correct statutory rates for EURO_5_6 modern cars', () => {
      expect(calculateMonthlyCompanyCarTaxRate(45, 'EURO_5_6')).toBe(14000);
      expect(calculateMonthlyCompanyCarTaxRate(50, 'EURO_5_6')).toBe(14000);
      expect(calculateMonthlyCompanyCarTaxRate(75, 'EURO_5_6')).toBe(19800);
      expect(calculateMonthlyCompanyCarTaxRate(90, 'EURO_5_6')).toBe(19800);
      expect(calculateMonthlyCompanyCarTaxRate(110, 'EURO_5_6')).toBe(26200);
      expect(calculateMonthlyCompanyCarTaxRate(120, 'EURO_5_6')).toBe(26200);
      expect(calculateMonthlyCompanyCarTaxRate(140, 'EURO_5_6')).toBe(41000);
    });

    it('calculates correct statutory rates for EURO_3_4 medium cars', () => {
      expect(calculateMonthlyCompanyCarTaxRate(45, 'EURO_3_4')).toBe(16500);
      expect(calculateMonthlyCompanyCarTaxRate(75, 'EURO_3_4')).toBe(24000);
      expect(calculateMonthlyCompanyCarTaxRate(110, 'EURO_3_4')).toBe(32000);
      expect(calculateMonthlyCompanyCarTaxRate(140, 'EURO_3_4')).toBe(52000);
    });

    it('calculates correct statutory rates for EURO_0_2 older cars', () => {
      expect(calculateMonthlyCompanyCarTaxRate(45, 'EURO_0_2')).toBe(22000);
      expect(calculateMonthlyCompanyCarTaxRate(75, 'EURO_0_2')).toBe(34000);
      expect(calculateMonthlyCompanyCarTaxRate(110, 'EURO_0_2')).toBe(46000);
      expect(calculateMonthlyCompanyCarTaxRate(140, 'EURO_0_2')).toBe(81000);
    });
  });

  describe('isMonthTaxable', () => {
    it('marks all months taxable for year-round liability', () => {
      expect(isMonthTaxable(2026, 1, '2025-01-01', null)).toBe(true);
      expect(isMonthTaxable(2026, 6, '2025-01-01', null)).toBe(true);
      expect(isMonthTaxable(2026, 12, '2025-01-01', null)).toBe(true);
    });

    it('accurately detects mid-year purchase month', () => {
      // Purchased on May 15, 2026 => Taxable from May, not before
      expect(isMonthTaxable(2026, 4, '2026-05-15', null)).toBe(false);
      expect(isMonthTaxable(2026, 5, '2026-05-15', null)).toBe(true);
      expect(isMonthTaxable(2026, 6, '2026-05-15', null)).toBe(true);
    });

    it('accurately detects mid-year disposal month', () => {
      // Disposed on August 20, 2026 (liability ends Aug 31, 2026)
      expect(isMonthTaxable(2026, 8, '2026-01-01', '2026-08-31')).toBe(true);
      expect(isMonthTaxable(2026, 9, '2026-01-01', '2026-08-31')).toBe(false);
    });
  });

  describe('quarter and vehicle tax due dates', () => {
    it('returns statutory quarter due dates', () => {
      expect(getQuarterDueDate(2026, 1)).toBe('2026-04-20');
      expect(getQuarterDueDate(2026, 2)).toBe('2026-07-20');
      expect(getQuarterDueDate(2026, 3)).toBe('2026-10-20');
      expect(getQuarterDueDate(2026, 4)).toBe('2027-01-20');
    });

    it('returns vehicle tax (súlyadó) due dates', () => {
      expect(getVehicleTaxDueDate(2026, 1)).toBe('2026-04-15');
      expect(getVehicleTaxDueDate(2026, 2)).toBe('2026-04-15');
      expect(getVehicleTaxDueDate(2026, 3)).toBe('2026-09-15');
      expect(getVehicleTaxDueDate(2026, 4)).toBe('2026-09-15');
    });
  });

  describe('calculateCarQuarterTax', () => {
    const car: Pick<CompanyCar, 'tax_liability_from' | 'tax_liability_to' | 'monthly_tax_rate' | 'is_tax_exempt' | 'engine_power_kw' | 'environmental_category'> = {
      engine_power_kw: 85, // 19 800 Ft/hó
      environmental_category: 'EURO_5_6',
      tax_liability_from: '2026-01-01',
      tax_liability_to: null,
      monthly_tax_rate: 19800,
      is_tax_exempt: false,
    };

    it('calculates full quarter gross tax (3 x 19 800 = 59 400 Ft)', () => {
      const calc = calculateCarQuarterTax(car, 2026, 1, []);
      expect(calc.activeMonthsCount).toBe(3);
      expect(calc.grossQuarterlyTax).toBe(59400);
      expect(calc.deductibleVehicleTax).toBe(0);
      expect(calc.netPayableTax).toBe(59400);
      expect(calc.dueDate).toBe('2026-04-20');
    });

    it('deducts timely paid vehicle tax', () => {
      const payments: CompanyCarTaxPayment[] = [
        {
          id: 'pay-1',
          company_id: 'c1',
          car_id: 'car-1',
          tax_year: 2026,
          quarter: 1,
          paid_amount: 14500,
          payment_date: '2026-04-10', // Timely (due: 2026-04-15)
          due_date: '2026-04-15',
          is_deductible: true,
          notes: null,
          created_at: '',
        },
      ];

      const calc = calculateCarQuarterTax(car, 2026, 1, payments);
      expect(calc.grossQuarterlyTax).toBe(59400);
      expect(calc.deductibleVehicleTax).toBe(14500);
      expect(calc.latePaidVehicleTax).toBe(0);
      expect(calc.netPayableTax).toBe(44900); // 59 400 - 14 500
    });

    it('does NOT deduct late paid vehicle tax and flags it as late', () => {
      const payments: CompanyCarTaxPayment[] = [
        {
          id: 'pay-1',
          company_id: 'c1',
          car_id: 'car-1',
          tax_year: 2026,
          quarter: 1,
          paid_amount: 14500,
          payment_date: '2026-04-20', // Late (after due: 2026-04-15)
          due_date: '2026-04-15',
          is_deductible: true,
          notes: null,
          created_at: '',
        },
      ];

      const calc = calculateCarQuarterTax(car, 2026, 1, payments);
      expect(calc.grossQuarterlyTax).toBe(59400);
      expect(calc.deductibleVehicleTax).toBe(0);
      expect(calc.latePaidVehicleTax).toBe(14500);
      expect(calc.netPayableTax).toBe(59400); // Cannot deduct late payment
    });

    it('prevents net tax from going below zero when deduction exceeds tax', () => {
      const payments: CompanyCarTaxPayment[] = [
        {
          id: 'pay-1',
          company_id: 'c1',
          car_id: 'car-1',
          tax_year: 2026,
          quarter: 1,
          paid_amount: 80000,
          payment_date: '2026-04-12',
          due_date: '2026-04-15',
          is_deductible: true,
          notes: null,
          created_at: '',
        },
      ];

      const calc = calculateCarQuarterTax(car, 2026, 1, payments);
      expect(calc.grossQuarterlyTax).toBe(59400);
      expect(calc.deductibleVehicleTax).toBe(80000);
      expect(calc.netPayableTax).toBe(0);
    });

    it('calculates partial quarter if car acquired in second month of quarter (February)', () => {
      const midCar = {
        ...car,
        tax_liability_from: '2026-02-10', // Feb, Mar = 2 months
      };

      const calc = calculateCarQuarterTax(midCar, 2026, 1, []);
      expect(calc.activeMonthsCount).toBe(2);
      expect(calc.grossQuarterlyTax).toBe(39600); // 2 x 19 800
      expect(calc.monthsActive[0].isTaxable).toBe(false); // Jan
      expect(calc.monthsActive[1].isTaxable).toBe(true);  // Feb
      expect(calc.monthsActive[2].isTaxable).toBe(true);  // Mar
    });
  });
});
