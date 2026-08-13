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
  console.log('Companies count:', companies.length);

  const { data: missing, error } = await supabase
    .from('accounty_missing_items')
    .select('id, company_id, category, title, subtitle, source, status, priority, created_at')
    .eq('category', 'ber');

  if (error) {
    console.error('Error fetching missing items:', error);
    return;
  }

  console.log('Total items in DB with category ber:', missing.length);
  const byCompany = {};
  missing.forEach(item => {
    if (!byCompany[item.company_id]) byCompany[item.company_id] = [];
    byCompany[item.company_id].push(item);
  });

  const companyMap = {};
  companies.forEach(c => { companyMap[c.id] = c.name; });

  Object.entries(byCompany).forEach(([cid, items]) => {
    const name = companyMap[cid] || cid;
    console.log(`Company: ${name} (${cid}) -> Total ber items: ${items.length}`);
    const openOrNotified = items.filter(mi => mi.status === 'open' || mi.status === 'notified');
    const resolved = items.filter(mi => mi.status === 'resolved');
    console.log(`  Open/Notified: ${openOrNotified.length}, Resolved: ${resolved.length}`);
    openOrNotified.forEach((item, i) => {
      console.log(`    Open item ${i+1}: ${item.title} (${item.id})`);
    });
  });
}

check();
