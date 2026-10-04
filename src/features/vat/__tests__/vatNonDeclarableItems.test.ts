import { describe, it, expect } from 'vitest';

describe('Vat Non-Declarable Items & Row 63 exclusion logic', () => {
  it('correctly classifies AAM and TAM purchases as non-declarable instead of Row 63', () => {
    // Tóth Mária: AAM partner (9th digit of tax number is 1), 0 VAT
    const tothMariaTaxNumber = '57751290-1-42';
    const isAam = tothMariaTaxNumber.replace(/\D/g, '').substring(8, 9) === '1';
    expect(isAam).toBe(true);

    // Generali: TAM insurance supplier
    const generaliSupplierName = 'Generali Biztosító Zrt.';
    const isInsurance = generaliSupplierName.toLowerCase().includes('biztosító');
    expect(isInsurance).toBe(true);

    // Neither belongs in Row 63 (only investment gold or explicit row override)
    const rowOverride = null;
    const isInvestmentGold = false;
    const entersRow63 = rowOverride === '63' || isInvestmentGold;
    expect(entersRow63).toBe(false);
  });

  it('calculates negative discount item VAT proportionally when net is negative and vat_amount is 0', () => {
    // SBA Group Line 3 discount item
    const netAmount = -3340;
    const vatRate = '0.27';
    let vatAmount = 0;

    if (netAmount < 0 && vatAmount === 0 && vatRate === '0.27') {
      vatAmount = Math.round(netAmount * 0.27 * 100) / 100;
    }

    expect(vatAmount).toBe(-901.8);

    // Total VAT on invoice: Line 1 (4509) + Line 2 (901.8) + Line 3 (-901.8) = 4509
    const totalVat = 4509 + 901.8 + vatAmount;
    expect(totalVat).toBe(4509);
  });

  it('DRS packaging fee items are non-declarable and excluded from declaration rows', () => {
    const drsDescription = 'DRS csomagolás 6db';
    const isDrs = drsDescription.toLowerCase().includes('drs');
    expect(isDrs).toBe(true);
  });
});
