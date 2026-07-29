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
  const rowId = '4d535c1e-1533-4772-9118-e8375da549d5';
  const userId = '9b877e10-23f5-4b50-9b45-d1715380a7e1';
  const companyId = 'b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7';

  const { data: byId, error: errId } = await supabase
    .from('user_nav_credentials')
    .select('*')
    .eq('id', rowId);
  console.log('Query by id:', byId, errId);

  const { data: byUser, error: errUser } = await supabase
    .from('user_nav_credentials')
    .select('*')
    .eq('user_id', userId);
  console.log('Query by user_id:', byUser, errUser);

  const { data: byCompany, error: errComp } = await supabase
    .from('user_nav_credentials')
    .select('*')
    .eq('company_id', companyId);
  console.log('Query by company_id:', byCompany, errComp);
}

check();
