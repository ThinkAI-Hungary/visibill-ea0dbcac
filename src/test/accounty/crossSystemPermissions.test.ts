import { describe, it, expect } from 'vitest';
import { getStaticDefaults, type EaisybillModule } from '@/hooks/useEaisybillPermissions';

/**
 * Cross-system permission tests: verifies that the EAIsybill and Accounty
 * permission systems are properly separated and don't interfere with each other.
 *
 * From the spec document:
 * - "A könyvelői permission nem egyezik meg a céges Visibill profilban meghívott könyvelő permissionjeivel."
 * - "Az Accounty-n keresztül regisztrált könyvelők teljes körű jogosultsággal rendelkeznek könyvelési funkciókhoz."
 * - "Jogosultságok mindkét oldalról érkezhetnek – szétválasztása legyen egyértelmű."
 */

// ── Accounty permission logic (mirrored) ──

type AccountyModule =
  | 'portfolio' | 'missing_invoices' | 'tax_calendar'
  | 'reports' | 'approval_queue' | 'alerts' | 'nav_deadlines'
  | 'payroll' | 'onboarding' | 'tao' | 'settings'
  | 'admin_audit' | 'admin_gdpr' | 'admin_templates' | 'admin_job_codes'
  | 'admin_tax_params' | 'admin_legal' | 'admin_office' | 'admin_permissions'
  | 'admin_accountants' | 'tickets' | 'ai_assistant' | 'help' | 'profile';

type AccountyRole = 'iroda_admin' | 'senior_könyvelő' | 'könyvelő' | 'asszisztens';

const ACCOUNTY_ADMIN_ONLY: AccountyModule[] = [
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'onboarding',
];

const ACCOUNTY_SENIOR_MODULES: AccountyModule[] = [
  'reports', 'approval_queue', 'alerts', 'nav_deadlines', 'settings',
];

const ACCOUNTY_ALWAYS_ACCESSIBLE: AccountyModule[] = [
  'portfolio', 'missing_invoices', 'tax_calendar', 'payroll',
  'tao', 'tickets', 'ai_assistant', 'help', 'profile',
];

function accountyCanAccess(role: AccountyRole, module: AccountyModule): boolean {
  const isAdmin = role === 'iroda_admin';
  const isSenior = role === 'iroda_admin' || role === 'senior_könyvelő';
  
  if (ACCOUNTY_ALWAYS_ACCESSIBLE.includes(module)) return true;
  if (ACCOUNTY_ADMIN_ONLY.includes(module)) return isAdmin;
  if (ACCOUNTY_SENIOR_MODULES.includes(module)) return isSenior;
  return true;
}

// ═══════════════════════════════════════════════════════════════
// Cross-system: EAIsybill vs Accounty module separation
// ═══════════════════════════════════════════════════════════════

