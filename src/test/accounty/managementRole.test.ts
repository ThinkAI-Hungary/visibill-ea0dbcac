import { describe, it, expect } from 'vitest';

/**
 * Tests for management role redirect logic.
 *
 * In AccountyLayout, users with 'management' or 'thinkai' profile roles
 * are redirected to /management instead of seeing the Accounty UI.
 * This tests the pure logic (role checking) without React routing.
 *
 * Source: AccountyLayout.tsx L243-244:
 *   if (profileRole === 'management' || profileRole === 'thinkai') {
 *     return <Navigate to="/management" replace />;
 *   }
 */

// ── Replicated redirect logic ──
function shouldRedirectToManagement(profileRole: string | null | undefined): boolean {
  return profileRole === 'management' || profileRole === 'thinkai';
}

describe('Management role redirect logic', () => {
  it('redirects "management" role to /management', () => {
    expect(shouldRedirectToManagement('management')).toBe(true);
  });

  it('redirects "thinkai" role to /management', () => {
    expect(shouldRedirectToManagement('thinkai')).toBe(true);
  });

  it('does NOT redirect "user" role', () => {
    expect(shouldRedirectToManagement('user')).toBe(false);
  });

  it('does NOT redirect "admin" role (separate from management)', () => {
    expect(shouldRedirectToManagement('admin')).toBe(false);
  });

  it('does NOT redirect null role', () => {
    expect(shouldRedirectToManagement(null)).toBe(false);
  });

  it('does NOT redirect undefined role', () => {
    expect(shouldRedirectToManagement(undefined)).toBe(false);
  });

  it('does NOT redirect empty string role', () => {
    expect(shouldRedirectToManagement('')).toBe(false);
  });

  it('does NOT redirect for regular accountant roles', () => {
    expect(shouldRedirectToManagement('iroda_admin')).toBe(false);
    expect(shouldRedirectToManagement('könyvelő')).toBe(false);
    expect(shouldRedirectToManagement('senior')).toBe(false);
    expect(shouldRedirectToManagement('junior')).toBe(false);
  });

  it('is case-sensitive (Management ≠ management)', () => {
    expect(shouldRedirectToManagement('Management')).toBe(false);
    expect(shouldRedirectToManagement('THINKAI')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Profile role query integration
// ═══════════════════════════════════════════════════════════════

describe('Profile role fallback logic', () => {
  /**
   * From AccountyLayout:
   *   return data?.role || 'user';
   * If the profile doesn't exist or has no role, it defaults to 'user'.
   */
  function resolveProfileRole(data: { role: string | null } | null): string {
    return data?.role || 'user';
  }

  it('returns the role when present', () => {
    expect(resolveProfileRole({ role: 'management' })).toBe('management');
  });

  it('defaults to "user" when data is null', () => {
    expect(resolveProfileRole(null)).toBe('user');
  });

  it('defaults to "user" when role is null', () => {
    expect(resolveProfileRole({ role: null })).toBe('user');
  });

  it('defaults to "user" when role is empty string', () => {
    expect(resolveProfileRole({ role: '' })).toBe('user');
  });

  it('preserves thinkai role', () => {
    expect(resolveProfileRole({ role: 'thinkai' })).toBe('thinkai');
  });
});
