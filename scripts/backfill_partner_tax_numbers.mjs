import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// ── 1. Load Environment Configuration ──────────────────────────────────────────
const envPath = path.resolve(process.cwd(), '.env.local');
const envVars = {};
if (fs.existsSync(envPath)) {
  const envStr = fs.readFileSync(envPath, 'utf-8');
  envStr.split('\n').forEach(line => {
    if (line && !line.startsWith('#')) {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim().replace(/^VITE_/, '');
        const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
        envVars[key] = val;
      }
    }
  });
}

const supabaseUrl = envVars.SUPABASE_URL || process.env.SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const projId = envVars.SUPABASE_PROJECT_ID || 'vxxgvdlqvvchtlmqnrqf';
const anonKey = envVars.SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

// ── 2. Parse CLI Arguments ───────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 && args[limitIdx + 1] !== undefined ? parseInt(args[limitIdx + 1], 10) : null;
const delayIdx = args.indexOf('--delay');
const delayMs = delayIdx !== -1 && args[delayIdx + 1] ? parseInt(args[delayIdx + 1], 10) : 600;
const companyIdx = args.indexOf('--company-id');
const filterCompanyId = companyIdx !== -1 && args[companyIdx + 1] ? args[companyIdx + 1] : null;
const resetState = args.includes('--reset-state');

const STATE_FILE = path.resolve(process.cwd(), 'scripts/backfill_state.json');
const REPORT_FILE = path.resolve(process.cwd(), 'scripts/backfill_report.json');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Format seconds into HH:MM:SS or MM:SS
function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec < 0) return '00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ── 3. State Management (Resume / Checkpoint) ──────────────────────────────────
function loadState() {
  if (resetState || !fs.existsSync(STATE_FILE)) {
    return {
      processedIds: [],
      updatedCount: 0,
      skippedDuplicateCount: 0,
      notFoundCount: 0,
      failedCount: 0,
      lastRunAt: null
    };
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      processedIds: Array.isArray(parsed.processedIds) ? parsed.processedIds : [],
      updatedCount: parsed.updatedCount || 0,
      skippedDuplicateCount: parsed.skippedDuplicateCount || 0,
      notFoundCount: parsed.notFoundCount || 0,
      failedCount: parsed.failedCount || 0,
      lastRunAt: parsed.lastRunAt || null
    };
  } catch {
    return { processedIds: [], updatedCount: 0, skippedDuplicateCount: 0, notFoundCount: 0, failedCount: 0 };
  }
}

function saveState(state) {
  try {
    state.lastRunAt = new Date().toISOString();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    // Ignore write error during rapid progress
  }
}

