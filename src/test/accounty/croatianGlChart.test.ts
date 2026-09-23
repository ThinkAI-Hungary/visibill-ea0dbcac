import { describe, it, expect } from 'vitest';
import { getLocalizedGlAccountName } from '@/lib/glUtils';

describe('Croatian GL Chart (számla_hr) Hierarchy & Localization', () => {
  it('preserves native Croatian class names starting with RAZRED', () => {
    const class0 = getLocalizedGlAccountName('0.', 'RAZRED KONTA: DUGOTRAJNA IMOVINA');
    expect(class0).toBe('RAZRED KONTA: DUGOTRAJNA IMOVINA');

    const class4 = getLocalizedGlAccountName('4.', 'RAZRED KONTA: TROŠKOVI PREMA VRSTAMA');
    expect(class4).toBe('RAZRED KONTA: TROŠKOVI PREMA VRSTAMA');
  });

  it('preserves native Croatian accounts without applying Hungarian dictionary when isHrPreset is true', () => {
    // 40. in Hungary is 'KÖZVETLEN ÖNKÖLTSÉG', but in Croatia it is 'Materijalni troškovi'
    const hrGroup40 = getLocalizedGlAccountName('40.', 'Materijalni troškovi', undefined, true);
    expect(hrGroup40).toBe('Materijalni troškovi');

    // 12. in Hungary is 'NEKRETNINE', but in Croatia it is 'Potraživanja od kupaca'
    const hrGroup12 = getLocalizedGlAccountName('12.', 'Potraživanja od kupaca', undefined, true);
    expect(hrGroup12).toBe('Potraživanja od kupaca');

    // Leaf account
    const hrLeaf = getLocalizedGlAccountName('4010', 'Pomoćni materijal', undefined, true);
    expect(hrLeaf).toBe('Pomoćni materijal');
  });

  it('correctly calculates hierarchical prefix nesting for Croatian accounts', () => {
    const cleanId = (val: string) => String(val || '').replace(/\./g, '');

    const rootClasses = ['0.', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.'];
    const groups = ['40.', '41.', '42.'];
    const leaves = ['4000', '4010', '4070', '4100'];

    const allNodes = [...rootClasses, ...groups, ...leaves].map(id => ({
      id,
      cid: cleanId(id),
    }));

    // Find direct parent for leaf 4010
    const node4010 = allNodes.find(n => n.id === '4010')!;
    let directParent4010: typeof node4010 | null = null;
    allNodes.forEach(candidate => {
      if (candidate.cid !== node4010.cid && node4010.cid.startsWith(candidate.cid)) {
        if (!directParent4010 || candidate.cid.length > directParent4010.cid.length) {
          directParent4010 = candidate;
        }
      }
    });
    expect(directParent4010?.id).toBe('40.');

    // Find direct parent for group 40.
    const node40 = allNodes.find(n => n.id === '40.')!;
    let directParent40: typeof node40 | null = null;
    allNodes.forEach(candidate => {
      if (candidate.cid !== node40.cid && node40.cid.startsWith(candidate.cid)) {
        if (!directParent40 || candidate.cid.length > directParent40.cid.length) {
          directParent40 = candidate;
        }
      }
    });
    expect(directParent40?.id).toBe('4.');

    // Find direct parent for class 4.
    const node4 = allNodes.find(n => n.id === '4.')!;
    let directParent4: typeof node4 | null = null;
    allNodes.forEach(candidate => {
      if (candidate.cid !== node4.cid && node4.cid.startsWith(candidate.cid)) {
        if (!directParent4 || candidate.cid.length > directParent4.cid.length) {
          directParent4 = candidate;
        }
      }
    });
    expect(directParent4).toBeNull(); // Root node!
  });
});
