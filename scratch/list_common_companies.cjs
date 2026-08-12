const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabaseAdmin = createClient(url, key);

async function run() {
  const userId = 'e5b822ee-4240-4350-9ebe-a14357d5bd89'; // Balazs

  const { data: members } = await supabaseAdmin
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId);

  const { data: assigns } = await supabaseAdmin
    .from('accounty_assignments')
    .select('company_id')
    .eq('accountant_user_id', userId);

  const memberIds = (members || []).map(m => m.company_id);
  const assignIds = (assigns || []).map(a => a.company_id);

  const commonIds = memberIds.filter(id => assignIds.includes(id));
  console.log("Common company IDs:", commonIds);

  const { data: companies } = await supabaseAdmin
    .from('companies')
    .select('id, name')
    .in('id', commonIds);

  console.log("Common companies name & ID:", companies);
}

run();
