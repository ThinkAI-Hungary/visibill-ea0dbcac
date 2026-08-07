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
  
  const { data: inbound, error: errIn } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_delivery_date, invoice_gross_amount, supplier_name, customer_name')
    .eq('company_id', companyId)
    .eq('invoice_direction', 'INBOUND')
    .gte('invoice_delivery_date', '2025-01-01')
    .lte('invoice_delivery_date', '2025-12-31');

  const { data: outbound, error: errOut } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_delivery_date, invoice_gross_amount, supplier_name, customer_name')
    .eq('company_id', companyId)
    .eq('invoice_direction', 'OUTBOUND')
    .gte('invoice_delivery_date', '2025-01-01')
    .lte('invoice_delivery_date', '2025-12-31');

  console.log('Inbound count:', inbound ? inbound.length : 0, 'Error:', errIn);
  console.log('Outbound count:', outbound ? outbound.length : 0, 'Error:', errOut);
  
  if (inbound && inbound.length > 0) {
    console.log('Sample inbound:', inbound.slice(0, 5));
  }
  if (outbound && outbound.length > 0) {
    console.log('Sample outbound:', outbound.slice(0, 5));
  }
}

check();
