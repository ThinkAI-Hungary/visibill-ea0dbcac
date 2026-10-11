/**
 * Migration contract test (A-247, RBAC Csomag A):
 *   - 20261011130700_restrict_bank_accounts_and_transfers_write_rls.sql
 *
 * Behaviour is covered by supabase/tests/database/bank_accounts_transfers_write_rls.test.sql.
 * This file protects the migration text against silent drift (assistant/viewer re-gaining write access,
 * lost InitPlan auth.uid() pattern, SELECT being narrowed).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261011130700_restrict_bank_accounts_and_transfers_write_rls.sql"),
  "utf8",
);

const TABLES = ["company_bank_accounts", "payment_transfers"] as const;

describe("bank accounts + payment transfers write RLS (A-247 Csomag A)", () => {
  it("allows write only for owner/admin/member/support_admin on every table", () => {
    for (const table of TABLES) {
      for (const cmd of ["INSERT", "UPDATE", "DELETE"]) {
        const re = new RegExp(`CREATE POLICY "Finance roles can ${cmd.toLowerCase()} [^"]+"\\s+ON public\\.${table} FOR ${cmd}`);
        expect(sql, `${table} ${cmd}`).toMatch(re);
      }
    }
    expect(sql.match(/cm\.role IN \('owner', 'admin', 'member', 'support_admin'\)/g)?.length).toBe(8);
  });

  it("never grants write to assistant / viewer / employee", () => {
    const policies = sql.slice(sql.indexOf("CREATE POLICY"));
    expect(policies).not.toContain("'assistant'");
    expect(policies).not.toContain("'viewer'");
    expect(policies).not.toContain("'employee'");
  });

  it("drops the old permissive 'Members can ...' write policies (idempotent)", () => {
    for (const verb of ["insert", "update", "delete"]) {
      expect(sql).toContain(`DROP POLICY IF EXISTS "Members can ${verb} bank accounts" ON public.company_bank_accounts;`);
      expect(sql).toContain(`DROP POLICY IF EXISTS "Members can ${verb} payment transfers" ON public.payment_transfers;`);
    }
  });

  it("keeps the (SELECT auth.uid()) InitPlan pattern and does not touch SELECT / service_role policies", () => {
    const code = sql.replace(/--.*$/gm, "");
    expect(code).not.toMatch(/cm\.user_id = auth\.uid\(\)/);
    expect(code.match(/cm\.user_id = \(SELECT auth\.uid\(\)\)/g)?.length).toBe(8);
    expect(code).not.toMatch(/FOR SELECT/);
    expect(code).not.toContain("service_role");
  });

  it("reloads the PostgREST schema cache", () => {
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
