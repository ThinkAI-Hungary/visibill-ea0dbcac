import { describe, it, expect } from 'vitest';
import { validateAndResolveItemVat } from '@/lib/invoiceItemVatValidation';

describe('InvoiceItemsDialog VAT Resolution & Reverse Charge Scope Guard', () => {
  it('resolves item VAT correctly when parent invoice is reverse charge', () => {
    const parentInvoice = {
      is_reverse_charge: true,
      partner_nev: 'Fakov Kft.',
    };

    const item = {
      id: 'test-item-1',
      line_number: 1,
      line_description: '8mm KORACÉL 6M/SZAL',
      quantity: 10,
      unit_of_measure: 'SZÁL',
      unit_price: 618.8,
      net_amount: 6188,
      gross_amount: 7758,
      vat_amount: 1670,
      vat_rate: '27%',
    };

    // Exactly replicating the TableCell logic inside InvoiceItemsDialog
    const isReverseCharge = parentInvoice?.is_reverse_charge ?? false;
    const isRc = parentInvoice?.is_reverse_charge ?? isReverseCharge;

    expect(() => {
      const val = validateAndResolveItemVat({
        ...item,
        is_reverse_charge: isRc,
      });

      expect(val).toBeDefined();
      expect(val.vatAmount).toBe(0);
      expect(val.grossAmount).toBe(6188);
      expect(val.isAutoCorrected).toBe(true);
    }).not.toThrow();
  });

  it('resolves item VAT correctly when parent invoice is not reverse charge', () => {
    const parentInvoice = {
      is_reverse_charge: false,
      partner_nev: 'Normál Partner Kft.',
    };

    const item = {
      id: 'test-item-2',
      line_number: 1,
      line_description: 'Normál irodaszer',
      quantity: 1,
      unit_of_measure: 'db',
      unit_price: 10000,
      net_amount: 10000,
      gross_amount: 12700,
      vat_amount: 2700,
      vat_rate: '27%',
    };

    const isReverseCharge = parentInvoice?.is_reverse_charge ?? false;
    const isRc = parentInvoice?.is_reverse_charge ?? isReverseCharge;

    expect(() => {
      const val = validateAndResolveItemVat({
        ...item,
        is_reverse_charge: isRc,
      });

      expect(val).toBeDefined();
      expect(val.vatAmount).toBe(2700);
      expect(val.grossAmount).toBe(12700);
      expect(val.isAutoCorrected).toBe(false);
    }).not.toThrow();
  });

  it('safely handles undefined parentInvoice gracefully without reference errors', () => {
    const parentInvoice: any = undefined;

    const item = {
      id: 'test-item-3',
      line_number: 1,
      line_description: 'Ismeretlen számla tétel',
      quantity: 1,
      unit_of_measure: 'db',
      unit_price: 5000,
      net_amount: 5000,
      gross_amount: 6350,
      vat_amount: 1350,
      vat_rate: '27%',
    };

    const isReverseCharge = parentInvoice?.is_reverse_charge ?? false;
    const isRc = parentInvoice?.is_reverse_charge ?? isReverseCharge;

    expect(() => {
      const val = validateAndResolveItemVat({
        ...item,
        is_reverse_charge: isRc,
      });

      expect(val).toBeDefined();
      expect(val.vatAmount).toBe(1350);
      expect(val.grossAmount).toBe(6350);
    }).not.toThrow();
  });
});
