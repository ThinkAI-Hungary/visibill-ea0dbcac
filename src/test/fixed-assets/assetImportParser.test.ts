import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseAssetImportData,
  parseHungarianNumber,
  parseExcelDate,
  ratePercentToMonths,
  resolveGlAccount,
  generateSampleAssetImportExcel,
} from '@/lib/fixed-assets/assetImportParser';

describe('assetImportParser', () => {
  describe('Helper functions', () => {
    it('parses various Hungarian number formats', () => {
      expect(parseHungarianNumber(134000)).toBe(134000);
      expect(parseHungarianNumber('134 000')).toBe(134000);
      expect(parseHungarianNumber('134.000')).toBe(134000);
      expect(parseHungarianNumber('16,67')).toBeCloseTo(16.67, 2);
      expect(parseHungarianNumber('1.234,56')).toBeCloseTo(1234.56, 2);
      expect(parseHungarianNumber(null)).toBe(0);
      expect(parseHungarianNumber('')).toBe(0);
    });

    it('parses Excel serial dates and string dates', () => {
      // 39265 -> 2007-07-02
      expect(parseExcelDate(39265)).toBe('2007-07-02');
      // 45177 -> 2023-09-08
      expect(parseExcelDate(45177)).toBe('2023-09-08');
      // Hungarian dot notation
      expect(parseExcelDate('2007.07.02.')).toBe('2007-07-02');
      expect(parseExcelDate('2024. 3. 15.')).toBe('2024-03-15');
      // ISO string
      expect(parseExcelDate('2021-05-10')).toBe('2021-05-10');
      // Empty or invalid
      expect(parseExcelDate(null)).toBeNull();
      expect(parseExcelDate('')).toBeNull();
    });

    it('converts depreciation rate percentage to useful life months', () => {
      expect(ratePercentToMonths(100)).toEqual({ months: 1, method: 'immediate' });
      expect(ratePercentToMonths(14.5)).toEqual({ months: 83, method: 'linear' });
      expect(ratePercentToMonths(20)).toEqual({ months: 60, method: 'linear' });
      expect(ratePercentToMonths(33.3)).toEqual({ months: 36, method: 'linear' });
      expect(ratePercentToMonths(2)).toEqual({ months: 600, method: 'linear' });
      expect(ratePercentToMonths(0)).toEqual({ months: 0, method: 'none' });
    });

    it('resolves GL accounts by exact or 3-digit prefix match', () => {
      const glList = [
        { id: 'uuid-143', gl_number: '143', short_name: 'Egyéb berendezések' },
        { id: 'uuid-141', gl_number: '141', short_name: 'Műszaki gépek' },
        { id: 'uuid-113', gl_number: '113', short_name: 'Vagyoni értékű jogok' },
      ];

      // 143100 -> prefix 143
      const res1 = resolveGlAccount('143100', glList);
      expect(res1.glAccountId).toBe('uuid-143');
      expect(res1.glAccountNumber).toBe('143');

      // 113000 -> prefix 113
      const res2 = resolveGlAccount('113000', glList);
      expect(res2.glAccountId).toBe('uuid-113');

      // Unmatched account
      const res3 = resolveGlAccount('999999', glList);
      expect(res3.glAccountId).toBeNull();
      expect(res3.glAccountNumber).toBe('999999');
    });
  });

  describe('Real file parsing: File 1 (RLB MyTargyi Kartonlista)', () => {
    const file1Path = path.resolve(process.cwd(), 'tests/docs/eb0148/de6ef900-1a1c-473a-99a8-b18f20f8aa72.xlsx');

    it('auto-detects rlb_mytargyi and parses all 2,261 rows', () => {
      if (!fs.existsSync(file1Path)) {
        console.warn('Test file not found, skipping real file test');
        return;
      }

      const buffer = fs.readFileSync(file1Path);
      const result = parseAssetImportData(buffer, {
        autoGenerateMissingInventoryNumbers: true,
        inventoryNumberPrefix: 'TE',
      });

      expect(result.detectedFormat).toBe('rlb_mytargyi');
      expect(result.formatName).toContain('MyTargyi');
      // Total data rows around 2,261
      expect(result.totalRows).toBeGreaterThanOrEqual(2260);
      expect(result.validRowsCount).toBe(result.totalRows);
      // Check that missing inventory numbers were auto-generated
      expect(result.generatedInventoryNumbersCount).toBeGreaterThan(1900);

      // Check first item
      const item0 = result.items[0];
      expect(item0.name).toContain('fa-üveg paraván');
      expect(item0.acquisitionValue).toBe(315998);
      expect(item0.activationDate).toBe('2007-07-02');
      expect(item0.depreciationRatePercent).toBe(14.5);
      expect(item0.usefulLifeMonths).toBe(83);
      expect(item0.status).toBe('active');

      // Check disposed items count
      expect(result.disposedRowsCount).toBeGreaterThan(200);
      const disposedItem = result.items.find(i => i.status === 'disposed');
      expect(disposedItem).toBeDefined();
      expect(disposedItem?.disposalDate).toBeTruthy();

      // Check land / telek items have 0% rate and 0 usefulLifeMonths (Blind Spot 1)
      const telekItem = result.items.find(i => i.name.toLowerCase().includes('telek'));
      expect(telekItem).toBeDefined();
      expect(telekItem?.depreciationRatePercent).toBe(0);
      expect(telekItem?.usefulLifeMonths).toBe(0);
      expect(telekItem?.depreciationMethod).toBe('none');
    });
  });

  describe('Real file parsing: File 2 (RLB TE Összesítő Tábla)', () => {
    const file2Path = path.resolve(process.cwd(), 'tests/docs/eb0148/1411c2e2-15ba-4306-bfd0-7abb8a3ac890.xlsx');

    it('auto-detects rlb_osszesito and parses rows with accumulated depreciation', () => {
      if (!fs.existsSync(file2Path)) {
        console.warn('Test file not found, skipping real file test');
        return;
      }

      const buffer = fs.readFileSync(file2Path);
      const result = parseAssetImportData(buffer, {
        autoGenerateMissingInventoryNumbers: true,
        inventoryNumberPrefix: 'TE',
      });

      expect(result.detectedFormat).toBe('rlb_osszesito');
      expect(result.formatName).toContain('Összesítő');
      expect(result.totalRows).toBeGreaterThanOrEqual(2040);
      expect(result.validRowsCount).toBe(result.totalRows);

      // Check first item
      const item0 = result.items[0];
      expect(item0.name).toBe('Áruforgalom prog.opc.');
      expect(item0.acquisitionValue).toBe(134000);
      expect(item0.activationDate).toBe('2007-07-02');
      expect(item0.accumulatedDepreciation).toBe(134000);
      expect(item0.netBookValue).toBe(0);
      expect(item0.depreciationRatePercent).toBeCloseTo(16.67, 2);
    });
  });

  describe('Sample template generation and round-trip parsing', () => {
    it('generates a valid Excel template and parses it as generic format', () => {
      const templateBytes = generateSampleAssetImportExcel();
      expect(templateBytes.length).toBeGreaterThan(100);

      const parsed = parseAssetImportData(templateBytes);
      expect(parsed.detectedFormat).toBe('generic');
      expect(parsed.totalRows).toBe(3);
      expect(parsed.validRowsCount).toBe(3);

      expect(parsed.items[0].name).toContain('Lenovo ThinkPad');
      expect(parsed.items[0].acquisitionValue).toBe(450000);
      expect(parsed.items[0].inventoryNumber).toBe('TE-2026-0001');
      expect(parsed.items[0].depreciationRatePercent).toBe(33.3);

      expect(parsed.items[2].name).toContain('Mikrohullámú sütő');
      expect(parsed.items[2].depreciationMethod).toBe('immediate');
    });
  });
});
