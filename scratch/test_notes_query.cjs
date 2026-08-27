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

const supabase = createClient(supabaseUrl, supabaseKey);

async function testNotesQuery() {
  try {
    const companyId = 'ecf31039-b539-4e04-bbea-70ea48c701bb'; // Sample company from earlier query

    const { data: navItemNotes, error: navItemNotesError } = await supabase
      .from('nav_invoice_items')
      .select(`
        id,
        notes,
        created_at,
        nav_invoices!inner(
          id,
          invoice_number,
          supplier_name,
          customer_name,
          invoice_gross_amount,
          invoice_direction,
          currency,
          invoice_issue_date
        )
      `)
      .eq('nav_invoices.company_id', companyId)
      .not('notes', 'is', null);

    if (navItemNotesError) {
      console.error("NAV Item Notes Error:", navItemNotesError);
    } else {
      console.log("NAV Item Notes Success! Count:", navItemNotes.length);
      console.log("NAV Item Notes Sample:", JSON.stringify(navItemNotes, null, 2));
    }

    const { data: itemNotes, error: itemNotesError } = await supabase
      .from('invoice_items')
      .select(`
        id,
        notes,
        created_at,
        invoices!inner(
          id,
          bizonylatsorszam,
          elado_nev,
          brutto_vegosszeg,
          invoice_direction,
          penznem,
          kibocsatas_datuma
        )
      `)
      .eq('invoices.company_id', companyId)
      .not('notes', 'is', null);

    if (itemNotesError) {
      console.error("Item Notes Error:", itemNotesError);
    } else {
      console.log("Item Notes Success! Count:", itemNotes.length);
      console.log("Item Notes Sample:", JSON.stringify(itemNotes, null, 2));
    }

  } catch (err) {
    console.error("Catch Error:", err);
  }
}

testNotesQuery();
