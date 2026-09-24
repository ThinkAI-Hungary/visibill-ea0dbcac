import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('./.env.local', 'utf-8');
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

function normalizeInvNum(num) {
  if (!num) return '';
  return String(num).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

async function run() {
  console.log('Fetching all outbound nav_invoices without customer_name (paginated)...');
  let allNavInvs = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data: chunk, error } = await supabase
      .from('nav_invoices')
      .select('id, company_id, invoice_number, invoice_direction, customer_name')
      .eq('invoice_direction', 'OUTBOUND')
      .is('customer_name', null)
      .range(from, to);

    if (error) {
      console.error('Error fetching chunk:', error);
      break;
    }

    if (!chunk || chunk.length === 0) break;
    allNavInvs = allNavInvs.concat(chunk);
    if (chunk.length < pageSize) break;
    page++;
  }

  console.log(`Total outbound nav_invoices without customer_name: ${allNavInvs.length}`);

  const companyIds = [...new Set(allNavInvs.map(i => i.company_id))];
  let totalUpdated = 0;

  for (const compId of companyIds) {
    const compNavInvs = allNavInvs.filter(i => i.company_id === compId);
    
    // Fetch all submitted invoices for this company
    let allSubInvs = [];
    let subPage = 0;
    while (true) {
      const from = subPage * pageSize;
      const to = from + pageSize - 1;
      const { data: subChunk, error: subErr } = await supabase
        .from('invoices')
        .select('id, company_id, bizonylatsorszam, invoice_direction, vevo_nev')
        .eq('company_id', compId)
        .eq('invoice_direction', 'OUTBOUND')
        .not('vevo_nev', 'is', null)
        .range(from, to);

      if (subErr) {
        console.error(`Error fetching submitted invoices for ${compId}:`, subErr);
        break;
      }
      if (!subChunk || subChunk.length === 0) break;
      allSubInvs = allSubInvs.concat(subChunk);
      if (subChunk.length < pageSize) break;
      subPage++;
    }

    const subMap = new Map();
    for (const sub of allSubInvs) {
      if (sub.vevo_nev && sub.vevo_nev.trim()) {
        const key = normalizeInvNum(sub.bizonylatsorszam);
        subMap.set(key, sub);
      }
    }

    for (const nav of compNavInvs) {
      const key = normalizeInvNum(nav.invoice_number);
      const match = subMap.get(key);
      if (match && match.vevo_nev && match.vevo_nev.trim()) {
        console.log(`[${compId.slice(0, 8)}] Matching: ${nav.invoice_number} -> ${match.vevo_nev}`);
        const { error: updErr } = await supabase
          .from('nav_invoices')
          .update({ customer_name: match.vevo_nev.trim() })
          .eq('id', nav.id);

        if (updErr) {
          console.error(`Failed to update ${nav.invoice_number}:`, updErr);
        } else {
          totalUpdated++;
        }
      }
    }
  }

  console.log(`\n=== BACKFILL COMPLETE: ${totalUpdated} customer names updated in nav_invoices ===`);
}

run();
