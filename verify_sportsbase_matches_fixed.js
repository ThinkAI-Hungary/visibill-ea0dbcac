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

  if (!companies || companies.length === 0) {
    console.log('Company not found');
    return;
  }
  const companyId = companies[0].id;
  console.log('Company ID found:', companyId);

  // 1. Get transactions
  const { data: txs, error: txErr } = await supabase
    .from('transactions')
    .select('id, amount, currency, transaction_date, description, matched_invoice_id, match_type, is_verified, type')
    .eq('company_id', companyId);

  if (txErr) {
    console.error('Tx error:', txErr);
    return;
  }

  // 2. Get NAV invoices
  const { data: nav, error: navErr } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_direction, invoice_gross_amount, currency, transaction_id, invoice_issue_date, supplier_name, customer_name')
    .eq('company_id', companyId);

  if (navErr) {
    console.error('NAV error:', navErr);
    return;
  }

  // 3. Get manual/submitted invoices
  const { data: manual, error: manErr } = await supabase
    .from('invoices')
    .select('id, bizonylatsorszam, brutto_vegosszeg, transaction_id, kibocsatas_datuma, elado_nev, penznem')
    .eq('company_id', companyId);

  if (manErr) {
    console.error('Manual error:', manErr);
    return;
  }

  console.log('=== SPORTSBASE MATCHING STATS ===');
  console.log('Total Transactions:', txs.length);
  const matchedTxs = txs.filter(t => t.matched_invoice_id !== null);
  console.log('Matched Transactions:', matchedTxs.length);
  console.log('Unmatched Transactions:', txs.length - matchedTxs.length);

  const incomingTxs = txs.filter(t => t.amount > 0);
  const outgoingTxs = txs.filter(t => t.amount < 0);
  console.log(`  Incoming (Revenue/Deposits) count: ${incomingTxs.length} (Matched: ${incomingTxs.filter(t => t.matched_invoice_id !== null).length})`);
  console.log(`  Outgoing (Expense/Payments) count: ${outgoingTxs.length} (Matched: ${outgoingTxs.filter(t => t.matched_invoice_id !== null).length})`);

  console.log('\nTotal NAV Invoices:', nav.length);
  const inbound = nav.filter(n => n.invoice_direction === 'INBOUND');
  const outbound = nav.filter(n => n.invoice_direction === 'OUTBOUND');
  console.log(`  INBOUND (Expenses) count: ${inbound.length} (Matched to tx: ${inbound.filter(n => n.transaction_id !== null).length})`);
  console.log(`  OUTBOUND (Revenue) count: ${outbound.length} (Matched to tx: ${outbound.filter(n => n.transaction_id !== null).length})`);

  console.log('\nTotal Submitted Invoices (manual):', manual.length);
  console.log(`  Matched to tx: ${manual.filter(m => m.transaction_id !== null).length}`);

  // Let's analyze unmatched incoming transactions vs unmatched outbound NAV invoices
  console.log('\n=== ANALYZING UNMATCHED INCOMING TRANSACTIONS vs UNMATCHED OUTBOUND NAV INVOICES ===');
  const unmatchedIncomingTxs = incomingTxs.filter(t => t.matched_invoice_id === null);
  const unmatchedOutboundNav = outbound.filter(n => n.transaction_id === null);
  console.log(`Unmatched Incoming Transactions: ${unmatchedIncomingTxs.length}`);
  console.log(`Unmatched Outbound NAV Invoices: ${unmatchedOutboundNav.length}`);

  // Let's run a comparison to find match candidates by amount
  let directMatchesFound = 0;
  unmatchedIncomingTxs.forEach(t => {
    const tAmt = t.amount;
    const tDate = new Date(t.transaction_date);
    const candidates = unmatchedOutboundNav.filter(n => {
      // Allow +/- 2 tolerance on amount, same currency
      const amtMatch = Math.abs(n.invoice_gross_amount - tAmt) < 5 && n.currency === t.currency;
      if (!amtMatch) return false;
      
      // Let's check date: transaction date should be on or after invoice issue date, within 90 days
      const nDate = new Date(n.invoice_issue_date);
      const dateDiffDays = (tDate.getTime() - nDate.getTime()) / (1000 * 60 * 60 * 24);
      return dateDiffDays >= -2 && dateDiffDays <= 120; // 4 months window
    });

    if (candidates.length > 0) {
      directMatchesFound++;
      if (directMatchesFound <= 10) {
        console.log(`\nTransaction: Date: ${t.transaction_date}, Amount: ${t.amount} ${t.currency}, Desc: "${t.description.substring(0, 120)}"`);
        console.log(`  Potential Outbound Invoice Candidates:`);
        candidates.forEach(c => {
          console.log(`    - Invoice ${c.invoice_number}, Issue Date: ${c.invoice_issue_date}, Gross: ${c.invoice_gross_amount} ${c.currency}, Customer: "${c.customer_name}"`);
        });
      }
    }
  });
  console.log(`\nTransactions with potential Outbound NAV Invoice matches by amount & currency & date: ${directMatchesFound}`);
}

check();
