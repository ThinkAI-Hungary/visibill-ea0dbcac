const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env file manually
const envContent = fs.readFileSync('c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/.env.local', 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    envConfig[key] = val;
  }
});

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const matchedInvoiceId = "f05796dc-36ab-468b-8e7f-9978692fd726";
  
  console.log("--- Testing submitted query ---");
  const { data: submitted, error: subErr } = await supabase
    .from('invoices')
    .select('id, bizonylatsorszam, kibocsatas_datuma, teljesites_datuma, elado_nev, vevo_nev, adoalap_osszesen, brutto_vegosszeg, afa_osszeg_osszesen, penznem, image_url, melleklet_url, invoice_type, reference_number, fizetesi_mod')
    .eq('id', matchedInvoiceId)
    .maybeSingle();
  console.log("Submitted:", submitted, "Error:", subErr);
}

main();
