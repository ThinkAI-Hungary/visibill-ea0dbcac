import { describe, it, expect } from 'vitest';
import { calculateDepreciation, calculateAnnualDepreciation } from '@/hooks/useDepreciation';

describe('assetDepreciationExtended (TENY Extended Engine)', () => {
  describe('1. Kétirányú leírási kulcs felülbírálat (depreciationRatePercent)', () => {
    it('felülbírálja a hasznos élettartamból kalkulált kulcsot a megadott százalékkal', () => {
      // 1 200 000 Ft eszköz, hasznos élettartam 60 hó (alapesetben 20% lenne),
      // de a könyvelő egyedi 14.5%-os kulcsot adott meg
      const res = calculateDepreciation({
        acquisitionValue: 1200000,
        residualValue: 0,
        activationDate: new Date('2026-01-01'),
        usefulLifeMonths: 60,
        taoRatePercent: 14.5,
        depreciationRatePercent: 14.5,
        calculationDate: new Date('2027-01-01'), // 12 hónap
      });

      // Éves amortizáció: 1 200 000 * 14.5% = 174 000 Ft
      // Havi amortizáció: 174 000 / 12 = 14 500 Ft
      expect(res.accounting.ratePercent).toBe(14.5);
      expect(res.accounting.monthly).toBe(14500);
      expect(res.accounting.accumulated).toBe(174000);
      expect(res.accounting.bookValue).toBe(1026000);
    });
  });

  describe('2. Eltérő TAO alap (taxDepreciationBase)', () => {
    it('a megadott eltérő alapból számolja a TAO ÉCS-t a bekerülési érték helyett', () => {
      // Bekerülési érték 10 000 000 Ft, de a TAO alap csak 8 000 000 Ft
      const res = calculateDepreciation({
        acquisitionValue: 10000000,
        residualValue: 0,
        activationDate: new Date('2026-01-01'),
        usefulLifeMonths: 60,
        taoRatePercent: 20,
        taxDepreciationBase: 8000000,
        calculationDate: new Date('2027-01-01'), // 1 év
      });

      // Számviteli: 10M / 5 év = 2 000 000 Ft / év
      expect(res.accounting.accumulated).toBe(2000000);
      expect(res.accounting.bookValue).toBe(8000000);

      // TAO: 8M * 20% = 1 600 000 Ft / év; havi: 133 333 Ft
      expect(res.tax.taxBase).toBe(8000000);
      expect(res.tax.monthly).toBe(133333);
      expect(res.tax.accumulated).toBe(1600000);
      expect(res.tax.bookValue).toBe(6400000);
    });

    it('figyelembe veszi a fejlesztési tartalékot az eltérő TAO alapból levonva', () => {
      const res = calculateDepreciation({
        acquisitionValue: 10000000,
        residualValue: 0,
        activationDate: new Date('2026-01-01'),
        usefulLifeMonths: 60,
        taoRatePercent: 20,
        taxDepreciationBase: 8000000,
        developmentReserveAmount: 3000000,
        calculationDate: new Date('2027-01-01'),
      });

      // TAO alap = 8 000 000 - 3 000 000 = 5 000 000 Ft
      // Éves ÉCS = 5 000 000 * 20% = 1 000 000 Ft
      expect(res.tax.taxBase).toBe(5000000);
      expect(res.tax.developmentReserveDeduction).toBe(3000000);
      expect(res.tax.accumulated).toBe(1000000);
      expect(res.tax.bookValue).toBe(4000000);
    });
  });

  describe('3. Pályázatos ÉCS 3. pálya (grant)', () => {
    it('kiszámítja a 3. pályázatos amortizációs ágat ha grantDepreciationBase > 0', () => {
      const res = calculateDepreciation({
        acquisitionValue: 10000000,
        residualValue: 0,
        activationDate: new Date('2026-01-01'),
        usefulLifeMonths: 60,
        taoRatePercent: 20,
        grantDepreciationBase: 6000000,
        grantDepreciationRate: 20,
        calculationDate: new Date('2027-01-01'), // 12 hónap
      });

      expect(res.grant).toBeDefined();
      if (!res.grant) return;

      expect(res.grant.grantBase).toBe(6000000);
      expect(res.grant.ratePercent).toBe(20);
      // Havi = 6 000 000 * 20% / 12 = 100 000 Ft
      expect(res.grant.monthly).toBe(100000);
      // 12 hónap halmozott = 1 200 000 Ft
      expect(res.grant.accumulated).toBe(1200000);
      expect(res.grant.bookValue).toBe(4800000);
    });

    it('ha grantDepreciationBase nincs megadva, a grant ág undefined marad', () => {
      const res = calculateDepreciation({
        acquisitionValue: 5000000,
        residualValue: 0,
        activationDate: new Date('2026-01-01'),
        usefulLifeMonths: 36,
        taoRatePercent: 20,
      });

      expect(res.grant).toBeUndefined();
    });

    it('calculateAnnualDepreciation visszaadja a grant éves összeget', () => {
      const annual = calculateAnnualDepreciation({
        acquisitionValue: 10000000,
        residualValue: 0,
        activationDate: '2026-01-01',
        usefulLifeMonths: 60,
        taoRatePercent: 20,
        grantDepreciationBase: 6000000,
        grantDepreciationRate: 20,
        year: 2026,
      });

      expect(annual.accounting).toBe(2000000);
      expect(annual.tax).toBe(2000000);
      expect(annual.grant).toBe(1200000);
    });
  });

  describe('4. Átvett nyitó kartonok (lastDepreciationDate, opening ÉCS)', () => {
    const openingAssetParams = {
      acquisitionValue: 2400000,
      residualValue: 0,
      activationDate: new Date('2023-01-01'),
      usefulLifeMonths: 48, // 50 000 Ft/hó
      taoRatePercent: 20, // 40 000 Ft/hó
      lastDepreciationDate: '2025-12-31',
      openingAccumulatedDepreciation: 1500000, // 30 hónapnyi számviteli ÉCS
      openingTaxDepreciation: 1200000, // 30 hónapnyi TAO ÉCS
    };

    it('átvételkori határdátumon pontosan az átvett halmozott és könyv szerinti értéket adja', () => {
      const res = calculateDepreciation({
        ...openingAssetParams,
        calculationDate: new Date('2025-12-31'),
      });

      // Számviteli: 1 500 000 Ft nyitó halmozott, 900 000 Ft nettó könyv szerinti
      expect(res.accounting.accumulated).toBe(1500000);
      expect(res.accounting.bookValue).toBe(900000);
      expect(res.accounting.monthly).toBe(50000);

      // TAO: 1 200 000 Ft nyitó halmozott, 1 200 000 Ft nettó TAO
      expect(res.tax.accumulated).toBe(1200000);
      expect(res.tax.bookValue).toBe(1200000);
      expect(res.tax.monthly).toBe(40000);
    });

    it('átvétel után 6 hónappal (2026-06-30) pontosan 6 hónapnyi többlet ÉCS-t számol', () => {
      const res = calculateDepreciation({
        ...openingAssetParams,
        calculationDate: new Date('2026-06-30'), // június vége = 6 hónap
      });

      // Számviteli: 1 500 000 + (6 * 50 000) = 1 800 000 Ft
      expect(res.accounting.accumulated).toBe(1800000);
      expect(res.accounting.bookValue).toBe(600000);

      // TAO: 1 200 000 + (6 * 40 000) = 1 440 000 Ft
      expect(res.tax.accumulated).toBe(1440000);
      expect(res.tax.bookValue).toBe(960000);
    });

    it('teljes leíródáskor megáll az amortizálandó alapnál (nem lépi túl a bekerülési értéket)', () => {
      const res = calculateDepreciation({
        ...openingAssetParams,
        calculationDate: new Date('2028-01-01'), // 24 hónap telt el, hátralévő 18 hónap volt
      });

      expect(res.accounting.accumulated).toBe(2400000);
      expect(res.accounting.bookValue).toBe(0);
    });

    it('calculateAnnualDepreciation a lezárt múltbeli évre 0-t, az átvételt követő évre a tényleges új ÉCS-t adja', () => {
      // 2025: lezárt átvétel előtti év Visibill szempontból -> 0 Ft
      const annual2025 = calculateAnnualDepreciation({
        ...openingAssetParams,
        year: 2025,
      });
      expect(annual2025.accounting).toBe(0);
      expect(annual2025.tax).toBe(0);

      // 2026: átvétel utáni első teljes év -> 12 hónap
      const annual2026 = calculateAnnualDepreciation({
        ...openingAssetParams,
        year: 2026,
      });
      // 12 * 50 000 = 600 000 Ft számviteli
      expect(annual2026.accounting).toBe(600000);
      // 12 * 40 000 = 480 000 Ft TAO
      expect(annual2026.tax).toBe(480000);
    });
  });
});
