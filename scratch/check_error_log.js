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
  const fileName = "D'Addario";
  const tables = [
    'invoice_uploads',
    'transaction_uploads',
    'report_uploads',
    'bank_statement_uploads',
    'gl_upload_notifications'
  ];

  console.log(`Searching for file: ${fileName} across upload tables...`);

  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .ilike('file_name', `%${fileName}%`);

    if (error) {
      console.error(`Error querying ${table}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`FOUND in ${table}!`);
      console.log(data);
      return;
    }
  }

  console.log('File not found in any upload table.');
}

check();
