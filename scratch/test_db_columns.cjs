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

async function test() {
  console.log("Checking invoice_items columns...");
  const { data: itemData, error: itemError } = await supabase
    .from('invoice_items')
    .select('id, project_id, notes')
    .limit(1);

  if (itemError) {
    console.error("Error querying invoice_items project_id/notes:", itemError.message);
  } else {
    console.log("Success! Columns exist in invoice_items:", itemData);
  }

  console.log("Checking nav_invoice_items columns...");
  const { data: navData, error: navError } = await supabase
    .from('nav_invoice_items')
    .select('id, project_id, notes')
    .limit(1);

  if (navError) {
    console.error("Error querying nav_invoice_items project_id/notes:", navError.message);
  } else {
    console.log("Success! Columns exist in nav_invoice_items:", navData);
  }

  console.log("Checking if item_project_rules table exists...");
  const { data: ruleData, error: ruleError } = await supabase
    .from('item_project_rules')
    .select('*')
    .limit(1);

  if (ruleError) {
    console.error("Error querying item_project_rules:", ruleError.message);
  } else {
    console.log("Success! item_project_rules table exists:", ruleData);
  }
}

test();
