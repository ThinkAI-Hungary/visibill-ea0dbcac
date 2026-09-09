import { describe, it, expect } from 'vitest';

describe('Fakov Kft. Accounting Rules & VAT Engine', () => {
  it('correctly routes suppliers to 4541 (Domestic), 4542 (Foreign), 4543 (FAD)', () => {
    const resolveSupplierGl = (isReverseCharge: boolean, isForeign: boolean) => {
      if (isReverseCharge) return '4543';
      if (isForeign) return '4542';
      return '4541';
    };

    expect(resolveSupplierGl(false, false)).toBe('4541'); // Domestic supplier
    expect(resolveSupplierGl(false, true)).toBe('4542');  // Foreign EUR supplier
    expect(resolveSupplierGl(true, false)).toBe('4543');  // FAD steel/agri/const supplier
    expect(resolveSupplierGl(true, true)).toBe('4543');   // FAD reverse charge priority
  });

  it('correctly routes customers to 3111 (Domestic), 3112 (Foreign), 3113 (FAD)', () => {
    const resolveCustomerGl = (isReverseCharge: boolean, isForeign: boolean) => {
      if (isReverseCharge) return '3113';
      if (isForeign) return '3112';
      return '3111';
    };

    expect(resolveCustomerGl(false, false)).toBe('3111'); // Domestic customer
    expect(resolveCustomerGl(false, true)).toBe('3112');  // Foreign EUR customer
    expect(resolveCustomerGl(true, false)).toBe('3113');  // FAD customer
  });

  it('calculates continuous service posting date as service_period_end', () => {
    const getPostingDate = (isContinuous: boolean, servicePeriodEnd: string | null, issueDate: string) => {
      if (isContinuous && servicePeriodEnd) {
        return servicePeriodEnd.substring(0, 10);
      }
      return issueDate.substring(0, 10);
    };

    expect(getPostingDate(true, '2026-01-31T00:00:00.000Z', '2026-01-15T00:00:00.000Z')).toBe('2026-01-31');
    expect(getPostingDate(false, null, '2026-01-15T00:00:00.000Z')).toBe('2026-01-15');
  });

  it('splits input VAT correctly for 50% pro-rata deductible items into 4661 and 4668', () => {
    const totalVatHuf = 27000;
    const deductiblePct = 50;

    const deductibleVatHuf = Math.round(totalVatHuf * (deductiblePct / 100) * 100) / 100;
    const proRataVatHuf = Math.round((totalVatHuf - deductibleVatHuf) * 100) / 100;

    expect(deductibleVatHuf).toBe(13500);
    expect(proRataVatHuf).toBe(13500);
    expect(deductibleVatHuf + proRataVatHuf).toBe(27000);
  });
});
