import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Logging in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'balazs@thinkai.hu',
    password: "Nincsapellata1'"
  });

  if (authError || !authData.session) {
    console.error('Login failed:', authError);
    return;
  }

  console.log('Logged in! Trying to update invoice A27700851/1970/00002...');
  
  const updateData = {
    details_fetched: true,
    supplier_name: "ROSSMANN MAGYARORSZÁG KERESKEDELMI KFT",
    supplier_address: "HU, 2225, ÜLLŐ, ZSARÓKA, ÚT, 8",
    customer_name: "VICTORIA MUSIC",
    customer_address: "HU, 1024, BUDAPEST, FÉNY, UTCA, 15",
    invoice_gross_amount: 18992,
    invoice_net_amount: 14954.33,
    invoice_vat_amount: 4037.67
  };

  const { data, error } = await supabase
    .from('nav_invoices')
    .update(updateData)
    .eq('id', '76f09dff-9c6e-4fe1-8b99-954492059b9b')
    .select();

  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update succeeded:', data);
  }
}

run();
