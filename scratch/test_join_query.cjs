const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envText = fs.readFileSync('c:\\Users\\adetw\\.antigravity\\visibill\\visibill-709fffdf\\.env.local', 'utf8');
const envConfig = {};
envText.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    envConfig[key] = val;
  }
});

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY;

console.log("URL:", supabaseUrl);
console.log("Key Length:", supabaseKey ? supabaseKey.length : 0);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  try {
    const { data, error } = await supabase
      .from('nav_invoice_items')
      .select(`
        project_id,
        net_amount,
        gross_amount,
        nav_invoices!inner(
          id,
          invoice_number,
          supplier_name,
          customer_name,
          invoice_gross_amount,
          invoice_direction,
          currency,
          invoice_issue_date,
          company_id
        )
      `)
      .not('project_id', 'is', null)
      .limit(5);

    if (error) {
      console.error("Query Error:", error);
    } else {
      console.log("Query Success! Data count:", data.length);
      console.log("Sample Data:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Catch Error:", err);
  }
}

testQuery();
