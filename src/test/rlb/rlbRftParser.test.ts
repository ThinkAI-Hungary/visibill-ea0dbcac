import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  parseRlbRftChartOfAccounts,
  isRlbRftFile,
  decodeHungarianBytes,
} from '@/lib/rlb/rlbRftParser';

describe('rlbRftParser', () => {
  const sampleFilePath = path.resolve(
    process.cwd(),
    'tests/docs/eb0148/FOKTORZS_WR  2026.RFT'
  );

  it('correctly decodes Hungarian special characters (CP852 and Win1250)', () => {
    // 0xFB = ű, 0xF5 = ő, 0xDB = Ű, 0xD5 = Ő, 0xE1 = á, 0xE9 = é, 0xED = í, 0xF3 = ó, 0xF6 = ö, 0xFC = ü
    const bytes = new Uint8Array([
      0x56, 0x61, 0x67, 0x79, 0x6f, 0x6e, 0x69, 0x20, // 'Vagyoni '
      0xe9, 0x72, 0x74, 0xe9, 0x6b, 0xfb, 0x20,       // 'értékű '
      0x6a, 0x6f, 0x67, 0x6f, 0x6b,                   // 'jogok'
    ]);
    const decoded = decodeHungarianBytes(bytes);
    expect(decoded).toBe('Vagyoni értékű jogok');

    // Test 'ő' and 'ű'
    const oBytes = new Uint8Array([0x76, 0x65, 0x76, 0xf5]); // 'vevő'
    expect(decodeHungarianBytes(oBytes)).toBe('vevő');

    const uBytes = new Uint8Array([0x73, 0x7a, 0x61, 0x62, 0x61, 0x64, 0x73, 0xe1, 0x67, 0xfb]); // 'szabadságű'
    expect(decodeHungarianBytes(uBytes)).toBe('szabadságű');
  });

  it('detects RLB FOKTORZS .RFT file accurately', () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    expect(isRlbRftFile(fileBuffer, 'FOKTORZS_WR  2026.RFT')).toBe(true);
    expect(isRlbRftFile(fileBuffer, 'sample.dbf')).toBe(true);

    // Random non-dbf buffer
    const randomBuffer = new Uint8Array([1, 2, 3, 4, 5]);
    expect(isRlbRftFile(randomBuffer, 'random.txt')).toBe(false);
  });

  it('parses real RLB-60 FOKTORZS_WR  2026.RFT file with 681 records and Hungarian characters', () => {
    const fileBuffer = fs.readFileSync(sampleFilePath);
    const result = parseRlbRftChartOfAccounts(fileBuffer, 'FOKTORZS_WR  2026.RFT');

    expect(result.format).toBe('rlb_rft_chart_of_accounts');
    expect(result.recordCount).toBe(681);
    expect(result.activeAccountsCount).toBeGreaterThanOrEqual(681);

    // Find specific accounts across key classes
    const accountMap = new Map(result.accounts.map((a) => [a.gl_number, a.short_name]));

    // Class 1: Immateriális javak
    expect(accountMap.get('113')).toBe('Vagyoni értékű jogok');
    expect(accountMap.get('111')).toBe('Alapítás-átszervezés aktivált értéke');

    // Class 3: Vevők, Pénztár, Bank
    expect(accountMap.get('311')).toBe('Belföldi vevő követelések forintban');
    expect(accountMap.get('381')).toBe('Pénztár');
    expect(accountMap.get('3811')).toBe('Főpénztár');
    expect(accountMap.get('384')).toBe('Bankszámlák');
    expect(accountMap.get('3841')).toBe('Elszámolási betétszámla');

    // Class 4: Szállítók
    expect(accountMap.get('454')).toBe('Szállítók');
    expect(accountMap.get('4541')).toBe('Belföldi anyag és áruszállítók');

    // Class 5: Költségek
    expect(accountMap.get('511')).toBe('Vásárolt anyagok költségei');

    // Class 9: Árbevétel
    expect(accountMap.get('911')).toBe('Alaptevékenység árbevétele');

    // Ensure mandatory balance sheet accounts 491 and 492 exist
    expect(accountMap.has('491')).toBe(true);
    expect(accountMap.has('492')).toBe(true);
  });

  it('throws descriptive error on invalid or truncated data', () => {
    const truncatedBuffer = new Uint8Array([0x03, 0x1a, 0x01, 0x01]);
    expect(() => parseRlbRftChartOfAccounts(truncatedBuffer)).toThrow(
      /túl rövid/i
    );
  });
});
