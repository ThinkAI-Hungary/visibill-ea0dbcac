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
      counts[item.company_id] = { total: 0, ber: 0, bejovo: 0, kimeno: 0, bank: 0 };
    }
    counts[item.company_id].total++;
    if (item.category === 'ber') counts[item.company_id].ber++;
    if (item.category === 'bejovo') counts[item.company_id].bejovo++;
    if (item.category === 'kimeno') counts[item.company_id].kimeno++;
    if (item.category === 'bank') counts[item.company_id].bank++;
  });

  const sorted = Object.entries(counts).map(([cid, data]) => ({
    companyId: cid,
    name: companyMap[cid] || cid,
    ...data
  })).sort((a, b) => b.total - a.total);

  console.log('Open items per company:');
  sorted.forEach(c => {
    console.log(`Company: ${c.name} (${c.companyId}) -> Total: ${c.total}, Ber: ${c.ber}, Bejovo: ${c.bejovo}, Kimeno: ${c.kimeno}, Bank: ${c.bank}`);
  });
}

check();
