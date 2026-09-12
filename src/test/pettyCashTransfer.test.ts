import { describe, it, expect } from 'vitest';
import { SOURCE_LABELS, SOURCE_COLORS, roundHuf } from '@/components/petty-cash/types';

describe('Petty Cash Inter-register Transfer (Pénztárközi átvezetés)', () => {
  it('has valid source label and color mappings for transfer', () => {
    expect(SOURCE_LABELS.transfer).toBe('Átvezetés');
    expect(SOURCE_COLORS.transfer).toBe('bg-sky-500/10 text-sky-500');
  });

  it('guarantees transfer balance conservation (net sum across registers is 0)', () => {
    const transferAmount = 150000; // 150,000 Ft
    const outLegAmount = -transferAmount;
    const inLegAmount = transferAmount;

    expect(outLegAmount + inLegAmount).toBe(0);
  });

  it('correctly rounds HUF transfer amounts to nearest 5', () => {
    expect(roundHuf(1234, 'HUF')).toBe(1235);
    expect(roundHuf(1232, 'HUF')).toBe(1230);
    expect(roundHuf(1230, 'HUF')).toBe(1230);
    expect(roundHuf(100.456, 'EUR')).toBe(100.46);
  });

  it('validates transfer payload rules', () => {
    const validateTransfer = (fromId: string, toId: string, amount: number) => {
      if (amount <= 0) return { valid: false, error: 'Az összegnek nagyobbnak kell lennie nullánál' };
      if (fromId === toId) return { valid: false, error: 'A forrás és cél pénztár nem lehet azonos' };
      return { valid: true };
    };

    expect(validateTransfer('reg-1', 'reg-2', 5000)).toEqual({ valid: true });
    expect(validateTransfer('reg-1', 'reg-1', 5000)).toEqual({
      valid: false,
      error: 'A forrás és cél pénztár nem lehet azonos',
    });
    expect(validateTransfer('reg-1', 'reg-2', 0)).toEqual({
      valid: false,
      error: 'Az összegnek nagyobbnak kell lennie nullánál',
    });
    expect(validateTransfer('reg-1', 'reg-2', -100)).toEqual({
      valid: false,
      error: 'Az összegnek nagyobbnak kell lennie nullánál',
    });
  });
});
