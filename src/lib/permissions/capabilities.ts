/**
 * Central, pure capability matrix for eaisyBill (company roles) and
 * eaisyBooks (accounting-firm roles).
 *
 * This file is intentionally free of React / Supabase imports so that it can be
 * unit-tested directly and shared between hooks, guards and the permission
 * management screens.
 *
 * Spec: implementation-plans/eaisybill_szerepkorok_fejlesztes.md
 * ADR : docs/architecture/decisions/A-247-role-capability-matrix.md
 *
 * Hybrid alias (D-1): the database keeps `company_members.role = 'member'`;
 * the UI treats it as `finance_lead` (Pénzügyi Vezető). No DB role rename.
 */

// ─── eaisyBill (company-level) roles ────────────────────────────────────────

/** Raw role values as stored in `company_members.role` (plus assignment-derived `payroll_specialist`). */
export type EaisybillRole =
  | 'owner'
  | 'admin'
  | 'member'
  | 'assistant'
  | 'viewer'
  | 'employee'
  | 'support_admin'
  | 'payroll_specialist';

/** UI persona: `member` is presented as `finance_lead` (hybrid alias, D-1). */
export type EaisybillPersona = Exclude<EaisybillRole, 'member'> | 'finance_lead';

/** Maps the stored DB role to the UI persona (member → finance_lead). */
export function toEaisybillPersona(role: EaisybillRole | string | null | undefined): EaisybillPersona | null {
  if (!role) return null;
  if (role === 'member') return 'finance_lead';
  switch (role) {
    case 'owner':
    case 'admin':
    case 'assistant':
    case 'viewer':
    case 'employee':
    case 'support_admin':
    case 'payroll_specialist':
    case 'finance_lead':
      return role;
    default:
      return null;
  }
}

/** Hungarian UI labels keyed by the STORED role value (member → Pénzügyi Vezető). */
export const EAISYBILL_ROLE_LABELS: Record<string, string> = {
  owner: 'Cégtulajdonos',
  admin: 'Cégvezető / Ügyvezető',
  member: 'Pénzügyi Vezető',
  finance_lead: 'Pénzügyi Vezető',
  assistant: 'Pénzügyi Asszisztens',
  viewer: 'Megfigyelő',
  employee: 'Munkavállaló',
  support_admin: 'Támogatás',
  payroll_specialist: 'Bérszámfejtő',
};

/** Short role descriptions for invite / team settings UI. */
export const EAISYBILL_ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Teljes hozzáférés, előfizetés és tulajdonjog kezelése.',
  admin: 'Operatív vezetés, csapatkezelés; a könyvelés-technikai nézetek nélkül.',
  member: 'Pénzügyi áttekintés (kontrolling), számlák és bankmozgások – csak olvasható könyvelési riportok.',
  assistant: 'Számlák és tranzakciók rögzítése; könyvelési riportok és banki egyenlegek nélkül.',
  viewer: 'Csak olvasható megfigyelői hozzáférés.',
  employee: 'Kizárólag munkaidő-nyilvántartás.',
};

// ─── eaisyBooks (accounting-firm) roles ─────────────────────────────────────

export type AccountyRole =
  | 'iroda_admin'
  | 'senior_könyvelő'
  | 'könyvelő'
  | 'asszisztens'
  | 'payroll_specialist';

export const ACCOUNTY_ROLE_LABELS: Record<AccountyRole, string> = {
  iroda_admin: 'Iroda Admin',
  'senior_könyvelő': 'Senior Könyvelő',
  'könyvelő': 'Könyvelő',
  asszisztens: 'Asszisztens',
  payroll_specialist: 'Bérszámfejtő',
};

/** All roles that can be stored in `accounty_assignments.role` (mirrors the DB CHECK). */
export const ACCOUNTY_ASSIGNMENT_ROLES: AccountyRole[] = [
  'iroda_admin',
  'senior_könyvelő',
  'könyvelő',
  'asszisztens',
  'payroll_specialist',
];

/** Legacy / alias role names → canonical eaisyBooks role. */
const LEGACY_ACCOUNTY_ROLE_MAP: Record<string, AccountyRole> = {
  admin: 'iroda_admin',
  senior: 'iroda_admin',
  junior: 'könyvelő',
  könyvelo: 'könyvelő',
  senior_konyvelo: 'senior_könyvelő',
  konyvelo: 'könyvelő',
};

/** Normalizes any stored/legacy accounty role string to the canonical role (or null). */
export function normalizeAccountyRole(role: string | null | undefined): AccountyRole | null {
  if (!role) return null;
  if ((ACCOUNTY_ASSIGNMENT_ROLES as string[]).includes(role)) return role as AccountyRole;
  return LEGACY_ACCOUNTY_ROLE_MAP[role] ?? null;
}

// ─── Capabilities ───────────────────────────────────────────────────────────

export interface CompanyCapabilities {
  /** P&L, balance sheet, general ledger, VAT replica, annual report, TENY (read-only controlling views). */
  canViewControlling: boolean;
  /** Dashboard bank balances / liquidity / cash-flow widgets and the bank tab of the cockpit. */
  canViewBankBalances: boolean;
  /** Create / edit invoices, upload documents. */
  canManageInvoices: boolean;
  /** Accounting-technical views: subledger (folyószámla) and journals (napló). */
  canManageAccountingTech: boolean;
  /** Finalize (close) a VAT return / period. */
  canClosePeriod: boolean;
  /** Invite / remove team members and change their roles. */
  canManageTeam: boolean;
  /** Generate / download the official ÁNYK XML of a tax return. */
  canExportOfficialTaxReturn: boolean;
  /** Create / modify journal entries, manual vouchers, daily auto-posting, settle open items. */
  canWriteLedger: boolean;
}

