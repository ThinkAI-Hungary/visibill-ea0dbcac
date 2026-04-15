import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vxxgvdlqvvchtlmqnrqf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY'
);

async function run() {
  const { data: presets, error: pErr } = await supabase
    .from('chart_of_accounts_presets')
    .select('*')
    .eq('type', 'generic');
  
  console.log('Generic presets found:', presets ? presets.length : 'none', pErr ? JSON.stringify(pErr) : '');

  if (presets && presets.length > 0) {
    const genericId = presets[0].id;
    console.log('Testing RPC get_gl_balances with genericId:', genericId);
    
    const { data, error } = await supabase.rpc('get_gl_balances', {
      p_company_id: '1e19d779-7c39-44d4-9844-486008889988', // random uuid
      p_preset_id: genericId
    });
    
    if (error) {
       console.error('RPC Error:', JSON.stringify(error));
    } else {
       console.log('RPC Data count:', data ? data.length : 'null');
       if (data && data.length > 0) {
           console.log('First returned row:', data[0]);
       }
    }
  }
}

run();
