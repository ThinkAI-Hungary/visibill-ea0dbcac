import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export const EAISYBILL_MODULES = [
  'dashboard', 'categories', 'projects', 'partners',
  'invoices', 'receivables', 'transactions', 'petty_cash',
  'general_ledger', 'profit_loss', 'balance_sheet', 'annual_report', 'vat_return',
  'salaries', 'working_time', 'fixed_assets',
  'integrations', 'exchange_rates', 'upload', 'tickets', 'settings',
  'shipments', 'shipment_import', 'shipment_matching',
];

export const ACCOUNTY_MODULES = [
  'portfolio', 'missing_invoices', 'tax_calendar',
  'reports', 'approval_queue', 'alerts', 'nav_deadlines',
  'payroll', 'onboarding', 'tao', 'settings',
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'tickets', 'ai_assistant', 'help', 'profile',
];

export const EAISYBILL_ADMIN_ONLY = new Set(['salaries', 'integrations']);
export const EAISYBILL_ASSISTANT = new Set([
  'dashboard', 'categories', 'projects', 'partners', 'invoices', 'receivables',
  'transactions', 'petty_cash', 'upload', 'tickets', 'exchange_rates', 'settings'
]);
export const EAISYBILL_VIEWER = new Set([
  'dashboard', 'categories', 'projects', 'partners', 'invoices', 'receivables',
  'transactions', 'petty_cash', 'exchange_rates', 'tickets', 'settings'
]);
export const EAISYBILL_EMPLOYEE = new Set(['working_time']);

export function getEaisybillDefault(role: string | null | undefined, module: string): { canRead: boolean; canWrite: boolean } {
  if (module === 'shipments' || module === 'shipment_import' || module === 'shipment_matching') {
    return { canRead: false, canWrite: false };
  }

  const r = (role || "").toLowerCase();
  const isAdmin = r === 'admin' || r === 'owner' || r === 'ceo';
  if (isAdmin) return { canRead: true, canWrite: true };

  if (r === 'member') {
    const canAccess = !EAISYBILL_ADMIN_ONLY.has(module) || module === 'working_time';
    const canWrite = canAccess && module !== 'settings';
    return { canRead: canAccess, canWrite };
  }
  if (r === 'assistant') {
    const canAccess = EAISYBILL_ASSISTANT.has(module);
    const canWrite = canAccess && module !== 'settings';
    return { canRead: canAccess, canWrite };
  }
  if (r === 'viewer') {
    const canAccess = EAISYBILL_VIEWER.has(module);
    return { canRead: canAccess, canWrite: false };
  }
  if (r === 'employee') {
    const canAccess = EAISYBILL_EMPLOYEE.has(module);
    return { canRead: canAccess, canWrite: canAccess };
  }
  return { canRead: false, canWrite: false };
}

export const ACCOUNTY_ADMIN_ONLY = new Set([
  'admin_audit', 'admin_gdpr', 'admin_templates', 'admin_job_codes',
  'admin_tax_params', 'admin_legal', 'admin_office', 'admin_permissions',
  'admin_accountants', 'onboarding',
]);
export const ACCOUNTY_SENIOR_AND_ADMIN = new Set([
  'reports', 'approval_queue', 'alerts', 'nav_deadlines', 'settings',
]);
export const ACCOUNTY_ALWAYS = new Set([
  'portfolio', 'missing_invoices', 'tax_calendar', 'payroll',
  'tao', 'tickets', 'ai_assistant', 'help', 'profile',
]);

