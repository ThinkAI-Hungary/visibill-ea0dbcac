import { describe, it, expect } from 'vitest';
import {
  normalizeKey,
  isCreditIndicator,
  isDebitIndicator,
  parseCsvContent,
  parseGenericRows,
  parseAmount,
} from '@/features/journals/services/openingImportParser';

describe('openingImportParser unit tests', () => {
  describe('normalizeKey', () => {
    it('normalizes accented Hungarian characters and trims', () => {
      expect(normalizeKey('  Főkönyvi szám  ')).toBe('fokonyvi_szam');
      expect(normalizeKey('Irány')).toBe('irany');
      expect(normalizeKey('Összeg')).toBe('osszeg');
      expect(normalizeKey('Követel')).toBe('kovetel');
      expect(normalizeKey('Tartozik')).toBe('tartozik');
      expect(normalizeKey('T / K')).toBe('t_k');
    });

    it('handles empty or special strings', () => {
      expect(normalizeKey('')).toBe('');
      expect(normalizeKey('___')).toBe('');
      expect(normalizeKey('Account #')).toBe('account');
    });
  });

  describe('DC indicators', () => {
    it('identifies Credit indicators', () => {
      expect(isCreditIndicator('K')).toBe(true);
      expect(isCreditIndicator('k')).toBe(true);
      expect(isCreditIndicator('Követel')).toBe(true);
      expect(isCreditIndicator('kovetel')).toBe(true);
      expect(isCreditIndicator('Credit')).toBe(true);
      expect(isCreditIndicator('C')).toBe(true);
      expect(isCreditIndicator('Potražuje')).toBe(true);
      expect(isCreditIndicator('T')).toBe(false);
    });

    it('identifies Debit indicators', () => {
      expect(isDebitIndicator('T')).toBe(true);
      expect(isDebitIndicator('t')).toBe(true);
      expect(isDebitIndicator('Tartozik')).toBe(true);
      expect(isDebitIndicator('tartozik')).toBe(true);
      expect(isDebitIndicator('Debit')).toBe(true);
      expect(isDebitIndicator('D')).toBe(true);
      expect(isDebitIndicator('Duguje')).toBe(true);
      expect(isDebitIndicator('K')).toBe(false);
    });
  });

  describe('parseCsvContent', () => {
    it('parses standard sample nyito_fokonyvi_minta.csv with semicolons', () => {
      const csv =
        'szamlaszam;irany;osszeg;megnevezes\n' +
        '111;T;1500000;Immateriális javak\n' +
        '121;T;12000000;Ingatlanok bruttó értéke\n' +
        '129;K;3200000;Ingatlanok halmozott értékcsökkenése\n' +
        '411;K;5000000;Jegyzett tőke\n';

      const { headers, rows } = parseCsvContent(csv);
      expect(headers).toEqual(['szamlaszam', 'irany', 'osszeg', 'megnevezes']);
      expect(rows.length).toBe(4);
      expect(rows[2].irany).toBe('K');
      expect(rows[2].osszeg).toBe('3200000');
    });

    it('strips UTF-8 BOM and handles comma delimiter', () => {
      const csv = '\uFEFFaccount,dc,amount,desc\n111,T,1000,Test\n';
      const { headers, rows } = parseCsvContent(csv);
      expect(headers).toEqual(['account', 'dc', 'amount', 'desc']);
      expect(rows.length).toBe(1);
    });
  });

  describe('parseGenericRows', () => {
    it('correctly maps Tartozik and Követel rows from nyito_fokonyvi_minta template', () => {
      const csv =
        'szamlaszam;irany;osszeg;megnevezes\n' +
        '111;T;1500000;Immateriális javak\n' +
        '121;T;12000000;Ingatlanok bruttó értéke\n' +
        '129;K;3200000;Ingatlanok halmozott értékcsökkenése\n' +
        '311;T;4500000;Vevőkövetelések nyitó\n' +
        '3841;T;8500000;Bankszámla nyitó\n' +
        '411;K;5000000;Jegyzett tőke\n' +
        '413;K;10800000;Eredménytartalék\n' +
        '454;K;7500000;Szállítói kötelezettségek nyitó\n';

      const { rows } = parseCsvContent(csv);
      const report = parseGenericRows(rows, 'generic_csv');

      expect(report.aggregatedItems.length).toBe(8);
      // Check K rows are NOT converted to T!
      const kRows = report.aggregatedItems.filter(i => i.dc_type === 'K');
      const tRows = report.aggregatedItems.filter(i => i.dc_type === 'T');

      expect(kRows.length).toBe(4); // 129, 411, 413, 454
      expect(tRows.length).toBe(4); // 111, 121, 311, 3841

      expect(report.totalDebit).toBe(1500000 + 12000000 + 4500000 + 8500000);
      expect(report.totalCredit).toBe(3200000 + 5000000 + 10800000 + 7500000);
      expect(report.totalDebit).toBe(26500000);
      expect(report.totalCredit).toBe(26500000);
      expect(report.isBalanced).toBe(true);
      expect(report.imbalance).toBe(0);
    });

    it('correctly maps accented Hungarian column headers (számlaszám;irány;összeg;megnevezés)', () => {
      const rows = [
        { 'számlaszám': '3841', 'irány': 'T', 'összeg': '500 000', 'megnevezés': 'Bankszámla' },
        { 'számlaszám': '411', 'irány': 'Követel', 'összeg': '500 000', 'megnevezés': 'Jegyzett tőke' },
      ];

      const report = parseGenericRows(rows, 'generic_excel');
      expect(report.aggregatedItems.length).toBe(2);
      expect(report.aggregatedItems[0].dc_type).toBe('T');
      expect(report.aggregatedItems[1].dc_type).toBe('K');
      expect(report.isBalanced).toBe(true);
    });

    it('correctly maps separate Tartozik and Követel columns', () => {
      const rows = [
        { 'főkönyvi_szám': '3841', 'tartozik': '250000', 'követel': '0', 'megnevezés': 'Bank' },
        { 'főkönyvi_szám': '454', 'tartozik': '0', 'követel': '250000', 'megnevezés': 'Szállító' },
      ];

      const report = parseGenericRows(rows, 'generic_excel');
      expect(report.aggregatedItems.length).toBe(2);
      expect(report.aggregatedItems[0].dc_type).toBe('T');
      expect(report.aggregatedItems[0].amount).toBe(250000);
      expect(report.aggregatedItems[1].dc_type).toBe('K');
      expect(report.aggregatedItems[1].amount).toBe(250000);
      expect(report.isBalanced).toBe(true);
    });
  });
});
