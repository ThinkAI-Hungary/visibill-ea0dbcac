import { useMemo } from 'react';
import { useAccountyRole, AccountyRole } from '@/pages/Accounty/AccountyRoleContext';

/**
 * Module names that can be permission-gated in Accounty.
 * For now this is a static config; Phase 3 will add DB-driven `accounty_module_permissions`.
 */
export type AccountyModule =
  | 'portfolio'         // Portfólió
  | 'missing_invoices'  // Hiányzó számlák
  | 'tax_calendar'      // Adó naptár
  | 'reports'           // Riportok
  | 'approval_queue'    // Jóváhagyó rendszer
  | 'alerts'            // Riasztások
  | 'nav_deadlines'     // NAV határidők
  | 'payroll'           // Bérszámfejtés
  | 'onboarding'        // Onboarding (ügyfél felvétel)
  | 'tao'               // TAO / KIVA
  | 'settings'          // Beállítások
  | 'admin_audit'       // Audit napló
  | 'admin_gdpr'        // GDPR
  | 'admin_templates'   // Sablonok
  | 'admin_job_codes'   // Jogviszonykódok
  | 'admin_tax_params'  // Adómértékek
  | 'admin_legal'       // Jogszabály-frissítések
  | 'admin_office'      // Irodai beállítások
  | 'admin_permissions' // Jogosultságkezelő
  | 'admin_accountants' // Könyvelők kezelése
  | 'tickets'           // Hibajegyek
  | 'ai_assistant'      // AI Asszisztens
  | 'help'              // Segítség
  | 'profile';          // Profilbeállítások

interface ModulePermission {
  canRead: boolean;
  canWrite: boolean;
}

/**
 * Default permissions per role (static config).
 * In Phase 3 these will be overridden by DB-level `accounty_module_permissions`.
 */
const ADMIN_ONLY_MODULES: AccountyModule[] = [
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

const SENIOR_AND_ADMIN_MODULES: AccountyModule[] = [
  'reports',
  'approval_queue',
  'alerts',
  'nav_deadlines',
  'settings',
];

/**
 * Returns permission info for Accounty modules based on the user's role.
 * 
 * Usage:
 *   const { canAccess, canWrite, visibleModules } = useAccountyPermissions();
 *   if (canAccess('admin_audit')) { ... }
 */
export function useAccountyPermissions() {
  const { role, isLoading, isAdmin, isSenior } = useAccountyRole();

  const permissions = useMemo(() => {
    /** Check if the user can access a given module */
    function canAccess(module: AccountyModule): boolean {
      // Everyone can access basic modules
      if (['portfolio', 'missing_invoices', 'tax_calendar', 'payroll', 'tao', 'tickets', 'ai_assistant', 'help', 'profile'].includes(module)) {
        return true;
      }
      // Admin-only modules
      if (ADMIN_ONLY_MODULES.includes(module)) {
        return isAdmin;
      }
      // Senior + Admin modules
      if (SENIOR_AND_ADMIN_MODULES.includes(module)) {
        return isSenior;
      }
      // Default: allow
      return true;
    }

    /** Check if the user has write permissions for a module */
    function canWrite(module: AccountyModule): boolean {
      if (isAdmin) return true;
      if (isSenior) return !ADMIN_ONLY_MODULES.includes(module);
      // könyvelő and asszisztens can write to their own modules
      return canAccess(module) && !ADMIN_ONLY_MODULES.includes(module) && !SENIOR_AND_ADMIN_MODULES.includes(module);
    }

    /** Get the full permission object for a module */
    function getPermission(module: AccountyModule): ModulePermission {
      return {
        canRead: canAccess(module),
        canWrite: canWrite(module),
      };
    }

    /** List of modules the user can access (useful for sidebar filtering) */
    const ALL_MODULES: AccountyModule[] = [
      'portfolio', 'missing_invoices', 'tax_calendar', 'reports',
      'approval_queue', 'alerts', 'nav_deadlines', 'payroll',
      'onboarding', 'tao', 'settings', 'tickets', 'ai_assistant',
      'help', 'profile', 'admin_audit', 'admin_gdpr', 'admin_templates',
      'admin_job_codes', 'admin_tax_params', 'admin_legal', 'admin_office',
      'admin_permissions', 'admin_accountants',
    ];

    const visibleModules = ALL_MODULES.filter(m => canAccess(m));

    return { canAccess, canWrite, getPermission, visibleModules, role, isAdmin, isSenior };
  }, [role, isAdmin, isSenior]);

  return { ...permissions, isLoading };
}

/**
 * Maps sidebar paths to module names for permission checking.
 */
export const PATH_TO_MODULE: Record<string, AccountyModule> = {
  '/accounty': 'portfolio',
  '/accounty/missing-invoices': 'missing_invoices',
  '/accounty/tax-calendar': 'tax_calendar',
  '/accounty/reports': 'reports',
  '/accounty/approval-queue': 'approval_queue',
  '/accounty/alerts': 'alerts',
  '/accounty/nav-deadlines': 'nav_deadlines',
  '/accounty/payroll-portfolio': 'payroll',
  '/accounty/onboarding': 'onboarding',
  '/accounty/tao': 'tao',
  '/accounty/settings': 'settings',
  '/accounty/tickets': 'tickets',
  '/accounty/ai-assistant': 'ai_assistant',
  '/accounty/help': 'help',
  '/accounty/profile/settings': 'profile',
  '/accounty/admin/audit': 'admin_audit',
  '/accounty/admin/gdpr': 'admin_gdpr',
  '/accounty/admin/templates': 'admin_templates',
  '/accounty/admin/job-codes': 'admin_job_codes',
  '/accounty/admin/tax-parameters': 'admin_tax_params',
  '/accounty/admin/legal-updates': 'admin_legal',
  '/accounty/admin/office-settings': 'admin_office',
  '/accounty/admin/permissions': 'admin_permissions',
  '/accounty/admin/accountants': 'admin_accountants',
};
