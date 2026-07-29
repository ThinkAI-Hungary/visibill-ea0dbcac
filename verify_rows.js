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
  const companyId = 'b1c19c7d-df9f-4423-a9d0-fa43dea1f5c7';

  const { data: nav, error: navError } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_direction, company_id')
    .eq('company_id', companyId)
    .limit(5);

  console.log('Nav Invoices Error:', navError);
  console.log('Nav Invoices data:', nav);

  const { data: countData, error: countError } = await supabase
    .from('nav_invoices')
    .select('id', { count: 'exact' })
    .eq('company_id', companyId);

  console.log('Total nav_invoices for SportsBase:', countData ? countData.length : 0, countError);
}

check();
