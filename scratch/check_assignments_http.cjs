const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function run() {
  const { data: assignments, error } = await supabase
    .from('accounty_assignments')
    .select('*, companies:companies!accounty_assignments_company_id_fkey(name)')
    .eq('accountant_user_id', 'e5b822ee-4240-4350-9ebe-a14357d5bd89');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log(`Assignments for Balázs Lederer (length: ${assignments.length}):`);
  assignments.forEach(a => {
    console.log(`- Company ID: ${a.company_id}, Name: ${a.companies ? a.companies.name : 'N/A'}, Role: ${a.role}, is_main: ${a.is_main_accountant}`);
  });
}

run();
