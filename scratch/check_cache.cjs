const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function run() {
  const { data: cache, error } = await supabase
    .from('user_company_access_cache')
    .select('*')
    .eq('user_id', 'e5b822ee-4240-4350-9ebe-a14357d5bd89');
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Access Cache for Balázs Lederer:");
  cache.forEach(c => {
    console.log(`- Company ID: ${c.company_id}, Source: ${c.access_source}, Role: ${c.role}`);
  });
}

run();
