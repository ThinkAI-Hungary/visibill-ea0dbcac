import { describe, it, expect } from 'vitest';
import { hasMinimumRole } from '@/pages/Accounty/ProtectedAccountyRoute';

/**
 * Tests for the role hierarchy helper and ProtectedAccountyRoute permission logic.
 *
 * Role hierarchy (highest to lowest):
 *   iroda_admin (4) > senior_könyvelő (3) > könyvelő (2) > asszisztens (1)
 */

describe('hasMinimumRole', () => {
  // ── iroda_admin (top-level) ──

  it('iroda_admin meets minimum of iroda_admin', () => {
    expect(hasMinimumRole('iroda_admin', 'iroda_admin')).toBe(true);
  });

  it('iroda_admin meets minimum of senior_könyvelő', () => {
    expect(hasMinimumRole('iroda_admin', 'senior_könyvelő')).toBe(true);
  });

  it('iroda_admin meets minimum of könyvelő', () => {
    expect(hasMinimumRole('iroda_admin', 'könyvelő')).toBe(true);
  });

  it('iroda_admin meets minimum of asszisztens', () => {
    expect(hasMinimumRole('iroda_admin', 'asszisztens')).toBe(true);
  });

  // ── senior_könyvelő ──

  it('senior_könyvelő does NOT meet minimum of iroda_admin', () => {
    expect(hasMinimumRole('senior_könyvelő', 'iroda_admin')).toBe(false);
  });

  it('senior_könyvelő meets minimum of senior_könyvelő', () => {
    expect(hasMinimumRole('senior_könyvelő', 'senior_könyvelő')).toBe(true);
  });

  it('senior_könyvelő meets minimum of könyvelő', () => {
    expect(hasMinimumRole('senior_könyvelő', 'könyvelő')).toBe(true);
  });

  it('senior_könyvelő meets minimum of asszisztens', () => {
    expect(hasMinimumRole('senior_könyvelő', 'asszisztens')).toBe(true);
  });

  // ── könyvelő ──

  it('könyvelő does NOT meet minimum of iroda_admin', () => {
    expect(hasMinimumRole('könyvelő', 'iroda_admin')).toBe(false);
  });

  it('könyvelő does NOT meet minimum of senior_könyvelő', () => {
    expect(hasMinimumRole('könyvelő', 'senior_könyvelő')).toBe(false);
  });

  it('könyvelő meets minimum of könyvelő', () => {
    expect(hasMinimumRole('könyvelő', 'könyvelő')).toBe(true);
  });

  it('könyvelő meets minimum of asszisztens', () => {
    expect(hasMinimumRole('könyvelő', 'asszisztens')).toBe(true);
  });

  // ── asszisztens (lowest) ──

  it('asszisztens does NOT meet minimum of iroda_admin', () => {
    expect(hasMinimumRole('asszisztens', 'iroda_admin')).toBe(false);
  });

  it('asszisztens does NOT meet minimum of senior_könyvelő', () => {
    expect(hasMinimumRole('asszisztens', 'senior_könyvelő')).toBe(false);
  });

  it('asszisztens does NOT meet minimum of könyvelő', () => {
    expect(hasMinimumRole('asszisztens', 'könyvelő')).toBe(false);
  });

  it('asszisztens meets minimum of asszisztens', () => {
    expect(hasMinimumRole('asszisztens', 'asszisztens')).toBe(true);
  });
});

/**
 * Tests for the static role resolution logic from AccountyRoleContext.
 *
 * We replicate the role priority resolution here to test it in isolation
 * without requiring React context or Supabase queries.
 */

type AccountyRole = 'iroda_admin' | 'senior_könyvelő' | 'könyvelő' | 'asszisztens';

const ROLE_PRIORITY: Record<string, number> = {
  'iroda_admin': 4,
  'senior_könyvelő': 3,
  'könyvelő': 2,
  'asszisztens': 1,
  // Legacy mappings
  'senior': 4,
  'admin': 4,
  'junior': 2,
};

