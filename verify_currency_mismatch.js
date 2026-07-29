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

  // Query transactions
  const { data: txs } = await supabase
    .from('transactions')
    .select('amount, currency, transaction_date')
    .eq('company_id', companyId);

  // Query NAV invoices
  const { data: nav } = await supabase
    .from('nav_invoices')
    .select('invoice_gross_amount, currency, invoice_issue_date, invoice_direction')
    .eq('company_id', companyId);

  const incoming = txs.filter(t => t.amount > 0);
  const outbound = nav.filter(n => n.invoice_direction === 'OUTBOUND');

  console.log('Incoming Transactions Currencies:');
  const txCurrs = {};
  incoming.forEach(t => {
    txCurrs[t.currency || 'HUF'] = (txCurrs[t.currency || 'HUF'] || 0) + 1;
  });
  console.log(txCurrs);

  console.log('\nOutbound NAV Invoices Currencies:');
  const navCurrs = {};
  outbound.forEach(n => {
    navCurrs[n.currency || 'HUF'] = (navCurrs[n.currency || 'HUF'] || 0) + 1;
  });
  console.log(navCurrs);

  console.log('\nSample Outbound NAV Invoices (HUF vs EUR):');
  console.log('HUF:', outbound.filter(n => n.currency === 'HUF').slice(0, 5).map(n => ({ num: n.invoice_number, amt: n.invoice_gross_amount, date: n.invoice_issue_date })));
  console.log('EUR:', outbound.filter(n => n.currency === 'EUR').slice(0, 5).map(n => ({ num: n.invoice_number, amt: n.invoice_gross_amount, date: n.invoice_issue_date })));
  console.log('USD:', outbound.filter(n => n.currency === 'USD').slice(0, 5).map(n => ({ num: n.invoice_number, amt: n.invoice_gross_amount, date: n.invoice_issue_date })));
}

check();
