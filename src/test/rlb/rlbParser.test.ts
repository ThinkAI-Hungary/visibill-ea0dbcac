import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  detectRlbFileFormat,
  parseRlbAuditXml,
  parseRlbCsvLedger,
  determineAccountType,
  readRlbFileAsText,
} from '@/lib/rlb/rlbParser';

describe('RLB Parser Engine', () => {
  const xmlFilePath = path.resolve(__dirname, '../../../docs/WR-HOME-KFT/Könyvvizsgálói_feladás_26242363_20260919_26.xml');
  const csvFilePath = path.resolve(__dirname, '../../../docs/WR-HOME-KFT/WR HOME KFT. - FŐKÖNYVI KIVONAT - 20260919 (1).CSV');

  describe('determineAccountType', () => {
    it('classifies standard Hungarian 1-digit account classes correctly', () => {
      expect(determineAccountType('131')).toBe('asset');
      expect(determineAccountType('261')).toBe('asset');
      expect(determineAccountType('311')).toBe('asset');
      expect(determineAccountType('381')).toBe('asset');
      expect(determineAccountType('411')).toBe('equity');
      expect(determineAccountType('454')).toBe('liability');
      expect(determineAccountType('491')).toBe('liability');
      expect(determineAccountType('511')).toBe('expense');
      expect(determineAccountType('814')).toBe('expense');
      expect(determineAccountType('911')).toBe('revenue');
      expect(determineAccountType('011')).toBe('unknown');
    });
  });

  describe('detectRlbFileFormat', () => {
    it('detects RLB XML format from content and filename', () => {
      const xmlHeader = '<?xml version="1.0" encoding="utf-8"?><Adatok><LetrehozoProgram><Nev>RLB 26.6</Nev></LetrehozoProgram><Szamlaszamok></Szamlaszamok><FkBizonylatok></FkBizonylatok><FkTetelek></FkTetelek></Adatok>';
      expect(detectRlbFileFormat(xmlHeader, 'feladas.xml')).toBe('rlb_audit_xml');
    });

    it('detects RLB CSV format from content and filename', () => {
      const csvHeader = 'FOKSZAM;FOKNEV;NYTART;NYKOV;TART;KOV;IDTARTE;IDKOVE;TARTE;KOVE\n111;Alapítás;0;0;100;0;100;0;100;0';
      expect(detectRlbFileFormat(csvHeader, 'fokonyv.csv')).toBe('rlb_csv_ledger');
    });

    it('returns unknown for random text', () => {
      expect(detectRlbFileFormat('Random text here', 'sample.txt')).toBe('unknown');
    });
  });

  describe('parseRlbAuditXml with WR Home Kft. real sample', () => {
    it('correctly parses real WR Home Kft. RLB 26.6 Audit XML', () => {
      expect(fs.existsSync(xmlFilePath)).toBe(true);
      const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');

      const result = parseRlbAuditXml(xmlContent);

      expect(result.format).toBe('rlb_audit_xml');

      // 1. Meta validation
      expect(result.meta.companyName).toBe('WR HOME KFT.');
      expect(result.meta.taxNumber).toBe('26242363-2-43');
      expect(result.meta.periodStart).toBe('2026-01-01');
      expect(result.meta.periodEnd).toBe('2026-12-31');
      expect(result.meta.currency).toBe('HUF');
      expect(result.meta.sourceProgram).toContain('RLB');
      expect(result.meta.sourceVersion).toBe('26.6');

      // 2. Count validations
      expect(result.accounts.length).toBe(681);
      expect(result.partners.length).toBe(52);
      expect(result.meta.voucherCount).toBe(335);
      expect(result.entries.length).toBe(504);

      // 3. Balance sheet equality (T = K)
      expect(result.stats.totalDebit).toBe(168539815);
      expect(result.stats.totalCredit).toBe(168539815);
      expect(result.stats.balanceDiff).toBe(0);
      expect(result.stats.isBalanced).toBe(true);
      expect(result.warnings.length).toBe(0);
      expect(result.errors.length).toBe(0);

      // 4. Account code resolution (<Kod> -> <TKod>)
      // Kod 23 corresponds to TKod 131 (Műszaki berendezések, gépek, járművek)
      expect(result.accountCodeMap['23']).toBe('131');
      // Kod 383 corresponds to TKod 491 (Nyitómérleg számla)
      expect(result.accountCodeMap['383']).toBe('491');

      // 5. Journal entries check
      const firstEntry = result.entries[0];
      expect(firstEntry).toBeDefined();
      expect(firstEntry.debitAccount).toBe('131'); // Resolved from raw '23'
      expect(firstEntry.creditAccount).toBe('491'); // Resolved from raw '383'
      expect(firstEntry.amount).toBe(241228);
      expect(firstEntry.voucherNumber).toBe('Nyitó 000001');
      expect(firstEntry.voucherDate).toBe('2026-01-01');

      // 6. Partner mapping verification
      // Find an entry with partner linked
      const partnerEntry = result.entries.find(e => e.partnerCode !== null);
      expect(partnerEntry).toBeDefined();
      expect(partnerEntry?.partnerName).toBeTruthy();
    });
  });

  describe('parseRlbCsvLedger with WR Home Kft. real sample', () => {
    it('correctly parses real WR Home Kft. Főkönyvi Kivonat CSV', () => {
      expect(fs.existsSync(csvFilePath)).toBe(true);
      const csvBuffer = fs.readFileSync(csvFilePath);
      const decoder = new TextDecoder('windows-1250');
      const csvContent = decoder.decode(csvBuffer);

      const result = parseRlbCsvLedger(csvContent, 'WR HOME KFT. - FŐKÖNYVI KIVONAT - 20260919 (1).CSV');

      expect(result.format).toBe('rlb_csv_ledger');
      expect(result.companyName).toBe('WR HOME KFT.');
      expect(result.accounts.length).toBe(114);

      expect(result.stats.totalAccounts).toBe(114);
      expect(result.stats.groupAccountsCount).toBeGreaterThan(0);
      expect(result.stats.detailAccountsCount).toBeGreaterThan(0);

      // Check specific accounts
      const openingBalanceAccount = result.accounts.find(a => a.glNumber === '491');
      expect(openingBalanceAccount).toBeDefined();
      expect(openingBalanceAccount?.accountName).toContain('Nyitómérleg');

      // Check detail account numbers
      const acc3811 = result.accounts.find(a => a.glNumber.startsWith('3811'));
      expect(acc3811).toBeDefined();
      expect(acc3811?.turnoverDebit).toBeGreaterThanOrEqual(0);
    });
  });

  describe('readRlbFileAsText', () => {
    it('correctly decodes CP1250 encoded bytes containing Hungarian characters', async () => {
      const csvBuffer = fs.readFileSync(csvFilePath);
      const blob = new Blob([csvBuffer]);
      const text = await readRlbFileAsText(blob);

      expect(text).toContain('FOKSZAM;FOKNEV');
      expect(text).toContain('Nyitómérleg számla');
      expect(text.includes('\uFFFD')).toBe(false);
    });
  });
});
