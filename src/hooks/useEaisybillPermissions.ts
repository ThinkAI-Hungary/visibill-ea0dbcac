import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';

/**
 * Module names that can be permission-gated in eaisybill.
 */
export type EaisybillModule =
  | 'dashboard'
  | 'categories'
  | 'projects'
  | 'partners'
  | 'invoices'
  | 'receivables'
  | 'transactions'
  | 'petty_cash'
  | 'general_ledger'
  | 'profit_loss'
  | 'balance_sheet'
  | 'annual_report'
  | 'vat_return'
  | 'journals'
  | 'subledger'
  | 'accounting_rules'
  | 'salaries'
  | 'working_time'
  | 'fixed_assets'
  | 'integrations'
  | 'exchange_rates'
  | 'upload'
  | 'knowledge_base'
  | 'tickets'
  | 'settings'
  | 'shipments'
  | 'shipment_matching'
  | 'shipment_import'
  | 'notes';

interface ModulePermission {
  canRead: boolean;
  canWrite: boolean;
}

interface DbModulePermission {
  module_name: string;
  can_read: boolean;
  can_write: boolean;
}

/**
 * Modules that only admin/owner can access (static default).
 */
const ADMIN_ONLY_MODULES: EaisybillModule[] = [
  'salaries',
  'integrations',
  'shipments',
  'shipment_matching',
  'shipment_import',
];

/**
 * Accounting-technical modules (subledger / folyószámla and journals / napló).
 * Hidden by default for the `admin` (Cégvezető) role — see capability
 * `canManageAccountingTech` (D-3). Owner and finance_lead keep access; the owner
 * can re-enable them per user through the permission panel (DB override wins).
 */
const ACCOUNTING_TECH_MODULES: EaisybillModule[] = ['subledger', 'journals'];

/**
 * Modules visible to an assignment-derived Bérszámfejtő (payroll_specialist) in eaisyBill.
 * No invoices / transactions / ledger — payroll itself lives in eaisyBooks (D-5).
 */
const PAYROLL_SPECIALIST_MODULES: EaisybillModule[] = [
  'dashboard',
  'salaries',
  'knowledge_base',
  'tickets',
  'notes',
];

/**
 * Modules accessible to assistant and above (not viewer/employee).
 * Assistant can R/W invoices, transactions, receivables, projects, categories, partners, upload.
 */
const ASSISTANT_MODULES: EaisybillModule[] = [
  'dashboard',
  'categories',
  'projects',
  'partners',
  'invoices',
  'receivables',
  'transactions',
  'petty_cash',
  'upload',
  'knowledge_base',
  'tickets',
  'exchange_rates',
  'settings',
  'notes',
];

/**
 * Modules accessible to viewer (Megfigyelő): read-only financial data incl. managerial
 * controlling views (spec: "globális read-only"). Accounting-technical views, payroll and settings write stay closed.
 */
const VIEWER_MODULES: EaisybillModule[] = [
  'dashboard',
  'categories',
  'projects',
  'partners',
  'invoices',
  'receivables',
  'transactions',
  'petty_cash',
  'exchange_rates',
  'general_ledger',
  'profit_loss',
  'balance_sheet',
  'annual_report',
  'vat_return',
  'knowledge_base',
  'tickets',
  'settings',
  'notes',
];

/**
 * Modules always accessible to employee.
 */
const EMPLOYEE_MODULES: EaisybillModule[] = [
  'working_time',
];

const ALL_MODULES: EaisybillModule[] = [
  'dashboard', 'categories', 'projects', 'partners',
  'invoices', 'receivables', 'transactions', 'petty_cash',
  'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return', 'journals',
  'subledger', 'accounting_rules',
  'salaries', 'working_time', 'fixed_assets',
  'integrations', 'exchange_rates', 'upload', 'knowledge_base', 'tickets', 'settings',
  'shipments', 'shipment_matching', 'shipment_import', 'notes',
];

/**
 * Maps sidebar nav item URLs to module keys.
 */
