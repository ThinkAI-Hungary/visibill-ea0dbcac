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
  const companyId = 'b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7';

  const { data, error } = await supabase
    .from('nav_invoices')
    .select('invoice_number, fetched_at, created_at, invoice_issue_date')
    .eq('company_id', companyId)
    .order('fetched_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
  } else {
    console.log(`Total nav_invoices found: ${data.length}`);
    console.log('Sample fetched_at dates:');
    data.slice(0, 10).forEach(r => {
      console.log(`  - No: ${r.invoice_number} | Issue: ${r.invoice_issue_date} | Fetched: ${r.fetched_at} | Created: ${r.created_at}`);
    });
  }
}

check();
