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
  const { data: creds, error } = await supabase
    .from('user_nav_credentials')
    .select('*');

  console.log('Error:', error);
  console.log('Number of credentials:', creds ? creds.length : 0);

  const sportsbase = creds.find(c => c.company_id && c.company_id.includes('b1c19e7d'));
  console.log('Found SportsBase row in JS filter:', sportsbase);

  // Now run the eq query
  const { data: eqCreds } = await supabase
    .from('user_nav_credentials')
    .select('*')
    .eq('company_id', 'b1c19e7d-df9f-4423-a9d0-fa43dea1f5c7');

  console.log('Found SportsBase row via eq() query:', eqCreds);
}

check();
