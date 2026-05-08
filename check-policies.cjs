const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envStr = fs.readFileSync('.env', 'utf-8');
const envConfig = {};
envStr.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      else if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
      envConfig[key] = val;
    }
  }
});

const supabase = createClient(envConfig['VITE_SUPABASE_URL'], envConfig['VITE_SUPABASE_SERVICE_ROLE_KEY']);

async function run() {
  const { data, error } = await supabase.rpc('get_policies');
  if (error) {
    console.log('Cant run RPC get_policies, trying pg_policies directly...');
  }
}
run();
