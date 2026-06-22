import { describe, it, expect } from 'vitest';

/**
 * Tests for useAccountyPermissions logic.
 *
 * Since the actual hook depends on React context and Supabase queries,
 * we test the underlying permission resolution logic in isolation.
 * This mirrors the static defaults defined in useAccountyPermissions.ts.
 */

// ── Module category sets (copied from useAccountyPermissions.ts) ──

type AccountyModule =
  | 'portfolio' | 'missing_invoices' | 'tax_calendar'
  | 'reports' | 'approval_queue' | 'alerts' | 'nav_deadlines'
  | 'payroll' | 'onboarding' | 'tao' | 'settings'
  | 'admin_audit' | 'admin_gdpr' | 'admin_templates' | 'admin_job_codes'
  | 'admin_tax_params' | 'admin_legal' | 'admin_office' | 'admin_permissions'
  | 'admin_accountants' | 'tickets' | 'ai_assistant' | 'help' | 'profile';

type AccountyRole = 'iroda_admin' | 'senior_könyvelő' | 'könyvelő' | 'asszisztens';

const ADMIN_ONLY_MODULES: AccountyModule[] = [
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'onboarding',
];

const SENIOR_AND_ADMIN_MODULES: AccountyModule[] = [
  'reports', 'approval_queue', 'alerts', 'nav_deadlines', 'settings',
];

const ALWAYS_ACCESSIBLE: AccountyModule[] = [
  'portfolio', 'missing_invoices', 'tax_calendar', 'payroll',
  'tao', 'tickets', 'ai_assistant', 'help', 'profile',
];

const ALL_MODULES: AccountyModule[] = [
  'portfolio', 'missing_invoices', 'tax_calendar', 'reports',
  'approval_queue', 'alerts', 'nav_deadlines', 'payroll',
  'onboarding', 'tao', 'settings', 'tickets', 'ai_assistant',
  'help', 'profile', 'admin_audit', 'admin_gdpr', 'admin_templates',
  'admin_job_codes', 'admin_tax_params', 'admin_legal', 'admin_office',
  'admin_permissions', 'admin_accountants',
];

// ── Logic under test (mirrors useAccountyPermissions) ──

function getPermissions(role: AccountyRole) {
  const isAdmin = role === 'iroda_admin';
  const isSenior = role === 'iroda_admin' || role === 'senior_könyvelő';

  function staticCanAccess(module: AccountyModule): boolean {
    if (ALWAYS_ACCESSIBLE.includes(module)) return true;
    if (ADMIN_ONLY_MODULES.includes(module)) return isAdmin;
    if (SENIOR_AND_ADMIN_MODULES.includes(module)) return isSenior;
    return true;
  }

  function staticCanWrite(module: AccountyModule): boolean {
    if (isAdmin) return true;
    if (isSenior) return !ADMIN_ONLY_MODULES.includes(module);
    return staticCanAccess(module) && !ADMIN_ONLY_MODULES.includes(module) && !SENIOR_AND_ADMIN_MODULES.includes(module);
  }

  function canAccess(module: AccountyModule, dbOverride?: { can_read: boolean }): boolean {
    if (isAdmin) return true;
    if (dbOverride !== undefined) return dbOverride.can_read;
    return staticCanAccess(module);
  }

  function canWrite(module: AccountyModule, dbOverride?: { can_write: boolean }): boolean {
    if (isAdmin) return true;
    if (dbOverride !== undefined) return dbOverride.can_write;
    return staticCanWrite(module);
  }

  const visibleModules = ALL_MODULES.filter(m => canAccess(m));

  return { canAccess, canWrite, visibleModules, isAdmin, isSenior };
}

// ═══════════════════════════════════════════════════════════════
// iroda_admin tests
// ═══════════════════════════════════════════════════════════════

