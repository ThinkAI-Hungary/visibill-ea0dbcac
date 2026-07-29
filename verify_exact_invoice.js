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
  console.log('SportsBase Company ID:', companyId);

  const testInvoices = [
    'E-SPRTS-2026-208',
    'E-SPRTS-2026-229',
    'E-SPRTS-2026-29',
    'E-SPRTS-2026-26',
    'E-SPRTS-2026-11'
  ];

  for (const invNum of testInvoices) {
    const { data: nav } = await supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_gross_amount, invoice_delivery_date')
      .eq('company_id', companyId)
      .eq('invoice_number', invNum);

    const { data: manual } = await supabase
      .from('invoices')
      .select('id, bizonylatsorszam, brutto_vegosszeg, teljesites_datuma')
      .eq('company_id', companyId)
      .eq('bizonylatsorszam', invNum);

    console.log(`\nChecking "${invNum}":`);
    console.log('  In nav_invoices:', nav);
    console.log('  In invoices:', manual);
  }
}

check();
