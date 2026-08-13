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
  const { data: missing, error } = await supabase
    .from('accounty_missing_items')
    .select('id, company_id, category, title, subtitle, status, item_date')
    .eq('category', 'ber')
    .in('status', ['open', 'notified']);

  if (error) {
    console.error('Error fetching items:', error);
    return;
  }

  console.log('Total open ber items fetched:', missing.length);

  // Group by company_id + category + title + item_date
  const grouped = {};
  missing.forEach(item => {
    const key = `${item.company_id}_${item.category}_${item.title}_${item.item_date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item.id);
  });

  const toDelete = [];
  Object.entries(grouped).forEach(([key, ids]) => {
    if (ids.length > 1) {
      // Keep the first one, delete the rest
      toDelete.push(...ids.slice(1));
    }
  });

  console.log('Number of duplicates to delete:', toDelete.length);

  if (toDelete.length > 0) {
    let deletedCount = 0;
    // Delete in batches of 50
    for (let i = 0; i < toDelete.length; i += 50) {
      const batch = toDelete.slice(i, i + 50);
      const { error: delErr } = await supabase
        .from('accounty_missing_items')
        .delete()
        .in('id', batch);

      if (delErr) {
        console.error('Error deleting batch:', delErr);
      } else {
        deletedCount += batch.length;
      }
    }
    console.log(`Successfully deleted ${deletedCount} duplicate open items from database!`);
  } else {
    console.log('No duplicates found.');
  }
}

check();
