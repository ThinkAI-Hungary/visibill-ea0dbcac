import { describe, it, expect } from 'vitest';
import { isCashPayment } from '../../hooks/useRelatedPartyTurnover';
import { RELATION_TYPE_LABELS } from '../../types/related-parties';

describe('Related Party Turnover Helpers', () => {
  it('detects cash payment methods correctly', () => {
    expect(isCashPayment('Készpénz')).toBe(true);
    expect(isCashPayment('Keszpenz')).toBe(true);
    expect(isCashPayment('Cash')).toBe(true);
    expect(isCashPayment('Házipénztár')).toBe(true);
    expect(isCashPayment('KP')).toBe(true);
    expect(isCashPayment('Átutalás')).toBe(false);
    expect(isCashPayment('Bankkártya')).toBe(false);
    expect(isCashPayment(null)).toBe(false);
    expect(isCashPayment(undefined)).toBe(false);
  });

  it('provides complete relation type labels in Hungarian', () => {
    expect(RELATION_TYPE_LABELS.parent).toBe('Anyavállalat');
    expect(RELATION_TYPE_LABELS.subsidiary).toBe('Leányvállalat');
    expect(RELATION_TYPE_LABELS.sister).toBe('Közös vezetésű / Testvérvállalat');
    expect(RELATION_TYPE_LABELS.owner_interest).toBe('Tulajdonos egyéb érdekeltsége');
    expect(RELATION_TYPE_LABELS.other).toBe('Egyéb kapcsolt viszony');
  });
});
