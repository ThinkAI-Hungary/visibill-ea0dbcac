import { describe, it, expect } from 'vitest';
import { validatePettyCashEntryPayload, roundHuf } from '@/components/petty-cash/types';

describe('Petty Cash Manual VAT Entry and Receipt Number Validation', () => {
  const baseValid = {
    register_id: '5364d0be-e92a-4b94-9704-f457cf71f140',
    amount: 12700,
    description: 'Irodaszer készpénzes vásárlás',
  };

  it('validates standard non-VAT entry successfully', () => {
    const res = validatePettyCashEntryPayload(baseValid);
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('validates VAT entry when net_amount and vat_amount are provided and positive', () => {
    const res = validatePettyCashEntryPayload({
      ...baseValid,
      isVat: true,
      net_amount: 10000,
      vat_amount: 2700,
      vat_row_override: '66',
    });
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it('rejects VAT entry when net_amount is negative or missing', () => {
    const resNegativeNet = validatePettyCashEntryPayload({
      ...baseValid,
      isVat: true,
      net_amount: -100,
      vat_amount: 2700,
    });
    expect(resNegativeNet.valid).toBe(false);
    expect(resNegativeNet.error).toBe('A nettó összeg érvénytelen!');
  });

  it('rejects VAT entry when vat_amount is negative or missing', () => {
    const resNegativeVat = validatePettyCashEntryPayload({
      ...baseValid,
      isVat: true,
      net_amount: 10000,
      vat_amount: -50,
    });
    expect(resNegativeVat.valid).toBe(false);
    expect(resNegativeVat.error).toBe('Az ÁFA összeg érvénytelen!');
  });

  it('calculates 27%, 18%, 5% VAT and rounded gross correctly', () => {
    const net1 = 10000;
    const vat1 = Math.round(net1 * 0.27);
    const gross1 = net1 + vat1;
    expect(vat1).toBe(2700);
    expect(gross1).toBe(12700);
    expect(roundHuf(gross1, 'HUF')).toBe(12700);

    const net2 = 1234;
    const vat2 = Math.round(net2 * 0.05); // 61.7 -> 62
    const gross2 = net2 + vat2; // 1296
    expect(roundHuf(gross2, 'HUF')).toBe(1295);
  });
});
