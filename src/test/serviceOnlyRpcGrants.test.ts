import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Contract test for migration 20261003225350_restrict_service_only_queue_and_nav_rpcs
//
// Internal SECURITY DEFINER RPCs (queue plumbing + NAV persistence) must only be
// executable by service_role (Edge Functions / Python worker) or owner context
// (other SECDEF functions, pg_cron). Live DB is verified by the pgTAP test
// supabase/tests/database/service_only_queue_and_nav_rpcs.test.sql.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
const MIGRATION_VERSION = '20261003225350';
const MIGRATION_FILE = join(MIGRATIONS_DIR, `${MIGRATION_VERSION}_restrict_service_only_queue_and_nav_rpcs.sql`);

const SERVICE_ONLY_FUNCTIONS: Array<{ name: string; signature: string }> = [
  { name: 'save_nav_invoice_details_and_items', signature: 'uuid, jsonb, jsonb' },
  { name: 'pgmq_set_vt', signature: 'text, bigint, integer' },
  { name: 'pgmq_send_retry', signature: 'text, jsonb' },
  { name: 'peek_queue_items', signature: 'text, integer' },
  { name: 'pgmq_metrics_all', signature: '' },
  { name: 'refresh_company_counts_cache', signature: '' },
];

/** Removes `-- ...` line comments so assertions only look at executable SQL. */
function stripSqlLineComments(sql: string): string {
  return sql
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listFilesRecursive(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...listFilesRecursive(full, exts));
    } else if (exts.some((e) => entry.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

const migrationSql = stripSqlLineComments(readFileSync(MIGRATION_FILE, 'utf8'));

describe('Migration 20261003225350 – service_role-only EXECUTE grants', () => {
  it.each(SERVICE_ONLY_FUNCTIONS)('revokes EXECUTE on $name from PUBLIC, anon, authenticated', ({ name, signature }) => {
    const re = new RegExp(
      `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\(\\s*${escapeRegex(signature)}\\s*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
      'i',
    );
    expect(migrationSql).toMatch(re);
  });

  it.each(SERVICE_ONLY_FUNCTIONS)('grants EXECUTE on $name to service_role only', ({ name, signature }) => {
    const re = new RegExp(
      `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\(\\s*${escapeRegex(signature)}\\s*\\)\\s+TO\\s+service_role\\s*;`,
      'i',
    );
    expect(migrationSql).toMatch(re);
  });

  it('never grants these functions to anon / authenticated / PUBLIC inside the migration', () => {
    for (const { name } of SERVICE_ONLY_FUNCTIONS) {
      const bad = new RegExp(`GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\([^)]*\\)\\s+TO\\s+[^;]*\\b(anon|authenticated|PUBLIC)\\b`, 'i');
      expect(migrationSql).not.toMatch(bad);
    }
  });
});

describe('Migration 20261003225350 – save_nav_invoice_details_and_items tenant integrity', () => {
  it('is SECURITY DEFINER, VOLATILE and pins search_path', () => {
    const header = migrationSql.slice(
      migrationSql.indexOf('CREATE OR REPLACE FUNCTION public.save_nav_invoice_details_and_items'),
      migrationSql.indexOf('AS $$'),
    );
    expect(header).toMatch(/SECURITY\s+DEFINER/i);
    expect(header).toMatch(/\bVOLATILE\b/i);
    expect(header).toMatch(/SET\s+search_path\s*=\s*public\s*,\s*pg_temp/i);
  });

  it('derives line-item company_id from the parent invoice, never from the payload', () => {
    // Executable SQL must not read the caller-supplied company_id
    expect(migrationSql).not.toMatch(/item\s*->>\s*'company_id'/i);
    // company_id is loaded from nav_invoices and used in the INSERT ... SELECT
    expect(migrationSql).toMatch(/SELECT\s+company_id\s+INTO\s+v_company_id\s+FROM\s+public\.nav_invoices/i);
    expect(migrationSql).toMatch(/SELECT\s+p_invoice_id\s*,\s*v_company_id\s*,/i);
  });

  it('keeps the idempotent upsert key (nav_invoice_id, line_number)', () => {
    expect(migrationSql).toMatch(/ON\s+CONFLICT\s*\(\s*nav_invoice_id\s*,\s*line_number\s*\)\s+DO\s+UPDATE/i);
  });
});

describe('Regression guards', () => {
  it('no later migration re-grants a service-only function to anon / authenticated / PUBLIC', () => {
    const later = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d{14}_.*\.sql$/.test(f) && f.slice(0, 14) > MIGRATION_VERSION);

    const offenders: string[] = [];
    for (const file of later) {
      const sql = stripSqlLineComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));
      for (const { name } of SERVICE_ONLY_FUNCTIONS) {
        const regrant = new RegExp(
          `GRANT\\s+(EXECUTE|ALL)[^;]*\\bpublic\\.${name}\\b[^;]*\\bTO\\b[^;]*\\b(anon|authenticated|PUBLIC)\\b`,
          'i',
        );
        if (regrant.test(sql)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('frontend (src/) never calls a service-only RPC directly', () => {
    const files = listFilesRecursive(join(ROOT, 'src'), ['.ts', '.tsx']).filter(
      (f) => !f.includes(`${join('src', 'test')}`) && !f.includes(`${join('integrations', 'supabase')}`),
    );

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const { name } of SERVICE_ONLY_FUNCTIONS) {
        if (new RegExp(`\\.rpc\\(\\s*['"\`]${name}['"\`]`).test(content)) {
          offenders.push(`${relative(ROOT, file)}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
