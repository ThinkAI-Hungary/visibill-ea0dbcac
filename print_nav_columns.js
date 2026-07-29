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
  const { data, error } = await supabase
    .from('nav_invoices')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else {
    console.log('Sample row from nav_invoices:', data[0] ? Object.keys(data[0]) : 'No data');
    console.log('Full sample row:', data[0]);
  }
}

check();
