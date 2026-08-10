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

  // 1. Simulate useMyAssignedCompanyIds
  console.log("\n--- Simulating useMyAssignedCompanyIds ---");
  const { data: myAssignments, error: myAssignError } = await supabaseUser
    .from('accounty_assignments')
    .select('accounting_firm_id, role, company_id, is_main_accountant')
    .eq('accountant_user_id', userId);

  if (myAssignError) {
    console.error("Error fetching my assignments:", myAssignError);
    return;
  }

  console.log(`My assignments count: ${myAssignments.length}`);
  const myAssignmentsFirmId = myAssignments[0]?.accounting_firm_id || null;
  const myAssignmentsIsAdmin = myAssignments.some(a => a.role === 'iroda_admin');
  console.log(`firmId: ${myAssignmentsFirmId}, isAdmin: ${myAssignmentsIsAdmin}`);

  let companyIds = [];
  if (myAssignmentsIsAdmin && myAssignmentsFirmId) {
    const { data, error } = await supabaseUser
      .from('accounty_assignments')
      .select('company_id')
      .eq('accounting_firm_id', myAssignmentsFirmId);
    if (error) {
      console.error("Error fetching firm company IDs:", error);
      return;
    }
    companyIds = [...new Set((data || []).map(a => a.company_id))];
  } else {
    companyIds = myAssignments
      .filter(a => a.is_main_accountant)
      .map(a => a.company_id);
  }

  console.log(`Company IDs count before company filter: ${companyIds.length}`);

  if (companyIds.length > 0) {
    const { data: companies, error: compError } = await supabaseUser
      .from('companies')
      .select('id, name')
      .in('id', companyIds);
    if (compError) {
      console.error("Error filtering sandbox:", compError);
      return;
    }
    console.log(`Visible companies from companies table: ${companies.length}`);
    companyIds = (companies || [])
      .filter(c => c.name !== 'SANDBOX')
      .map(c => c.id);
  }

  console.log(`Final companyIds count (after companies RLS & sandbox filter): ${companyIds.length}`);
  console.log("Is 'teszt' in companyIds?", companyIds.includes('61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2'));

  // 2. Simulate useAccountyClients queryFn
  console.log("\n--- Simulating useAccountyClients ---");
  if (companyIds.length === 0) {
    console.log("companyIds is empty, returning []");
    return;
  }

  let assignments = [];
  if (myAssignmentsIsAdmin && myAssignmentsFirmId) {
    const { data, error } = await supabaseUser
      .from('accounty_assignments')
      .select('*')
      .eq('accounting_firm_id', myAssignmentsFirmId);
    if (error) {
      console.error("Error fetching all assignments:", error);
      return;
    }
    assignments = data || [];
  } else {
    const { data, error } = await supabaseUser
      .from('accounty_assignments')
      .select('*')
      .eq('accountant_user_id', userId);
    if (error) {
      console.error("Error fetching assignments:", error);
      return;
    }
    assignments = data || [];
  }

  console.log(`Assignments count from query: ${assignments.length}`);
  const uniqueCompanyIds = [...new Set(assignments.map(a => a.company_id))];
  console.log(`Unique company IDs count: ${uniqueCompanyIds.length}`);

  const { data: clientCompanies, error: clientCompErr } = await supabaseUser
    .from('companies')
    .select('id, name, tax_number')
    .in('id', uniqueCompanyIds);

  if (clientCompErr) {
    console.error("Error fetching client companies:", clientCompErr);
    return;
  }

  console.log(`Client companies visible under RLS: ${clientCompanies.length}`);
  const isTesztInClientCompanies = clientCompanies.some(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log("Is 'teszt' in clientCompanies?", isTesztInClientCompanies);

  const companyAssignments = {};
  assignments.forEach((a) => {
    if (!companyAssignments[a.company_id]) {
      companyAssignments[a.company_id] = [];
    }
    companyAssignments[a.company_id].push(a);
  });

  const clientsList = (clientCompanies || []).filter(c => c.name !== 'SANDBOX').map((company) => {
    const assignsForComp = companyAssignments[company.id] || [];
    const mainAccountantAssign = assignsForComp.find(a => a.is_main_accountant) 
      || assignsForComp.find(a => a.is_primary) 
      || assignsForComp[0];
    const isMainAccountantForMe = assignsForComp.some(a => a.accountant_user_id === userId && a.is_main_accountant);

    const assignedToMe = myAssignmentsIsAdmin 
      ? assignsForComp.some(a => a.accountant_user_id === userId)
      : isMainAccountantForMe;

    return {
      id: company.id,
      companyId: company.id,
      name: company.name,
      taxNumber: company.tax_number,
      assignedToMe,
      isMainAccountant: isMainAccountantForMe,
    };
  });

  console.log(`clientsList count: ${clientsList.length}`);
  const tesztClient = clientsList.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' in clientsList?`, !!tesztClient);

  const filteredClients = myAssignmentsIsAdmin ? clientsList : clientsList.filter(c => c.isMainAccountant);
  console.log(`filteredClients count: ${filteredClients.length}`);
  const filteredTeszt = filteredClients.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' in filteredClients?`, !!filteredTeszt);
}

run();
