
const fs = require('fs');
const envStr = fs.readFileSync('.env', 'utf-8');
const envVars = Object.fromEntries(envStr.split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split('=').map(s=>s.trim())));
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: nav } = await supabase.from('nav_invoices').select('id, supplier_name, invoice_number, invoice_gross_amount').ilike('supplier_name', '%Jámbor%');
  console.log('NAV Invoices:', nav);
  const { data: inv } = await supabase.from('invoices').select('id, elado_nev, bizonylatsorszam, brutto_vegosszeg').ilike('elado_nev', '%Jámbor%');
  console.log('Invoices:', inv);
}
run();