// ── 4. Main Process ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n================================================================');
  console.log('🚀 VISIBILL PARTNER TAX NUMBER BACKFILL & NAV 8-1-2 STANDARDIZATION');
  console.log('================================================================');
  if (isDryRun) console.log('⚠️  DRY-RUN AKTÍV: Módosítások nem kerülnek mentésre az adatbázisba.');
  if (limit) console.log(`ℹ️  Limit beállítva: max. ${limit} partner feldolgozása.`);
  if (filterCompanyId) console.log(`🏢 Cég szűrés: ${filterCompanyId}`);
  console.log(`⏱️  NAV kérések közötti késleltetés: ${delayMs} ms\n`);

  const state = loadState();
  const processedSet = new Set(state.processedIds);
  if (processedSet.size > 0 && !resetState) {
    console.log(`🔄 Folytatás korábbi állapotból: ${processedSet.size} korábban sikertelen/duplikált rekord kihagyása.`);
  }

  // A) Resolve Service Role Key
  let serviceKey = envVars.SUPABASE_SERVICE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey && envVars.SUPABASE_ACCESS_TOKEN) {
    try {
      const keysRes = await fetch(`https://api.supabase.com/v1/projects/${projId}/api-keys`, {
        headers: { Authorization: `Bearer ${envVars.SUPABASE_ACCESS_TOKEN}` }
      });
      if (keysRes.ok) {
        const keys = await keysRes.json();
        const sr = keys.find(k => k.name === 'service_role');
        if (sr?.api_key) {
          serviceKey = sr.api_key;
        }
      }
    } catch (e) {
      console.log(`⚠️  Nem sikerült feloldani a service_role kulcsot API-ból: ${e.message}`);
    }
  }

  let supabase;
  let authToken;

  if (serviceKey) {
    supabase = createClient(supabaseUrl, serviceKey);
    authToken = serviceKey;
    console.log('🔑 Hitelesítés: Adminisztrátori (service_role) hozzáférés aktív (RLS megkerülve).');
  } else {
    console.log('⚠️  Service role kulcs nem elérhető. Bejelentkezés tesztfelhasználóval...');
    supabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'origin': 'http://localhost:8080',
          'referer': 'http://localhost:8080/'
        }
      }
    });
    const testEmail = envVars.PLAYWRIGHT_TEST_EMAIL || 'notbyalongway@gmail.com';
    const testPassword = envVars.PLAYWRIGHT_TEST_PASSWORD || 'Morfiapro1.';
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (authError || !authData?.session?.access_token) {
      console.error(`❌ Hitelesítési hiba: ${authError?.message || 'Nem sikerült bejelentkezni'}`);
      return;
    }
    authToken = authData.session.access_token;
    console.log(`🔑 Hitelesítés: Felhasználói munkamenet (${testEmail}) aktív.`);
  }

  // B) Query Candidates with Pagination
  console.log('\n🔍 Kötőjel nélküli magyar partnerek keresése az adatbázisban...');
  const allCandidates = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    let q = supabase
      .from('partners')
      .select('id, company_id, name, tax_number, address')
      .not('tax_number', 'is', null)
      .not('tax_number', 'like', 'FOREIGN:%')
      .not('tax_number', 'like', '%-%')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (filterCompanyId) {
      q = q.eq('company_id', filterCompanyId);
    }

    const { data, error } = await q;
    if (error) {
      console.error(`❌ Hiba a partnerek lekérdezésekor: ${error.message}`);
      return;
    }
    if (!data || data.length === 0) break;
    allCandidates.push(...data);
    if (data.length < pageSize) break;
    page++;
  }

  // Filter 8-digit domestic candidates and exclude already processed non-upgradable IDs
  const targets = allCandidates.filter(p => {
    if (processedSet.has(p.id)) return false;
    const clean = (p.tax_number || '').replace(/^HU/i, '').replace(/\D/g, '');
    return clean.length === 8;
  });

  const totalToProcess = limit !== null ? targets.slice(0, limit) : targets;
  console.log(`📋 Összes jelölt partner: ${allCandidates.length} db`);
  console.log(`🎯 Ebből feldolgozásra vár (szigorúan 8 jegyű, még nem próbált): ${totalToProcess.length} db\n`);

  if (totalToProcess.length === 0) {
    console.log('✅ Nincs feldolgozandó 8 jegyű partner! Minden partner szabványos 8-1-2 formátumú.');
    return;
  }

  const report = {
    startedAt: new Date().toISOString(),
    isDryRun,
    limit,
    delayMs,
    filterCompanyId,
    totalTargets: totalToProcess.length,
    processed: 0,
    updated: 0,
    skippedDuplicate: 0,
    notFoundInNav: 0,
    failed: 0,
    results: []
  };

  const startTime = Date.now();

  // Setup graceful interrupt handling
  let isInterrupted = false;
  const handleExit = () => {
    if (isInterrupted) return;
    isInterrupted = true;
    console.log('\n\n🛑 Megszakítás észlelve (SIGINT / Ctrl+C)! Állapot mentése...');
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
    saveState(state);
    console.log(`💾 Állapot sikeresen mentve ide: scripts/backfill_state.json`);
    console.log(`📊 Riport mentve ide: scripts/backfill_report.json`);
    console.log('👋 A script bármikor újraindítható, onnan fogja folytatni, ahol abbahagytad.\n');
    process.exit(0);
  };
  process.on('SIGINT', handleExit);
  process.on('SIGTERM', handleExit);

  // C) Main Processing Loop
  for (let i = 0; i < totalToProcess.length; i++) {
    if (isInterrupted) break;

    const partner = totalToProcess[i];
    report.processed++;
    const clean8 = partner.tax_number.replace(/^HU/i, '').replace(/\D/g, '').slice(0, 8);
    const partnerName = (partner.name || 'Ismeretlen').slice(0, 32);

    // Calculate progress & ETA
    const elapsedSec = (Date.now() - startTime) / 1000;
    const avgSecPerItem = elapsedSec / report.processed;
    const remainingSec = Math.round((totalToProcess.length - report.processed) * avgSecPerItem);
    const progressPct = ((report.processed / totalToProcess.length) * 100).toFixed(1);
    const progressTag = `[${report.processed}/${totalToProcess.length} ${progressPct}%]`;
    const etaStr = formatDuration(remainingSec);

    try {
      await sleep(delayMs);

      // Call nav-query-taxpayer Edge Function
      let resData = null;
      let lastErr = null;

      // Resilience retry (max 2 attempts for transient errors)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/nav-query-taxpayer`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'origin': 'http://localhost:8080',
              'referer': 'http://localhost:8080/'
            },
            body: JSON.stringify({
              taxNumber: clean8,
              companyId: partner.company_id || undefined
            })
          });
          resData = await response.json().catch(() => ({}));
          if (response.ok && resData) break;
        } catch (fetchErr) {
          lastErr = fetchErr;
          if (attempt === 1) await sleep(1500);
        }
      }

      // Check if NAV found an active taxpayer
      if (!resData?.success || !resData?.data?.taxpayerValidity || !resData?.data?.taxNumber) {
        report.notFoundInNav++;
        state.notFoundCount++;
        processedSet.add(partner.id);
        state.processedIds.push(partner.id);

        console.log(`${progressTag} ⚪ ${partnerName} (${clean8}) ➔ NAV: Nem található / érvénytelen | ETA: ${etaStr}`);
        report.results.push({
          id: partner.id,
          name: partner.name,
          oldTax: partner.tax_number,
          status: 'not_found_or_invalid',
          error: resData?.error || lastErr?.message || 'Invalid in NAV'
        });
        continue;
      }

      const taxpayer = resData.data;
      const newTaxNumber = taxpayer.taxNumber; // Official 8-1-2

      // Check unique constraint conflict within the same company
      if (partner.company_id) {
        const { data: existing } = await supabase
          .from('partners')
          .select('id, name')
          .eq('company_id', partner.company_id)
          .eq('tax_number', newTaxNumber)
          .neq('id', partner.id)
          .maybeSingle();

        if (existing) {
          report.skippedDuplicate++;
          state.skippedDuplicateCount++;
          processedSet.add(partner.id);
          state.processedIds.push(partner.id);

          console.log(`${progressTag} ⚠️  ${partnerName} (${clean8}) ➔ DUPLIKÁTUM KIHAGYVA (már létezik: ${newTaxNumber}) | ETA: ${etaStr}`);
          report.results.push({
            id: partner.id,
            name: partner.name,
            oldTax: partner.tax_number,
            newTax: newTaxNumber,
            status: 'skipped_duplicate',
            conflictWithId: existing.id
          });
          continue;
        }
      }

      // Perform Update
      if (!isDryRun) {
        const updatePayload = {
          tax_number: newTaxNumber
        };
        if (!partner.address && taxpayer.address?.formattedAddress) {
          updatePayload.address = taxpayer.address.formattedAddress;
        }

        const { error: updateErr } = await supabase
          .from('partners')
          .update(updatePayload)
          .eq('id', partner.id);

        if (updateErr) {
          report.failed++;
          state.failedCount++;
          console.log(`${progressTag} ❌ ${partnerName} (${clean8}) ➔ Mentési hiba: ${updateErr.message}`);
          report.results.push({
            id: partner.id,
            name: partner.name,
            oldTax: partner.tax_number,
            status: 'update_error',
            error: updateErr.message
          });
          continue;
        }
      }

      report.updated++;
      state.updatedCount++;
      const addrTag = (!partner.address && !!taxpayer.address?.formattedAddress) ? ' + Cím pótolva' : '';
      console.log(`${progressTag} ✅ ${partnerName} ➔ ${newTaxNumber}${addrTag} | ETA: ${etaStr}`);

      report.results.push({
        id: partner.id,
        name: partner.name,
        oldTax: partner.tax_number,
        newTax: newTaxNumber,
        status: isDryRun ? 'dry_run_success' : 'updated',
        addressEnriched: !partner.address && !!taxpayer.address?.formattedAddress
      });

    } catch (itemErr) {
      report.failed++;
      state.failedCount++;
      console.log(`${progressTag} ❌ ${partnerName} ➔ Kivétel: ${itemErr.message}`);
      report.results.push({
        id: partner.id,
        name: partner.name,
        oldTax: partner.tax_number,
        status: 'exception',
        error: itemErr.message
      });
    }

    // Periodic Checkpoint Save (every 25 items)
    if (report.processed % 25 === 0) {
      saveState(state);
    }
  }

  // D) Final Reporting
  report.finishedAt = new Date().toISOString();
  saveState(state);
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

  const totalTimeSec = Math.round((Date.now() - startTime) / 1000);
  console.log('\n================================================================');
  console.log('🎉 BACKFILL FUTÁS BEFEJEZŐDÖTT');
  console.log('================================================================');
  console.log(`⏱️  Összes futási idő: ${formatDuration(totalTimeSec)}`);
  console.log(`🎯 Feldolgozott partnerek: ${report.processed} db`);
  console.log(`✅ Sikeresen 8-1-2-re frissítve: ${report.updated} db`);
  console.log(`⚠️  Duplikátum miatt kihagyva: ${report.skippedDuplicate} db`);
  console.log(`⚪ NAV-ban nem található / megszűnt: ${report.notFoundInNav} db`);
  console.log(`❌ Hiba: ${report.failed} db`);
  console.log(`📁 Részletes napló: scripts/backfill_report.json`);
  console.log(`💾 Állapotmentés: scripts/backfill_state.json`);
  console.log('================================================================\n');
}

main().catch(err => {
  console.error('\n💥 Végzetes hiba történt a futás során:', err.message);
  process.exit(1);
});
