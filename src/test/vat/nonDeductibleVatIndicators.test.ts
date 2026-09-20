import { describe, it, expect } from 'vitest';

/**
 * Business rule test suite for Non-deductible VAT indicators:
 * Option 1: Modal totals breakdown
 * Option 2: Table list row discrete indicator badge
 * Option 3: Expanded row accounting classification card
 */

interface LineItemSample {
  id: string;
  net_amount: number | null;
  vat_amount: number | null;
  vat_rate: string | null;
  deductible_percentage: number | null;
}

function calculateInvoiceTotals(items: LineItemSample[], isOutbound: boolean) {
  let net = 0;
  let vat = 0;
  let deductibleVat = 0;
  let nonDeductibleVat = 0;
  let hasNonDeductible = false;
  let minPercentage = 100;

  for (const item of items) {
    const itemNet = item.net_amount || 0;
    let itemVat = item.vat_amount;
    if ((itemVat === null || itemVat === 0 || itemVat === undefined) && item.net_amount && item.vat_rate) {
      const num = parseFloat(item.vat_rate);
      if (!isNaN(num) && num > 0) {
        const rate = num >= 1 ? num / 100 : num;
        itemVat = Math.round(item.net_amount * rate);
      }
    }
    const safeVat = itemVat || 0;

    net += itemNet;
    vat += safeVat;

    const pct = item.deductible_percentage != null ? Number(item.deductible_percentage) : 100;
    if (pct < 100) {
      hasNonDeductible = true;
      minPercentage = Math.min(minPercentage, pct);
    }
    const itemDeductible = Math.round(safeVat * (pct / 100));
    deductibleVat += itemDeductible;
    nonDeductibleVat += (safeVat - itemDeductible);
  }

  return {
    net,
    vat,
    deductibleVat,
    nonDeductibleVat,
    hasNonDeductible: hasNonDeductible && nonDeductibleVat > 0 && !isOutbound,
    minPercentage,
  };
}

describe('Non-Deductible VAT Calculations and Indicators', () => {
  it('correctly calculates 70/30 telecom split for Single Item (One Magyarország example)', () => {
    const items: LineItemSample[] = [
      {
        id: 'item-1',
        net_amount: 6519.7,
        vat_amount: 1760.32,
        vat_rate: '27%',
        deductible_percentage: 70,
      },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.vat).toBe(1760.32);
    expect(result.deductibleVat).toBe(1232); // Math.round(1760.32 * 0.7) = 1232
    expect(result.nonDeductibleVat).toBeCloseTo(528.32, 2);
    expect(result.hasNonDeductible).toBe(true);
    expect(result.minPercentage).toBe(70);
  });

  it('correctly calculates 0% non-deductible items (OMV fuel / representation)', () => {
    const items: LineItemSample[] = [
      {
        id: 'item-omv',
        net_amount: 18626,
        vat_amount: 5029,
        vat_rate: '27%',
        deductible_percentage: 0,
      },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.vat).toBe(5029);
    expect(result.deductibleVat).toBe(0);
    expect(result.nonDeductibleVat).toBe(5029);
    expect(result.hasNonDeductible).toBe(true);
    expect(result.minPercentage).toBe(0);
  });

  it('correctly handles mixed invoice (one 70% item and one 100% deductible item)', () => {
    const items: LineItemSample[] = [
      {
        id: 'phone-item',
        net_amount: 10000,
        vat_amount: 2700,
        vat_rate: '27%',
        deductible_percentage: 70, // 70% deductible -> 1890 ded, 810 non-ded
      },
      {
        id: 'hardware-item',
        net_amount: 20000,
        vat_amount: 5400,
        vat_rate: '27%',
        deductible_percentage: 100, // 100% deductible -> 5400 ded, 0 non-ded
      },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.vat).toBe(8100);
    expect(result.deductibleVat).toBe(1890 + 5400); // 7290
    expect(result.nonDeductibleVat).toBe(810);
    expect(result.hasNonDeductible).toBe(true);
    expect(result.minPercentage).toBe(70);
  });

  it('does NOT activate non-deductible warning on OUTBOUND invoices (vevői számlák)', () => {
    const items: LineItemSample[] = [
      {
        id: 'outbound-item',
        net_amount: 10000,
        vat_amount: 2700,
        vat_rate: '27%',
        deductible_percentage: 70, // Even if set by mistake on outbound
      },
    ];

    const result = calculateInvoiceTotals(items, true); // isOutbound = true

    expect(result.hasNonDeductible).toBe(false);
  });

  it('does NOT flag zero VAT items with non-deductible indicator when nonDeductibleVat is 0', () => {
    const items: LineItemSample[] = [
      {
        id: 'aam-item',
        net_amount: 5000,
        vat_amount: 0,
        vat_rate: 'AAM',
        deductible_percentage: 0, // 0% of 0 is 0
      },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.vat).toBe(0);
    expect(result.deductibleVat).toBe(0);
    expect(result.nonDeductibleVat).toBe(0);
    expect(result.hasNonDeductible).toBe(false);
  });

  it('correctly calculates 50/50 car lease / rental split', () => {
    const items: LineItemSample[] = [
      {
        id: 'car-lease',
        net_amount: 100000,
        vat_amount: 27000,
        vat_rate: '27%',
        deductible_percentage: 50,
      },
    ];

    const result = calculateInvoiceTotals(items, false);

    expect(result.vat).toBe(27000);
    expect(result.deductibleVat).toBe(13500);
    expect(result.nonDeductibleVat).toBe(13500);
    expect(result.hasNonDeductible).toBe(true);
    expect(result.minPercentage).toBe(50);
  });
});
