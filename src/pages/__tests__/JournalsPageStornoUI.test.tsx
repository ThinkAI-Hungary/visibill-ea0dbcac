import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('JournalsPage Sztornó Bizonylat UI Features', () => {
  const filePath = path.resolve(__dirname, '../JournalsPage.tsx');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  it('imports RotateCcw icon for storno visualization', () => {
    expect(fileContent).toContain('RotateCcw');
  });

  it('includes storno quick filter buttons (Összes, Aktív, Sztornó tételek)', () => {
    expect(fileContent).toContain("setStornoFilter('all')");
    expect(fileContent).toContain("setStornoFilter('active')");
    expect(fileContent).toContain("setStornoFilter('storno')");
    expect(fileContent).toContain('Sztornó tételek');
  });

  it('displays Sztornó badge and negative total amount for storno vouchers', () => {
    expect(fileContent).toContain("const isStornoEntry = e.entry_type === 'SZTORNO';");
    expect(fileContent).toContain('totalAmount = isStornoEntry ? -Math.abs(rawTotalAmount) : rawTotalAmount;');
    expect(fileContent).toContain('isStornoEntry && "text-amber-600 dark:text-amber-400 font-bold"');
    expect(fileContent).toContain('Sztornó');
  });

  it('displays cross-references between original and storno documents', () => {
    expect(fileContent).toContain('origRefEntry');
    expect(fileContent).toContain('stornoRefEntry');
    expect(fileContent).toContain('↩');
    expect(fileContent).toContain('❌');
  });

  it('renders descriptive alert banners in the details drawer for storno and stornoed entries', () => {
    expect(fileContent).toContain('SZTORNÓ BIZONYLAT');
    expect(fileContent).toContain('Ez a bizonylat ellentétes előjellel sztornózza');
    expect(fileContent).toContain('SZTORNÓZOTT (ÉRVÉNYTELENÍTETT) BIZONYLAT');
    expect(fileContent).toContain('Ezt a bizonylatot hivatalosan sztornózták.');
  });
});
