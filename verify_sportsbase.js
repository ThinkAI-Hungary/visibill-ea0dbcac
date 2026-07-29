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

const supabaseUrl = envVars.SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  console.log('Searching for SportsBase company...');
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%sportsbase%');

  if (compError) {
    console.error('Error finding company:', compError);
    process.exit(1);
  }

  if (companies.length === 0) {
    console.log('No company found matching "sportsbase".');
    process.exit(0);
  }

  console.log('Found companies:', companies);
  const company = companies[0];
  const companyId = company.id;

  // Query transactions
  console.log('\nQuerying transactions for company...');
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId);

  if (txError) {
    console.error('Error querying transactions:', txError);
    process.exit(1);
  }

  console.log(`Total transactions found: ${txs.length}`);

  // Count matches
  const matchedTxs = txs.filter(t => t.matched_invoice_id !== null);
  console.log(`Transactions matched directly (matched_invoice_id): ${matchedTxs.length}`);

  // Query transaction matches table
  const { data: links, error: linkError } = await supabase
    .from('transaction_invoice_matches')
    .select('*')
    .in('transaction_id', txs.map(t => t.id).slice(0, 1000)); // batching if needed

  const linkCount = linkError ? 0 : links.length;
  console.log(`Transactions matched via transaction_invoice_matches table: ${linkCount}`);

  // Query invoices
  console.log('\nQuerying submitted invoices...');
  const { data: invs, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId);

  if (invError) {
    console.error('Error querying invoices:', invError);
    process.exit(1);
  }
  console.log(`Total submitted invoices (manual/email): ${invs.length}`);

  // Query NAV invoices
  console.log('\nQuerying NAV invoices...');
  const { data: navInvs, error: navError } = await supabase
    .from('nav_invoices')
    .select('*')
    .eq('company_id', companyId);

  if (navError) {
    console.error('Error querying NAV invoices:', navError);
    process.exit(1);
  }
  console.log(`Total NAV invoices: ${navInvs.length}`);

  // Let's analyze a few unmatched transactions to see why they don't match
  console.log('\nAnalyzing unmatched transactions...');
  const unmatched = txs.filter(t => t.matched_invoice_id === null);
  
  // Find matches by amount or description keywords in invoices
  console.log('\nSample unmatched transactions with potential matching candidates:');
  
  let checked = 0;
  for (const t of unmatched) {
    if (checked >= 10) break;
    const tAmtAbs = Math.abs(t.amount);
    
    // Find invoices with same amount (or very close)
    const matchingInvs = invs.filter(i => {
      const iAmt = i.brutto_vegosszeg || i.total_amount;
      return iAmt && Math.abs(Math.abs(iAmt) - tAmtAbs) < 5;
    });

    const matchingNavInvs = navInvs.filter(ni => {
      const niAmt = ni.invoice_gross_amount;
      return niAmt && Math.abs(Math.abs(niAmt) - tAmtAbs) < 5;
    });

    if (matchingInvs.length > 0 || matchingNavInvs.length > 0) {
      checked++;
      console.log(`\nTransaction ID: ${t.id}`);
      console.log(`  Date: ${t.transaction_date}`);
      console.log(`  Desc: ${t.description}`);
      console.log(`  Amount: ${t.amount} ${t.currency}`);
      
      if (matchingInvs.length > 0) {
        console.log(`  Potential Submitted Invoice candidates (by amount):`);
        matchingInvs.forEach(i => {
          console.log(`    - ID: ${i.id}, No: ${i.bizonylatsorszam}, Partner: ${i.elado_nev}, Date: ${i.kibocsatas_datuma || i.teljesites_datuma}, Amount: ${i.brutto_vegosszeg} ${i.penznem}`);
        });
      }
      if (matchingNavInvs.length > 0) {
        console.log(`  Potential NAV Invoice candidates (by amount):`);
        matchingNavInvs.forEach(ni => {
          console.log(`    - ID: ${ni.id}, No: ${ni.invoice_number}, Partner: ${ni.supplier_name || ni.customer_name}, Date: ${ni.invoice_delivery_date || ni.invoice_issue_date}, Amount: ${ni.invoice_gross_amount} ${ni.currency}`);
        });
      }
    }
  }
}

analyze();
