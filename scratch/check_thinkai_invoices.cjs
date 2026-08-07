const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
  const companyId = 'ecf31039-b539-4e04-bbea-70ea48c701bb'; // Think Ai Kft
  
  const { data: codes, error } = await supabase
    .from('vat_codes')
    .select('*')
    .eq('company_id', companyId);

  console.log('VAT codes:', codes, 'Error:', error);
}

check();
