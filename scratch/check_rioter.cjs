const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabaseAdmin = createClient(url, key);

async function run() {
  const userId = 'e5b822ee-4240-4350-9ebe-a14357d5bd89'; // Balazs

  // Find Rioter company
  const { data: companies, error: compError } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .ilike('name', '%rioter%');

  if (compError) {
    console.error("Error finding companies:", compError);
    return;
  }

  console.log("Rioter companies:", companies);

  for (const c of companies) {
    // Check eaisybill access
    const { data: memberData } = await supabaseAdmin
      .from('company_members')
      .select('id, role')
      .eq('company_id', c.id)
      .eq('user_id', userId);
    
    // Check eaisybooks access
    const { data: assignData } = await supabaseAdmin
      .from('accounty_assignments')
      .select('id, role')
      .eq('company_id', c.id)
      .eq('accountant_user_id', userId);

    console.log(`Company: ${c.name} (${c.id})`);
    console.log(`  eaisybill (company_members):`, memberData);
    console.log(`  eaisybooks (accounty_assignments):`, assignData);
  }
}

run();