export const URL_TO_MODULE: Record<string, EaisybillModule> = {
  '/': 'dashboard',
  '/categories': 'categories',
  '/projects': 'projects',
  '/partners': 'partners',
  '/invoices': 'invoices',
  '/kintlevo': 'receivables',
  '/transactions': 'transactions',
  '/transfers': 'transactions',
  '/petty-cash': 'petty_cash',
  '/opg': 'petty_cash',
  '/general-ledger': 'general_ledger',
  '/subledger': 'subledger',
  '/profit-and-loss': 'profit_loss',
  '/balance-sheet': 'balance_sheet',
  '/annual-report': 'annual_report',
  '/vat-return': 'vat_return',
  '/journals': 'journals',
  '/accounting-rules': 'accounting_rules',
  '/auto-accounting-rules': 'accounting_rules',
  '/prompts': 'accounting_rules',
  '/salaries': 'salaries',
  '/working-time': 'working_time',
  '/teny': 'fixed_assets',
  '/integrations': 'integrations',
  '/exchange-rates': 'exchange_rates',
  '/upload': 'upload',
  '/knowledge-base': 'knowledge_base',
  '/tickets': 'tickets',
  '/settings': 'settings',
  '/notes': 'notes',
  '/shipments': 'shipment_matching',
  '/shipments/import': 'shipment_import',
  '/shipments/escalated': 'shipment_matching',
  '/analytics': 'profit_loss',
  // Legacy URLs (redirect targets still need module resolution)
  '/shipment-matching': 'shipment_matching',
  '/shipment-matching/escalated': 'shipment_matching',
};

/**
 * All configurable modules with Hungarian labels (for the admin permission panel UI).
 */
export const CONFIGURABLE_MODULES: { key: EaisybillModule; label: string; group: string }[] = [
  { key: 'dashboard', label: 'Irányítópult', group: 'Áttekintés' },
  { key: 'categories', label: 'Kategóriák', group: 'Áttekintés' },
  { key: 'projects', label: 'Projektek', group: 'Áttekintés' },
  { key: 'partners', label: 'Partnertörzs', group: 'Áttekintés' },
  { key: 'invoices', label: 'Számlák', group: 'Pénzügyek' },
  { key: 'receivables', label: 'Kintlévőség', group: 'Pénzügyek' },
  { key: 'transactions', label: 'Tranzakciók', group: 'Pénzügyek' },
  { key: 'petty_cash', label: 'Házipénztár', group: 'Pénzügyek' },
  { key: 'general_ledger', label: 'Főkönyv', group: 'Könyvelés' },
  { key: 'profit_loss', label: 'Eredménykimutatás', group: 'Könyvelés' },
  { key: 'balance_sheet', label: 'Mérleg', group: 'Könyvelés' },
  { key: 'annual_report', label: 'Beszámoló', group: 'Könyvelés' },
  { key: 'vat_return', label: 'ÁFA Bevallás', group: 'Könyvelés' },
  { key: 'journals', label: 'Napló', group: 'Könyvelés' },
  { key: 'subledger', label: 'Folyószámla', group: 'Könyvelés' },
  { key: 'accounting_rules', label: 'Könyvelési szabályok', group: 'Könyvelés' },
  { key: 'salaries', label: 'Bérek/járulékok', group: 'HR & Eszközök' },
  { key: 'working_time', label: 'Munkaidő', group: 'HR & Eszközök' },
  { key: 'fixed_assets', label: 'TENY', group: 'HR & Eszközök' },
  { key: 'exchange_rates', label: 'Árfolyamok', group: 'Rendszer' },
  { key: 'upload', label: 'Feltöltés', group: 'Rendszer' },
  { key: 'knowledge_base', label: 'Tudástár', group: 'Rendszer' },
  { key: 'tickets', label: 'Hibajegyek', group: 'Rendszer' },
  { key: 'integrations', label: 'Integrációk', group: 'Rendszer' },
  { key: 'settings', label: 'Beállítások', group: 'Rendszer' },
  { key: 'notes', label: 'Jegyzetek', group: 'Rendszer' },
  { key: 'shipment_matching', label: 'Fuvarok', group: 'Szállítmányozás' },
  { key: 'shipment_import', label: 'Excel Import', group: 'Szállítmányozás' },
];

/**
 * Fetches the user's DB-level module permission overrides for the selected company.
 */
