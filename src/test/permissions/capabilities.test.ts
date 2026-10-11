import { describe, it, expect } from 'vitest';
import {
  ACCOUNTY_ASSIGNMENT_ROLES,
  ACCOUNTY_ROLE_LABELS,
  EAISYBILL_ROLE_LABELS,
  NO_CAPABILITIES,
  canAccountyRoleClosePeriod,
  canAccountyRoleExportOfficialXml,
  getAccountyCapabilities,
  getEaisybillCapabilities,
  normalizeAccountyRole,
  resolveCapabilities,
  toEaisybillPersona,
} from '@/lib/permissions/capabilities';

describe('capabilities — eaisyBill company roles', () => {
  it('D-1: member is presented as finance_lead (hybrid alias, no DB rename)', () => {
    expect(toEaisybillPersona('member')).toBe('finance_lead');
    expect(toEaisybillPersona('owner')).toBe('owner');
    expect(toEaisybillPersona('nonsense')).toBeNull();
    expect(toEaisybillPersona(null)).toBeNull();
  });

  it('labels: viewer is "Megfigyelő" (never Csendestárs), member is "Pénzügyi Vezető"', () => {
    expect(EAISYBILL_ROLE_LABELS.viewer).toBe('Megfigyelő');
    expect(EAISYBILL_ROLE_LABELS.member).toBe('Pénzügyi Vezető');
    expect(EAISYBILL_ROLE_LABELS.payroll_specialist).toBe('Bérszámfejtő');
    expect(JSON.stringify(EAISYBILL_ROLE_LABELS)).not.toMatch(/Csendest/i);
  });

  it('owner has every capability', () => {
    const c = getEaisybillCapabilities('owner');
    expect(Object.values(c).every(Boolean)).toBe(true);
  });

  it('D-3: admin (Cégvezető) keeps controlling but not accounting-technical views', () => {
    const c = getEaisybillCapabilities('admin');
    expect(c.canViewControlling).toBe(true);
    expect(c.canViewBankBalances).toBe(true);
    expect(c.canManageTeam).toBe(true);
    expect(c.canManageAccountingTech).toBe(false);
  });

  it('D-3: finance_lead (member) has controlling but cannot manage the team', () => {
    const c = getEaisybillCapabilities('member');
    expect(c.canViewControlling).toBe(true);
    expect(c.canManageAccountingTech).toBe(true);
    expect(c.canManageTeam).toBe(false);
  });

  it('D-3: assistant can manage invoices but sees no books / bank balances', () => {
    const c = getEaisybillCapabilities('assistant');
    expect(c.canManageInvoices).toBe(true);
    expect(c.canViewBankBalances).toBe(false);
    expect(c.canViewControlling).toBe(false);
    expect(c.canManageAccountingTech).toBe(false);
    expect(c.canClosePeriod).toBe(false);
  });

  it('viewer (Megfigyelő) is global read-only: no write-type capability', () => {
    const c = getEaisybillCapabilities('viewer');
    expect(c.canViewControlling).toBe(true);
    expect(c.canViewBankBalances).toBe(true);
    expect(c.canManageInvoices).toBe(false);
    expect(c.canManageAccountingTech).toBe(false);
    expect(c.canClosePeriod).toBe(false);
    expect(c.canManageTeam).toBe(false);
    expect(c.canExportOfficialTaxReturn).toBe(false);
  });

  it('employee and unknown roles have no capabilities (fail closed)', () => {
    expect(getEaisybillCapabilities('employee')).toEqual(NO_CAPABILITIES);
    expect(getEaisybillCapabilities(undefined)).toEqual(NO_CAPABILITIES);
    expect(getEaisybillCapabilities('hacker')).toEqual(NO_CAPABILITIES);
  });

  it('returns copies (callers cannot mutate the matrix)', () => {
    const a = getEaisybillCapabilities('owner');
    a.canClosePeriod = false;
    expect(getEaisybillCapabilities('owner').canClosePeriod).toBe(true);
  });
});

