import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateHungarianTaxNumber,
  calculateVatBalances,
} from '@/features/vat/core/vatEngine';
import { shouldExcludeFromMLine } from '@/features/vat/types';

describe('VAT Regression Gate: Taxology Kft. 2026-07 Golden Master Benchmark', () => {
  const fixturePath = path.resolve(__dirname, '../../../tests/fixtures/vat_snapshot_taxology_2026_07.json');
  const xmlPath = path.resolve(__dirname, '../../../tests/NAV_2665_2026_07_Taxology_Kft.xml');

  it('ensures the Taxology 2026-07 baseline fixture exists and is valid', () => {
    expect(fs.existsSync(fixturePath)).toBe(true);
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const snapshot = JSON.parse(raw);

    expect(snapshot.metadata.company_name).toBe('Taxology Kft.');
    expect(snapshot.metadata.tax_number).toBe('14160877-2-43');
    expect(snapshot.metadata.period_year).toBe(2026);
    expect(snapshot.metadata.period_month).toBe(7);
    expect(snapshot.metadata.frequency).toBe('H');
  });

  describe('Mathematical and Form Invariant Integrity (NAV 2665)', () => {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const snapshot = JSON.parse(raw);
    const lineMap = new Map<string, any>(snapshot.lines.map((l: any) => [l.row_number, l]));

    it('validates 07. row (27% Fizetendő termékértékesítés és szolgáltatásnyújtás)', () => {
      const row07 = lineMap.get('07');
      expect(row07).toBeDefined();
      expect(row07.base_amount_rounded).toBe(3702); // 3 702 eFt
      expect(row07.tax_amount_rounded).toBe(999);   // 999 eFt (27%)
      expect(Math.round(row07.base_amount)).toBe(3701740);
      expect(Math.round(row07.tax_amount)).toBe(999470);
      // Math consistency: 3701740 * 0.27 = 999469.8 -> rounds to 999470
      expect(Math.round(row07.base_amount * 0.27)).toBe(Math.round(row07.tax_amount));
    });

    it('validates 14. row (Közösségen belülről történő termékbeszerzés fizetendő ÁFA)', () => {
      const row14 = lineMap.get('14');
      expect(row14).toBeDefined();
      expect(row14.base_amount_rounded).toBe(26); // 26 eFt
      expect(row14.tax_amount_rounded).toBe(7);   // 7 eFt
      expect(Math.round(row14.base_amount)).toBe(25799);
      expect(Math.round(row14.tax_amount)).toBe(6966);
    });

    it('validates 18. row (Közösségi szolgáltatás igénybevétel fizetendő ÁFA - Google Cloud)', () => {
      const row18 = lineMap.get('18');
      expect(row18).toBeDefined();
      expect(row18.base_amount_rounded).toBe(31); // 31 eFt
      expect(row18.tax_amount_rounded).toBe(8);   // 8 eFt
      expect(Math.round(row18.base_amount)).toBe(31301);
      expect(Math.round(row18.tax_amount)).toBe(8451);
    });

    it('validates 27. row (Harmadik országbeli szolgáltatás fizetendő ÁFA - Anthropic)', () => {
      const row27 = lineMap.get('27');
      expect(row27).toBeDefined();
      expect(row27.base_amount_rounded).toBe(7); // 7 eFt
      expect(row27.tax_amount_rounded).toBe(2); // 2 eFt
      expect(Math.round(row27.base_amount)).toBe(6529);
      expect(Math.round(row27.tax_amount)).toBe(1763);
    });

    it('validates 36. row (Összes fizetendő adóalap és adó = 07 + 14 + 18 + 27)', () => {
      const row36 = lineMap.get('36');
      expect(row36).toBeDefined();
      expect(row36.base_amount_rounded).toBe(3765); // 3 765 eFt
      expect(row36.tax_amount_rounded).toBe(1017);   // 1 017 eFt
      expect(Math.round(row36.base_amount)).toBe(3765369);
      expect(Math.round(row36.tax_amount)).toBe(1016650);
      expect(Math.round(row36.tax_amount)).toBe(Math.round(snapshot.header.total_payable_tax));
      expect(Math.round(snapshot.header.total_payable_tax)).toBe(1016650);
    });

    it('validates 64. row (5% kedvezményes kulcsú beszerzések levonható ÁFA)', () => {
      const row64 = lineMap.get('64');
      expect(row64).toBeDefined();
      expect(row64.base_amount_rounded).toBe(20);
      expect(row64.tax_amount_rounded).toBe(1);
      expect(Math.round(row64.base_amount)).toBe(20372);
      expect(row64.tax_amount).toBeCloseTo(1018.6, 1);
    });

    it('validates 66. row (27% belföldi levonható általános forgalmi adó - duplikációmentes)', () => {
      const row66 = lineMap.get('66');
      expect(row66).toBeDefined();
      expect(row66.base_amount_rounded).toBe(2403);
      expect(row66.tax_amount_rounded).toBe(649);
      expect(Math.round(row66.base_amount)).toBe(2402533);
      expect(Math.round(row66.tax_amount)).toBe(648685);
    });

    it('validates 67. row (Közösségi és harmadik orsz. szolgáltatás levonható ÁFA = 18 + 27 sorok)', () => {
      const row67 = lineMap.get('67');
      expect(row67).toBeDefined();
      expect(row67.base_amount_rounded).toBe(38);
      expect(row67.tax_amount_rounded).toBe(10);
      expect(Math.round(row67.base_amount)).toBe(37830);
      expect(Math.round(row67.tax_amount)).toBe(10214);
    });

    it('validates 76. row (Összes levonható adóalap és adó = 64 + 66 + 67)', () => {
      const row76 = lineMap.get('76');
      expect(row76).toBeDefined();
      expect(row76.base_amount_rounded).toBe(2461);
      expect(row76.tax_amount_rounded).toBe(660);
      expect(Math.round(row76.base_amount)).toBe(2460734);
      expect(Math.round(row76.tax_amount)).toBe(659918);
      expect(Math.round(row76.tax_amount)).toBe(Math.round(snapshot.header.total_deductible_tax));
      expect(Math.round(snapshot.header.total_deductible_tax)).toBe(659918);
    });

    it('validates 83. and 84. row (Különbözet és Befizetendő ÁFA egyenleg)', () => {
      const row83 = lineMap.get('83');
      const row84 = lineMap.get('84');
      expect(row83).toBeDefined();
      expect(row84).toBeDefined();

      // Net balance math: Payable - Deductible = Net (1 016 650 - 659 918 = +356 732 Ft)
      const diff = snapshot.header.total_payable_tax - snapshot.header.total_deductible_tax;
      expect(diff).toBeCloseTo(snapshot.header.net_balance, 2);
      expect(Math.round(snapshot.header.net_balance)).toBe(356732);

      expect(row83.tax_amount_rounded).toBe(357);
      expect(row84.tax_amount_rounded).toBe(357);
      expect(Math.round(row83.tax_amount)).toBe(356732);
      expect(Math.round(row84.tax_amount)).toBe(356732);

      // Core engine calculation check: positive balance means toPay84
      const engineRes = calculateVatBalances(
        Math.round(snapshot.header.total_payable_tax),
        Math.round(snapshot.header.total_deductible_tax),
        0
      );
      expect(engineRes.net83).toBe(356732);
      expect(engineRes.toPay84).toBe(356732);
      expect(engineRes.reclaimable85).toBe(0);
    });
  });

  describe('M-Lines (Belföldi tételes összesítő jelentés) Integrity', () => {
    const raw = fs.readFileSync(fixturePath, 'utf8');
    const snapshot = JSON.parse(raw);

    it('contains exactly 10 M-line partners with non-zero deductible VAT', () => {
      expect(snapshot.m_lines_count).toBe(10);
      expect(snapshot.m_lines).toHaveLength(10);
    });

    it('verifies all M-line partner tax numbers pass CDV checksum validation', () => {
      for (const m of snapshot.m_lines) {
        const val = validateHungarianTaxNumber(m.partner_tax_number);
        expect(val.isValid, `Partner tax number invalid: ${m.partner_name} (${m.partner_tax_number})`).toBe(true);
      }
    });

    it('ensures no proforma or excluded lines slipped into M-lines', () => {
      for (const m of snapshot.m_lines) {
        expect(shouldExcludeFromMLine(m)).toBe(false);
      }
    });

    it('validates top M-line partners match expected amounts from official accounting list', () => {
      const thinkAi = snapshot.m_lines.find((m: any) => m.partner_tax_number === '32478620');
      expect(thinkAi).toBeDefined();
      expect(thinkAi.partner_name).toBe('Think AI Korlátolt Felelősségű Társaság');
      expect(thinkAi.invoice_count).toBe(2);
      expect(thinkAi.base_amount_rounded).toBe(2219);
      expect(thinkAi.tax_amount_rounded).toBe(599);

      const telekom = snapshot.m_lines.find((m: any) => m.partner_tax_number === '10773381');
      expect(telekom).toBeDefined();
      expect(telekom.partner_name).toBe('Magyar Telekom Nyrt.');
      expect(telekom.invoice_count).toBe(2);
      expect(telekom.base_amount_rounded).toBe(25);
      expect(telekom.tax_amount_rounded).toBe(2);

      const eon = snapshot.m_lines.find((m: any) => m.partner_tax_number === '13322142');
      expect(eon).toBeDefined();
      expect(eon.partner_name).toBe('E.ON Energiamegoldások Kft.');
      expect(eon.invoice_count).toBe(2);
      expect(eon.base_amount_rounded).toBe(47);
      expect(eon.tax_amount_rounded).toBe(8);
    });
  });

  describe('Official NAV 2665 XML Baseline Match', () => {
    it('verifies the official XML file contains identical key reporting figures', () => {
      expect(fs.existsSync(xmlPath)).toBe(true);
      const xml = fs.readFileSync(xmlPath, 'utf8');

      // 1. Company tax number and name
      expect(xml).toContain('<nev>Taxology Kft.</nev>');
      expect(xml).toContain('<adoszam>14160877243</adoszam>');

      // 2. Period: 2026-07-01 to 2026-07-31
      expect(xml).toContain('<tol>20260701</tol>');
      expect(xml).toContain('<ig>20260731</ig>');

      // 3. Row 07 in XML (0B0001C0007BA: base = 3702, 0B0001C0007CA: tax = 999)
      expect(xml).toContain('<mezo eazon="0B0001C0007BA">3702</mezo>');
      expect(xml).toContain('<mezo eazon="0B0001C0007CA">999</mezo>');

      // 4. M-sheet for Magyar Telekom Nyrt. (10773381) with 29 eFt base and 3 eFt tax
      expect(xml).toContain('<azonosito>10773381</azonosito>');
      expect(xml).toContain('<megnevezes>Magyar Telekom Nyrt.</megnevezes>');
      expect(xml).toContain('<mezo eazon="0A0001E0004CA">29</mezo>');
      expect(xml).toContain('<mezo eazon="0A0001E0004DA">3</mezo>');
    });
  });
});
