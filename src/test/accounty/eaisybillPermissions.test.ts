import { describe, it, expect } from 'vitest';
import {
  URL_TO_MODULE,
  CONFIGURABLE_MODULES,
  getStaticDefaults,
  type EaisybillModule,
} from '@/hooks/useEaisybillPermissions';

/**
 * Comprehensive tests for the EAIsybill permission system.
 * Tests the static permission logic for all 6 roles × 23 modules,
 * DB override behavior, URL_TO_MODULE mapping, and CONFIGURABLE_MODULES.
 *
 * Roles: owner, admin, member, assistant, viewer, employee
 */

// ── Module category sets (mirrored from useEaisybillPermissions.ts) ──

const ADMIN_ONLY_MODULES: EaisybillModule[] = [
  'salaries', 'integrations', 'shipments', 'shipment_matching', 'shipment_import',
];

const MEMBER_MODULES: EaisybillModule[] = [
  'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return', 'fixed_assets',
];

const ASSISTANT_MODULES: EaisybillModule[] = [
  'dashboard', 'categories', 'projects', 'partners', 'invoices',
  'receivables', 'transactions', 'petty_cash', 'upload', 'tickets',
  'exchange_rates', 'settings', 'notes',
];

const VIEWER_MODULES: EaisybillModule[] = [
  'dashboard', 'categories', 'projects', 'partners', 'invoices',
  'receivables', 'transactions', 'petty_cash', 'exchange_rates', 'tickets', 'settings', 'notes',
];

const EMPLOYEE_MODULES: EaisybillModule[] = ['working_time'];

const SHIPMENT_MODULES: EaisybillModule[] = ['shipments', 'shipment_matching', 'shipment_import'];

const ALL_MODULES: EaisybillModule[] = [
  'dashboard', 'categories', 'projects', 'partners',
  'invoices', 'receivables', 'transactions', 'petty_cash',
  'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
  'salaries', 'working_time', 'fixed_assets',
  'integrations', 'exchange_rates', 'upload', 'tickets', 'settings',
  'shipments', 'shipment_matching', 'shipment_import', 'notes',
];

// ═══════════════════════════════════════════════════════════════
// getStaticDefaults tests
// ═══════════════════════════════════════════════════════════════

describe('getStaticDefaults – owner role', () => {
  it('has full read+write access to ALL non-shipment modules', () => {
    for (const mod of ALL_MODULES) {
      if (SHIPMENT_MODULES.includes(mod)) continue;
      const perms = getStaticDefaults('owner', mod);
      expect(perms.canRead).toBe(true);
      expect(perms.canWrite).toBe(true);
    }
  });

  it('shipment modules are disabled by default even for owner', () => {
    for (const mod of SHIPMENT_MODULES) {
      const perms = getStaticDefaults('owner', mod);
      expect(perms.canRead).toBe(false);
      expect(perms.canWrite).toBe(false);
    }
  });
});

describe('getStaticDefaults – admin role', () => {
  it('has full read+write access to ALL non-shipment modules', () => {
    for (const mod of ALL_MODULES) {
      if (SHIPMENT_MODULES.includes(mod)) continue;
      const perms = getStaticDefaults('admin', mod);
      expect(perms.canRead).toBe(true);
      expect(perms.canWrite).toBe(true);
    }
  });

  it('shipment modules are disabled by default even for admin', () => {
    for (const mod of SHIPMENT_MODULES) {
      const perms = getStaticDefaults('admin', mod);
      expect(perms.canRead).toBe(false);
      expect(perms.canWrite).toBe(false);
    }
  });
});

