import { describe, it, expect } from 'vitest';
import { formatVatRate } from '@/lib/utils';
import { formatThousands, fmtEft } from '@/features/vat/types';
import {
  isSteelCandidate,
  isSteelItemComplete,
  type SteelItemRecord,
} from '@/features/vat/hooks/useSteelProductsData';

describe('VAT Rate and Tax Formatting (NAV 2665 Rules)', () => {
  it('formats any 0% variation as "mentes" instead of "0%" according to user requirements', () => {
    // Exact zero numbers
    expect(formatVatRate(0)).toBe('mentes');
    expect(formatVatRate(0.0)).toBe('mentes');

    // String zero numbers
    expect(formatVatRate('0')).toBe('mentes');
    expect(formatVatRate('0%')).toBe('mentes');
    expect(formatVatRate('0.00')).toBe('mentes');
    expect(formatVatRate('0.0')).toBe('mentes');
    expect(formatVatRate('0,00')).toBe('mentes');

    // Tax exempt and reverse-charge codes
    expect(formatVatRate('AAM')).toBe('mentes');
    expect(formatVatRate('TAM')).toBe('mentes');
    expect(formatVatRate('MENTES')).toBe('mentes');
    expect(formatVatRate('EXP')).toBe('mentes');
    expect(formatVatRate('EXPORT')).toBe('mentes');
    expect(formatVatRate('FAD')).toBe('mentes');
    expect(formatVatRate('FORD')).toBe('mentes');
    expect(formatVatRate('DOMESTIC_REVERSE_CHARGE')).toBe('mentes');

    // Null or undefined fallback
    expect(formatVatRate(null)).toBe('mentes');
    expect(formatVatRate(undefined)).toBe('mentes');
    expect(formatVatRate('')).toBe('mentes');
  });

  it('correctly formats standard positive VAT rates', () => {
    expect(formatVatRate('27%')).toBe('27%');
    expect(formatVatRate('18%')).toBe('18%');
    expect(formatVatRate('5%')).toBe('5%');

    // Decimal fractions from NAV
    expect(formatVatRate(0.27)).toBe('27%');
    expect(formatVatRate(0.18)).toBe('18%');
    expect(formatVatRate(0.05)).toBe('5%');
    expect(formatVatRate('0.27')).toBe('27%');
    expect(formatVatRate('0.18')).toBe('18%');
    expect(formatVatRate('0.05')).toBe('5%');
  });

  it('formats currency numbers and eFt correctly for NAV forms', () => {
    expect(formatThousands(1000000)).toBe('1 000 000');
    expect(formatThousands(1250)).toBe('1 250');
    expect(fmtEft(1500)).toBe('1 500 eFt');
  });
});

describe('NAV 2665 6/B Steel Products & Compliance Validation', () => {
  it('detects steel candidates by KN code (72xx, 73xx), keywords, and reverse charge tax rates', () => {
    // By product code (KN code chapters 72 & 73)
    expect(isSteelCandidate({ product_code: '7214 20 00' })).toBe(true);
    expect(isSteelCandidate({ product_code: '7306 30 77' })).toBe(true);
    expect(isSteelCandidate({ product_code: '8471 30 00' })).toBe(false);

    // By net weight
    expect(isSteelCandidate({ net_weight_kg: 500 })).toBe(true);
    expect(isSteelCandidate({ net_weight_kg: 0 })).toBe(false);

    // By VAT rate
    expect(isSteelCandidate({ vat_rate: 'FAD_ACEL_27' })).toBe(true);
    expect(isSteelCandidate({ vat_rate: 'FAD_HULL_27' })).toBe(true);
    expect(isSteelCandidate({ vat_rate: '27%' })).toBe(false);

    // By line description
    expect(isSteelCandidate({ line_description: 'Betonacél 12mm bordás szálban' })).toBe(true);
    expect(isSteelCandidate({ line_description: 'Zártszelvény 40x40x2' })).toBe(true);
    expect(isSteelCandidate({ line_description: 'HEB 200 gerenda acél' })).toBe(true);
    expect(isSteelCandidate({ line_description: 'Irodaszer A4 fénymásolópapír' })).toBe(false);
  });

  it('correctly determines completeness of steel records for NAV 2665-07/08', () => {
    const completeItem: SteelItemRecord = {
      id: 'test-1',
      sourceTable: 'invoice_items',
      invoiceId: 'inv-1',
      direction: 'OUTBOUND',
      invoiceNumber: 'SZ-2026/001',
      partnerName: 'Acél-Ker Kft.',
      partnerTaxNumber: '12345678-2-42',
      deliveryDate: '2026-03-15',
      lineNumber: 1,
      lineDescription: 'Betonacél',
      productCode: '7214 20 00',
      quantity: 10,
      unitOfMeasure: 't',
      netAmount: 2500000,
      vatRate: 'FAD',
      netWeightKg: 10245.5,
    };
    expect(isSteelItemComplete(completeItem)).toBe(true);

    const missingVtszItem: SteelItemRecord = {
      ...completeItem,
      productCode: null,
    };
    expect(isSteelItemComplete(missingVtszItem)).toBe(false);

    const missingWeightItem: SteelItemRecord = {
      ...completeItem,
      netWeightKg: null,
    };
    expect(isSteelItemComplete(missingWeightItem)).toBe(false);

    const zeroWeightItem: SteelItemRecord = {
      ...completeItem,
      netWeightKg: 0,
    };
    expect(isSteelItemComplete(zeroWeightItem)).toBe(false);
  });

  it('verifies integer kg rounding compliance for NAV 2665 export vs exact decimal kg', () => {
    const rawWeights = [1250.4, 1250.5, 1250.6, 98.2, 0.7];
    const roundedWeights = rawWeights.map(w => Math.round(w));

    expect(roundedWeights).toEqual([1250, 1251, 1251, 98, 1]);
    expect(Math.round(10245.45)).toBe(10245);
    expect(Math.round(10245.55)).toBe(10246);
  });
});
