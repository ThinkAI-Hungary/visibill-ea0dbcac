
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: nav } = await supabase.from('nav_invoices').select('id, supplier_name, invoice_number, invoice_gross_amount').ilike('supplier_name', '%Jámbor%');
  console.log('NAV Invoices:', nav);
  const { data: inv } = await supabase.from('invoices').select('id, elado_nev, bizonylatsorszam, brutto_vegosszeg').ilike('elado_nev', '%Jámbor%');
  console.log('Invoices:', inv);
}
run();

