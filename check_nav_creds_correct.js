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
      envVars[key] = val;
    }
  }
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_KEY);

async function check() {
  const companyId = 'b1c19e7d-df9f-4423-a9d0-fa43dea1f5c7';

  // Check NAV credentials
  const { data: creds, error: credsError } = await supabase
    .from('user_nav_credentials')
    .select('company_id, validation_status, last_validated_at, validation_error, auto_sync_enabled, sync_frequency')
    .eq('company_id', companyId)
    .maybeSingle();

  console.log('NAV credentials for SportsBase (correct ID):', creds, credsError);

  // Check sync logs
  const { data: logs, error: logsError } = await supabase
    .from('nav_sync_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('started_at', { ascending: false });

  console.log('Sync logs count:', logs ? logs.length : 0, logsError);
  if (logs && logs.length > 0) {
    logs.slice(0, 5).forEach((l, idx) => {
      console.log(`  Log ${idx + 1}: ${l.started_at} | ${l.invoice_direction} | ${l.date_from} to ${l.date_to} | ${l.status} | fetched: ${l.invoices_fetched}`);
    });
  }
}

check();
