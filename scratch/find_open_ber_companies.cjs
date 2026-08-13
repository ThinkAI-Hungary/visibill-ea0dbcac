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
  const { data: companies } = await supabase.from('companies').select('id, name');
  const { data: missing, error } = await supabase
    .from('accounty_missing_items')
    .select('id, company_id, category, title, status')
    .eq('category', 'ber')
    .in('status', ['open', 'notified']);

  if (error) {
    console.error(error);
    return;
  }

  const companyMap = {};
  companies.forEach(c => { companyMap[c.id] = c.name; });

  const counts = {};
  missing.forEach(item => {
    if (!counts[item.company_id]) {
      counts[item.company_id] = 0;
    }
    counts[item.company_id]++;
  });

  console.log('Companies with open ber items:');
  Object.entries(counts).forEach(([cid, count]) => {
    console.log(`Company: ${companyMap[cid] || cid} (${cid}) -> Open Ber count: ${count}`);
  });
}

check();
