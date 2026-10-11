import { describe, it, expect } from 'vitest';
import { getAccountyRoleDefault } from '@/lib/permissions/accountyDefaults';
import {
  CONFIGURABLE_MODULES,
  getStaticDefaults,
  type EaisybillModule,
} from '@/hooks/useEaisybillPermissions';

const ALL_MODULES: EaisybillModule[] = [
  'dashboard', 'categories', 'projects', 'partners', 'invoices', 'receivables', 'transactions', 'petty_cash',
  'general_ledger', 'journals', 'subledger', 'accounting_rules', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
  'salaries', 'working_time', 'fixed_assets', 'integrations', 'exchange_rates', 'upload', 'knowledge_base',
  'tickets', 'settings', 'notes',
];

describe('getAccountyRoleDefault — eaisyBooks role defaults', () => {
  it('iroda_admin is never restricted', () => {
    for (const m of ['payroll', 'admin_audit', 'tao', 'client_bookkeeping', 'anything']) {
      expect(getAccountyRoleDefault('iroda_admin', m)).toEqual({ canRead: true, canWrite: true });
    }
  });

  it('senior reads/writes everything except admin-only modules (read denied there)', () => {
    expect(getAccountyRoleDefault('senior_könyvelő', 'reports')).toEqual({ canRead: true, canWrite: true });
    expect(getAccountyRoleDefault('senior_könyvelő', 'admin_audit').canRead).toBe(false);
    expect(getAccountyRoleDefault('senior_könyvelő', 'tao').canRead).toBe(true);
  });

  it('könyvelő cannot read senior-only modules, can write the always-accessible ones', () => {
    expect(getAccountyRoleDefault('könyvelő', 'reports').canRead).toBe(false);
    expect(getAccountyRoleDefault('könyvelő', 'payroll')).toEqual({ canRead: true, canWrite: true });
    expect(getAccountyRoleDefault('könyvelő', 'client_bookkeeping')).toEqual({ canRead: true, canWrite: true });
  });

  it('asszisztens has no TAO / KIVA by default (spec) but keeps the other basics', () => {
    expect(getAccountyRoleDefault('asszisztens', 'tao')).toEqual({ canRead: false, canWrite: false });
    expect(getAccountyRoleDefault('asszisztens', 'payroll').canRead).toBe(true);
  });

  it('D-5: payroll_specialist gets only payroll (rw) + a few read-only basics', () => {
    expect(getAccountyRoleDefault('payroll_specialist', 'payroll')).toEqual({ canRead: true, canWrite: true });
    expect(getAccountyRoleDefault('payroll_specialist', 'portfolio')).toEqual({ canRead: true, canWrite: false });
    expect(getAccountyRoleDefault('payroll_specialist', 'tax_calendar')).toEqual({ canRead: true, canWrite: false });
  });

  it('D-5: payroll_specialist has no access to ledger / invoices / TAO / reports / unknown modules', () => {
    for (const m of ['client_bookkeeping', 'missing_invoices', 'tao', 'reports', 'settings', 'admin_audit', 'unknown_module']) {
      expect(getAccountyRoleDefault('payroll_specialist', m)).toEqual({ canRead: false, canWrite: false });
    }
  });

  it('unknown / null role behaves as a classic (non-senior) role, not as admin', () => {
    expect(getAccountyRoleDefault(null, 'admin_audit').canRead).toBe(false);
    expect(getAccountyRoleDefault(undefined, 'reports').canRead).toBe(false);
  });
});

describe('getStaticDefaults — eaisyBill module defaults', () => {
  const tech: EaisybillModule[] = ['subledger', 'journals'];

  it('new modules are registered and configurable', () => {
    const keys = CONFIGURABLE_MODULES.map(m => m.key);
    expect(keys).toContain('subledger');
    expect(keys).toContain('accounting_rules');
    expect(keys).toContain('journals');
  });

  it('D-3: owner sees accounting-technical modules, admin (Cégvezető) does not', () => {
    for (const m of tech) {
      expect(getStaticDefaults('owner', m).canRead).toBe(true);
      expect(getStaticDefaults('admin', m)).toEqual({ canRead: false, canWrite: false });
    }
  });

  it('D-3: admin still sees the controlling views', () => {
    for (const m of ['profit_loss', 'balance_sheet', 'general_ledger', 'vat_return'] as EaisybillModule[]) {
      expect(getStaticDefaults('admin', m).canRead).toBe(true);
    }
  });

  it('member (Pénzügyi Vezető) keeps accounting-technical access and no settings write', () => {
    for (const m of tech) expect(getStaticDefaults('member', m).canRead).toBe(true);
    expect(getStaticDefaults('member', 'settings').canWrite).toBe(false);
    expect(getStaticDefaults('finance_lead', 'profit_loss').canRead).toBe(true);
  });

  it('D-3: assistant has no book / controlling modules', () => {
    for (const m of ['profit_loss', 'balance_sheet', 'general_ledger', 'vat_return', 'subledger', 'journals'] as EaisybillModule[]) {
      expect(getStaticDefaults('assistant', m).canRead).toBe(false);
    }
    expect(getStaticDefaults('assistant', 'invoices')).toEqual({ canRead: true, canWrite: true });
  });

  it('Megfigyelő (viewer): read-only everywhere, sees controlling but not payroll / accounting-tech', () => {
    for (const m of ALL_MODULES) {
      expect(getStaticDefaults('viewer', m).canWrite).toBe(false);
    }
    expect(getStaticDefaults('viewer', 'profit_loss').canRead).toBe(true);
    expect(getStaticDefaults('viewer', 'salaries').canRead).toBe(false);
    expect(getStaticDefaults('viewer', 'journals').canRead).toBe(false);
    expect(getStaticDefaults('viewer', 'subledger').canRead).toBe(false);
  });

  it('employee only reaches working time; payroll_specialist reaches no financial module', () => {
    expect(getStaticDefaults('employee', 'working_time').canRead).toBe(true);
    expect(getStaticDefaults('employee', 'invoices').canRead).toBe(false);
    for (const m of ['invoices', 'transactions', 'general_ledger', 'profit_loss', 'journals'] as EaisybillModule[]) {
      expect(getStaticDefaults('payroll_specialist', m).canRead).toBe(false);
    }
  });

  it('unknown roles fail closed', () => {
    expect(getStaticDefaults('stranger', 'dashboard')).toEqual({ canRead: false, canWrite: false });
  });
});
