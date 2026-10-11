/**
 * Migration contract test (A-247 addendum, discrepancies 1 + 3):
 *   - 20261011050500_fix_firm_member_sync_roles.sql
 *   - 20261011052000_external_accountant_ledger_access.sql
 *   - MANUAL_RUN_cleanup_firm_member_sync_assignments.sql
 *
 * The behaviour is covered by the pgTAP suites
 *   supabase/tests/database/firm_member_sync_roles.test.sql
 *   supabase/tests/database/external_accountant_ledger_access.test.sql
 * This file only protects the migration text against silent drift (widened roles, lost REVOKE,
 * payroll_specialist leaking into the ledger, destructive cleanup moving into the auto pipeline).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const dir = resolve(process.cwd(), "supabase/migrations");
const read = (name: string) => readFileSync(resolve(dir, name), "utf8");

const syncSql = read("20261011050500_fix_firm_member_sync_roles.sql");
const ledgerSql = read("20261011052000_external_accountant_ledger_access.sql");
const cleanupSql = read("MANUAL_RUN_cleanup_firm_member_sync_assignments.sql");

describe("firm member -> eaisyBooks sync fix (A-247, discrepancy 1)", () => {
  it("maps only owner/admin to iroda_admin and gives viewer/employee NO bookkeeping role", () => {
    const mapping = /CASE p_member_role([\s\S]*?)END;/.exec(syncSql)?.[1] ?? "";
    expect(mapping).toMatch(/WHEN 'owner'\s+THEN 'iroda_admin'/);
    expect(mapping).toMatch(/WHEN 'admin'\s+THEN 'iroda_admin'/);
    expect(mapping).toMatch(/WHEN 'member'\s+THEN 'könyvelő'/);
    expect(mapping).toMatch(/WHEN 'assistant'\s+THEN 'asszisztens'/);
    expect(mapping).not.toContain("'viewer'");
    expect(mapping).not.toContain("'employee'");
    expect(mapping).toMatch(/ELSE NULL/);
  });

  it("re-states SECURITY DEFINER + search_path on every replaced function (A-020)", () => {
    expect(syncSql.match(/SECURITY DEFINER\s+SET search_path TO 'public'/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("fires on INSERT and role UPDATE, and the internal resolver is not callable by clients", () => {
    expect(syncSql).toContain("AFTER INSERT OR UPDATE OF role ON public.company_members");
    expect(syncSql).toContain(
      "REVOKE ALL ON FUNCTION public.resolve_accounting_firm_id_for_company(uuid) FROM PUBLIC, anon, authenticated;",
    );
    expect(syncSql).toContain("REVOKE ALL ON FUNCTION public.firm_member_accounting_role(text) FROM PUBLIC, anon;");
  });

  it("never touches manual assignments and removes the synced row for every removed firm member", () => {
    expect(syncSql).toMatch(/WHERE public\.accounty_assignments\.source = 'sync'/);
    expect(syncSql).toMatch(/AND source = 'sync'/);
    expect(syncSql).toContain("public.resolve_accounting_firm_id_for_company(OLD.company_id) IS NOT NULL");
  });

  it("contains NO data-changing statement on accounty_assignments outside the trigger bodies", () => {
    // revoking access is a manual, per-environment action (see the MANUAL_RUN script)
    const outsideFunctions = syncSql.replace(/\$function\$[\s\S]*?\$function\$/g, "");
    expect(outsideFunctions).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(outsideFunctions).not.toMatch(/\bUPDATE\s+public\./i);
  });
});

describe("manual cleanup script", () => {
  it("is NOT part of the automatic migration pipeline (no timestamp prefix)", () => {
    const auto = readdirSync(dir).filter((f) => /^\d{8,14}_.*\.sql$/.test(f));
    expect(auto).not.toContain("MANUAL_RUN_cleanup_firm_member_sync_assignments.sql");
  });

  it("is scoped to source = 'sync' rows of accounting-firm office companies and only ever downgrades", () => {
    expect(cleanupSql.match(/aa\.source = 'sync'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(cleanupSql.match(/resolve_accounting_firm_id_for_company\(aa\.company_id\) IS NOT NULL/g)?.length).toBeGreaterThanOrEqual(3);
    expect(cleanupSql).toContain("SET role = 'asszisztens'");
    expect(cleanupSql).not.toMatch(/SET role = 'iroda_admin'/);
  });
});

describe("external accountant ledger access (A-247, discrepancy 3)", () => {
  it("builds the company set from accounty_assignments and keeps payroll_specialist OUT", () => {
    const roles = /aa\.role IN \(([^)]*)\)/.exec(ledgerSql)?.[1] ?? "";
    for (const r of ["iroda_admin", "senior_könyvelő", "könyvelő", "asszisztens"]) {
      expect(roles).toContain(`'${r}'`);
    }
    expect(roles).not.toContain("payroll_specialist");
    expect(ledgerSql).toContain("FROM public.accounty_assignments aa");
    expect(ledgerSql).toContain(
      "REVOKE ALL ON FUNCTION public.rls_accounty_bookkeeping_company_ids() FROM PUBLIC, anon;",
    );
    expect(ledgerSql).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public'/);
  });

  it("opens the four ledger tables FOR ALL but periods and invoice_items FOR SELECT only", () => {
    for (const tbl of ["acc_journals", "acc_journal_headers", "acc_open_item_matches"]) {
      expect(ledgerSql).toContain(`'${tbl}'`);
    }
    expect(ledgerSql).toMatch(/CREATE POLICY accounty_bookkeeping_access ON public\.acc_journal_lines AS PERMISSIVE FOR ALL/);
    expect(ledgerSql).toMatch(/CREATE POLICY accounty_bookkeeping_read ON public\.acc_accounting_periods\s+AS PERMISSIVE FOR SELECT/);
    expect(ledgerSql).toMatch(/CREATE POLICY accounty_bookkeeping_read ON public\.invoice_items\s+AS PERMISSIVE FOR SELECT/);
  });

  it("never rewrites or drops an existing policy and does not touch invoices / transactions writes", () => {
    expect(ledgerSql).not.toMatch(/DROP POLICY IF EXISTS (acc_|"Members)/);
    expect(ledgerSql).not.toMatch(/ON public\.(invoices|transactions)\b/);
    expect(ledgerSql).not.toMatch(/ON public\.acc_accounting_periods\s+AS PERMISSIVE FOR (ALL|INSERT|UPDATE|DELETE)/);
  });

  it("is idempotent and reloads the PostgREST schema cache", () => {
    expect(ledgerSql).toMatch(/DROP POLICY IF EXISTS accounty_bookkeeping_access/);
    expect(ledgerSql).toMatch(/DROP POLICY IF EXISTS accounty_bookkeeping_read/);
    expect(ledgerSql).toContain("NOTIFY pgrst, 'reload schema';");
  });
});
