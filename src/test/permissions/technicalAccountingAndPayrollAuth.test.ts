import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Technical Accounting and Payroll Auth Migration Contract', () => {
  const migrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20261013180000_fix_technical_accounting_and_payroll_auth.sql'
  );

  it('migration file exists and is readable', () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  it('contains has_accounty_company_access for all 7 RPCs', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const expectedFunctions = [
      'detect_accounting_anomalies',
      'get_partner_360_matrix',
      'get_omni_partner_ledger',
      'execute_journal_reclassification',
      'rollback_journal_reclassification',
      'get_payroll_471_reconciliation',
      'auto_match_payroll_bank_transactions',
    ];

    for (const fn of expectedFunctions) {
      expect(sql).toContain(`FUNCTION public.${fn}`);
    }

    // Ensure has_accounty_company_access is called across all functions
    const matchCount = (sql.match(/public\.has_accounty_company_access\(p_company_id\)/g) || []).length;
    expect(matchCount).toBe(7);
  });

  it('does NOT contain the naive company_members check', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).not.toContain('WHERE company_id = p_company_id AND user_id = auth.uid()');
  });

  it('revokes anonymous access and grants authenticated for all 7 RPCs', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8');

    const revokeCount = (sql.match(/REVOKE ALL ON FUNCTION/g) || []).length;
    expect(revokeCount).toBe(7);

    const grantCount = (sql.match(/GRANT EXECUTE ON FUNCTION/g) || []).length;
    expect(grantCount).toBe(7);
  });
});
