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
      expect(row07.base_amount).toBe(3701740);
      expect(row07.tax_amount).toBe(999470);
      // Math consistency: 3701740 * 0.27 = 999469.8 -> rounds to 999470
      expect(Math.round(row07.base_amount * 0.27)).toBe(row07.tax_amount);
    });

    it('validates 29. row (Egyéb fizetendő / külföldi teljesítés)', () => {
      const row29 = lineMap.get('29');
      expect(row29).toBeDefined();
      expect(row29.base_amount_rounded).toBe(31);
      expect(row29.tax_amount_rounded).toBe(8);
    });

    it('validates 36. row (Összes fizetendő adóalap és adó)', () => {
      const row36 = lineMap.get('36');
      expect(row36).toBeDefined();
      expect(row36.base_amount_rounded).toBe(3733); // 3 702 + 31 eFt
      expect(row36.tax_amount_rounded).toBe(1008);   // 999 + 8 eFt (kerekítve 1008)
      expect(row36.tax_amount).toBe(snapshot.header.total_payable_tax);
      expect(snapshot.header.total_payable_tax).toBe(1007921);
    });

    it('validates 63. row (Adómentes / AAM / TAM beszerzések)', () => {
      const row63 = lineMap.get('63');
      expect(row63).toBeDefined();
      expect(row63.base_amount_rounded).toBe(243);
      expect(row63.tax_amount_rounded).toBe(0);
    });

    it('validates 64. row (5% kedvezményes kulcsú beszerzések)', () => {
      const row64 = lineMap.get('64');
      expect(row64).toBeDefined();
      expect(row64.base_amount_rounded).toBe(20);
      expect(row64.tax_amount_rounded).toBe(1);
    });

    it('validates 66. row (27% levonható általános forgalmi adó)', () => {
      const row66 = lineMap.get('66');
      expect(row66).toBeDefined();
      expect(row66.base_amount_rounded).toBe(4654);
      expect(row66.tax_amount_rounded).toBe(1258);
      expect(row66.base_amount).toBe(4653857.59);
      expect(row66.tax_amount).toBe(1258492.21);
    });

    it('validates 76. row (Összes levonható adóalap és adó)', () => {
      const row76 = lineMap.get('76');
      expect(row76).toBeDefined();
      expect(row76.base_amount_rounded).toBe(4918);
      expect(row76.tax_amount_rounded).toBe(1260);
      expect(row76.tax_amount).toBe(snapshot.header.total_deductible_tax);
      expect(snapshot.header.total_deductible_tax).toBe(1259510.81);
    });

    it('validates 83. and 86. row (Különbözet és Visszaigényelhető ÁFA)', () => {
      const row83 = lineMap.get('83');
      const row86 = lineMap.get('86');
      expect(row83).toBeDefined();
      expect(row86).toBeDefined();

      // Net balance math: Payable - Deductible = Net
      const diff = snapshot.header.total_payable_tax - snapshot.header.total_deductible_tax;
      expect(diff).toBeCloseTo(snapshot.header.net_balance, 2);
      expect(snapshot.header.net_balance).toBe(-251589.81);

      expect(row83.tax_amount_rounded).toBe(-252);
      expect(row86.tax_amount_rounded).toBe(252);

      // Core engine calculation check
      const engineRes = calculateVatBalances(
        snapshot.header.total_payable_tax,
        snapshot.header.total_deductible_tax,
        0
      );
      expect(engineRes.net83).toBeCloseTo(-251589.81, 1);
      expect(engineRes.reclaimable85).toBeCloseTo(251589.81, 1);
      expect(engineRes.toPay84).toBe(0);
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

    it('validates top M-line partners match expected amounts', () => {
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
      expect(telekom.base_amount_rounded).toBe(27); // 70% deductible portion rounded to eFt
      expect(telekom.tax_amount_rounded).toBe(3);
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
