import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
}

const SUPABASE_URL = env.SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/customer-api`;

async function testCustomerApi() {
  console.log('=== CUSTOMER REST API AUTOMATED VERIFICATION ===\n');

  // 1. Generate a test API key for Mauroni Events Kft.
  const targetCompanyId = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
  console.log(`1. Finding owner for company ${targetCompanyId}...`);
  const { data: comp } = await supabase.from('companies').select('id, name, owner_id').eq('id', targetCompanyId).single();
  const userId = comp?.owner_id;
  console.log(`Found owner: ${userId} (${comp?.name})`);

  console.log(`Generating test API key...`);
  const { data: keyData, error: keyErr } = await supabase.rpc('generate_api_key', {
    p_name: 'Automated REST Tester',
    p_scope: 'read_write',
    p_company_id: targetCompanyId,
    p_user_id: userId,
  });

  if (keyErr || !keyData?.api_key) {
    console.error('Failed to generate test API key:', keyErr);
    process.exit(1);
  }

  const apiKey = keyData.api_key;
  const keyId = keyData.id;
  console.log(`Generated Key: ${apiKey.slice(0, 10)}... (ID: ${keyId})\n`);

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  let allPassed = true;

  // Helper for fetch
  async function testEndpoint(name, path, options = {}) {
    try {
      const url = `${EDGE_FUNCTION_URL}${path}`;
      const res = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...(options.headers || {}),
        },
      });

      const body = await res.json().catch(() => null);
      const isOk = res.ok;

      console.log(`[${isOk ? 'PASS' : 'FAIL'}] ${name} (${options.method || 'GET'} ${path}) -> HTTP ${res.status}`);
      if (!isOk) {
        console.error('   Error response:', body);
        allPassed = false;
      } else {
        const count = Array.isArray(body?.data) ? body.data.length : (body?.data ? 'object' : 'empty');
        const meta = body?.meta ? JSON.stringify(body.meta) : '';
        console.log(`   Result: ${count} items | Meta: ${meta}`);
      }
      return { status: res.status, body };
    } catch (e) {
      console.error(`[FAIL] ${name} (${path}) -> Exception:`, e.message);
      allPassed = false;
      return null;
    }
  }

  // 2. Test Invalid Token (Security check)
  console.log('--- Security & Auth Checks ---');
  const unauthRes = await fetch(`${EDGE_FUNCTION_URL}/v1/invoices`, {
    headers: { 'Authorization': 'Bearer vb_live_invalidkey12345' },
  });
  console.log(`[${unauthRes.status === 401 ? 'PASS' : 'FAIL'}] Unauthorized key rejection -> HTTP ${unauthRes.status}`);

  // 3. Test Core Endpoints
  console.log('\n--- Core Domain Endpoints ---');
  await testEndpoint('GET /v1/invoices (inbound)', '/v1/invoices?direction=inbound&limit=5');
  await testEndpoint('GET /v1/invoices (with items)', '/v1/invoices?limit=2&include_items=true');
  await testEndpoint('GET /v1/partners', '/v1/partners?limit=5');
  await testEndpoint('GET /v1/transactions', '/v1/transactions?limit=5');
  await testEndpoint('GET /v1/ledger', '/v1/ledger?limit=5');
  await testEndpoint('GET /v1/reports/vat', '/v1/reports/vat?year=2026');
  await testEndpoint('GET /v1/reports/pnl', '/v1/reports/pnl?year=2026');
  await testEndpoint('GET /v1/projects', '/v1/projects');

  // 4. Test Retrocompatibility Query-Param Action
  console.log('\n--- Retrocompatibility Checks (?action=companies) ---');
  await testEndpoint('GET ?action=companies', '?action=companies');

  // 5. Cleanup: Revoke Test Key
  console.log('\n--- Cleanup ---');
  console.log(`Revoking test key ${keyId}...`);
  const { error: revokeErr } = await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId);
  if (revokeErr) {
    console.error('Warning: Failed to revoke test key:', revokeErr);
  } else {
    console.log('Test key revoked successfully.');
  }

  // Verify revoked key is rejected
  const revokedRes = await fetch(`${EDGE_FUNCTION_URL}/v1/invoices`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  });
  const revokedBody = await revokedRes.json().catch(() => null);
  console.log(`[${revokedRes.status === 401 ? 'PASS' : 'FAIL'}] Revoked key rejection -> HTTP ${revokedRes.status} (Code: ${revokedBody?.error?.code})`);
  if (revokedRes.status !== 401) allPassed = false;

  console.log(`\n========================================`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
  console.log(`========================================`);
}

testCustomerApi();
