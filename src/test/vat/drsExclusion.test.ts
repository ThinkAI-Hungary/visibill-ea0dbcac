import { describe, it, expect } from 'vitest';

describe('DRS / Mandatory Redemption Fee Exclusion (Áfa tv. 71. §)', () => {
  // Helper matching logic in VatCollectorAnalyticsView
  const isDrsItem = (desc?: string | null, vatAmount?: number | null, rate?: string | null) => {
    if (!desc) return false;
    const d = desc.toLowerCase();
    const isVatZero = !vatAmount || Number(vatAmount) === 0;
    const isRateNonTaxable = !rate || rate === '0' || rate === '0%' || rate.toLowerCase().includes('mentes') || rate.toLowerCase().includes('tam') || rate.toLowerCase().includes('aam') || rate.toLowerCase().includes('atk') || rate.toLowerCase().includes('ahk');
    if (isVatZero || isRateNonTaxable) {
      if (
        d.includes('visszavált') ||
        d.includes('visszavalt') ||
        d.includes('drs') ||
        d.includes('betétdíj') ||
        d.includes('betetdij') ||
        d.includes('kupakdíj') ||
        d.includes('kupakdij') ||
        d.includes('palackdíj') ||
        d.includes('palackdij')
      ) {
        return true;
      }
    }
    return false;
  };

  // Helper matching logic in VatRowDrillDown
  const isExcludedFromVatReturnRow = (lineDescription?: string | null, vatAmount?: number | null) => {
    const desc = String(lineDescription || '').toLowerCase();
    const vat = Number(vatAmount || 0);
    if (vat === 0 && (
      desc.includes('visszavált') ||
      desc.includes('visszavalt') ||
      desc.includes('drs') ||
      desc.includes('betétdíj') ||
      desc.includes('betetdij') ||
      desc.includes('kupakdíj') ||
      desc.includes('kupakdij') ||
      desc.includes('palackdíj') ||
      desc.includes('palackdij')
    )) {
      return true; // Excluded!
    }
    return false;
  };

  it('correctly identifies DRS deposit fee lines with 0 VAT as DRS', () => {
    expect(isDrsItem('Visszaváltási díj 50Ft PET', 0, '0%')).toBe(true);
    expect(isDrsItem('VISSZAVÁLTÁSI DÍJ DRS', null, 'TAM')).toBe(true);
    expect(isDrsItem('DRS betétdíj CP', 0, null)).toBe(true);
    expect(isDrsItem('Kupakdíj MOHU', 0, '0')).toBe(true);
    expect(isDrsItem('Palackdíj 50 Ft', 0, '0%')).toBe(true);
  });

  it('does NOT misclassify taxable beverage items containing DRS in product name', () => {
    // A taxable beverage product has 27% VAT and vat_amount > 0
    expect(isDrsItem('Miller Lime üveges 0,33l DRS', 135, '27%')).toBe(false);
    expect(isDrsItem('Hell energiaital Classic DRS', 81, '0.27')).toBe(false);
    expect(isDrsItem('0,5L PET Pepsi Cola DRS', 108, '27')).toBe(false);
  });

  it('excludes DRS items from VAT return drilldown rows (e.g. Row 63 exempt, Row 66 27%)', () => {
    expect(isExcludedFromVatReturnRow('Visszaváltási díj 50Ft', 0)).toBe(true);
    expect(isExcludedFromVatReturnRow('DRS csomagolás 6db', 0)).toBe(true);
    expect(isExcludedFromVatReturnRow('Betétdíj 50Ft', 0)).toBe(true);

    // Normal non-DRS exempt items are NOT excluded
    expect(isExcludedFromVatReturnRow('Banki jutalék és számlavezetési díj', 0)).toBe(false);
    expect(isExcludedFromVatReturnRow('Orvosi szolgáltatás TAM', 0)).toBe(false);

    // Normal 27% items are NOT excluded
    expect(isExcludedFromVatReturnRow('Coca Cola 0.5L', 108)).toBe(false);
  });
});