export function getAccountyDefault(role: string | null | undefined, module: string): { canRead: boolean; canWrite: boolean } {
  const r = (role || "").toLowerCase();
  const isAdmin = r === 'iroda_admin' || r === 'admin';
  const isSenior = isAdmin || r === 'senior_könyvelő' || r === 'senior_konyvelo' || r === 'senior';

  if (isAdmin) return { canRead: true, canWrite: true };

  let canRead = false;
  if (ACCOUNTY_ALWAYS.has(module)) {
    canRead = true;
  } else if (ACCOUNTY_SENIOR_AND_ADMIN.has(module)) {
    canRead = isSenior;
  } else if (!ACCOUNTY_ADMIN_ONLY.has(module)) {
    canRead = true;
  }

  let canWrite = false;
  if (isAdmin) {
    canWrite = true;
  } else if (isSenior) {
    canWrite = !ACCOUNTY_ADMIN_ONLY.has(module);
  } else {
    canWrite = canRead && !ACCOUNTY_ADMIN_ONLY.has(module) && !ACCOUNTY_SENIOR_AND_ADMIN.has(module);
  }

  return { canRead, canWrite };
}

export async function buildUserPermissions(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const userEmail = userData?.user?.email || "—";

  const { data: profileData } = await admin
    .from("profiles")
    .select("name, role, is_support_admin, eaisybooks_access")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: eaisybillMemberships } = await admin
    .from("company_members")
    .select("company_id, role")
    .eq("user_id", userId);

  const { data: accountyAssignments } = await admin
    .from("accounty_assignments")
    .select("company_id, accounting_firm_id, role")
    .eq("accountant_user_id", userId);

  const allCompanyIds = new Set<string>();
  for (const m of eaisybillMemberships || []) allCompanyIds.add(m.company_id);
  for (const a of accountyAssignments || []) {
    allCompanyIds.add(a.company_id);
    if (a.accounting_firm_id) allCompanyIds.add(a.accounting_firm_id);
  }

  const { data: companies } = await admin
    .from("companies")
    .select("id, name")
    .in("id", [...allCompanyIds]);

  const companyNameMap = new Map((companies || []).map((c: any) => [c.id, c.name]));

  const { data: eaisybillPerms } = await admin
    .from("eaisybill_module_permissions")
    .select("company_id, module_name, can_read, can_write")
    .eq("user_id", userId);

  const ebPermMap = new Map<string, Map<string, { can_read: boolean; can_write: boolean }>>();
  for (const p of (eaisybillPerms || []) as any[]) {
    if (!ebPermMap.has(p.company_id)) ebPermMap.set(p.company_id, new Map());
    ebPermMap.get(p.company_id)!.set(p.module_name, { can_read: p.can_read, can_write: p.can_write });
  }

  const { data: accountyPerms } = await admin
    .from("accounty_module_permissions")
    .select("accounting_firm_id, module_name, can_read, can_write")
    .eq("user_id", userId);

  const acPermMap = new Map<string, Map<string, { can_read: boolean; can_write: boolean }>>();
  for (const p of (accountyPerms || []) as any[]) {
    if (!acPermMap.has(p.accounting_firm_id)) acPermMap.set(p.accounting_firm_id, new Map());
    acPermMap.get(p.accounting_firm_id)!.set(p.module_name, { can_read: p.can_read, can_write: p.can_write });
  }

  const eaisybill = (eaisybillMemberships || []).map((m: any) => ({
    companyId: m.company_id,
    companyName: companyNameMap.get(m.company_id) || "—",
    role: m.role,
    modules: EAISYBILL_MODULES.map(mod => {
      const override = ebPermMap.get(m.company_id)?.get(mod);
      const defaults = getEaisybillDefault(m.role, mod);
      return {
        module: mod,
        canRead: override?.can_read ?? defaults.canRead,
        canWrite: override?.can_write ?? defaults.canWrite,
        isOverride: !!override,
      };
    }),
  }));

  const accounty = (accountyAssignments || []).map((a: any) => ({
    firmId: a.accounting_firm_id,
    firmName: companyNameMap.get(a.accounting_firm_id) || "—",
    companyId: a.company_id,
    companyName: companyNameMap.get(a.company_id) || "—",
    role: a.role,
    modules: ACCOUNTY_MODULES.map(mod => {
      const override = acPermMap.get(a.accounting_firm_id)?.get(mod);
      const defaults = getAccountyDefault(a.role, mod);
      return {
        module: mod,
        canRead: override?.can_read ?? defaults.canRead,
        canWrite: override?.can_write ?? defaults.canWrite,
        isOverride: !!override,
      };
    }),
  }));

  return {
    userId,
    email: userEmail,
    name: profileData?.name || "—",
    profileRole: profileData?.role || "user",
    isSupportAdmin: profileData?.is_support_admin || false,
    eaisybooksAccess: profileData?.eaisybooks_access || (accountyAssignments && accountyAssignments.length > 0) || false,
    eaisybill,
    accounty,
  };
}

