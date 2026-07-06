import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useAccountyRole, AccountyRole } from '@/pages/Accounty/AccountyRoleContext';

/**
 * Module names that can be permission-gated in Accounty.
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
 * DB-driven module permission override.
 * If the iroda_admin has configured specific permissions for a user in
 * `accounty_module_permissions`, those override the static defaults.
 */
interface DbModulePermission {
  module_name: string;
  can_read: boolean;
  can_write: boolean;
}

/**
 * Default permissions per role (static config).
 * These are used when there is NO DB override for a specific module.
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

/**
 * Fetches the user's DB-level module permission overrides.
 * These are set by the iroda_admin in the permission management UI.
 * The RLS policy on `accounty_module_permissions` ensures users can only
 * read their own permissions (or admin can read all within their firm).
 */
function useDbModulePermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounty-module-permissions', user?.id],
    queryFn: async (): Promise<Map<string, DbModulePermission>> => {
      const { data, error } = await supabase
        .from('accounty_module_permissions')
        .select('module_name, can_read, can_write')
        .eq('user_id', user!.id);

      if (error || !data) return new Map();

      const map = new Map<string, DbModulePermission>();
      for (const row of data as any[]) {
        map.set(row.module_name, {
          module_name: row.module_name,
          can_read: row.can_read,
          can_write: row.can_write,
        });
      }
      return map;
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Returns permission info for Accounty modules based on:
 * 1. The user's role (static defaults)
 * 2. DB-level overrides from `accounty_module_permissions` (if set by admin)
 *
 * Priority: DB override > static default
 *
 * Usage:
 *   const { canAccess, canWrite, visibleModules } = useAccountyPermissions();
 *   if (canAccess('admin_audit')) { ... }
 */
export function useAccountyPermissions() {
  const { role, isLoading: roleLoading, isAdmin, isSenior } = useAccountyRole();
  const { data: dbOverrides, isLoading: dbLoading } = useDbModulePermissions();

  const isLoading = roleLoading || dbLoading;

  const permissions = useMemo(() => {
    /** Static default: can the user access this module based on role? */
    function staticCanAccess(module: AccountyModule): boolean {
      if (ALWAYS_ACCESSIBLE.includes(module)) return true;
      if (ADMIN_ONLY_MODULES.includes(module)) return isAdmin;
      if (SENIOR_AND_ADMIN_MODULES.includes(module)) return isSenior;
      return true;
    }

    /** Static default: can the user write to this module based on role? */
    function staticCanWrite(module: AccountyModule): boolean {
      if (isAdmin) return true;
      if (isSenior) return !ADMIN_ONLY_MODULES.includes(module);
      return staticCanAccess(module) && !ADMIN_ONLY_MODULES.includes(module) && !SENIOR_AND_ADMIN_MODULES.includes(module);
    }

    /** Check if the user can access a given module (DB override > static) */
    function canAccess(module: AccountyModule): boolean {
      // Admin always has access — DB overrides don't restrict admins
      if (isAdmin) return true;

      // Check DB override
      const override = dbOverrides?.get(module);
      if (override !== undefined) {
        return override.can_read;
      }

      // Fall back to static default
      return staticCanAccess(module);
    }

    /** Check if the user has write permissions for a module */
    function canWrite(module: AccountyModule): boolean {
      if (isAdmin) return true;

      // Check DB override
      const override = dbOverrides?.get(module);
      if (override !== undefined) {
        return override.can_write;
      }

      return staticCanWrite(module);
    }

    /** Get the full permission object for a module */
    function getPermission(module: AccountyModule): ModulePermission {
      return {
        canRead: canAccess(module),
        canWrite: canWrite(module),
      };
    }

    const visibleModules = ALL_MODULES.filter(m => canAccess(m));

    return { canAccess, canWrite, getPermission, visibleModules, role, isAdmin, isSenior };
  }, [role, isAdmin, isSenior, dbOverrides]);

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
