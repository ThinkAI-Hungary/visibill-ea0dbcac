import { describe, it, expect } from 'vitest';
import {
  matchItemToVatCode,
  getVatCodeBadgeData,
  resolveVatCodeWithLearning,
  type VatCodeItem,
  type VatCodeOverrideLogEntry,
} from '@/utils/vatCodeMatching';
import { isReverseChargeVatRate, formatVatRate, normalizeVatRatePercent } from '@/lib/utils';

describe('Dual VAT Code System & F.AFA Recognition', () => {
  const sampleCompanyVatCodes: VatCodeItem[] = [
    {
      code: 'KIM_27',
      legacy_code: '25',
      label: 'Kimenő 27% (belföldi értékesítés)',
      vat_percent: 27,
      direction: 'OUTBOUND',
      is_reverse_charge: false,
    },
    {
      code: 'KIM_FORD',
      legacy_code: 'FAD',
      label: 'Belföldi fordított értékesítés (mentes)',
      vat_percent: 0,
      direction: 'OUTBOUND',
      is_reverse_charge: true,
    },
    {
      code: 'BE_27_LEV',
      legacy_code: '25',
      label: 'Levonható 27% ÁFA (beszerzés)',
      vat_percent: 27,
      direction: 'INBOUND',
      is_deductible: true,
      is_reverse_charge: false,
    },
    {
      code: 'BE_FORD_27',
      legacy_code: 'FAD',
      label: 'Belföldi fordított adózás (beszerzés)',
      vat_percent: 27,
      direction: 'INBOUND',
      is_reverse_charge: true,
    },
    {
      code: 'BE_FORD_ACEL',
      legacy_code: 'FAD',
      label: 'FAD Acél- és fémtermékek fordított adózása',
      vat_percent: 27,
      direction: 'INBOUND',
      is_reverse_charge: true,
      fad_category: 'steel',
    },
    {
      code: 'BE_5_LEV',
      legacy_code: '05',
      label: 'Levonható 5% ÁFA (beszerzés)',
      vat_percent: 5,
      direction: 'INBOUND',
      is_reverse_charge: false,
    },
    {
      code: 'BE_18_LEV',
      legacy_code: '18',
      label: 'Levonható 18% ÁFA (beszerzés)',
      vat_percent: 18,
      direction: 'INBOUND',
      is_reverse_charge: false,
    },
    {
      code: 'BE_0_LEV',
      legacy_code: 'TAM',
      label: 'Adómentes belföldi beszerzés (TAM)',
      vat_percent: 0,
      direction: 'INBOUND',
      is_reverse_charge: false,
    },
  ];

  describe('isReverseChargeVatRate utility', () => {
    it('accurately identifies Hungarian reverse charge designations', () => {
      expect(isReverseChargeVatRate('F.AFA')).toBe(true);
      expect(isReverseChargeVatRate('f.afa')).toBe(true);
      expect(isReverseChargeVatRate('F. ÁFA')).toBe(true);
      expect(isReverseChargeVatRate('F_AFA')).toBe(true);
      expect(isReverseChargeVatRate('F-AFA')).toBe(true);
      expect(isReverseChargeVatRate('FAFA')).toBe(true);
      expect(isReverseChargeVatRate('FAD')).toBe(true);
      expect(isReverseChargeVatRate('FORDÍTOTT')).toBe(true);
      expect(isReverseChargeVatRate('REVERSE_CHARGE')).toBe(true);
      expect(isReverseChargeVatRate('DOMESTIC_REVERSE_CHARGE')).toBe(true);
    });

    it('returns false for regular percentages and exemptions', () => {
      expect(isReverseChargeVatRate('27%')).toBe(false);
      expect(isReverseChargeVatRate('0.27')).toBe(false);
      expect(isReverseChargeVatRate('5%')).toBe(false);
      expect(isReverseChargeVatRate('AAM')).toBe(false);
      expect(isReverseChargeVatRate('TAM')).toBe(false);
      expect(isReverseChargeVatRate(null)).toBe(false);
      expect(isReverseChargeVatRate('')).toBe(false);
    });
  });

  describe('formatVatRate utility', () => {
    it('formats reverse charge strings cleanly as mentes / F.AFA', () => {
      expect(formatVatRate('F.AFA')).toBe('mentes');
      expect(formatVatRate('FAD')).toBe('mentes');
      expect(formatVatRate('FORD')).toBe('mentes');
      expect(formatVatRate('27%')).toBe('27%');
      expect(formatVatRate(0.27)).toBe('27%');
    });
  });

  describe('matchItemToVatCode', () => {
    it('correctly maps F.AFA to reverse charge code and NEVER to 25 / 27%', () => {
      const match = matchItemToVatCode({
        vatRate: 'F.AFA',
        direction: 'INBOUND',
        vatCodes: sampleCompanyVatCodes,
      });

      expect(match.is_reverse_charge).toBe(true);
      expect(match.legacy_code).toBe('FAD');
      expect(match.code).not.toBe('BE_27_LEV');
      expect(match.legacy_code).not.toBe('25');
    });

    it('identifies steel keywords on reverse charge items and chooses BE_FORD_ACEL', () => {
      const match = matchItemToVatCode({
        vatRate: 'F.AFA',
        direction: 'INBOUND',
        vatCodes: sampleCompanyVatCodes,
        lineDescription: 'Köracél és betonacél VTSZ 7214',
      });

      expect(match.code).toBe('BE_FORD_ACEL');
      expect(match.legacy_code).toBe('FAD');
      expect(match.label).toBe('FAD Acél- és fémtermékek fordított adózása');
    });

    it('matches regular 27% items to BE_27_LEV / 25', () => {
      const match = matchItemToVatCode({
        vatRate: '27%',
        direction: 'INBOUND',
        vatCodes: sampleCompanyVatCodes,
      });

      expect(match.code).toBe('BE_27_LEV');
      expect(match.legacy_code).toBe('25');
      expect(match.label).toBe('Levonható 27% ÁFA (beszerzés)');
    });

    it('matches outbound 27% items to KIM_27 / 25', () => {
      const match = matchItemToVatCode({
        vatRate: '27%',
        direction: 'OUTBOUND',
        vatCodes: sampleCompanyVatCodes,
      });

      expect(match.code).toBe('KIM_27');
      expect(match.legacy_code).toBe('25');
      expect(match.label).toBe('Kimenő 27% (belföldi értékesítés)');
    });

    it('matches 5% items to 05, NOT 25', () => {
      const match = matchItemToVatCode({
        vatRate: '5%',
        direction: 'INBOUND',
        vatCodes: sampleCompanyVatCodes,
      });

      expect(match.code).toBe('BE_5_LEV');
      expect(match.legacy_code).toBe('05');
    });
  });

  describe('getVatCodeBadgeData & Tooltip resolution', () => {
    it('renders legacy code (25) in legacy mode and NAV code (KIM_27) in nav mode', () => {
      const matched = sampleCompanyVatCodes.find(c => c.code === 'KIM_27')!;

      const legacyBadge = getVatCodeBadgeData(matched, 'legacy', '27%');
      expect(legacyBadge.displayCode).toBe('25');
      expect(legacyBadge.rateLabel).toBe('27%');
      expect(legacyBadge.tooltipText).toBe('Kimenő 27% (belföldi értékesítés)');

      const navBadge = getVatCodeBadgeData(matched, 'nav', '27%');
      expect(navBadge.displayCode).toBe('KIM_27');
      expect(navBadge.rateLabel).toBe('27%');
      expect(navBadge.tooltipText).toBe('Kimenő 27% (belföldi értékesítés)');
    });

    it('renders FAD badge with column 3 label as tooltip for reverse charge', () => {
      const matched = sampleCompanyVatCodes.find(c => c.code === 'BE_FORD_ACEL')!;

      const legacyBadge = getVatCodeBadgeData(matched, 'legacy', 'F.AFA');
      expect(legacyBadge.displayCode).toBe('FAD');
      expect(legacyBadge.rateLabel).toBe('mentes');
      expect(legacyBadge.tooltipText).toBe('FAD Acél- és fémtermékek fordított adózása');

      const navBadge = getVatCodeBadgeData(matched, 'nav', 'F.AFA');
      expect(navBadge.displayCode).toBe('BE_FORD_ACEL');
      expect(navBadge.tooltipText).toBe('FAD Acél- és fémtermékek fordított adózása');
    });

    it('tooltip never contains misleading hardcoded 27% text', () => {
      const matched5 = sampleCompanyVatCodes.find(c => c.code === 'BE_5_LEV')!;
      const badge = getVatCodeBadgeData(matched5, 'legacy', '5%');
      expect(badge.tooltipText).not.toContain('Alapértelmezett kód 27%-os');
      expect(badge.tooltipText).toBe('Levonható 5% ÁFA (beszerzés)');
    });

    it('attaches machine learning sparkles and explanation when source is learned', () => {
      const matched = sampleCompanyVatCodes.find(c => c.code === 'BE_FORD_ACEL')!;
      const badge = getVatCodeBadgeData(
        matched,
        'legacy',
        'F.AFA',
        'learned_partner',
        'Gépi tanulás: a partner korábbi acél tételeinél ezt állítottad be'
      );
      expect(badge.isLearned).toBe(true);
      expect(badge.isManual).toBe(false);
      expect(badge.tooltipText).toContain('✨ Gépi tanulás');
    });

    it('attaches pencil icon text when source is manual', () => {
      const matched = sampleCompanyVatCodes.find(c => c.code === 'BE_27_LEV')!;
      const badge = getVatCodeBadgeData(matched, 'legacy', '27%', 'manual');
      expect(badge.isManual).toBe(true);
      expect(badge.isLearned).toBe(false);
      expect(badge.tooltipText).toContain('✏️ Kézzel rögzített áfakód');
    });
  });

  describe('resolveVatCodeWithLearning (4-tier cascade)', () => {
    const sampleVatCodesWithIds: (VatCodeItem & { id?: string })[] = [
      {
        id: 'vat-id-1',
        code: 'BE_27_LEV',
        legacy_code: '25',
        label: 'Levonható 27% ÁFA (beszerzés)',
        vat_percent: 27,
        direction: 'INBOUND',
        is_reverse_charge: false,
      },
      {
        id: 'vat-id-2',
        code: 'BE_FORD_ACEL',
        legacy_code: 'FAD',
        label: 'FAD Acél- és fémtermékek fordított adózása',
        vat_percent: 27,
        direction: 'INBOUND',
        is_reverse_charge: true,
        fad_category: 'steel',
      },
      {
        id: 'vat-id-3',
        code: 'BE_5_LEV',
        legacy_code: '05',
        label: 'Levonható 5% ÁFA (beszerzés)',
        vat_percent: 5,
        direction: 'INBOUND',
        is_reverse_charge: false,
      },
      {
        id: 'vat-id-4',
        code: 'BE_0_LEV',
        legacy_code: 'TAM',
        label: 'Adómentes belföldi beszerzés (TAM)',
        vat_percent: 0,
        direction: 'INBOUND',
        is_reverse_charge: false,
      },
    ];

    const sampleRules: VatCodeOverrideLogEntry[] = [
      {
        id: 'rule-1',
        company_id: 'comp-1',
        partner_tax_number: '12345678-2-42',
        partner_name: 'Acélker Kft.',
        item_description: 'Betonacél szálban B500B',
        original_vat_rate: '27%',
        original_vat_code: 'BE_27_LEV',
        new_vat_code_id: 'vat-id-2',
        new_vat_code: 'BE_FORD_ACEL',
        direction: 'INBOUND',
        created_at: '2026-09-21T10:00:00Z',
      },
      {
        id: 'rule-2',
        company_id: 'comp-1',
        partner_tax_number: null,
        partner_name: null,
        item_description: 'Könyvelési szakkönyv',
        original_vat_rate: '27%',
        original_vat_code: 'BE_27_LEV',
        new_vat_code_id: 'vat-id-3',
        new_vat_code: 'BE_5_LEV',
        direction: 'INBOUND',
        created_at: '2026-09-20T10:00:00Z',
      },
    ];

    it('tier 1: respects explicit manual line item override over learned rules', () => {
      const result = resolveVatCodeWithLearning({
        itemVatCodeId: 'vat-id-3', // explicitly picked 5%
        itemVatCode: 'BE_5_LEV',
        vatRate: '27%',
        direction: 'INBOUND',
        lineDescription: 'Betonacél szálban B500B',
        partnerTaxNumber: '12345678-2-42',
        vatCodes: sampleVatCodesWithIds,
        learnedRules: sampleRules,
      });

      expect(result.source).toBe('manual');
      expect(result.matchedCode.code).toBe('BE_5_LEV');
      expect(result.ruleExplanation).toContain('Kézzel rögzített');
    });

    it('tier 2: uses partner-specific learned rule when tax number (first 8 digits) and description match', () => {
      const result = resolveVatCodeWithLearning({
        vatRate: '27%',
        direction: 'INBOUND',
        lineDescription: 'Betonacél szálban B500B 12mm',
        partnerTaxNumber: '12345678-1-11', // matches first 8 digits 12345678
        vatCodes: sampleVatCodesWithIds,
        learnedRules: sampleRules,
      });

      expect(result.source).toBe('learned_partner');
      expect(result.matchedCode.code).toBe('BE_FORD_ACEL');
      expect(result.ruleExplanation).toContain('Gépi tanulás');
    });

    it('tier 3: falls back to company-wide learned description rule when partner does not match', () => {
      const result = resolveVatCodeWithLearning({
        vatRate: '27%',
        direction: 'INBOUND',
        lineDescription: 'Könyvelési szakkönyv 2026',
        partnerTaxNumber: '99999999-2-42', // different partner
        vatCodes: sampleVatCodesWithIds,
        learnedRules: sampleRules,
      });

      expect(result.source).toBe('learned_company');
      expect(result.matchedCode.code).toBe('BE_5_LEV');
      expect(result.ruleExplanation).toContain('Könyvelési szakkönyv');
    });

    it('tier 4: falls back to heuristic standard matching when no rules apply', () => {
      const result = resolveVatCodeWithLearning({
        vatRate: '27%',
        direction: 'INBOUND',
        lineDescription: 'Általános irodaszer',
        partnerTaxNumber: '88888888-2-42',
        vatCodes: sampleVatCodesWithIds,
        learnedRules: sampleRules,
      });

      expect(result.source).toBe('heuristic');
      expect(result.matchedCode.code).toBe('BE_27_LEV');
    });
  });
});