export async function updatePermissions(
  admin: ReturnType<typeof createClient>,
  body: {
    userId?: string;
    platform?: "eaisybill" | "accounty";
    companyId?: string;
    firmId?: string;
    permissions?: Array<{ module: string; canRead: boolean; canWrite: boolean }>;
    isSupportAdmin?: boolean;
    eaisybooksAccess?: boolean;
  },
) {
  if (!body.userId) {
    return { error: "Missing required field: userId" };
  }

  const errors: string[] = [];
  let updated = 0;

  if (body.isSupportAdmin !== undefined) {
    const { error } = await admin
      .from("profiles")
      .update({ is_support_admin: body.isSupportAdmin })
      .eq("user_id", body.userId);

    if (error) {
      errors.push(`is_support_admin: ${error.message}`);
    } else {
      updated++;
    }
  }

  if (body.eaisybooksAccess !== undefined) {
    const { error } = await admin
      .from("profiles")
      .update({ eaisybooks_access: body.eaisybooksAccess })
      .eq("user_id", body.userId);

    if (error) {
      errors.push(`eaisybooks_access: ${error.message}`);
    } else {
      updated++;
    }

    if (body.eaisybooksAccess === true) {
      const { data: memberships } = await admin
        .from("company_members")
        .select("company_id")
        .eq("user_id", body.userId);

      const companyIds = (memberships || []).map((m: any) => m.company_id as string);

      for (const companyId of companyIds) {
        const { data: existingMain } = await admin
          .from("accounty_assignments")
          .select("id")
          .eq("company_id", companyId)
          .eq("is_main_accountant", true)
          .neq("accountant_user_id", body.userId)
          .limit(1);
        const hasOtherMain = (existingMain || []).length > 0;

        const { error: assignErr } = await admin
          .from("accounty_assignments")
          .upsert(
            {
              accountant_user_id: body.userId,
              company_id: companyId,
              accounting_firm_id: companyId,
              role: "iroda_admin",
              is_primary: true,
              is_main_accountant: !hasOtherMain,
              source: "manual",
            },
            { onConflict: "accountant_user_id,company_id" },
          );
        if (assignErr) {
          errors.push(`accounty_assignment(${companyId}): ${assignErr.message}`);
        } else {
          updated++;
        }

        const { error: taxErr } = await admin
          .from("accounty_tax_profiles")
          .upsert(
            {
              company_id: companyId,
              vat_frequency: "monthly",
              contribution_frequency: "monthly",
              is_kata: false,
              is_kiva: false,
              has_payroll: false,
              payroll_settings: {},
            },
            { onConflict: "company_id", ignoreDuplicates: true },
          );
        if (taxErr) {
          errors.push(`accounty_tax_profile(${companyId}): ${taxErr.message}`);
        } else {
          updated++;
        }
      }
    } else {
      const { error: delErr } = await admin
        .from("accounty_assignments")
        .delete()
        .eq("accountant_user_id", body.userId);
      if (delErr) {
        errors.push(`delete_assignments: ${delErr.message}`);
      } else {
        updated++;
      }
    }
  }

  if (body.platform && body.permissions) {
    if (body.platform === "eaisybill") {
      if (!body.companyId) return { error: "companyId required for eaisybill" };

      for (const perm of body.permissions) {
        const { error } = await admin
          .from("eaisybill_module_permissions")
          .upsert(
            {
              company_id: body.companyId,
              user_id: body.userId,
              module_name: perm.module,
              can_read: perm.canRead,
              can_write: perm.canWrite,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "company_id,user_id,module_name" },
          );

        if (error) {
          errors.push(`${perm.module}: ${error.message}`);
        } else {
          updated++;
        }
      }
    } else if (body.platform === "accounty") {
      if (!body.firmId) return { error: "firmId required for accounty" };

      for (const perm of body.permissions) {
        const { error } = await admin
          .from("accounty_module_permissions")
          .upsert(
            {
              accounting_firm_id: body.firmId,
              user_id: body.userId,
              module_name: perm.module,
              can_read: perm.canRead,
              can_write: perm.canWrite,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "accounting_firm_id,user_id,module_name" },
          );

        if (error) {
          errors.push(`${perm.module}: ${error.message}`);
        } else {
          updated++;
        }
      }
    }
  }

  return {
    updated,
    error: errors.length > 0 ? errors.join("; ") : null,
  };
}

