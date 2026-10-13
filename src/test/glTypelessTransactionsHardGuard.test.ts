import { describe, it, expect } from 'vitest';
import { TRANSACTION_TYPE_OPTIONS } from '@/components/general-ledger/TypelessTransactionsApprovalModal';

describe('GL Typeless Transactions Hard Guard & Approval Logic', () => {
  it('should have correct default GL prefix definitions for all transaction types', () => {
    const types = TRANSACTION_TYPE_OPTIONS.map(t => t.value);
    expect(types).toContain('bankköltség');
    expect(types).toContain('szállítói tranzakció');
    expect(types).toContain('vevői tranzakció');
    expect(types).toContain('járulékok/adók');
    expect(types).toContain('bérek');
    expect(types).toContain('hiteltörlesztés');
    expect(types).toContain('kamatjóváírás');
    expect(types).toContain('számlák közötti átvezetés');

    const bankCost = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'bankköltség');
    expect(bankCost?.defaultPrefix).toBe('532');

    const supplier = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'szállítói tranzakció');
    expect(supplier?.defaultPrefix).toBe('454');

    const customer = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'vevői tranzakció');
    expect(customer?.defaultPrefix).toBe('311');

    const tax = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'járulékok/adók');
    expect(tax?.defaultPrefix).toBe('463');

    const wage = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'bérek');
    expect(wage?.defaultPrefix).toBe('471');

    const transfer = TRANSACTION_TYPE_OPTIONS.find(t => t.value === 'számlák közötti átvezetés');
    expect(transfer?.defaultPrefix).toBe('389');
  });

  it('should evaluate Hard Guard mapping condition correctly', () => {
    // Replicating the SQL Hard Guard logic:
    // CASE WHEN (t.type IS NULL OR t.type = '' OR t.type = 'nincs egyértelmű besorolás')
    //           AND NOT COALESCE(t.gl_is_manually_overridden, false)
    //           AND NOT COALESCE(t.is_verified, false)
    //      THEN NULL
    //      ELSE mapped_account_id
    const evaluateHardGuard = (
      type: string | null | undefined,
      isManuallyOverridden: boolean | null | undefined,
      isVerified: boolean | null | undefined,
      suggestedAccountId: string
    ) => {
      const isTypeless = !type || type.trim() === '' || type === 'nincs egyértelmű besorolás';
      const isOverridden = isManuallyOverridden === true;
      const isVerif = isVerified === true;

      if (isTypeless && !isOverridden && !isVerif) {
        return null; // UNCLASSIFIED
      }
      return suggestedAccountId;
    };

    // 1. Missing type and not verified -> NULL (Hard Guard blocks false classification)
    expect(evaluateHardGuard(null, false, false, 'acc-5321')).toBeNull();
    expect(evaluateHardGuard('', false, false, 'acc-5321')).toBeNull();
    expect(evaluateHardGuard('nincs egyértelmű besorolás', false, false, 'acc-5321')).toBeNull();
    expect(evaluateHardGuard('nincs egyértelmű besorolás', null, null, 'acc-5321')).toBeNull();

    // 2. Verified or manually overridden -> permitted through
    expect(evaluateHardGuard('nincs egyértelmű besorolás', true, false, 'acc-5321')).toBe('acc-5321');
    expect(evaluateHardGuard('nincs egyértelmű besorolás', false, true, 'acc-5321')).toBe('acc-5321');

    // 3. Proper transaction type -> permitted through
    expect(evaluateHardGuard('bankköltség', false, false, 'acc-5321')).toBe('acc-5321');
    expect(evaluateHardGuard('szállítói tranzakció', false, false, 'acc-4541')).toBe('acc-4541');
  });
});
