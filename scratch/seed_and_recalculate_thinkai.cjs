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
  
  // Keep only BE_27_LEV (domestic) and OUTBOUND codes, delete the others to see realistic result
  console.log('Cleaning up duplicate active VAT codes...');
  const { error: deleteErr } = await supabase
    .from('vat_codes')
    .delete()
    .eq('company_id', companyId)
    .in('code', ['EU_SZOLG_BE', 'EU_TERM_27', 'HARM_SZOLG']);

  console.log('Delete error:', deleteErr);

  // Recalculate VAT return
  console.log('Recalculating VAT return for 2025 (frequency E)...');
  const { data: returnId, error: errCalc } = await supabase.rpc('calculate_vat_return', {
    p_company_id: companyId,
    p_year: 2025,
    p_month: 12,
    p_frequency: 'E'
  });
  console.log('calculate_vat_return returned ID:', returnId, 'Error:', errCalc);

  // Fetch the resulting VAT return values
  const { data: returns } = await supabase
    .from('vat_returns')
    .select('*')
    .eq('company_id', companyId)
    .eq('period_year', 2025)
    .eq('frequency', 'E');

  console.log('VAT returns:', returns);

  if (returns && returns.length > 0) {
    const { data: lines } = await supabase
      .from('vat_return_lines')
      .select('*')
      .eq('vat_return_id', returns[0].id);

    console.log('Non-zero Lines:', lines ? lines.filter(l => l.base_amount !== 0 || l.tax_amount !== 0) : []);
  }
}

check();