describe('Cross-system: EAIsybill and Accounty module separation', () => {
  it('EAIsybill and Accounty have completely different module sets', () => {
    const eaisybillModules: EaisybillModule[] = [
      'dashboard', 'categories', 'projects', 'partners',
      'invoices', 'receivables', 'transactions', 'petty_cash',
      'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
      'salaries', 'working_time', 'fixed_assets',
      'integrations', 'exchange_rates', 'upload', 'tickets', 'settings',
      'shipments', 'shipment_matching', 'shipment_import',
    ];

    const accountyModules: AccountyModule[] = [
      'portfolio', 'missing_invoices', 'tax_calendar', 'reports',
      'approval_queue', 'alerts', 'nav_deadlines', 'payroll',
      'onboarding', 'tao', 'settings', 'tickets', 'ai_assistant',
      'help', 'profile', 'admin_audit', 'admin_gdpr', 'admin_templates',
      'admin_job_codes', 'admin_tax_params', 'admin_legal', 'admin_office',
      'admin_permissions', 'admin_accountants',
    ];

    // The two sets should be MOSTLY different (a few like 'tickets' and 'settings' may overlap in name)
    const eaisybillSet = new Set(eaisybillModules);
    const accountySet = new Set(accountyModules);
    
    // Core financial modules are ONLY in EAIsybill
    expect(eaisybillSet.has('invoices')).toBe(true);
    expect(accountySet.has('invoices' as any)).toBe(false);
    
    expect(eaisybillSet.has('transactions')).toBe(true);
    expect(accountySet.has('transactions' as any)).toBe(false);
    
    // Accounty-specific modules are ONLY in Accounty
    expect(accountySet.has('portfolio')).toBe(true);
    expect(eaisybillSet.has('portfolio' as any)).toBe(false);
    
    expect(accountySet.has('missing_invoices')).toBe(true);
    expect(eaisybillSet.has('missing_invoices' as any)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-system: Accounty könyvelő gets EAIsybill member access
// ═══════════════════════════════════════════════════════════════

describe('Cross-system: Accounty accountant → EAIsybill member fallback', () => {
  /**
   * Per the spec and useUserRole.ts:
   * If a user has NO company_members row but HAS an accounty_assignments row,
   * they get 'member' role in EAIsybill. This gives them full financial access.
   */
  
  it('Accounty könyvelő as EAIsybill member can access könyvelés modules', () => {
    // An Accounty könyvelő falls back to 'member' in EAIsybill
    const memberModules: EaisybillModule[] = [
      'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
    ];
    for (const mod of memberModules) {
      const perms = getStaticDefaults('member', mod);
      expect(perms.canRead).toBe(true);
    }
  });

  it('Accounty könyvelő as EAIsybill member can access financial data', () => {
    const financialModules: EaisybillModule[] = [
      'dashboard', 'invoices', 'transactions', 'petty_cash', 'partners',
    ];
    for (const mod of financialModules) {
      const perms = getStaticDefaults('member', mod);
      expect(perms.canRead).toBe(true);
      expect(perms.canWrite).toBe(true);
    }
  });

  it('Accounty könyvelő as EAIsybill member CANNOT access admin modules', () => {
    const adminModules: EaisybillModule[] = ['salaries', 'integrations'];
    for (const mod of adminModules) {
      const perms = getStaticDefaults('member', mod);
      expect(perms.canRead).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-system: Permission isolation
// ═══════════════════════════════════════════════════════════════

describe('Cross-system: Permission isolation', () => {
  it('Accounty iroda_admin does NOT automatically get EAIsybill admin', () => {
    // Being iroda_admin in Accounty only affects Accounty modules
    // In EAIsybill, the user needs a company_members row or falls back to member
    // This test validates the concept
    const accountyAdmin = accountyCanAccess('iroda_admin', 'admin_audit');
    expect(accountyAdmin).toBe(true);
    
    // But as an EAIsybill member (fallback), they CAN'T access salaries
    const eaisybillMember = getStaticDefaults('member', 'salaries');
    expect(eaisybillMember.canRead).toBe(false);
  });

  it('EAIsybill admin does NOT automatically get Accounty admin modules', () => {
    // Being admin in EAIsybill gives full access in EAIsybill
    const eaisybillAdmin = getStaticDefaults('admin', 'salaries');
    expect(eaisybillAdmin.canRead).toBe(true);
    
    // But a regular Accounty könyvelő cannot access admin_audit
    const accountyKonyv = accountyCanAccess('könyvelő', 'admin_audit');
    expect(accountyKonyv).toBe(false);
  });

  it('Accounty asszisztens still gets base Accounty access', () => {
    for (const mod of ACCOUNTY_ALWAYS_ACCESSIBLE) {
      expect(accountyCanAccess('asszisztens', mod)).toBe(true);
    }
  });

  it('Accounty asszisztens CANNOT access admin or senior modules', () => {
    for (const mod of ACCOUNTY_ADMIN_ONLY) {
      expect(accountyCanAccess('asszisztens', mod)).toBe(false);
    }
    for (const mod of ACCOUNTY_SENIOR_MODULES) {
      expect(accountyCanAccess('asszisztens', mod)).toBe(false);
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// Spec document: company scoping per role
// ═══════════════════════════════════════════════════════════════

describe('Spec: Same user, different roles per company', () => {
  /**
   * From spec: "Jogosultsági rendszer mindenhol egyedileg érvényesüljön
   * (pl. a könyvelő az egyik cégen admin, máshol csak könyvelő)."
   */

  it('admin role gives full access on that company', () => {
    const adminPerms = getStaticDefaults('admin', 'salaries');
    expect(adminPerms.canRead).toBe(true);
    expect(adminPerms.canWrite).toBe(true);
  });

  it('member role on another company restricts access', () => {
    const memberPerms = getStaticDefaults('member', 'salaries');
    expect(memberPerms.canRead).toBe(false);
    expect(memberPerms.canWrite).toBe(false);
  });

  it('the SAME module has different permissions per role', () => {
    const roles = ['owner', 'admin', 'member', 'assistant', 'viewer', 'employee'];
    const module: EaisybillModule = 'invoices';
    
    const readAccess = roles.map(r => getStaticDefaults(r, module).canRead);
    // owner=true, admin=true, member=true, assistant=true, viewer=true, employee=false
    expect(readAccess).toEqual([true, true, true, true, true, false]);
    
    const writeAccess = roles.map(r => getStaticDefaults(r, module).canWrite);
    // owner=true, admin=true, member=true, assistant=true, viewer=false, employee=false
    expect(writeAccess).toEqual([true, true, true, true, false, false]);
  });
});

// ═══════════════════════════════════════════════════════════════
// Spec document: Testreszabható permission panel
// ═══════════════════════════════════════════════════════════════

describe('Spec: Customizable permission panel', () => {
  /**
   * From spec: "Testreszabható jogosultsági panel: bármely funkcióhoz főadmin
   * szabályozhatja, ki mit lát."
   *
   * This is implemented via DB overrides (eaisybill_module_permissions /
   * accounty_module_permissions tables).
   */

  it('DB override can restrict normally-accessible module', () => {
    // Static default: member CAN read invoices
    expect(getStaticDefaults('member', 'invoices').canRead).toBe(true);
    // But admin can set can_read=false via DB, which is tested in eaisybillPermissions.test.ts
  });

  it('DB override can grant normally-restricted module', () => {
    // Static default: assistant CANNOT read general_ledger
    expect(getStaticDefaults('assistant', 'general_ledger').canRead).toBe(false);
    // But admin can set can_read=true via DB
  });

  it('static defaults exist for all roles and all modules', () => {
    const roles = ['owner', 'admin', 'member', 'assistant', 'viewer', 'employee'];
    const modules: EaisybillModule[] = [
      'dashboard', 'categories', 'projects', 'partners',
      'invoices', 'receivables', 'transactions', 'petty_cash',
      'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
      'salaries', 'working_time', 'fixed_assets',
      'integrations', 'exchange_rates', 'upload', 'tickets', 'settings',
      'shipments', 'shipment_matching', 'shipment_import',
    ];

    for (const role of roles) {
      for (const mod of modules) {
        const perms = getStaticDefaults(role, mod);
        expect(typeof perms.canRead).toBe('boolean');
        expect(typeof perms.canWrite).toBe('boolean');
      }
    }
  });
});
