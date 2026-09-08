#!/usr/bin/env node
/**
 * RAG Knowledge Base Retrieval Tester
 * 
 * Használat:
 * node scripts/verify_kb_rag.mjs "keresőkifejezés" ["/oldal_utvonal"] [max_talalat]
 * 
 * Példa:
 * node scripts/verify_kb_rag.mjs "bérszámfejtés" "/eaisybooks/payroll" 5
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../../../');

// Read .env.local
const envLocalPath = path.join(rootDir, '.env.local');
const envVars = {};
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      envVars[key] = val;
    }
  }
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const testEmail = envVars.PLAYWRIGHT_TEST_EMAIL || 'notbyalongway@gmail.com';
const testPassword = envVars.PLAYWRIGHT_TEST_PASSWORD || 'Morfiapro1.';

if (!supabaseUrl || !anonKey) {
  console.error('HIBA: Supabase URL vagy Anon kulcs hiányzik (.env.local)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, anonKey, {
  global: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'http://localhost:8080',
      'Referer': 'http://localhost:8080/',
      'x-visibill-client': 'web-app',
    },
  },
});

const searchQuery = process.argv[2] || 'számla';
const pagePath = process.argv[3] || null;
const matchLimit = parseInt(process.argv[4] || '5', 10);

async function main() {
  console.log(`\n🔍 [RAG TEST] Keresés indítása...`);
  console.log(`   Kérdés / Query : "${searchQuery}"`);
  console.log(`   Aktuális oldal : ${pagePath || 'Nincs megadva (NULL)'}`);
  console.log(`   Limit          : ${matchLimit} db`);

  // Sign in to obtain authenticated JWT
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr) {
    console.error('⚠️ Bejelentkezési hiba a teszt felhasználóval:', authErr.message);
    process.exit(1);
  }

  // Call search_knowledge_base RPC
  const { data: results, error: rpcErr } = await supabase.rpc('search_knowledge_base', {
    search_query: searchQuery,
    page_path: pagePath,
    target_category: null,
    match_limit: matchLimit,
  });

  if (rpcErr) {
    console.error('❌ RPC Hiba a search_knowledge_base hívásakor:', rpcErr.message);
    process.exit(1);
  }

  console.log(`\n📊 [TALÁLATOK SZÁMA: ${results?.length || 0}]`);
  if (!results || results.length === 0) {
    console.log('   ⚠️ Nincs találat! A rank pontszám nem érte el a küszöböt.');
    process.exit(0);
  }

  results.forEach((r, idx) => {
    const isPassing = (r.rank ?? 0) >= 0.15;
    const statusIcon = isPassing ? '✅' : '❌';
    console.log(`\n${statusIcon} #${idx + 1} [Rank: ${(r.rank ?? 0).toFixed(3)}]`);
    console.log(`   ID       : ${r.id}`);
    console.log(`   Cím      : ${r.title}`);
    console.log(`   Kategória: ${r.category_id}`);
    console.log(`   Route    : ${r.menu_path || 'NULL'}`);
    console.log(`   Kivonat  : ${(r.summary || '').slice(0, 100)}...`);
    console.log(`   RAG Status: ${isPassing ? 'INJEKTÁLVA AZ ASSZISZTENSBE (>= 0.15)' : 'ELDOBVA (< 0.15)'}`);
  });
  console.log('\n-----------------------------------------------------------');
}

main().catch(err => {
  console.error('Váratlan hiba:', err);
  process.exit(1);
});
