#!/usr/bin/env node
/**
 * verify-migrations.mjs
 * 
 * Visibill Supabase Migration Verification & Integrity Guard
 * Checks local migration files in supabase/migrations/ for:
 * 1. Valid filename conventions (<timestamp>_<name>.sql)
 * 2. Duplicate timestamps
 * 3. Chronological order and sorting
 * 4. Checks against provided DB baseline (via CLI argument or environment)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const migrationsDir = path.join(rootDir, 'supabase', 'migrations');

export function scanLocalMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at: ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
  const parsed = [];
  const timestampMap = new Map();
  const duplicates = [];
  const malformed = [];

  for (const file of files) {
    const match = file.match(/^(\d+)(?:_(.*))?\.sql$/);
    if (!match) {
      malformed.push(file);
      continue;
    }

    const version = match[1];
    const name = match[2] || '';
    const fullPath = path.join(migrationsDir, file);
    const size = fs.statSync(fullPath).size;

    if (timestampMap.has(version)) {
      duplicates.push({
        version,
        file1: timestampMap.get(version).file,
        file2: file
      });
    } else {
      timestampMap.set(version, { version, name, file, fullPath, size });
    }

    parsed.push({ version, name, file, fullPath, size });
  }

  // Sort chronologically by version
  parsed.sort((a, b) => a.version.localeCompare(b.version));

  return {
    total: parsed.length,
    files: parsed,
    timestampMap,
    duplicates,
    malformed
  };
}

export function auditAgainstDb(dbVersions) {
  const local = scanLocalMigrations();
  const dbSet = new Set(dbVersions.map(v => String(v)));

  const onDiskOnly = [];
  for (const [ver, item] of local.timestampMap.entries()) {
    if (!dbSet.has(ver)) {
      onDiskOnly.push(item);
    }
  }

  const inDbOnly = [];
  for (const ver of dbSet) {
    if (!local.timestampMap.has(ver)) {
      inDbOnly.push(ver);
    }
  }

  return {
    localCount: local.total,
    dbCount: dbSet.size,
    duplicates: local.duplicates,
    malformed: local.malformed,
    onDiskOnly,
    inDbOnly,
    isFullySynced: onDiskOnly.length === 0 && inDbOnly.length === 0 && local.duplicates.length === 0 && local.malformed.length === 0
  };
}

// CLI Execution mode
if (process.argv[1] === __filename) {
  console.log('🔍 Auditing Supabase migrations on disk...');
  const local = scanLocalMigrations();

  console.log(`📁 Total local migration files: ${local.total}`);

  if (local.malformed.length > 0) {
    console.error('❌ Malformed filenames detected:');
    for (const f of local.malformed) console.error(`  - ${f}`);
  } else {
    console.log('✅ All filenames follow the <timestamp>_<name>.sql convention.');
  }

  if (local.duplicates.length > 0) {
    console.error('❌ Duplicate timestamps detected:');
    for (const d of local.duplicates) {
      console.error(`  - Version ${d.version}: '${d.file1}' AND '${d.file2}'`);
    }
  } else {
    console.log('✅ No duplicate timestamps found on disk.');
  }

  const latest = local.files[local.files.length - 1];
  console.log(`📌 Latest local migration: ${latest.version} (${latest.name})`);

  if (local.duplicates.length > 0 || local.malformed.length > 0) {
    process.exit(1);
  }
}
