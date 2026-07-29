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
      const val = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1').replace(/\r/g, '');
      envVars[key] = val;
    }
  }
});

const supabase = createClient(envVars.SUPABASE_URL, envVars.SUPABASE_SERVICE_KEY);

async function check() {
  const ids = [
    'b1c19c7d-df9f-4423-a9d0-fa43dea1f5c7',
    'b1c19e7d-df9f-4423-a9d0-fa43dea1f5c7'
  ];

  for (const id of ids) {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', id)
      .maybeSingle();

    console.log(`Checking Company ID "${id}":`, data, error);
  }
}

check();
