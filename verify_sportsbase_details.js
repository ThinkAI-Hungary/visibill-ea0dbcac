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
  // Find SportsBase company
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .ilike('name', '%sportsbase%');

  const companyId = companies[0].id;

  // Query all transactions
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId);

  // We want to extract potential invoice numbers from transaction descriptions
  // e.g. "E-SPRTS-2026-208" or "E SPRTS 2026 208" or similar
  const pattern = /(?:E[- ]?SPRTS[- ]?2026[- ]?\d+|E[- ]?SPRTS[- ]?2025[- ]?\d+|INV-\d+|\b\d+\/2026\b)/gi;

  console.log('Analyzing transaction references...');
  let referencedCount = 0;
  let referencedFoundInDb = 0;
  let matchAnalysis = [];

  for (const t of txs) {
    const matches = t.description.match(pattern);
    if (matches) {
      referencedCount++;
      const refRaw = matches[0];
      // Normalize reference: e.g. "E SPRTS 2026 208" -> "E-SPRTS-2026-208"
      let refClean = refRaw.toUpperCase().replace(/\s+/g, '-');
      if (refClean.startsWith('E-SPRTS') && !refClean.startsWith('E-SPRTS-')) {
        refClean = refClean.replace('E-SPRTS', 'E-SPRTS-');
      }
      // Also construct variants
      const variants = [refRaw, refClean, refClean.replace(/-/g, ' '), refClean.replace(/-/g, '')];

      // Query database for this invoice number
      const { data: navInvs } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_gross_amount, invoice_delivery_date, company_id')
        .eq('company_id', companyId)
        .or(`invoice_number.ilike.%${refClean}%,invoice_number.ilike.%${refRaw}%`);

      const { data: manualInvs } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, brutto_vegosszeg, teljesites_datuma, company_id')
        .eq('company_id', companyId)
        .or(`bizonylatsorszam.ilike.%${refClean}%,bizonylatsorszam.ilike.%${refRaw}%`);

      const found = (navInvs && navInvs.length > 0) || (manualInvs && manualInvs.length > 0);
      if (found) {
        referencedFoundInDb++;
      }

      matchAnalysis.push({
        txId: t.id,
        txDate: t.transaction_date,
        txDesc: t.description,
        txAmount: t.amount,
        txCurrency: t.currency,
        refRaw,
        refClean,
        matchedInDb: t.matched_invoice_id !== null,
        foundInDb: found,
        navInvs: navInvs || [],
        manualInvs: manualInvs || []
      });
    }
  }

  console.log(`\nTransactions with invoice references in description: ${referencedCount}`);
  console.log(`Of those, referenced invoice is actually found in DB (nav_invoices or invoices): ${referencedFoundInDb}`);
  console.log(`Of those, already matched: ${matchAnalysis.filter(m => m.matchedInDb).length}`);

  console.log('\n--- Match Diagnostic Analysis (Ref found in DB but unmatched) ---');
  const candidates = matchAnalysis.filter(m => m.foundInDb && !m.matchedInDb);
  console.log(`Number of transactions where the referenced invoice is in the DB but they are NOT matched: ${candidates.length}`);

  candidates.slice(0, 10).forEach((c, idx) => {
    console.log(`\n[${idx + 1}] Transaction:`);
    console.log(`    Date: ${c.txDate}`);
    console.log(`    Desc: ${c.txDesc}`);
    console.log(`    Amount: ${c.txAmount} ${c.txCurrency}`);
    console.log(`    Extracted Ref: ${c.refClean} (raw: "${c.refRaw}")`);
    
    if (c.navInvs.length > 0) {
      console.log(`    NAV Invoices in DB:`);
      c.navInvs.forEach(ni => {
        console.log(`      - ID: ${ni.id}, No: ${ni.invoice_number}, Amount: ${ni.invoice_gross_amount} HUF, Date: ${ni.invoice_delivery_date}`);
      });
    }
    if (c.manualInvs.length > 0) {
      console.log(`    Manual Invoices in DB:`);
      c.manualInvs.forEach(i => {
        console.log(`      - ID: ${i.id}, No: ${i.bizonylatsorszam}, Amount: ${i.brutto_vegosszeg} HUF/EUR, Date: ${i.teljesites_datuma}`);
      });
    }
  });

  console.log('\n--- Analysis of Refs NOT found in DB ---');
  const notFound = matchAnalysis.filter(m => !m.foundInDb);
  console.log(`Number of transactions where referenced invoice is NOT found in DB: ${notFound.length}`);
  console.log('Sample missing invoices (from transaction description):');
  notFound.slice(0, 10).forEach(n => {
    console.log(`  - Ref: ${n.refClean} (Tx date: ${n.txDate}, Desc: "${n.txDesc.substring(0, 80)}...")`);
  });
}

analyze();