function resolveRole(dbRoles: string[]): AccountyRole {
  if (dbRoles.length === 0) return 'könyvelő';

  const bestRole = dbRoles.reduce((best, current) => {
    const bestPrio = ROLE_PRIORITY[best] ?? 0;
    const currentPrio = ROLE_PRIORITY[current] ?? 0;
    return currentPrio > bestPrio ? current : best;
  }, dbRoles[0]);

  // Map legacy values
  if (bestRole === 'senior' || bestRole === 'admin') return 'iroda_admin';
  if (bestRole === 'junior') return 'könyvelő';

  return bestRole as AccountyRole;
}

describe('AccountyRole resolution (role priority)', () => {
  it('resolves to könyvelő when no roles provided', () => {
    expect(resolveRole([])).toBe('könyvelő');
  });

  it('resolves single iroda_admin role', () => {
    expect(resolveRole(['iroda_admin'])).toBe('iroda_admin');
  });

  it('resolves single könyvelő role', () => {
    expect(resolveRole(['könyvelő'])).toBe('könyvelő');
  });

  it('resolves single asszisztens role', () => {
    expect(resolveRole(['asszisztens'])).toBe('asszisztens');
  });

  it('picks highest priority when multiple roles assigned', () => {
    expect(resolveRole(['könyvelő', 'senior_könyvelő'])).toBe('senior_könyvelő');
  });

  it('picks iroda_admin when mixed with lower roles', () => {
    expect(resolveRole(['asszisztens', 'könyvelő', 'iroda_admin'])).toBe('iroda_admin');
  });

  it('handles reversed order correctly', () => {
    expect(resolveRole(['iroda_admin', 'asszisztens'])).toBe('iroda_admin');
  });

  // Legacy role mapping tests
  it('maps legacy "admin" to iroda_admin', () => {
    expect(resolveRole(['admin'])).toBe('iroda_admin');
  });

  it('maps legacy "senior" to iroda_admin', () => {
    expect(resolveRole(['senior'])).toBe('iroda_admin');
  });

  it('maps legacy "junior" to könyvelő', () => {
    expect(resolveRole(['junior'])).toBe('könyvelő');
  });

  it('maps legacy "admin" even when mixed with new roles', () => {
    expect(resolveRole(['könyvelő', 'admin'])).toBe('iroda_admin');
  });

  it('maps legacy "junior" but picks higher new role if present', () => {
    expect(resolveRole(['junior', 'senior_könyvelő'])).toBe('senior_könyvelő');
  });

  it('handles unknown role values gracefully (defaults to 0 priority)', () => {
    expect(resolveRole(['unknown_role'])).toBe('unknown_role' as any);
  });

  it('unknown role loses to known role', () => {
    expect(resolveRole(['unknown_role', 'asszisztens'])).toBe('asszisztens');
  });

  it('two unknown roles: first one wins (both have priority 0)', () => {
    const result = resolveRole(['unknown_a', 'unknown_b']);
    // Both priority 0, reduce keeps the current best
    expect(result).toBe('unknown_a');
  });
});

describe('AccountyRole derived flags', () => {
  function getFlags(role: AccountyRole) {
    return {
      isAdmin: role === 'iroda_admin',
      isSenior: role === 'iroda_admin' || role === 'senior_könyvelő',
    };
  }

  it('iroda_admin: isAdmin=true, isSenior=true', () => {
    const flags = getFlags('iroda_admin');
    expect(flags.isAdmin).toBe(true);
    expect(flags.isSenior).toBe(true);
  });

  it('senior_könyvelő: isAdmin=false, isSenior=true', () => {
    const flags = getFlags('senior_könyvelő');
    expect(flags.isAdmin).toBe(false);
    expect(flags.isSenior).toBe(true);
  });

  it('könyvelő: isAdmin=false, isSenior=false', () => {
    const flags = getFlags('könyvelő');
    expect(flags.isAdmin).toBe(false);
    expect(flags.isSenior).toBe(false);
  });

  it('asszisztens: isAdmin=false, isSenior=false', () => {
    const flags = getFlags('asszisztens');
    expect(flags.isAdmin).toBe(false);
    expect(flags.isSenior).toBe(false);
  });
});
