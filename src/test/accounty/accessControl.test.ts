import { describe, it, expect } from 'vitest';

/**
 * Tests for the access control hook logic used to determine
 * which app toggle (eaisybill/eaisybooks) should be visible.
 *
 * The hooks themselves use React Query + Supabase, so we test
 * the pure decision logic extracted from them.
 *
 * Key rules:
 * - useHasEaisybillAccess: ONLY checks company_members (NOT accounty_assignments)
 * - useHasAccountyAccess: ONLY checks accounty_assignments
 * - profiles.eaisybill_access === false overrides everything for eaisybill
 */

// ── Replicated access logic ──

interface AccessCheckInput {
  profileEaisybillAccess: boolean | null; // null = not set (default true)
  companyMemberCount: number;
  accountyAssignmentCount: number;
}

function hasEaisybillAccess(input: AccessCheckInput): boolean {
  // Admin can disable via profiles.eaisybill_access = false
  if (input.profileEaisybillAccess === false) return false;

  // Only company_members count determines access
  return input.companyMemberCount > 0;
}

function hasAccountyAccess(input: AccessCheckInput): boolean {
  // Only accounty_assignments count determines access
  return input.accountyAssignmentCount > 0;
}

// ═══════════════════════════════════════════════════════════════
// useHasEaisybillAccess logic tests
// ═══════════════════════════════════════════════════════════════

describe('useHasEaisybillAccess logic', () => {
  describe('company_members based access', () => {
    it('grants access when user has company_members rows', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 1,
        accountyAssignmentCount: 0,
      })).toBe(true);
    });

    it('grants access with multiple company_members', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 5,
        accountyAssignmentCount: 0,
      })).toBe(true);
    });

    it('denies access when user has NO company_members', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 0,
        accountyAssignmentCount: 0,
      })).toBe(false);
    });
  });

  describe('accounty_assignments must NOT grant eaisybill access', () => {
    it('denies eaisybill access for eaisybooks-only user', () => {
      // This is the critical fix: a user with only accounty_assignments
      // should NOT see the eaisybill toggle
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 0,
        accountyAssignmentCount: 3,
      })).toBe(false);
    });

    it('denies eaisybill even with many accounty_assignments', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 0,
        accountyAssignmentCount: 100,
      })).toBe(false);
    });
  });

  describe('admin override via profiles.eaisybill_access', () => {
    it('denies access when admin sets eaisybill_access = false', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: false,
        companyMemberCount: 5, // has company_members but disabled
        accountyAssignmentCount: 0,
      })).toBe(false);
    });

    it('grants access when eaisybill_access = true and has members', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: true,
        companyMemberCount: 1,
        accountyAssignmentCount: 0,
      })).toBe(true);
    });

    it('grants access when eaisybill_access = null (not set) and has members', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: null,
        companyMemberCount: 1,
        accountyAssignmentCount: 0,
      })).toBe(true);
    });

    it('denies when disabled even with both members and assignments', () => {
      expect(hasEaisybillAccess({
        profileEaisybillAccess: false,
        companyMemberCount: 3,
        accountyAssignmentCount: 5,
      })).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// useHasAccountyAccess logic tests
// ═══════════════════════════════════════════════════════════════

describe('useHasAccountyAccess logic', () => {
  it('grants access when user has accounty_assignments', () => {
    expect(hasAccountyAccess({
      profileEaisybillAccess: null,
      companyMemberCount: 0,
      accountyAssignmentCount: 1,
    })).toBe(true);
  });

  it('grants access with multiple assignments', () => {
    expect(hasAccountyAccess({
      profileEaisybillAccess: null,
      companyMemberCount: 0,
      accountyAssignmentCount: 10,
    })).toBe(true);
  });

  it('denies access when user has NO accounty_assignments', () => {
    expect(hasAccountyAccess({
      profileEaisybillAccess: null,
      companyMemberCount: 5,
      accountyAssignmentCount: 0,
    })).toBe(false);
  });

  it('company_members alone do NOT grant accounty access', () => {
    expect(hasAccountyAccess({
      profileEaisybillAccess: null,
      companyMemberCount: 100,
      accountyAssignmentCount: 0,
    })).toBe(false);
  });

  it('eaisybill_access flag does NOT affect accounty access', () => {
    expect(hasAccountyAccess({
      profileEaisybillAccess: false,
      companyMemberCount: 0,
      accountyAssignmentCount: 1,
    })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// Combined scenarios: user personas
// ═══════════════════════════════════════════════════════════════

describe('Access control: User persona scenarios', () => {
  it('eaisybill-only user: sees eaisybill, not eaisybooks', () => {
    const input: AccessCheckInput = {
      profileEaisybillAccess: null,
      companyMemberCount: 2,
      accountyAssignmentCount: 0,
    };
    expect(hasEaisybillAccess(input)).toBe(true);
    expect(hasAccountyAccess(input)).toBe(false);
  });

  it('eaisybooks-only user: sees eaisybooks, not eaisybill', () => {
    const input: AccessCheckInput = {
      profileEaisybillAccess: null,
      companyMemberCount: 0,
      accountyAssignmentCount: 3,
    };
    expect(hasEaisybillAccess(input)).toBe(false);
    expect(hasAccountyAccess(input)).toBe(true);
  });

  it('dual user (both): sees both toggles', () => {
    const input: AccessCheckInput = {
      profileEaisybillAccess: null,
      companyMemberCount: 2,
      accountyAssignmentCount: 5,
    };
    expect(hasEaisybillAccess(input)).toBe(true);
    expect(hasAccountyAccess(input)).toBe(true);
  });

  it('new user (nothing): sees neither', () => {
    const input: AccessCheckInput = {
      profileEaisybillAccess: null,
      companyMemberCount: 0,
      accountyAssignmentCount: 0,
    };
    expect(hasEaisybillAccess(input)).toBe(false);
    expect(hasAccountyAccess(input)).toBe(false);
  });

  it('disabled dual user: sees only eaisybooks', () => {
    const input: AccessCheckInput = {
      profileEaisybillAccess: false,
      companyMemberCount: 2,
      accountyAssignmentCount: 5,
    };
    expect(hasEaisybillAccess(input)).toBe(false);
    expect(hasAccountyAccess(input)).toBe(true);
  });
});