describe('Accounty Permissions – iroda_admin', () => {
  const { canAccess, canWrite, visibleModules, isAdmin, isSenior } = getPermissions('iroda_admin');

  it('has admin flag set', () => {
    expect(isAdmin).toBe(true);
  });

  it('has senior flag set', () => {
    expect(isSenior).toBe(true);
  });

  it('can access ALL modules', () => {
    for (const mod of ALL_MODULES) {
      expect(canAccess(mod)).toBe(true);
    }
  });

  it('can write ALL modules', () => {
    for (const mod of ALL_MODULES) {
      expect(canWrite(mod)).toBe(true);
    }
  });

  it('visibleModules contains all modules', () => {
    expect(visibleModules).toHaveLength(ALL_MODULES.length);
  });

  it('ignores DB override (admin is never restricted)', () => {
    expect(canAccess('admin_audit', { can_read: false })).toBe(true);
    expect(canWrite('admin_audit', { can_write: false })).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════
// senior_könyvelő tests
// ═══════════════════════════════════════════════════════════════

describe('Accounty Permissions – senior_könyvelő', () => {
  const { canAccess, canWrite, visibleModules, isAdmin, isSenior } = getPermissions('senior_könyvelő');

  it('is NOT admin', () => {
    expect(isAdmin).toBe(false);
  });

  it('IS senior', () => {
    expect(isSenior).toBe(true);
  });

  it('can access always-accessible modules', () => {
    for (const mod of ALWAYS_ACCESSIBLE) {
      expect(canAccess(mod)).toBe(true);
    }
  });

  it('can access senior+admin modules', () => {
    for (const mod of SENIOR_AND_ADMIN_MODULES) {
      expect(canAccess(mod)).toBe(true);
    }
  });

  it('CANNOT access admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(canAccess(mod)).toBe(false);
    }
  });

  it('can write to always-accessible modules', () => {
    for (const mod of ALWAYS_ACCESSIBLE) {
      expect(canWrite(mod)).toBe(true);
    }
  });

  it('can write to senior modules', () => {
    for (const mod of SENIOR_AND_ADMIN_MODULES) {
      expect(canWrite(mod)).toBe(true);
    }
  });

  it('CANNOT write to admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(canWrite(mod)).toBe(false);
    }
  });

  it('DB override can grant read access to normally hidden module', () => {
    expect(canAccess('admin_audit')).toBe(false);
    expect(canAccess('admin_audit', { can_read: true })).toBe(true);
  });

  it('DB override can revoke read access to normally visible module', () => {
    expect(canAccess('portfolio')).toBe(true);
    expect(canAccess('portfolio', { can_read: false })).toBe(false);
  });

  it('visibleModules does NOT include admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(visibleModules).not.toContain(mod);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// könyvelő tests
// ═══════════════════════════════════════════════════════════════

describe('Accounty Permissions – könyvelő', () => {
  const { canAccess, canWrite, visibleModules, isAdmin, isSenior } = getPermissions('könyvelő');

  it('is NOT admin', () => {
    expect(isAdmin).toBe(false);
  });

  it('is NOT senior', () => {
    expect(isSenior).toBe(false);
  });

  it('can access always-accessible modules', () => {
    for (const mod of ALWAYS_ACCESSIBLE) {
      expect(canAccess(mod)).toBe(true);
    }
  });

  it('CANNOT access admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(canAccess(mod)).toBe(false);
    }
  });

  it('CANNOT access senior+admin modules', () => {
    for (const mod of SENIOR_AND_ADMIN_MODULES) {
      expect(canAccess(mod)).toBe(false);
    }
  });

  it('can write to always-accessible modules', () => {
    for (const mod of ALWAYS_ACCESSIBLE) {
      expect(canWrite(mod)).toBe(true);
    }
  });

  it('CANNOT write to admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(canWrite(mod)).toBe(false);
    }
  });

  it('CANNOT write to senior+admin modules', () => {
    for (const mod of SENIOR_AND_ADMIN_MODULES) {
      expect(canWrite(mod)).toBe(false);
    }
  });

  it('visibleModules contains only always-accessible modules', () => {
    expect(visibleModules.sort()).toEqual([...ALWAYS_ACCESSIBLE].sort());
  });
});

// ═══════════════════════════════════════════════════════════════
// asszisztens tests
// ═══════════════════════════════════════════════════════════════

describe('Accounty Permissions – asszisztens', () => {
  const { canAccess, canWrite, visibleModules, isAdmin, isSenior } = getPermissions('asszisztens');

  it('is NOT admin', () => {
    expect(isAdmin).toBe(false);
  });

  it('is NOT senior', () => {
    expect(isSenior).toBe(false);
  });

  it('can access always-accessible modules', () => {
    for (const mod of ALWAYS_ACCESSIBLE) {
      expect(canAccess(mod)).toBe(true);
    }
  });

  it('CANNOT access admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      expect(canAccess(mod)).toBe(false);
    }
  });

  it('CANNOT access senior+admin modules', () => {
    for (const mod of SENIOR_AND_ADMIN_MODULES) {
      expect(canAccess(mod)).toBe(false);
    }
  });

  it('has same access profile as könyvelő', () => {
    const konyveloPerms = getPermissions('könyvelő');
    for (const mod of ALL_MODULES) {
      expect(canAccess(mod)).toBe(konyveloPerms.canAccess(mod));
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// DB override tests (role-agnostic)
// ═══════════════════════════════════════════════════════════════

describe('Accounty Permissions – DB overrides', () => {
  it('DB override takes precedence over static default for senior', () => {
    const { canAccess } = getPermissions('senior_könyvelő');
    // Normally accessible
    expect(canAccess('portfolio')).toBe(true);
    // DB says no
    expect(canAccess('portfolio', { can_read: false })).toBe(false);
  });

  it('DB override can grant access to normally-hidden module for könyvelő', () => {
    const { canAccess } = getPermissions('könyvelő');
    expect(canAccess('admin_audit')).toBe(false);
    expect(canAccess('admin_audit', { can_read: true })).toBe(true);
  });

  it('DB write override works for könyvelő', () => {
    const { canWrite } = getPermissions('könyvelő');
    expect(canWrite('reports')).toBe(false); // senior-only
    expect(canWrite('reports', { can_write: true })).toBe(true);
  });
});
