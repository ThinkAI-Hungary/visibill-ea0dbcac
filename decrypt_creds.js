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
  const companyId = 'b1c19e7d-df9f-4423-a9d0-fa43dea1f5c7';
  const userId = '9b877e10-23f5-4b50-9b45-d1715380a7e1'; // From print_all_nav_creds.js

  const { data, error } = await supabase.rpc('get_nav_credentials', {
    p_user_id: userId,
    p_company_id: companyId
  });

  console.log('Error:', error);
  console.log('Decrypted Creds:', data ? { ...data, nav_password: '***', nav_sign_key: '***', nav_exchange_key: '***' } : 'No data');
  if (data) {
    console.log('Username:', data.nav_username);
    console.log('Tax number:', data.nav_tax_number);
  }
}

check();