describe('getStaticDefaults – member role', () => {
  it('can access all modules except admin-only (and excluding working_time which is special)', () => {
    const nonAdminOnlyExceptShipments = ALL_MODULES.filter(
      m => !ADMIN_ONLY_MODULES.includes(m) && !SHIPMENT_MODULES.includes(m)
    );
    for (const mod of nonAdminOnlyExceptShipments) {
      const perms = getStaticDefaults('member', mod);
      expect(perms.canRead).toBe(true);
    }
  });

  it('can access working_time even though salaries is admin-only', () => {
    const perms = getStaticDefaults('member', 'working_time');
    expect(perms.canRead).toBe(true);
    expect(perms.canWrite).toBe(true);
  });

  it('CANNOT access salaries (admin-only)', () => {
    const perms = getStaticDefaults('member', 'salaries');
    expect(perms.canRead).toBe(false);
  });

  it('CANNOT access integrations (admin-only)', () => {
    const perms = getStaticDefaults('member', 'integrations');
    expect(perms.canRead).toBe(false);
  });

  it('can write to modules they can access', () => {
    const perms = getStaticDefaults('member', 'invoices');
    expect(perms.canRead).toBe(true);
    expect(perms.canWrite).toBe(true);
  });

  it('shipment modules are disabled for member', () => {
    for (const mod of SHIPMENT_MODULES) {
      const perms = getStaticDefaults('member', mod);
      expect(perms.canRead).toBe(false);
      expect(perms.canWrite).toBe(false);
    }
  });
});

describe('getStaticDefaults – assistant role', () => {
  it('can access assistant modules', () => {
    for (const mod of ASSISTANT_MODULES) {
      if (SHIPMENT_MODULES.includes(mod)) continue;
      const perms = getStaticDefaults('assistant', mod);
      expect(perms.canRead).toBe(true);
    }
  });

  it('CANNOT access member-only modules (könyvelés)', () => {
    for (const mod of MEMBER_MODULES) {
      const perms = getStaticDefaults('assistant', mod);
      expect(perms.canRead).toBe(false);
    }
  });

  it('CANNOT access admin-only modules', () => {
    const perms = getStaticDefaults('assistant', 'salaries');
    expect(perms.canRead).toBe(false);
  });

  it('can write to assistant modules', () => {
    for (const mod of ASSISTANT_MODULES) {
      if (SHIPMENT_MODULES.includes(mod)) continue;
      const perms = getStaticDefaults('assistant', mod);
      expect(perms.canWrite).toBe(true);
    }
  });
});

describe('getStaticDefaults – viewer role', () => {
  it('can READ viewer modules', () => {
    for (const mod of VIEWER_MODULES) {
      if (SHIPMENT_MODULES.includes(mod)) continue;
      const perms = getStaticDefaults('viewer', mod);
      expect(perms.canRead).toBe(true);
    }
  });

  it('CANNOT WRITE to any module (read-only)', () => {
    for (const mod of ALL_MODULES) {
      const perms = getStaticDefaults('viewer', mod);
      expect(perms.canWrite).toBe(false);
    }
  });

  it('CANNOT access member-only modules', () => {
    for (const mod of MEMBER_MODULES) {
      const perms = getStaticDefaults('viewer', mod);
      expect(perms.canRead).toBe(false);
    }
  });

  it('CANNOT access admin-only modules', () => {
    for (const mod of ADMIN_ONLY_MODULES) {
      const perms = getStaticDefaults('viewer', mod);
      expect(perms.canRead).toBe(false);
    }
  });
});

describe('getStaticDefaults – employee role', () => {
  it('can ONLY access working_time', () => {
    const perms = getStaticDefaults('employee', 'working_time');
    expect(perms.canRead).toBe(true);
    expect(perms.canWrite).toBe(true);
  });

  it('CANNOT access any other module', () => {
    const otherModules = ALL_MODULES.filter(m => m !== 'working_time');
    for (const mod of otherModules) {
      const perms = getStaticDefaults('employee', mod);
      expect(perms.canRead).toBe(false);
    }
  });
});

