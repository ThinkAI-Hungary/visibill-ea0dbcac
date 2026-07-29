import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = './.env.local';
const envStr = fs.readFileSync(envPath, 'utf-8');
const envVars = {};
envStr.split('\n').forEach(line => {
  if (line && !line.startsWith('#')) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim().replace(/^VITE_/, '');
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1');
      envVars[key] = val.replace(/\r$/, '');
    }
  }
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_KEY);

async function check() {
  const companyId = 'b1c19c7d-df9f-4423-a9d0-fa43dea1f5c7';

  // 1. Fetch some info about the nav_invoices
  const { data: nav } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, created_at, fetched_at, user_id, details_fetched')
    .eq('company_id', companyId)
    .limit(10);

  console.log('Sample SportsBase NAV Invoices details:');
  console.log(nav);

  // 2. See if there are ANY sync logs in the database
  const { data: allLogs } = await supabase
    .from('nav_sync_logs')
    .select('id, company_id, status, started_at, completed_at, invoices_fetched')
    .limit(10);

  console.log('\nSample sync logs (all companies):');
  console.log(allLogs);

  // 3. See if we have NAV credentials for SportsBase
  const { data: creds } = await supabase
    .from('user_nav_credentials')
    .select('company_id, validation_status, last_validated_at, validation_error')
    .eq('company_id', companyId)
    .maybeSingle();

  console.log('\nNAV credentials for SportsBase:', creds);
}

check();
