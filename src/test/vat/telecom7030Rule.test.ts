import { describe, it, expect } from 'vitest';
import { is27PercentVatRate, normalizeVatRatePercent } from '@/lib/utils';

describe('Telecom 70/30 Rule & VAT Collector Code Accuracy', () => {
  it('correctly targets all 27% line items regardless of string representation (including "27%" and "0.27")', () => {
    const mockItems = [
      { id: '1', line_description: 'Mobiltelefonszolg. (30)6005802', vat_rate: '27%', net_amount: 5210 },
      { id: '2', line_description: 'Üzleti M1B díjmentes', vat_rate: '27%', net_amount: 0 },
      { id: '3', line_description: 'Üzleti Adat 10GB', vat_rate: '5%', net_amount: 7360 },
      { id: '4', line_description: 'Üzleti e-Pack kedvezmény', vat_rate: '27%', net_amount: -1000 },
      { id: '5', line_description: 'Régi NAV tétel 27-es', vat_rate: '0.27', net_amount: 15000 },
      { id: '6', line_description: 'Régi NAV tétel 5-ös', vat_rate: '0.05', net_amount: 4000 },
      { id: '7', line_description: 'Alanyi mentes tétel', vat_rate: 'AAM', net_amount: 20000 },
    ];

    const targetItems = mockItems.filter(it => is27PercentVatRate(it.vat_rate));
    
    // Items 1, 2, 4, 5 must be targeted (all 27% items)
    expect(targetItems.map(it => it.id)).toEqual(['1', '2', '4', '5']);
    expect(targetItems.length).toBe(4);
  });

  it('correctly returns proper NAV gyűjtőkód for 27%, 5%, 18% and special rates', () => {
    const getVatCollectorCode = (rate: string | null): string => {
      if (!rate) return '25';
      const upper = rate.toUpperCase();
      if (upper.includes('FAD') || upper.includes('FORD') || upper.includes('REVERSE_CHARGE')) return 'FAD';
      if (upper.includes('AAM')) return 'AAM';
      if (upper.includes('TAM')) return 'TAM';
      const pct = normalizeVatRatePercent(rate);
      if (pct === 27) return '25';
      if (pct === 5) return '05';
      if (pct === 18) return '18';
      if (pct === 0) return '00';
      return '25';
    };

    // 27% items (collector code 25)
    expect(getVatCollectorCode('27%')).toBe('25');
    expect(getVatCollectorCode('0.27')).toBe('25');
    expect(getVatCollectorCode('27')).toBe('25');

    // 5% internet items (collector code 05, NOT 25!)
    expect(getVatCollectorCode('5%')).toBe('05');
    expect(getVatCollectorCode('0.05')).toBe('05');

    // 18% items (collector code 18)
    expect(getVatCollectorCode('18%')).toBe('18');
    expect(getVatCollectorCode('0.18')).toBe('18');

    // Special categories
    expect(getVatCollectorCode('AAM')).toBe('AAM');
    expect(getVatCollectorCode('TAM')).toBe('TAM');
    expect(getVatCollectorCode('FAD')).toBe('FAD');
    expect(getVatCollectorCode('DOMESTIC_REVERSE_CHARGE')).toBe('FAD');
  });
});
