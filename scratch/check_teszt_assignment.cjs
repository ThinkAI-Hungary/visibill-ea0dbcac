const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function run() {
  const { data: assignments, error } = await supabase
    .from('accounty_assignments')
    .select('*')
    .eq('company_id', '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Assignments for 'teszt':");
  assignments.forEach(a => {
    console.log(`- ID: ${a.id}, Accountant ID: ${a.accountant_user_id}, Firm ID: ${a.accounting_firm_id}, Role: ${a.role}, is_main: ${a.is_main_accountant}, is_primary: ${a.is_primary}`);
  });
}

run();
