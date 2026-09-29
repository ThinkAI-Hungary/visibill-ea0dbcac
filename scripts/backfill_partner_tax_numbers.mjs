import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
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
const anonKey = envVars.SUPABASE_PUBLISHABLE_KEY || envVars.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 && args[limitIdx + 1] ? parseInt(args[limitIdx + 1], 10) : null;
const delayIdx = args.indexOf('--delay');
const delayMs = delayIdx !== -1 && args[delayIdx + 1] ? parseInt(args[delayIdx + 1], 10) : 600;
const companyIdx = args.indexOf('--company-id');
const filterCompanyId = companyIdx !== -1 && args[companyIdx + 1] ? args[companyIdx + 1] : null;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  const report = {
    startedAt: new Date().toISOString(),
    isDryRun,
    limit,
    delayMs,
    filterCompanyId,
    totalFound: 0,
    processed: 0,
    updated: 0,
    skippedDuplicate: 0,
    notFoundInNav: 0,
    failed: 0,
    results: []
  };

  try {
    let supabase;
    let authToken;

    if (serviceKey) {
      supabase = createClient(supabaseUrl, serviceKey);
      authToken = serviceKey;
    } else {
      supabase = createClient(supabaseUrl, anonKey, {
        global: {
          headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'origin': 'http://localhost:8080',
            'referer': 'http://localhost:8080/'
          }
        }
      });
      const testEmail = envVars.PLAYWRIGHT_TEST_EMAIL || 'notbyalongway@gmail.com';
      const testPassword = envVars.PLAYWRIGHT_TEST_PASSWORD || 'Morfiapro1.';
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword });
      if (authError || !authData?.session?.access_token) {
        report.error = authError?.message || 'Authentication failed';
        fs.writeFileSync('scripts/backfill_report.json', JSON.stringify(report, null, 2), 'utf-8');
        return;
      }
      authToken = authData.session.access_token;
    }

    // 1. Fetch domestic 8-digit partners
    let query = supabase
      .from('partners')
      .select('id, company_id, name, tax_number, address')
      .not('tax_number', 'is', null)
      .not('tax_number', 'like', 'FOREIGN:%')
      .not('tax_number', 'like', '%-%');

    if (filterCompanyId) {
      query = query.eq('company_id', filterCompanyId);
    }

    const { data: candidates, error: fetchErr } = await query;
    if (fetchErr || !candidates) {
      report.error = fetchErr?.message || 'Failed to fetch partners';
      fs.writeFileSync('scripts/backfill_report.json', JSON.stringify(report, null, 2), 'utf-8');
      return;
    }

    // Filter strictly 8 digits (or HU + 8 digits)
    const targets = candidates.filter(p => {
      const clean = p.tax_number.replace(/^HU/i, '').replace(/\D/g, '');
      return clean.length === 8;
    });

    report.totalFound = targets.length;
    const toProcess = limit ? targets.slice(0, limit) : targets;

    for (const partner of toProcess) {
      report.processed++;
      const clean8 = partner.tax_number.replace(/^HU/i, '').replace(/\D/g, '').slice(0, 8);

      try {
        await sleep(delayMs);

        // Query NAV through nav-query-taxpayer edge function
        const response = await fetch(`${supabaseUrl}/functions/v1/nav-query-taxpayer`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'origin': 'http://localhost:8080',
            'referer': 'http://localhost:8080/'
          },
          body: JSON.stringify({
            taxNumber: clean8,
            companyId: partner.company_id || undefined
          })
        });

        const resData = await response.json().catch(() => ({}));

        if (!response.ok || !resData?.success || !resData?.data?.taxpayerValidity || !resData?.data?.taxNumber) {
          report.notFoundInNav++;
          report.results.push({
            id: partner.id,
            name: partner.name,
            oldTax: partner.tax_number,
            status: 'not_found_or_invalid',
            error: resData?.error || 'Invalid in NAV'
          });
          continue;
        }

        const taxpayer = resData.data;
        const newTaxNumber = taxpayer.taxNumber; // 8-1-2

        // Check unique constraint conflict for this company
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
        report.results.push({
          id: partner.id,
          name: partner.name,
          oldTax: partner.tax_number,
          status: 'exception',
          error: itemErr.message
        });
      }
    }

  } catch (err) {
    report.fatalError = err.message;
  } finally {
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync('scripts/backfill_report.json', JSON.stringify(report, null, 2), 'utf-8');
  }
}

main();
