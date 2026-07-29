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

  // Count by direction
  const { data: counts, error } = await supabase
    .from('nav_invoices')
    .select('direction, id')
    .eq('company_id', companyId);

  if (error) {
    console.error('Error fetching nav_invoices:', error);
    return;
  }

  const directions = {};
  counts.forEach(row => {
    directions[row.direction] = (directions[row.direction] || 0) + 1;
  });
  console.log('NAV Invoices Count by Direction:', directions);

  // Fetch some outbound invoice numbers
  const { data: outbounds } = await supabase
    .from('nav_invoices')
    .select('invoice_number, direction, invoice_gross_amount, invoice_issue_date')
    .eq('company_id', companyId)
    .eq('direction', 'OUTBOUND')
    .order('invoice_issue_date', { ascending: false })
    .limit(20);

  console.log('\nSample OUTBOUND NAV Invoices in DB:');
  console.log(outbounds);

  // Fetch some inbound invoice numbers
  const { data: inbounds } = await supabase
    .from('nav_invoices')
    .select('invoice_number, direction, invoice_gross_amount, invoice_issue_date')
    .eq('company_id', companyId)
    .eq('direction', 'INBOUND')
    .order('invoice_issue_date', { ascending: false })
    .limit(20);

  console.log('\nSample INBOUND NAV Invoices in DB:');
  console.log(inbounds);
}

check();
