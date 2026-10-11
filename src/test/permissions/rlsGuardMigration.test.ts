/**
 * Migration contract test (A-247 addendum): 20261011042300_rls_role_write_guards_and_payroll_isolation.sql
 *
 * The behaviour itself is covered by supabase/tests/database/rls_role_write_guards.test.sql (pgTAP) and
 * by the Dev-DB persona session. This file only protects the migration text against silent drift
 * (dropped tables, widened roles, lost REVOKE, weakened triggers).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261011042300_rls_role_write_guards_and_payroll_isolation.sql",
  ),
  "utf8",
);

describe("RLS role write guards migration (A-247)", () => {
  it("defines both SECURITY DEFINER helpers with a pinned search_path and no anon/PUBLIC access", () => {
    for (const fn of ["rls_write_denied_company_ids(text, text[])", "rls_payroll_blocked_company_ids(text[])"]) {
      expect(sql).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon;`);
      expect(sql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO authenticated, service_role;`);
    }
    expect(sql.match(/SECURITY DEFINER\s+SET search_path TO 'public'/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("keeps the viewer / employee / payroll_specialist OUT of the write-allowed role lists", () => {
    const allowed = /cm\.role IN \(([^)]*)\)/.exec(sql)?.[1] ?? "";
    expect(allowed).toContain("'owner'");
    expect(allowed).toContain("'member'");
    expect(allowed).not.toContain("viewer");
    expect(allowed).not.toContain("employee");
    expect(allowed).not.toContain("assistant"); // assistant only via the invoicing level
    expect(sql).toContain("(p_level = 'invoicing' AND cm.role = 'assistant')");
    expect(sql).toContain("(c.role <> 'payroll_specialist') AS ok");
  });

  it("guards every book / VAT / invoice-item table with RESTRICTIVE INSERT/UPDATE/DELETE policies", () => {
    for (const tbl of [
      "vat_returns", "vat_return_a60_lines", "acc_journals", "acc_journal_headers",
      "acc_open_item_matches", "acc_accounting_periods", "vat_return_lines",
      "vat_return_m_lines", "acc_journal_lines", "invoice_items",
    ]) {
      expect(sql).toContain(`'${tbl}'`);
    }
    for (const p of ["rls_guard_write_ins", "rls_guard_write_upd", "rls_guard_write_del"]) {
      expect(sql).toMatch(new RegExp(`CREATE POLICY ${p} ON public\\.%I AS RESTRICTIVE`));
    }
    // never a PERMISSIVE grant: the guards may only narrow access
    expect(sql).not.toMatch(/CREATE POLICY rls_guard_\w+ ON public\.%I AS PERMISSIVE/);
    expect(sql).not.toMatch(/CREATE POLICY rls_guard_\w+ ON public\.%I FOR/);
  });

  it("isolates payroll_specialist from financial tables but not from the wages table", () => {
    expect(sql).toContain("rls_guard_payroll_isolation");
    for (const tbl of ["invoices", "nav_invoices", "transactions", "partners", "vat_returns", "llm_koltsegek"]) {
      expect(sql).toContain(`('${tbl}'`);
    }
    expect(sql).toContain("c.relname <> 'accounty_ev_records_wages'");
  });

  it("makes finalized VAT returns immutable for header (incl. DELETE) and lines", () => {
    expect(sql).toContain("BEFORE INSERT OR UPDATE OR DELETE ON public.vat_returns");
    expect(sql).toContain("OLD.status = 'finalized' AND NOT public.can_finalize_company_filing(OLD.company_id)");
    expect(sql).toContain("fn_vat_return_children_finalize_guard");
    for (const t of ["vat_return_lines", "vat_return_m_lines", "vat_return_a60_lines"]) {
      expect(sql).toContain(`'${t}'`);
    }
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_vat_returns_finalize_guard() FROM PUBLIC, anon, authenticated;");
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.fn_vat_return_children_finalize_guard() FROM PUBLIC, anon, authenticated;");
    expect(sql.match(/ERRCODE = '42501'/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("is idempotent and reloads the PostgREST schema cache", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS rls_guard_write_ins/);
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_vat_returns_finalize_guard/);
    expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
  });
});
