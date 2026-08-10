const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .ilike('name', '%teszt%');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Companies matching 'teszt':", data.length);
  data.forEach(c => {
    console.log(`- ID: ${c.id}, Name: ${c.name}, Owner: ${c.owner_id}, Tax: ${c.tax_number}`);
  });
}

run();
