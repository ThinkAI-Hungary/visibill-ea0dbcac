import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const targetIds = [
  '2c2be5d5-a7bd-4fe7-8176-e19e8b56c4b8', // A22500299/0693/00016 (2026-06-28)
  'b16650da-045e-48de-9389-76203bcc0b02', // A01902005/2069/00006 (2026-07-08)
  'f751c818-712a-44bc-a65e-1841c012a26d'  // A01902005/1995/00002 (2026-04-23)
];

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

  const session = authData.session;
  console.log('Logged in successfully!');

  // 1. Reset details_fetched to false
  console.log('Resetting the 3 invoices in database...');
  const { error: resetError } = await supabase
    .from('nav_invoices')
    .update({ details_fetched: false, invoice_net_amount: 0, invoice_vat_amount: 0, invoice_gross_amount: 0 })
    .in('id', targetIds);

  if (resetError) {
    console.error('Reset failed:', resetError);
    return;
  }

  // 2. Reprocess in 34-day chunks
  const chunks = [
    { from: '2026-04-01', to: '2026-05-04' }, // covers 2026-04-23
    { from: '2026-05-05', to: '2026-06-07' },
    { from: '2026-06-08', to: '2026-07-10' }  // covers 2026-06-28 and 2026-07-08
  ];

  for (const chunk of chunks) {
    console.log(`Invoking Edge Function for range ${chunk.from} to ${chunk.to}...`);
    const { data: syncData, error: syncError } = await supabase.functions.invoke('nav-query-outbound-invoices', {
      body: {
        invoiceDirection: 'INBOUND',
        dateFrom: chunk.from,
        dateTo: chunk.to,
        companyId: 'ecf31039-b539-4e04-bbea-70ea48c701bb'
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (syncError) {
      console.error(`  Failed:`, syncError);
    } else {
      console.log(`  Done. Details fetched: ${syncData?.detailsFetched || 0}`);
    }
  }

  // 3. Query the updated rows in DB
  const { data: updatedInvoices } = await supabase
    .from('nav_invoices')
    .select('id, invoice_number, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, details_fetched')
    .in('id', targetIds);

  console.log('\nUpdated Database Invoice Rows:');
  if (updatedInvoices) {
    updatedInvoices.forEach(inv => {
      console.log(`  - ${inv.invoice_number}: net=${inv.invoice_net_amount}, vat=${inv.invoice_vat_amount}, gross=${inv.invoice_gross_amount}, fetched=${inv.details_fetched}`);
    });
  }
}

run();
