import { describe, it, expect } from 'vitest';
import { generateDeclarationJournalLines } from '@/features/vat/services/importCustomsAccounting';
import { ImportCustomsDeclaration } from '@/features/vat/types/importVat';

describe('Import ÁFA (Termékimport) Calculations & Statutory Rules', () => {
  // Áfa tv. 74-75. § & 81. § Adóalap és Vámérték kalkuláció
  const calculateCustomsVatBase = (
    foreignAmount: number,
    exchangeRate: number,
    customsDuty: number,
    otherCosts: number
  ) => {
    const customsValueHuf = Math.round(foreignAmount * exchangeRate);
    const vatBaseHuf = Math.round(customsValueHuf + customsDuty + otherCosts);
    return { customsValueHuf, vatBaseHuf };
  };

  it('correctly calculates customs value and import VAT base according to Áfa tv. 74-75. §', () => {
    // 10,000 EUR invoice with 395.50 HUF customs exchange rate, 150,000 HUF duty, and 50,000 HUF domestic freight
    const { customsValueHuf, vatBaseHuf } = calculateCustomsVatBase(10000, 395.5, 150000, 50000);

    expect(customsValueHuf).toBe(3955000);
    // Vámérték (3,955,000) + Vám (150,000) + Járulékos költség (50,000) = 4,155,000 HUF
    expect(vatBaseHuf).toBe(4155000);

    // 27% import VAT on this base
    const vatAmount27 = Math.round(vatBaseHuf * 0.27);
    expect(vatAmount27).toBe(1121850);
  });

  describe('Double-Entry Bookkeeping Journal Posting (Szt. 47. §, Áfa tv. 120., 154-156. §)', () => {
    it('generates correct GL entries for LEVY import VAT (Kivetés) when PAID', () => {
      const declaration: ImportCustomsDeclaration = {
        id: 'decl-001',
        company_id: 'comp-001',
        declaration_number: '26HU0012345678',
        decision_date: '2026-01-10',
        tax_period_date: '2026-01-10',
        procedure_type: 'LEVY',
        status: 'PAID',
        foreign_supplier_name: 'Shenzhen Tech Ltd.',
        foreign_currency: 'EUR',
        foreign_invoice_amount: 10000,
        customs_exchange_rate: 395.5,
        customs_value_huf: 3955000,
        customs_duty_huf: 150000,
        other_import_costs_huf: 50000,
        vat_base_huf: 4155000,
        vat_code: 'IMP_KIV_27',
        vat_rate_percent: 27,
        vat_amount_huf: 1121850,
        is_deductible: true,
        payment_status: 'PAID',
        payment_date: '2026-01-15',
        bank_transaction_ref: 'KH-BANK-20260115',
      };

      const lines = generateDeclarationJournalLines(declaration);

      expect(lines).toHaveLength(3);

      // Line 1: Vám előírása a bekerülési értékbe (T 261 / K 465)
      expect(lines[0].debitAccount).toBe('261');
      expect(lines[0].creditAccount).toBe('465');
      expect(lines[0].amount).toBe(150000);

      // Line 2: Kivetett áfa előírása (T 368 / K 465)
      expect(lines[1].debitAccount).toBe('368');
      expect(lines[1].creditAccount).toBe('465');
      expect(lines[1].amount).toBe(1121850);
      expect(lines[1].vatBase).toBe(4155000);

      // Line 3: Megfizetéskor levonhatóvá válás átvezetése (T 466 / K 368)
      expect(lines[2].debitAccount).toBe('466');
      expect(lines[2].creditAccount).toBe('368');
      expect(lines[2].amount).toBe(1121850);
    });

    it('does NOT generate line 3 (T 466 / K 368) if LEVY import VAT is still PENDING payment', () => {
      const declaration: ImportCustomsDeclaration = {
        id: 'decl-002',
        company_id: 'comp-001',
        declaration_number: '26HU9988776655',
        decision_date: '2026-01-10',
        tax_period_date: '2026-01-10',
        procedure_type: 'LEVY',
        status: 'CONFIRMED',
        foreign_supplier_name: 'Tokyo Export Co.',
        foreign_currency: 'USD',
        foreign_invoice_amount: 5000,
        customs_exchange_rate: 360.0,
        customs_value_huf: 1800000,
        customs_duty_huf: 80000,
        other_import_costs_huf: 20000,
        vat_base_huf: 1900000,
        vat_code: 'IMP_KIV_27',
        vat_rate_percent: 27,
        vat_amount_huf: 513000,
        is_deductible: true,
        payment_status: 'PENDING',
      };

      const lines = generateDeclarationJournalLines(declaration);

      // Only Duty (T 261 / K 465) and Assessment (T 368 / K 465), NO deduction yet!
      expect(lines).toHaveLength(2);
      expect(lines.find((l) => l.debitAccount === '466')).toBeUndefined();
      expect(lines[1].debitAccount).toBe('368');
      expect(lines[1].creditAccount).toBe('465');
    });

    it('generates T 261 / K 368 for non-deductible LEVY import VAT upon payment', () => {
      const declaration: ImportCustomsDeclaration = {
        id: 'decl-003',
        company_id: 'comp-001',
        declaration_number: '26HU3333333333',
        decision_date: '2026-01-10',
        tax_period_date: '2026-01-10',
        procedure_type: 'LEVY',
        status: 'PAID',
        foreign_supplier_name: 'Geneva Trading',
        foreign_currency: 'CHF',
        foreign_invoice_amount: 2000,
        customs_exchange_rate: 420.0,
        customs_value_huf: 840000,
        customs_duty_huf: 40000,
        other_import_costs_huf: 0,
        vat_base_huf: 880000,
        vat_code: 'IMP_NEM_LEV',
        vat_rate_percent: 27,
        vat_amount_huf: 237600,
        is_deductible: false,
        payment_status: 'PAID',
        payment_date: '2026-01-18',
      };

      const lines = generateDeclarationJournalLines(declaration);
      expect(lines).toHaveLength(3);
      // Non-deductible VAT posted to asset/cost (T 261 / K 368)
      expect(lines[2].debitAccount).toBe('261');
      expect(lines[2].creditAccount).toBe('368');
      expect(lines[2].amount).toBe(237600);
    });

    it('generates correct GL entries for SELF_ASSESSMENT import (Önadózás)', () => {
      const declaration: ImportCustomsDeclaration = {
        id: 'decl-004',
        company_id: 'comp-001',
        declaration_number: '26HUONADOZAS01',
        decision_date: '2026-01-20',
        tax_period_date: '2026-01-20',
        procedure_type: 'SELF_ASSESSMENT',
        status: 'CONFIRMED',
        foreign_supplier_name: 'Chicago Parts Inc.',
        foreign_currency: 'USD',
        foreign_invoice_amount: 8000,
        customs_exchange_rate: 360.0,
        customs_value_huf: 2880000,
        customs_duty_huf: 120000,
        other_import_costs_huf: 0,
        vat_base_huf: 3000000,
        vat_code: 'IMP_ON_27',
        vat_rate_percent: 27,
        vat_amount_huf: 810000,
        is_deductible: true,
        payment_status: 'PENDING',
      };

      const lines = generateDeclarationJournalLines(declaration);
      expect(lines).toHaveLength(2);

      // Line 1: Kiszabott vám (T 261 / K 465)
      expect(lines[0].debitAccount).toBe('261');
      expect(lines[0].creditAccount).toBe('465');
      expect(lines[0].amount).toBe(120000);

      // Line 2: Önadózásos ÁFA egyszerre levonható és fizetendő (T 466 / K 467)
      expect(lines[1].debitAccount).toBe('466');
      expect(lines[1].creditAccount).toBe('467');
      expect(lines[1].amount).toBe(810000);
    });
  });

  describe('NAV 2665 Tax Return Row Routing & Gating Rules', () => {
    // Simulator matching calculate_hungarian_vat_return logic
    const routeDeclarationToVatReturnRows = (
      declaration: ImportCustomsDeclaration,
      dateFrom: string,
      dateTo: string
    ) => {
      const rows: Record<string, { base: number; tax: number }> = {};

      const add = (row: string, base: number, tax: number) => {
        if (!rows[row]) rows[row] = { base: 0, tax: 0 };
        rows[row].base += base;
        rows[row].tax += tax;
      };

      if (declaration.procedure_type === 'LEVY') {
        // Áfa tv. 120. § c) & 127. § (1) c): ONLY when actually paid within return period!
        if (
          declaration.is_deductible &&
          declaration.payment_status === 'PAID' &&
          declaration.payment_date &&
          declaration.payment_date >= dateFrom &&
          declaration.payment_date <= dateTo
        ) {
          add('70', declaration.vat_base_huf, declaration.vat_amount_huf);
        }
      } else if (declaration.procedure_type === 'SELF_ASSESSMENT') {
        // Enters within tax period date
        if (declaration.tax_period_date >= dateFrom && declaration.tax_period_date <= dateTo) {
          // Payable rows (24, 25, 26)
          if (declaration.vat_rate_percent === 5) {
            add('24', declaration.vat_base_huf, declaration.vat_amount_huf);
          } else if (declaration.vat_rate_percent === 18) {
            add('25', declaration.vat_base_huf, declaration.vat_amount_huf);
          } else {
            add('26', declaration.vat_base_huf, declaration.vat_amount_huf);
          }

          // Deductible row 71
          if (declaration.is_deductible) {
            add('71', declaration.vat_base_huf, declaration.vat_amount_huf);
          }
        }
      }

      // Exempt procedure 42
      if (
        declaration.vat_code === 'IMP_MENTES' &&
        declaration.tax_period_date >= dateFrom &&
        declaration.tax_period_date <= dateTo
      ) {
        add('23', declaration.vat_base_huf, 0);
      }

      return rows;
    };

    it('routes PAID LEVY declaration to row 70 in payment month, and NOT in decision month if different', () => {
      const decl: ImportCustomsDeclaration = {
        id: 'd1',
        company_id: 'c1',
        declaration_number: '26HU-JAN-PAY-FEB',
        decision_date: '2026-01-28',
        tax_period_date: '2026-01-28',
        procedure_type: 'LEVY',
        status: 'PAID',
        foreign_currency: 'EUR',
        foreign_invoice_amount: 1000,
        customs_exchange_rate: 400,
        customs_value_huf: 400000,
        customs_duty_huf: 0,
        other_import_costs_huf: 0,
        vat_base_huf: 400000,
        vat_code: 'IMP_KIV_27',
        vat_rate_percent: 27,
        vat_amount_huf: 108000,
        is_deductible: true,
        payment_status: 'PAID',
        payment_date: '2026-02-05', // Paid in FEBRUARY
      };

      // January 2026 return
      const janRows = routeDeclarationToVatReturnRows(decl, '2026-01-01', '2026-01-31');
      expect(janRows['70']).toBeUndefined(); // NOT deductible in January!

      // February 2026 return
      const febRows = routeDeclarationToVatReturnRows(decl, '2026-02-01', '2026-02-28');
      expect(febRows['70']).toBeDefined();
      expect(febRows['70'].base).toBe(400000);
      expect(febRows['70'].tax).toBe(108000);
    });

    it('routes SELF_ASSESSMENT declaration simultaneously to Row 26 (payable) and Row 71 (deductible)', () => {
      const decl: ImportCustomsDeclaration = {
        id: 'd2',
        company_id: 'c1',
        declaration_number: '26HU-ONADOZAS',
        decision_date: '2026-01-15',
        tax_period_date: '2026-01-15',
        procedure_type: 'SELF_ASSESSMENT',
        status: 'CONFIRMED',
        foreign_currency: 'EUR',
        foreign_invoice_amount: 2000,
        customs_exchange_rate: 400,
        customs_value_huf: 800000,
        customs_duty_huf: 0,
        other_import_costs_huf: 0,
        vat_base_huf: 800000,
        vat_code: 'IMP_ON_27',
        vat_rate_percent: 27,
        vat_amount_huf: 216000,
        is_deductible: true,
        payment_status: 'PENDING',
      };

      const rows = routeDeclarationToVatReturnRows(decl, '2026-01-01', '2026-01-31');

      // Row 26 (Payable 27% import)
      expect(rows['26']).toBeDefined();
      expect(rows['26'].base).toBe(800000);
      expect(rows['26'].tax).toBe(216000);

      // Row 71 (Deductible self-assessed import)
      expect(rows['71']).toBeDefined();
      expect(rows['71'].base).toBe(800000);
      expect(rows['71'].tax).toBe(216000);

      // Net impact on cash is 0
      expect(rows['26'].tax - rows['71'].tax).toBe(0);
    });

    it('routes exempt import (Áfa tv. 95. § / 42-es eljárás) to Row 23 base only', () => {
      const decl: ImportCustomsDeclaration = {
        id: 'd3',
        company_id: 'c1',
        declaration_number: '26HU-MENTES-42',
        decision_date: '2026-01-15',
        tax_period_date: '2026-01-15',
        procedure_type: 'SELF_ASSESSMENT',
        status: 'CONFIRMED',
        foreign_currency: 'EUR',
        foreign_invoice_amount: 5000,
        customs_exchange_rate: 400,
        customs_value_huf: 2000000,
        customs_duty_huf: 0,
        other_import_costs_huf: 0,
        vat_base_huf: 2000000,
        vat_code: 'IMP_MENTES',
        vat_rate_percent: 0,
        vat_amount_huf: 0,
        is_deductible: false,
        payment_status: 'PENDING',
      };

      const rows = routeDeclarationToVatReturnRows(decl, '2026-01-01', '2026-01-31');
      expect(rows['23']).toBeDefined();
      expect(rows['23'].base).toBe(2000000);
      expect(rows['23'].tax).toBe(0);
    });
  });
});
