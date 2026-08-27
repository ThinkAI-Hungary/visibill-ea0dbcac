import { createClient } from '@supabase/supabase-js';

const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

async function main() {
  console.log("Fetching all presets...");
  const { data, error } = await supabase
    .from('chart_of_accounts_presets')
    .select(`
      id, name, company_id, is_active,
      company:companies(name)
    `);
  
  if (error) {
    console.error(error);
    return;
  }
  
  data?.forEach(p => {
    console.log(`Preset ID: ${p.id} | Name: ${p.name} | Active: ${p.is_active} | Company: ${p.company?.name}`);
  });
}

main().catch(console.error);
