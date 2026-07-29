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
  const ids = [
    'f4db33eb-6b40-4737-8cdd-fe79eb9904a0', // password
    '697fd884-2a39-4dc3-bc7e-38e3523ce332', // sign_key
    '67c06a97-8147-44e0-971c-1f7a0decfadd'  // exchange_key
  ];

  const { data, error } = await supabase
    .from('vault.decrypted_secrets') // Query the schema-qualified table
    .select('*')
    .in('id', ids);

  console.log('Error:', error);
  console.log('Decrypted secrets from vault:', data);
}

check();