export type CapabilityKey = keyof CompanyCapabilities;

export const NO_CAPABILITIES: CompanyCapabilities = {
  canViewControlling: false,
  canViewBankBalances: false,
  canManageInvoices: false,
  canManageAccountingTech: false,
  canClosePeriod: false,
  canManageTeam: false,
  canExportOfficialTaxReturn: false,
  canWriteLedger: false,
};

const ALL_CAPABILITIES: CompanyCapabilities = {
  canViewControlling: true,
  canViewBankBalances: true,
  canManageInvoices: true,
  canManageAccountingTech: true,
  canClosePeriod: true,
  canManageTeam: true,
  canExportOfficialTaxReturn: true,
  canWriteLedger: true,
};

/** eaisyBill capability matrix, keyed by persona (member is `finance_lead`). */
const EAISYBILL_CAPABILITIES: Record<EaisybillPersona, CompanyCapabilities> = {
  owner: ALL_CAPABILITIES,
  support_admin: ALL_CAPABILITIES,
  // Cégvezető: operational control + team management, but NO accounting-technical views (D-3).
  admin: { ...ALL_CAPABILITIES, canManageAccountingTech: false },
  // Pénzügyi Vezető / Belső Főkönyvelő: controlling read-only, no team management.
  finance_lead: { ...ALL_CAPABILITIES, canManageTeam: false },
  // Pénzügyi Asszisztens: data entry only — no books, no bank balances (D-3).
  assistant: { ...NO_CAPABILITIES, canManageInvoices: true },
  // Megfigyelő: global read-only.
  viewer: { ...NO_CAPABILITIES, canViewControlling: true, canViewBankBalances: true },
  employee: NO_CAPABILITIES,
  // Bérszámfejtő seen from the eaisyBill side: nothing financial (payroll lives in eaisyBooks).
  payroll_specialist: NO_CAPABILITIES,
};

/** eaisyBooks capability matrix. Close + official XML export: senior and iroda_admin only (D-4). */
const ACCOUNTY_CAPABILITIES: Record<AccountyRole, CompanyCapabilities> = {
  iroda_admin: ALL_CAPABILITIES,
  'senior_könyvelő': { ...ALL_CAPABILITIES, canManageTeam: false },
  'könyvelő': {
    ...ALL_CAPABILITIES,
    canManageTeam: false,
    canClosePeriod: false,
    canExportOfficialTaxReturn: false,
  },
  asszisztens: {
    ...ALL_CAPABILITIES,
    canManageTeam: false,
    canManageAccountingTech: false,
    canClosePeriod: false,
    canExportOfficialTaxReturn: false,
  },
  // Bérszámfejtő: payroll + 08 filing only; no bank, no ledger, no invoices (D-5).
  payroll_specialist: NO_CAPABILITIES,
};

export function getEaisybillCapabilities(role: EaisybillRole | string | null | undefined): CompanyCapabilities {
  const persona = toEaisybillPersona(role);
  return persona ? { ...EAISYBILL_CAPABILITIES[persona] } : { ...NO_CAPABILITIES };
}

export function getAccountyCapabilities(role: string | null | undefined): CompanyCapabilities {
  const normalized = normalizeAccountyRole(role);
  return normalized ? { ...ACCOUNTY_CAPABILITIES[normalized] } : { ...NO_CAPABILITIES };
}

/** True when the eaisyBooks role may finalize a VAT return / period (D-4). */
export function canAccountyRoleClosePeriod(role: string | null | undefined): boolean {
  return getAccountyCapabilities(role).canClosePeriod;
}

/** True when the eaisyBooks role may export the official ÁNYK XML (D-4). */
export function canAccountyRoleExportOfficialXml(role: string | null | undefined): boolean {
  return getAccountyCapabilities(role).canExportOfficialTaxReturn;
}

/**
 * Resolves the effective capabilities for the current user in a company.
 *
 * - If the user has a real `company_members` row, the eaisyBill matrix applies.
 * - If the user only reaches the company through an `accounty_assignments` row
 *   (external accountant), the eaisyBooks matrix applies.
 * - If the user has both, the more permissive flag wins per capability.
 * - If hasAssignedBookkeeper is true, company leadership (owner/admin/member)
 *   delegates ledger write & period closing to the assigned accountant.
 */
export function resolveCapabilities(input: {
  memberRole?: EaisybillRole | string | null;
  assignmentRole?: string | null;
  hasAssignedBookkeeper?: boolean;
}): CompanyCapabilities {
  let member = input.memberRole ? getEaisybillCapabilities(input.memberRole) : null;
  const assignment = input.assignmentRole ? getAccountyCapabilities(input.assignmentRole) : null;

  // Segregation of duties / O1 fallback:
  // When an accountant is assigned to the company, company leadership delegates
  // ledger writing and closing to the professional accountants.
  // Support admin is exempt.
  if (input.hasAssignedBookkeeper && member && input.memberRole !== 'support_admin') {
    member = {
      ...member,
      canWriteLedger: false,
      canClosePeriod: false,
      canExportOfficialTaxReturn: false,
    };
  }

  if (member && assignment) {
    return (Object.keys(NO_CAPABILITIES) as CapabilityKey[]).reduce<CompanyCapabilities>(
      (acc, key) => ({ ...acc, [key]: member![key] || assignment[key] }),
      { ...NO_CAPABILITIES },
    );
  }
  return member ?? assignment ?? { ...NO_CAPABILITIES };
}
