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

  const { data: logs, error } = await supabase
    .from('nav_sync_logs')
    .select('*')
    .eq('company_id', companyId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching nav_sync_logs:', error);
    return;
  }

  console.log(`Found ${logs.length} sync logs for SportsBase.`);
  logs.slice(0, 15).forEach((l, idx) => {
    console.log(`\n[Log ${idx + 1}]:`);
    console.log(`  Started: ${l.started_at}`);
    console.log(`  Type: ${l.sync_type}`);
    console.log(`  Direction: ${l.invoice_direction}`);
    console.log(`  Range: ${l.date_from} to ${l.date_to}`);
    console.log(`  Status: ${l.status}`);
    console.log(`  Invoices fetched: ${l.invoices_fetched}`);
    console.log(`  Error: ${l.error_message || 'None'}`);
  });
}

check();
