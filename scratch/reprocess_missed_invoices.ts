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

  const session = authData.session;
  console.log('Logged in successfully!');

  // Define the chunks to cover the 4 invoices (2026-02-13 to 2026-07-08)
  const chunks = [
    { from: '2026-02-01', to: '2026-03-05' },
    { from: '2026-03-06', to: '2026-04-10' },
    { from: '2026-04-11', to: '2026-05-15' },
    { from: '2026-05-16', to: '2026-06-20' },
    { from: '2026-06-21', to: '2026-07-15' }
  ];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing range ${chunk.from} to ${chunk.to}...`);

    for (const direction of ['INBOUND', 'OUTBOUND']) {
      const { data, error } = await supabase.functions.invoke('nav-query-outbound-invoices', {
        body: {
          invoiceDirection: direction,
          dateFrom: chunk.from,
          dateTo: chunk.to,
          companyId: 'ecf31039-b539-4e04-bbea-70ea48c701bb'
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error(`  Failed ${direction}:`, error);
      } else {
        console.log(`  Done ${direction}. Details fetched: ${data?.detailsFetched || 0}`);
      }
    }
  }

  console.log('Finished reprocessing missed invoices.');
}

run();