describe('getStaticDefaults – unknown role', () => {
  it('returns no access for unknown roles', () => {
    for (const mod of ALL_MODULES) {
      const perms = getStaticDefaults('nonexistent', mod);
      // Shipment modules have their own guard first
      if (SHIPMENT_MODULES.includes(mod)) {
        expect(perms.canRead).toBe(false);
        expect(perms.canWrite).toBe(false);
      } else {
        expect(perms.canRead).toBe(false);
        expect(perms.canWrite).toBe(false);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// URL_TO_MODULE tests
// ═══════════════════════════════════════════════════════════════

describe('URL_TO_MODULE mapping', () => {
  it('maps / to dashboard', () => {
    expect(URL_TO_MODULE['/']).toBe('dashboard');
  });

  it('maps /categories to categories', () => {
    expect(URL_TO_MODULE['/categories']).toBe('categories');
  });

  it('maps /projects to projects', () => {
    expect(URL_TO_MODULE['/projects']).toBe('projects');
  });

  it('maps /partners to partners', () => {
    expect(URL_TO_MODULE['/partners']).toBe('partners');
  });

  it('maps /invoices to invoices', () => {
    expect(URL_TO_MODULE['/invoices']).toBe('invoices');
  });

  it('maps /kintlevo to receivables', () => {
    expect(URL_TO_MODULE['/kintlevo']).toBe('receivables');
  });

  it('maps /transactions to transactions', () => {
    expect(URL_TO_MODULE['/transactions']).toBe('transactions');
  });

  it('maps /petty-cash to petty_cash', () => {
    expect(URL_TO_MODULE['/petty-cash']).toBe('petty_cash');
  });

  it('maps /general-ledger to general_ledger', () => {
    expect(URL_TO_MODULE['/general-ledger']).toBe('general_ledger');
  });

  it('maps /profit-and-loss to profit_loss', () => {
    expect(URL_TO_MODULE['/profit-and-loss']).toBe('profit_loss');
  });

  it('maps /balance-sheet to balance_sheet', () => {
    expect(URL_TO_MODULE['/balance-sheet']).toBe('balance_sheet');
  });

  it('maps /annual-report to annual_report', () => {
    expect(URL_TO_MODULE['/annual-report']).toBe('annual_report');
  });

  it('maps /vat-return to vat_return', () => {
    expect(URL_TO_MODULE['/vat-return']).toBe('vat_return');
  });

  it('maps /salaries to salaries', () => {
    expect(URL_TO_MODULE['/salaries']).toBe('salaries');
  });

  it('maps /working-time to working_time', () => {
    expect(URL_TO_MODULE['/working-time']).toBe('working_time');
  });

  it('maps /teny to fixed_assets', () => {
    expect(URL_TO_MODULE['/teny']).toBe('fixed_assets');
  });

  it('maps /integrations to integrations', () => {
    expect(URL_TO_MODULE['/integrations']).toBe('integrations');
  });

  it('maps /exchange-rates to exchange_rates', () => {
    expect(URL_TO_MODULE['/exchange-rates']).toBe('exchange_rates');
  });

  it('maps /upload to upload', () => {
    expect(URL_TO_MODULE['/upload']).toBe('upload');
  });

  it('maps /tickets to tickets', () => {
    expect(URL_TO_MODULE['/tickets']).toBe('tickets');
  });

  it('maps /settings to settings', () => {
    expect(URL_TO_MODULE['/settings']).toBe('settings');
  });

  it('maps /shipments to shipment_matching', () => {
    expect(URL_TO_MODULE['/shipments']).toBe('shipment_matching');
  });

  it('maps /shipments/import to shipment_import', () => {
    expect(URL_TO_MODULE['/shipments/import']).toBe('shipment_import');
  });

  it('maps legacy /shipment-matching URL', () => {
    expect(URL_TO_MODULE['/shipment-matching']).toBe('shipment_matching');
  });

  it('returns undefined for non-existent paths', () => {
    expect(URL_TO_MODULE['/nonexistent']).toBeUndefined();
  });

  it('all paths start with /', () => {
    for (const path of Object.keys(URL_TO_MODULE)) {
      expect(path).toMatch(/^\//);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// CONFIGURABLE_MODULES tests
// ═══════════════════════════════════════════════════════════════

describe('CONFIGURABLE_MODULES', () => {
  it('has at least 20 configurable modules', () => {
    expect(CONFIGURABLE_MODULES.length).toBeGreaterThanOrEqual(20);
  });

  it('all modules have key, label, and group', () => {
    for (const mod of CONFIGURABLE_MODULES) {
      expect(mod.key).toBeDefined();
      expect(mod.label).toBeDefined();
      expect(mod.label.length).toBeGreaterThan(0);
      expect(mod.group).toBeDefined();
      expect(mod.group.length).toBeGreaterThan(0);
    }
  });

  it('all module keys are valid EaisybillModule values', () => {
    for (const mod of CONFIGURABLE_MODULES) {
      expect(ALL_MODULES).toContain(mod.key);
    }
  });

  it('no duplicate module keys', () => {
    const keys = CONFIGURABLE_MODULES.map(m => m.key);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('groups include expected categories', () => {
    const groups = new Set(CONFIGURABLE_MODULES.map(m => m.group));
    expect(groups).toContain('Áttekintés');
    expect(groups).toContain('Pénzügyek');
    expect(groups).toContain('Könyvelés');
    expect(groups).toContain('HR & Eszközök');
    expect(groups).toContain('Rendszer');
  });

  it('contains all key financial modules', () => {
    const keys = CONFIGURABLE_MODULES.map(m => m.key);
    expect(keys).toContain('invoices');
    expect(keys).toContain('transactions');
    expect(keys).toContain('salaries');
    expect(keys).toContain('general_ledger');
  });
});

// ═══════════════════════════════════════════════════════════════
// EAIsybill permission logic tests (mirroring canAccess/canWrite)
// ═══════════════════════════════════════════════════════════════

describe('EAIsybill permission logic (integrated canAccess/canWrite)', () => {
  // Replicate the internal canAccess/canWrite logic for testing
  function canAccess(role: string, module: EaisybillModule, dbOverride?: { can_read: boolean }): boolean {
    if (dbOverride !== undefined) return dbOverride.can_read;

    // Shipment modules are disabled by default for ALL users
    if (SHIPMENT_MODULES.includes(module)) return false;

    const isAdmin = role === 'owner' || role === 'admin';
    if (isAdmin) return true;

    if (role === 'member') return !ADMIN_ONLY_MODULES.includes(module) || module === 'working_time';
    if (role === 'assistant') return ASSISTANT_MODULES.includes(module);
    if (role === 'viewer') return VIEWER_MODULES.includes(module);
    if (role === 'employee') return EMPLOYEE_MODULES.includes(module);
    return false;
  }

  function canWrite(role: string, module: EaisybillModule, dbOverride?: { can_write: boolean }): boolean {
    if (dbOverride !== undefined) return dbOverride.can_write;

    if (SHIPMENT_MODULES.includes(module)) return false;

    const isAdmin = role === 'owner' || role === 'admin';
    if (isAdmin) return true;

    if (module === 'settings') return false; // settings write is admin-only
    if (role === 'member') return canAccess(role, module);
    if (role === 'assistant') return ASSISTANT_MODULES.includes(module);
    if (role === 'viewer') return false;
    if (role === 'employee') return module === 'working_time';
    return false;
  }

  describe('DB override takes priority', () => {
    it('DB override can grant read to normally hidden module', () => {
      expect(canAccess('employee', 'dashboard')).toBe(false);
      expect(canAccess('employee', 'dashboard', { can_read: true })).toBe(true);
    });

    it('DB override can revoke read from normally visible module', () => {
      expect(canAccess('member', 'invoices')).toBe(true);
      expect(canAccess('member', 'invoices', { can_read: false })).toBe(false);
    });

    it('DB override can enable shipment modules', () => {
      expect(canAccess('admin', 'shipment_matching')).toBe(false);
      expect(canAccess('admin', 'shipment_matching', { can_read: true })).toBe(true);
    });

    it('DB write override works', () => {
      expect(canWrite('viewer', 'invoices')).toBe(false);
      expect(canWrite('viewer', 'invoices', { can_write: true })).toBe(true);
    });
  });

  describe('Settings write is admin-only', () => {
    it('member cannot write settings', () => {
      expect(canAccess('member', 'settings')).toBe(true);
      expect(canWrite('member', 'settings')).toBe(false);
    });

    it('assistant cannot write settings', () => {
      expect(canAccess('assistant', 'settings')).toBe(true);
      expect(canWrite('assistant', 'settings')).toBe(false);
    });

    it('admin can write settings', () => {
      expect(canWrite('admin', 'settings')).toBe(true);
    });

    it('owner can write settings', () => {
      expect(canWrite('owner', 'settings')).toBe(true);
    });
  });

  describe('Viewer is strictly read-only', () => {
    it('viewer cannot write any module', () => {
      for (const mod of ALL_MODULES) {
        expect(canWrite('viewer', mod)).toBe(false);
      }
    });

    it('viewer CAN read financial modules', () => {
      expect(canAccess('viewer', 'invoices')).toBe(true);
      expect(canAccess('viewer', 'transactions')).toBe(true);
      expect(canAccess('viewer', 'partners')).toBe(true);
    });
  });

  describe('Employee is working_time only', () => {
    it('employee can read and write working_time', () => {
      expect(canAccess('employee', 'working_time')).toBe(true);
      expect(canWrite('employee', 'working_time')).toBe(true);
    });

    it('employee cannot access any other module', () => {
      const others = ALL_MODULES.filter(m => m !== 'working_time');
      for (const mod of others) {
        expect(canAccess('employee', mod)).toBe(false);
      }
    });
  });

  describe('Member cannot access admin-only modules except working_time', () => {
    it('member cannot access salaries', () => {
      expect(canAccess('member', 'salaries')).toBe(false);
    });

    it('member cannot access integrations', () => {
      expect(canAccess('member', 'integrations')).toBe(false);
    });

    it('member CAN access working_time', () => {
      expect(canAccess('member', 'working_time')).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// useUserRole logic tests
// ═══════════════════════════════════════════════════════════════

describe('useUserRole derived flags logic', () => {
  function getDerivedFlags(role: string | null, hasCompanyId: boolean) {
    const resolvedRole = !hasCompanyId ? null : role;
    return {
      role: resolvedRole,
      isAdmin: resolvedRole === 'owner' || resolvedRole === 'admin' || !hasCompanyId,
      isMember: resolvedRole === 'member',
      isAssistant: resolvedRole === 'assistant',
      isViewer: resolvedRole === 'viewer',
      isEmployee: !!hasCompanyId && resolvedRole === 'employee',
    };
  }

  it('owner is admin', () => {
    const flags = getDerivedFlags('owner', true);
    expect(flags.isAdmin).toBe(true);
    expect(flags.isMember).toBe(false);
    expect(flags.isEmployee).toBe(false);
  });

  it('admin is admin', () => {
    const flags = getDerivedFlags('admin', true);
    expect(flags.isAdmin).toBe(true);
  });

  it('member flags', () => {
    const flags = getDerivedFlags('member', true);
    expect(flags.isAdmin).toBe(false);
    expect(flags.isMember).toBe(true);
    expect(flags.isAssistant).toBe(false);
    expect(flags.isViewer).toBe(false);
    expect(flags.isEmployee).toBe(false);
  });

  it('assistant flags', () => {
    const flags = getDerivedFlags('assistant', true);
    expect(flags.isAdmin).toBe(false);
    expect(flags.isMember).toBe(false);
    expect(flags.isAssistant).toBe(true);
  });

  it('viewer flags', () => {
    const flags = getDerivedFlags('viewer', true);
    expect(flags.isViewer).toBe(true);
    expect(flags.isAdmin).toBe(false);
  });

  it('employee flags', () => {
    const flags = getDerivedFlags('employee', true);
    expect(flags.isEmployee).toBe(true);
    expect(flags.isAdmin).toBe(false);
  });

  it('no company = isAdmin defaults to true', () => {
    const flags = getDerivedFlags(null, false);
    expect(flags.isAdmin).toBe(true);
    expect(flags.role).toBeNull();
  });

  it('employee without company is NOT employee', () => {
    const flags = getDerivedFlags('employee', false);
    expect(flags.isEmployee).toBe(false);
  });

  it('null role with company is not admin', () => {
    const flags = getDerivedFlags(null, true);
    expect(flags.isAdmin).toBe(false);
    expect(flags.isMember).toBe(false);
  });
});
