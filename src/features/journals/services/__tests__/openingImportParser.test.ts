import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseOpeningFile, excelSerialToIsoDate } from '../openingImportParser';

describe('openingImportParser', () => {
  it('correctly converts Excel serial dates to ISO strings', () => {
    expect(excelSerialToIsoDate(46023)).toBe('2026-01-01');
    expect(excelSerialToIsoDate(45688)).toBe('2025-01-31');
    expect(excelSerialToIsoDate('46023')).toBe('2026-01-01');
    expect(excelSerialToIsoDate('2026-01-01')).toBe('2026-01-01');
    expect(excelSerialToIsoDate('01.01.2026')).toBe('2026-01-01');
  });

  it('correctly parses the real Minimax Croatian Excel file', async () => {
    const filePath = path.resolve(
      process.cwd(),
      'tests/docs/horvat/NyitoXLS_Napredni pregled knjiženja za razdoblje od 01.01.2026 do 31.12.2026 (47).xlsx'
    );

    expect(fs.existsSync(filePath)).toBe(true);
    const buffer = fs.readFileSync(filePath);

    // Create a mock File object
    const file = new File([buffer], 'NyitoXLS.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const report = await parseOpeningFile(file);

    expect(report.format).toBe('minimax');
    expect(report.currency).toBe('EUR');
    expect(report.suggestedDate).toBe('2026-01-01');
    expect(report.suggestedYear).toBe(2026);
    expect(report.rawRowCount).toBe(350);

    // Total Debit and Credit equality
    expect(report.totalDebit).toBe(144457.54);
    expect(report.totalCredit).toBe(144457.54);
    expect(report.imbalance).toBe(0);
    expect(report.isBalanced).toBe(true);

    // Aggregated items count
    expect(report.aggregatedItems.length).toBe(43);

    // Check key accounts in aggregated items
    const agg1200 = report.aggregatedItems.find(i => i.gl_number === '1200');
    expect(agg1200).toBeDefined();
    expect(agg1200?.dc_type).toBe('T');
    // 48989.94 - 162.50 = 48827.44
    expect(agg1200?.amount).toBe(48827.44);

    const agg2200 = report.aggregatedItems.find(i => i.gl_number === '2200');
    expect(agg2200).toBeDefined();
    expect(agg2200?.dc_type).toBe('K');
    // 8403.56 - (-81.60) = 8485.16
    expect(agg2200?.amount).toBe(8485.16);

    const agg1000 = report.aggregatedItems.find(i => i.gl_number === '1000');
    expect(agg1000).toBeDefined();
    expect(agg1000?.dc_type).toBe('T');
    expect(agg1000?.amount).toBe(22468.88);

    const agg9000 = report.aggregatedItems.find(i => i.gl_number === '9000');
    expect(agg9000).toBeDefined();
    expect(agg9000?.dc_type).toBe('K');
    expect(agg9000?.amount).toBe(3000);

    // Detailed items count
    expect(report.detailedItems.length).toBe(350);

    // Sub-ledger open invoices
    expect(report.subledgerInvoices.length).toBeGreaterThan(250);
    const customerInvoices = report.subledgerInvoices.filter(i => i.type === 'customer');
    const supplierInvoices = report.subledgerInvoices.filter(i => i.type === 'supplier');
    expect(customerInvoices.length).toBe(264);
    expect(supplierInvoices.length).toBe(26);
  });

  it('correctly parses standard Hungarian CSV format', async () => {
    const csvContent =
      'szamlaszam;irany;osszeg;megnevezes\n' +
      '311;T;150000;Vevők\n' +
      '454;K;150000;Szállítók\n';

    const file = new File([csvContent], 'nyito.csv', { type: 'text/csv' });
    const report = await parseOpeningFile(file);

    expect(report.format).toBe('generic_csv');
    expect(report.isBalanced).toBe(true);
    expect(report.totalDebit).toBe(150000);
    expect(report.totalCredit).toBe(150000);
    expect(report.aggregatedItems.length).toBe(2);
  });
});
