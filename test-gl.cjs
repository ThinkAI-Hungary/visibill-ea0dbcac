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
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envConfig['VITE_SUPABASE_URL'], envConfig['VITE_SUPABASE_PUBLISHABLE_KEY']);
async function run() {
  const { data } = await supabase.from('chart_of_accounts_presets').select('id, name, type, is_active');
  console.log('Presets:', data);
  const { data: items } = await supabase.from('nav_invoice_items').select('id, gl_classifications').limit(3).not('gl_classifications', 'is', null);
  console.log('Classifications:', JSON.stringify(items, null, 2));
}
run();