describe('capabilities — eaisyBooks accounting-firm roles', () => {
  it('D-4: only senior and iroda_admin may close a period / export official XML', () => {
    expect(canAccountyRoleClosePeriod('iroda_admin')).toBe(true);
    expect(canAccountyRoleClosePeriod('senior_könyvelő')).toBe(true);
    expect(canAccountyRoleClosePeriod('könyvelő')).toBe(false);
    expect(canAccountyRoleClosePeriod('asszisztens')).toBe(false);
    expect(canAccountyRoleClosePeriod('payroll_specialist')).toBe(false);
    expect(canAccountyRoleClosePeriod(null)).toBe(false);

    expect(canAccountyRoleExportOfficialXml('iroda_admin')).toBe(true);
    expect(canAccountyRoleExportOfficialXml('senior_könyvelő')).toBe(true);
    expect(canAccountyRoleExportOfficialXml('könyvelő')).toBe(false);
    expect(canAccountyRoleExportOfficialXml('asszisztens')).toBe(false);
    expect(canAccountyRoleExportOfficialXml('payroll_specialist')).toBe(false);
  });

  it('D-5: payroll_specialist (Bérszámfejtő) has no financial capability by default', () => {
    expect(getAccountyCapabilities('payroll_specialist')).toEqual(NO_CAPABILITIES);
  });

  it('only iroda_admin manages the team', () => {
    expect(getAccountyCapabilities('iroda_admin').canManageTeam).toBe(true);
    expect(getAccountyCapabilities('senior_könyvelő').canManageTeam).toBe(false);
  });

  it('all five roles exist with labels, mirroring the DB CHECK constraint', () => {
    expect(ACCOUNTY_ASSIGNMENT_ROLES).toEqual([
      'iroda_admin',
      'senior_könyvelő',
      'könyvelő',
      'asszisztens',
      'payroll_specialist',
    ]);
    for (const role of ACCOUNTY_ASSIGNMENT_ROLES) {
      expect(ACCOUNTY_ROLE_LABELS[role]).toBeTruthy();
    }
  });

  it('normalizeAccountyRole maps legacy names and rejects unknowns', () => {
    expect(normalizeAccountyRole('admin')).toBe('iroda_admin');
    expect(normalizeAccountyRole('senior')).toBe('iroda_admin');
    expect(normalizeAccountyRole('junior')).toBe('könyvelő');
    expect(normalizeAccountyRole('payroll_specialist')).toBe('payroll_specialist');
    expect(normalizeAccountyRole('whatever')).toBeNull();
    expect(normalizeAccountyRole('')).toBeNull();
    expect(normalizeAccountyRole(undefined)).toBeNull();
  });
});

describe('resolveCapabilities', () => {
  it('uses the eaisyBill matrix for a real company member', () => {
    expect(resolveCapabilities({ memberRole: 'assistant' }).canViewBankBalances).toBe(false);
    expect(resolveCapabilities({ memberRole: 'assistant' }).canWriteLedger).toBe(false);
  });

  it('uses the eaisyBooks matrix for an assignment-only accountant', () => {
    const c = resolveCapabilities({ memberRole: null, assignmentRole: 'senior_könyvelő' });
    expect(c.canClosePeriod).toBe(true);
    expect(c.canWriteLedger).toBe(true);
    const k = resolveCapabilities({ memberRole: null, assignmentRole: 'könyvelő' });
    expect(k.canClosePeriod).toBe(false);
    expect(k.canWriteLedger).toBe(true);
  });

  it('merges member + assignment permissively', () => {
    const c = resolveCapabilities({ memberRole: 'assistant', assignmentRole: 'senior_könyvelő' });
    expect(c.canClosePeriod).toBe(true);
    expect(c.canManageInvoices).toBe(true);
    expect(c.canWriteLedger).toBe(true);
  });

  it('O1 Fallback: self-managed company (no assigned bookkeeper) grants leadership ledger & closing rights', () => {
    const owner = resolveCapabilities({ memberRole: 'owner', hasAssignedBookkeeper: false });
    expect(owner.canWriteLedger).toBe(true);
    expect(owner.canClosePeriod).toBe(true);
    expect(owner.canExportOfficialTaxReturn).toBe(true);

    const member = resolveCapabilities({ memberRole: 'member', hasAssignedBookkeeper: false });
    expect(member.canWriteLedger).toBe(true);
    expect(member.canClosePeriod).toBe(true);
    expect(member.canExportOfficialTaxReturn).toBe(true);
  });

  it('O2/O1: managed company (hasAssignedBookkeeper = true) strips ledger & closing rights from company leadership', () => {
    const owner = resolveCapabilities({ memberRole: 'owner', hasAssignedBookkeeper: true });
    expect(owner.canWriteLedger).toBe(false);
    expect(owner.canClosePeriod).toBe(false);
    expect(owner.canExportOfficialTaxReturn).toBe(false);
    expect(owner.canManageInvoices).toBe(true);
    expect(owner.canManageTeam).toBe(true);

    const member = resolveCapabilities({ memberRole: 'member', hasAssignedBookkeeper: true });
    expect(member.canWriteLedger).toBe(false);
    expect(member.canClosePeriod).toBe(false);
    expect(member.canExportOfficialTaxReturn).toBe(false);

    // Support admin remains fully capable even when accountant is assigned
    const support = resolveCapabilities({ memberRole: 'support_admin', hasAssignedBookkeeper: true });
    expect(support.canWriteLedger).toBe(true);
    expect(support.canClosePeriod).toBe(true);
  });

  it('fails closed without any role', () => {
    expect(resolveCapabilities({})).toEqual(NO_CAPABILITIES);
  });
});