export async function deleteUser(
  admin: ReturnType<typeof createClient>,
  body: { userId?: string },
) {
  if (!body.userId) {
    return { error: "Missing required field: userId" };
  }

  const { data: ownedCompanies, error: ownedErr } = await admin
    .from("companies")
    .select("id, name")
    .eq("owner_id", body.userId);

  if (ownedErr) {
    return { error: `Failed to check company ownership: ${ownedErr.message}` };
  }

  if (ownedCompanies && ownedCompanies.length > 0) {
    const companyNames = ownedCompanies.map((c: any) => c.name).join(", ");
    return {
      error: `A felhasználó a következő cégek tulajdonosa: ${companyNames}. A törlés előtt kérjük, ruházza át a cég tulajdonjogát egy másik tagra a Cégbeállításokban.`,
    };
  }

  const { error: memErr } = await admin
    .from("company_members")
    .delete()
    .eq("user_id", body.userId);

  if (memErr) {
    return { error: `Failed to remove company memberships: ${memErr.message}` };
  }

  const { error: assignErr } = await admin
    .from("accounty_assignments")
    .delete()
    .eq("accountant_user_id", body.userId);

  if (assignErr) {
    return { error: `Failed to remove accounty assignments: ${assignErr.message}` };
  }

  const { error: ebPermErr } = await admin
    .from("eaisybill_module_permissions")
    .delete()
    .eq("user_id", body.userId);

  if (ebPermErr) {
    return { error: `Failed to remove eaisybill permissions: ${ebPermErr.message}` };
  }

  const { error: acPermErr } = await admin
    .from("accounty_module_permissions")
    .delete()
    .eq("user_id", body.userId);

  if (acPermErr) {
    return { error: `Failed to remove accounty permissions: ${acPermErr.message}` };
  }

  const anonymizedName = "Törölt Felhasználó";
  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      name: anonymizedName,
      avatar_url: null,
      position: null,
      company: null,
      is_support_admin: false,
      eaisybill_access: false,
      eaisybooks_access: false,
      role: "user",
    })
    .eq("user_id", body.userId);

  if (profileErr) {
    return { error: `Failed to anonymize profile: ${profileErr.message}` };
  }

  const anonymizedEmail = `deleted_${body.userId.substring(0, 8)}@visibill.hu`;
  const randomPass = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  const { error: authErr } = await admin.auth.admin.updateUserById(
    body.userId,
    {
      email: anonymizedEmail,
      email_confirm: false,
      password: randomPass,
      user_metadata: {},
      app_metadata: {},
      banDuration: "876000h",
    }
  );

  if (authErr) {
    console.error("Auth anonymization failed:", authErr.message);
    return {
      success: true,
      warning: `A profil sikeresen anonimizálva lett, de az autentikációs fiók letiltása meghiúsult: ${authErr.message}`,
    };
  }

  return { success: true };
}
