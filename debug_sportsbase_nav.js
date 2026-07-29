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
  // Let's find SportsBase company id
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%sportsbase%');
  
  if (!companies || companies.length === 0) {
    console.log('Company not found');
    return;
  }
  const companyId = companies[0].id;
  console.log('Company ID found:', companyId);

  // Get count
  const { data: navInvs, error } = await supabase
    .from('nav_invoices')
    .select('*')
    .eq('company_id', companyId);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Total nav_invoices found:', navInvs.length);
  if (navInvs.length > 0) {
    console.log('Sample row structure:', Object.keys(navInvs[0]));
    console.log('Sample row direction:', navInvs[0].invoice_direction);
    
    // Group by direction
    const dirs = {};
    navInvs.forEach(r => {
      dirs[r.invoice_direction] = (dirs[r.invoice_direction] || 0) + 1;
    });
    console.log('Directions group:', dirs);

    // Let's print the first 5 row numbers and amounts
    console.log('First 5 invoice numbers:');
    navInvs.slice(0, 5).forEach(r => {
      console.log(`  - ${r.invoice_number} | ${r.invoice_direction} | ${r.invoice_gross_amount} | ${r.invoice_issue_date}`);
    });
  }
}

check();
