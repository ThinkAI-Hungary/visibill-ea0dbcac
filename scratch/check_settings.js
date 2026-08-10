const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function check() {
  const companyId = '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2';
  
  const { data: company, error: cErr } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();
    
  console.log("Company:", company, cErr);

  const { data: settings, error: sErr } = await supabase
    .from('accounty_ev_client_settings')
    .select('*')
    .eq('company_id', companyId);
    
  console.log("EV settings:", settings, sErr);
}

check();
