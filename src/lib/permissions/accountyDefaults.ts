/**
 * Static (role-based) default permissions for eaisyBooks modules.
 *
 * Pure, dependency-free module shared by `useAccountyPermissions` (runtime)
 * and `PermissionMatrixPage` (admin UI) so the two can never drift apart.
 * DB overrides in `accounty_module_permissions` ALWAYS win over these defaults
 * (except for iroda_admin, who is never restricted) — D-5 "hybrid" model.
 */
import type { AccountyRole } from './capabilities';

/** Only iroda_admin by default. */
export const ACCOUNTY_ADMIN_ONLY_MODULES: readonly string[] = [
  'admin_audit',
  'admin_gdpr',
  'admin_templates',
  'admin_job_codes',
  'admin_tax_params',
  'admin_legal',
  'admin_office',
  'admin_permissions',
  'admin_accountants',
  'onboarding',
];

/** iroda_admin + senior_könyvelő by default. */
export const ACCOUNTY_SENIOR_AND_ADMIN_MODULES: readonly string[] = [
  'reports',
  'approval_queue',
  'alerts',
  'nav_deadlines',
  'settings',
];

/** Visible to every accounting role by default (except where a role-specific rule below narrows it). */
export const ACCOUNTY_ALWAYS_ACCESSIBLE_MODULES: readonly string[] = [
  'portfolio',
  'missing_invoices',
  'tax_calendar',
  'payroll',
  'client_bookkeeping',
  'tao',
  'tickets',
  'ai_assistant',
  'help',
  'profile',
];

/** TAO / KIVA is not available to asszisztens and payroll_specialist by default (spec: Asszisztens). */
export const ACCOUNTY_TAO_MODULES: readonly string[] = ['tao'];

/**
 * Bérszámfejtő (payroll_specialist, D-5): payroll + the 08 filing only.
 * Default: no access to client bank accounts, ledger, invoices or TAO.
 * Value = can write.
 */
export const ACCOUNTY_PAYROLL_SPECIALIST_MODULES: Readonly<Record<string, boolean>> = {
  payroll: true,
  portfolio: false,
  tax_calendar: false,
  tickets: true,
  ai_assistant: true,
  help: false,
  profile: true,
};

export interface ModuleDefault {
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Role-based default for a module (no DB override considered).
 * Unknown modules default to readable for the four classic roles (backwards compatible)
 * and to hidden for payroll_specialist (least privilege).
 */
export function getAccountyRoleDefault(role: AccountyRole | null | undefined, module: string): ModuleDefault {
  if (role === 'iroda_admin') return { canRead: true, canWrite: true };

  if (role === 'payroll_specialist') {
    const canWrite = ACCOUNTY_PAYROLL_SPECIALIST_MODULES[module];
    if (canWrite === undefined) return { canRead: false, canWrite: false };
    return { canRead: true, canWrite };
  }

  const isSenior = role === 'senior_könyvelő';

  let canRead: boolean;
  if (ACCOUNTY_ADMIN_ONLY_MODULES.includes(module)) {
    canRead = false;
  } else if (ACCOUNTY_SENIOR_AND_ADMIN_MODULES.includes(module)) {
    canRead = isSenior;
  } else if (role === 'asszisztens' && ACCOUNTY_TAO_MODULES.includes(module)) {
    canRead = false;
  } else {
    canRead = true; // ALWAYS_ACCESSIBLE + unknown modules
  }

  if (isSenior) {
    return { canRead, canWrite: !ACCOUNTY_ADMIN_ONLY_MODULES.includes(module) };
  }
  return {
    canRead,
    canWrite:
      canRead &&
      !ACCOUNTY_ADMIN_ONLY_MODULES.includes(module) &&
      !ACCOUNTY_SENIOR_AND_ADMIN_MODULES.includes(module),
  };
}
