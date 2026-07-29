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
  const uploadId = '1d0f8696-0611-440c-9d7e-18f69f36665d';

  const { data, error } = await supabase
    .from('transaction_uploads')
    .select('*')
    .eq('id', uploadId)
    .maybeSingle();

  console.log('Error:', error);
  console.log('Upload record:', data);
}

check();
