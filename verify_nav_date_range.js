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
  const { data: companies } = await supabase
    .from('companies')
    .select('id')
    .ilike('name', '%sportsbase%');
  const companyId = companies[0].id;

  const { data: nav } = await supabase
    .from('nav_invoices')
    .select('invoice_number, invoice_direction, invoice_issue_date, invoice_gross_amount, currency')
    .eq('company_id', companyId);

  const outbound = nav.filter(n => n.invoice_direction === 'OUTBOUND');
  const inbound = nav.filter(n => n.invoice_direction === 'INBOUND');

  console.log('=== NAV INVOICE DATE RANGES ===');
  if (outbound.length > 0) {
    const sortedOut = [...outbound].sort((a, b) => a.invoice_issue_date.localeCompare(b.invoice_issue_date));
    console.log(`Outbound Invoices (${outbound.length} total):`);
    console.log(`  Min issue date: ${sortedOut[0].invoice_issue_date} (No: ${sortedOut[0].invoice_number})`);
    console.log(`  Max issue date: ${sortedOut[sortedOut.length - 1].invoice_issue_date} (No: ${sortedOut[sortedOut.length - 1].invoice_number})`);
  } else {
    console.log('No outbound invoices found.');
  }

  if (inbound.length > 0) {
    const sortedIn = [...inbound].sort((a, b) => a.invoice_issue_date.localeCompare(b.invoice_issue_date));
    console.log(`Inbound Invoices (${inbound.length} total):`);
    console.log(`  Min issue date: ${sortedIn[0].invoice_issue_date} (No: ${sortedIn[0].invoice_number})`);
    console.log(`  Max issue date: ${sortedIn[sortedIn.length - 1].invoice_issue_date} (No: ${sortedIn[sortedIn.length - 1].invoice_number})`);
  } else {
    console.log('No inbound invoices found.');
  }

  // Let's print the list of all outbound invoice numbers to see what numbers we have
  console.log('\nAll Outbound Invoice Numbers in DB (sorted):');
  const numbers = outbound.map(n => n.invoice_number).filter(Boolean).sort();
  console.log(`Total numbers: ${numbers.length}`);
  
  // Group by year prefix, e.g. E-SPRTS-2026 vs E-SPRTS-2025
  const groups = {};
  numbers.forEach(num => {
    const match = num.match(/^E-SPRTS-(\d+)/i);
    const prefix = match ? `E-SPRTS-${match[1]}` : 'Other';
    groups[prefix] = (groups[prefix] || 0) + 1;
  });
  console.log('Numbers by prefix:', groups);

  console.log('\nSample E-SPRTS-2026 numbers in DB (first 30):');
  console.log(numbers.filter(num => num.startsWith('E-SPRTS-2026')).slice(0, 30));

  console.log('\nSample E-SPRTS-2026 numbers in DB (last 30):');
  console.log(numbers.filter(num => num.startsWith('E-SPRTS-2026')).slice(-30));
}

check();
