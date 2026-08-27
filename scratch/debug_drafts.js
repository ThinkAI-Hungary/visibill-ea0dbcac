import { createClient } from '@supabase/supabase-js';

const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

const companyId = "b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7"; // SportsBase Hungary

async function main() {
  console.log("Fetching active preset for company...");
  const { data: preset, error: err } = await supabase
    .from('chart_of_accounts_presets')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .maybeSingle();

  if (err) {
    console.error(err);
    return;
  }

  console.log("Active Preset:", preset);
  
  if (!preset) {
    console.log("No active preset found! Fetching any preset...");
    const { data: anyPreset } = await supabase
      .from('chart_of_accounts_presets')
      .select('id, name')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    console.log("Preset fallback:", anyPreset);
  }

  const presetId = preset?.id || (await supabase
    .from('chart_of_accounts_presets')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)
    .maybeSingle()).data?.id;

  if (!presetId) {
    console.log("No preset at all!");
    return;
  }

  console.log("Using Preset ID:", presetId);

  console.log("Running get_gl_categorized_items...");
  const { data: items, error: itemsErr } = await supabase.rpc('get_gl_categorized_items', {
    p_company_id: companyId,
    p_preset_id: presetId
  });

  if (itemsErr) {
    console.error(itemsErr);
    return;
  }

  console.log("Total items returned by get_gl_categorized_items:", items?.length);
  const withGL = items?.filter(i => i.gl_account_id);
  console.log("Items with gl_account_id:", withGL?.length);
  if (withGL && withGL.length > 0) {
    console.log("Sample item:", withGL[0]);
  }
}

main().catch(console.error);