function useDbModulePermissions() {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;

  return useQuery({
    queryKey: ['eaisybill-module-permissions', user?.id, companyId],
    queryFn: async (): Promise<Map<string, DbModulePermission>> => {
      const { data, error } = await supabase
        .from('eaisybill_module_permissions')
        .select('module_name, can_read, can_write')
        .eq('company_id', companyId!)
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
    enabled: !!user?.id && !!companyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Returns permission info for eaisybill modules based on:
 * 1. The user's role (static defaults)
 * 2. DB-level overrides from `eaisybill_module_permissions` (if set by admin)
 *
 * Priority: DB override > static default
 * Admin users are NEVER restricted by DB overrides.
 *
 * Usage:
 *   const { canAccess, canWrite } = useEaisybillPermissions();
 *   if (canAccess('salaries')) { ... }
 */
export function useEaisybillPermissions() {
  const { role, isAdmin, isLoading: roleLoading } = useUserRole();
  const { data: dbOverrides, isLoading: dbLoading } = useDbModulePermissions();

  const isLoading = roleLoading || dbLoading;

  const permissions = useMemo(() => {
    /** Static default: can the user access this module based on role? */
    function staticCanAccess(module: EaisybillModule): boolean {
      // No company selected yet (isAdmin is true only in that case with a null role)
      if (!role) return isAdmin;
      return getStaticDefaults(role, module).canRead;
    }

    /** Static default: can the user write to this module? */
    function staticCanWrite(module: EaisybillModule): boolean {
      if (!role) return isAdmin;
      return getStaticDefaults(role, module).canWrite;
    }

    /** Check if the user can access a given module (DB override > static) */
    function canAccess(module: EaisybillModule): boolean {
      // Check DB override first
      const override = dbOverrides?.get(module);
      if (override !== undefined) {
        return override.can_read;
      }

      // Shipment modules are disabled by default for ALL users (including admins)
      if (module === 'shipments' || module === 'shipment_matching' || module === 'shipment_import') {
        return false;
      }

      return staticCanAccess(module);
    }

    /** Check if the user has write permissions for a module */
    function canWrite(module: EaisybillModule): boolean {
      // Check DB override first
      const override = dbOverrides?.get(module);
      if (override !== undefined) {
        return override.can_write;
      }

      // Shipment modules are disabled by default for ALL users (including admins)
      if (module === 'shipments' || module === 'shipment_matching' || module === 'shipment_import') {
        return false;
      }

      return staticCanWrite(module);
    }

    /** Get the full permission object for a module */
    function getPermission(module: EaisybillModule): ModulePermission {
      return {
        canRead: canAccess(module),
        canWrite: canWrite(module),
      };
    }

    const visibleModules = ALL_MODULES.filter(m => canAccess(m));

    return { canAccess, canWrite, getPermission, visibleModules, role, isAdmin };
  }, [role, isAdmin, dbOverrides]);

  return { ...permissions, isLoading };
}

/**
 * Returns the static (role-based) default read/write for a given module.
 * Used by the admin permission panel to show accurate defaults.
 */
export function getStaticDefaults(role: string, module: EaisybillModule): { canRead: boolean; canWrite: boolean } {
  // Shipment modules are disabled by default for all roles
  if (module === 'shipments' || module === 'shipment_matching' || module === 'shipment_import') {
    return { canRead: false, canWrite: false };
  }

  // Owner and support_admin: everything
  if (role === 'owner' || role === 'support_admin') return { canRead: true, canWrite: true };

  // Cégvezető (admin): everything except the accounting-technical views (D-3)
  if (role === 'admin') {
    const canAccess = !ACCOUNTING_TECH_MODULES.includes(module);
    return { canRead: canAccess, canWrite: canAccess };
  }

  // Bérszámfejtő (assignment-derived): minimal, payroll only
  if (role === 'payroll_specialist') {
    const canAccess = PAYROLL_SPECIALIST_MODULES.includes(module);
    return { canRead: canAccess, canWrite: canAccess && module !== 'dashboard' };
  }

  // `member` = Pénzügyi Vezető (finance_lead alias)
  // Settings write (member management, company data edit) stays owner/admin-only.
  if (role === 'member' || role === 'finance_lead') {
    const canAccess = !ADMIN_ONLY_MODULES.includes(module) || module === 'working_time';
    return { canRead: canAccess, canWrite: canAccess && module !== 'settings' };
  }
  if (role === 'assistant') {
    const canAccess = ASSISTANT_MODULES.includes(module);
    return { canRead: canAccess, canWrite: canAccess && module !== 'settings' };
  }
  if (role === 'viewer') {
    const canAccess = VIEWER_MODULES.includes(module);
    return { canRead: canAccess, canWrite: false };
  }
  if (role === 'employee') {
    const canAccess = EMPLOYEE_MODULES.includes(module);
    return { canRead: canAccess, canWrite: canAccess };
  }
  return { canRead: false, canWrite: false };
}
