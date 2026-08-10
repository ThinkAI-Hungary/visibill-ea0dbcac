const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabaseAdmin = createClient(url, key);

async function run() {
  console.log("Generating OTP...");
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'balazs@thinkai.hu'
  });

  if (linkError) {
    console.error("Error generating link:", linkError);
    return;
  }

  const otp = linkData.properties.email_otp;
  const supabaseUser = createClient(url, "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc5NzAwNTAsImV4cCI6MjA3MzU0NjA1MH0.Ec9KFcjt89cY6FF9Nq9GnW1hzlnDUhQCCJ_LhWm2evY");

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

  const userId = sessionData.user.id;
  console.log(`Signed in! userId = ${userId}`);

  // 1. Simulate CompanyContext.tsx
  console.log("\n--- Simulating CompanyContext.tsx Query ---");
  // Step 1: company_members
  const { data: memberData, error: memberError } = await supabaseUser
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId);

  if (memberError) {
    console.error("Error fetching company members:", memberError);
    return;
  }
  console.log(`Member companies count: ${memberData.length}`);

  // Step 2: role check
  const { data: roleData, error: roleError } = await supabaseUser
    .from('accounty_assignments')
    .select('role')
    .eq('accountant_user_id', userId);

  if (roleError) {
    console.error("Error fetching role data:", roleError);
    return;
  }
  const isAccountyAdmin = roleData?.some((r) => r.role === 'iroda_admin');
  console.log(`isAccountyAdmin: ${isAccountyAdmin}`);

  // Step 3: assignmentQuery
  let assignmentQuery = supabaseUser
    .from('accounty_assignments')
    .select('company_id')
    .eq('accountant_user_id', userId);

  if (!isAccountyAdmin) {
    assignmentQuery = assignmentQuery.eq('is_main_accountant', true);
  }

  const { data: assignmentData, error: assignmentError } = await assignmentQuery;
  if (assignmentError) {
    console.error("Error fetching assignments:", assignmentError);
    return;
  }
  console.log(`Assignment data count: ${assignmentData.length}`);

  // Combine
  const memberCompIds = (memberData || []).map((m) => m.company_id);
  const assignedCompIds = (assignmentData || []).map((a) => a.company_id);
  const allCompanyIds = [...new Set([...memberCompIds, ...assignedCompIds])];
  console.log(`Combined allCompanyIds count: ${allCompanyIds.length}`);

  // Fetch companies
  const result = await supabaseUser
    .from('companies')
    .select('id, name, tax_number')
    .in('id', allCompanyIds)
    .order('created_at', { ascending: true });

  if (result.error) {
    console.error("Error fetching companies:", result.error);
    return;
  }

  console.log(`Companies returned by select: ${result.data.length}`);
  const tesztCompany = result.data.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' in returned companies?`, !!tesztCompany);
  if (tesztCompany) {
    console.log(`Teszt company info:`, tesztCompany);
  }
}

run();
