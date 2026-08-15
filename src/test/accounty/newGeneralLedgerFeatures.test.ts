import { describe, it, expect } from 'vitest';

// Simple mockup of the leaf filtering and variance percentage calculations
function filterLeafAccounts(glAccounts: Array<{ id: string; gl_number: string; short_name: string }>) {
  const cleanGlNum = (num: string) => String(num).replace(/\./g, '');
  return glAccounts.filter(gl => {
    const cid = cleanGlNum(gl.gl_number);
    const isLeaf = !glAccounts.some(sub => 
      cleanGlNum(sub.gl_number).startsWith(cid) && 
      sub.id !== gl.id
    );
    return isLeaf;
  }).sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)));
}

function calculateVariance(valCurr: number, valPrev: number) {
  const diff = valCurr - valPrev;
  let pct = 0;
  if (valPrev !== 0) {
    pct = (diff / Math.abs(valPrev)) * 100;
  } else if (diff !== 0) {
    pct = 100;
  }
  return { diff, pct };
}

describe('General Ledger Features', () => {
  describe('Leaf Account Filtering', () => {
    it('should correctly identify leaf accounts and discard parent headers', () => {
      const glAccounts = [
        { id: '1', gl_number: '1', short_name: 'Befektetett eszközök' },
        { id: '2', gl_number: '11', short_name: 'Immateriális javak' },
        { id: '3', gl_number: '111', short_name: 'Alapítás-átszervezés' },
        { id: '4', gl_number: '112', short_name: 'Kísérleti fejlesztés' },
      ];

      const leafs = filterLeafAccounts(glAccounts);
      expect(leafs).toHaveLength(2);
      expect(leafs.map(l => l.gl_number)).toContain('111');
      expect(leafs.map(l => l.gl_number)).toContain('112');
      expect(leafs.map(l => l.gl_number)).not.toContain('1');
      expect(leafs.map(l => l.gl_number)).not.toContain('11');
    });
  });

  describe('Multi-Year Variance Calculations', () => {
    it('should correctly compute increase variance and percentage', () => {
      const { diff, pct } = calculateVariance(150000, 100000);
      expect(diff).toBe(50000);
      expect(pct).toBe(50);
    });

    it('should correctly compute decrease variance and percentage', () => {
      const { diff, pct } = calculateVariance(80000, 100000);
      expect(diff).toBe(-20000);
      expect(pct).toBe(-20);
    });

    it('should handle zero base previous values safely', () => {
      const { diff, pct } = calculateVariance(5000, 0);
      expect(diff).toBe(5000);
      expect(pct).toBe(100);
    });
  });
});
