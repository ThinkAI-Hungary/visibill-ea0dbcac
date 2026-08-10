const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabaseAdmin = createClient(url, key);

async function run() {
  console.log("Generating OTP for balazs@thinkai.hu...");
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'balazs@thinkai.hu'
  });

  if (linkError) {
    console.error("Error generating link:", linkError);
    return;
  }

  const otp = linkData.properties.email_otp;
  console.log(`Generated OTP: ${otp}`);

  // Create a clean client for user session
  const supabaseUser = createClient(url, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY"); // Anon key

  console.log("Signing in with OTP...");
  const { data: sessionData, error: signInError } = await supabaseUser.auth.verifyOtp({
    email: 'balazs@thinkai.hu',
    token: otp,
    type: 'magiclink'
  });

  if (signInError) {
    console.error("Sign in failed:", signInError);
    return;
  }

  console.log("Sign in successful!");
  console.log(`User ID: ${sessionData.user.id}`);

  console.log("\n--- Testing RLS Queries ---");

  // Query 1: Get assignments
  const { data: assignments, error: assignError } = await supabaseUser
    .from('accounty_assignments')
    .select('company_id, accounting_firm_id, accountant_user_id, role, is_main_accountant');
  
  if (assignError) {
    console.error("Error fetching assignments:", assignError);
  } else {
    console.log(`Assignments returned: ${assignments.length}`);
  }

  // Query 2: Get companies
  const { data: companies, error: compError } = await supabaseUser
    .from('companies')
    .select('id, name');
  
  if (compError) {
    console.error("Error fetching companies:", compError);
  } else {
    console.log(`Companies returned: ${companies.length}`);
    const teszt = companies.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
    console.log(`Is 'teszt' (61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2) in companies list?`, !!teszt);
  }

  // Query 3: Get user access cache
  const { data: cache, error: cacheError } = await supabaseUser
    .from('user_company_access_cache')
    .select('*');

  if (cacheError) {
    console.error("Error fetching access cache:", cacheError);
  } else {
    console.log(`Cache entries returned: ${cache.length}`);
    const tesztCache = cache.find(c => c.company_id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
    console.log(`Is 'teszt' in cache list?`, !!tesztCache);
  }
}

run();
