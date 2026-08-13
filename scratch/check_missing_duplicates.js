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
  console.log('Companies:', companies);

  const { data: missing, error } = await supabase
    .from('accounty_missing_items')
    .select('id, company_id, category, title, subtitle, source, status, priority')
    .in('status', ['open', 'notified', 'resolved']);

  if (error) {
    console.error('Error fetching missing items:', error);
    return;
  }

  console.log('Total missing items:', missing.length);
  const grouped = {};
  missing.forEach(item => {
    const key = `${item.company_id}-${item.category}-${item.title}-${item.subtitle}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item.id);
  });

  console.log('Duplicates summary:');
  Object.entries(grouped).forEach(([key, ids]) => {
    if (ids.length > 1) {
      console.log(`Key: ${key} -> Count: ${ids.length}, IDs:`, ids);
    }
  });
}

check();
