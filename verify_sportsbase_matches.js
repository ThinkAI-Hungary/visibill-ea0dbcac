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
      envVars[key] = val.replace(/\r$/, '');
    }
  }
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_KEY);

async function check() {
  const companyId = 'b1c19c7d-df9f-4423-a9d0-fa43dea1f5c7';

  // 1. Get transactions matching stats
  const { data: txs } = await supabase
    .from('transactions')
    .select('id, amount, currency, transaction_date, description, matched_invoice_id')
    .eq('company_id', companyId);

  const matchedTxs = txs.filter(t => t.matched_invoice_id !== null);
  console.log('Total Transactions:', txs.length);
  console.log('Matched Transactions:', matchedTxs.length);

  // 2. Get NAV invoices and their matching stats
  const { data: nav } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_direction, invoice_gross_amount, currency, transaction_id, invoice_issue_date')
    .eq('company_id', companyId);

  const inbound = nav.filter(n => n.invoice_direction === 'INBOUND');
  const outbound = nav.filter(n => n.invoice_direction === 'OUTBOUND');

  console.log('\nTotal NAV Invoices:', nav.length);
  console.log('  INBOUND count:', inbound.length);
  console.log('    Matched:', inbound.filter(n => n.transaction_id !== null).length);
  console.log('  OUTBOUND count:', outbound.length);
  console.log('    Matched:', outbound.filter(n => n.transaction_id !== null).length);

  // 3. Get manual/submitted invoices
  const { data: manual } = await supabase
    .from('invoices')
    .select('id, bizonylatsorszam, brutto_vegosszeg, transaction_id, kibocsatas_datuma')
    .eq('company_id', companyId);

  console.log('\nTotal Manual/Submitted Invoices:', manual.length);
  console.log('  Matched:', manual.filter(m => m.transaction_id !== null).length);

  // Let's check some OUTBOUND invoices and look for corresponding transactions in DB!
  console.log('\nAnalyzing unmatched OUTBOUND invoices to find potential transactions by amount:');
  const unmatchedOutbound = outbound.filter(n => n.transaction_id === null);

  let checked = 0;
  for (const inv of unmatchedOutbound) {
    if (checked >= 10) break;
    const invAmt = inv.invoice_gross_amount;
    const invCcy = inv.currency;
    const invDateStr = inv.invoice_issue_date;

    // Find any transaction with matching amount (positive since it's outbound revenue, money incoming)
    // Wait, outbound invoice means we receive money, so transaction amount should be positive.
    const potentialTxs = txs.filter(t => {
      return Math.abs(t.amount - invAmt) < 2 && t.currency === invCcy && t.matched_invoice_id === null;
    });

    if (potentialTxs.length > 0) {
      checked++;
      console.log(`\nUnmatched Outbound Invoice: ${inv.invoice_number}`);
      console.log(`  Issue Date: ${invDateStr}`);
      console.log(`  Amount: ${invAmt} ${invCcy}`);
      console.log(`  Potential matching transactions (by amount):`);
      potentialTxs.forEach(t => {
        console.log(`    - ID: ${t.id}, Date: ${t.transaction_date}, Amount: ${t.amount} ${t.currency}, Desc: "${t.description.substring(0, 100)}"`);
      });
    }
  }
}

check();
