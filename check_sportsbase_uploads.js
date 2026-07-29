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
  const companyId = 'b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7';

  // Query uploads
  const { data: uploads, error: err } = await supabase
    .from('transaction_uploads')
    .select('id, file_name, metadata, detected_bank, created_at')
    .eq('company_id', companyId);

  console.log('Error:', err);
  console.log(`Found ${uploads ? uploads.length : 0} uploads for SportsBase.`);

  if (uploads) {
    for (const u of uploads) {
      // Get transaction currency counts for this upload
      const { data: txs } = await supabase
        .from('transactions')
        .select('currency, amount')
        .eq('upload_id', u.id);

      const currencies = {};
      let totalAmount = 0;
      if (txs) {
        txs.forEach(t => {
          currencies[t.currency || 'HUF'] = (currencies[t.currency || 'HUF'] || 0) + 1;
        });
      }

      console.log(`\nUpload ID: ${u.id}`);
      console.log(`  File name: ${u.file_name}`);
      console.log(`  Created: ${u.created_at}`);
      console.log(`  Detected bank: ${u.detected_bank}`);
      console.log(`  Metadata:`, u.metadata);
      console.log(`  Transactions count: ${txs ? txs.length : 0}, Currencies:`, currencies);
    }
  }
}

check();
