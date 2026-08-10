const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

const userId = 'e5b822ee-4240-4350-9ebe-a14357d5bd89'; // Balázs Lederer

async function run() {
  console.log("--- SIMULATING useMyAssignedCompanyIds ---");

  // 1. Get assignments for the user
  const { data: myAssignments, error: myAssignErr } = await supabase
    .from('accounty_assignments')
    .select('*')
    .eq('accountant_user_id', userId);

  if (myAssignErr) {
    console.error("myAssignments error:", myAssignErr);
    return;
  }

  console.log(`myAssignments fetched: ${myAssignments.length} rows.`);

  const firmId = myAssignments[0]?.accounting_firm_id || null;
  const isAdmin = myAssignments.some(a => a.role === 'iroda_admin');
  console.log(`Computed firmId: ${firmId}, isAdmin: ${isAdmin}`);

  let companyIds = [];
  if (isAdmin && firmId) {
    // Admin: get all assignments for the firm
    const { data: firmAssignments, error: firmAssignErr } = await supabase
      .from('accounty_assignments')
      .select('company_id')
      .eq('accounting_firm_id', firmId);

    if (firmAssignErr) {
      console.error("firmAssignments error:", firmAssignErr);
      return;
    }
    companyIds = [...new Set((firmAssignments || []).map(a => a.company_id))];
    console.log(`Admin mode: Unique company IDs from firm assignments: ${companyIds.length}`);
  } else {
    companyIds = myAssignments
      .filter(a => a.is_main_accountant)
      .map(a => a.company_id);
    console.log(`Non-admin mode: Unique company IDs (is_main_accountant = true): ${companyIds.length}`);
  }

  // Filter out SANDBOX by querying companies
  let finalCompanyIds = [];
  if (companyIds.length > 0) {
    // In RLS, we simulate checking if the user has access to each company
    // Let's first query the companies
    const { data: companies, error: compErr } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    if (compErr) {
      console.error("companies query error:", compErr);
      return;
    }

    console.log(`Companies returned by DB: ${companies.length}`);

    // Now, let's filter out companies that are blocked by RLS
    // RLS: owner_id = userId OR user_id in company_members OR accountant_user_id in accounty_assignments
    const { data: companyMembers } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', userId);

    const memberCompIds = new Set((companyMembers || []).map(m => m.company_id));
    const assignedCompIds = new Set(myAssignments.map(a => a.company_id));

    const rlsVisibleCompanies = companies.filter(c => {
      const isOwner = false; // We can query owner_id if needed, but let's check membership and assignments
      const isMember = memberCompIds.has(c.id);
      const isAssigned = assignedCompIds.has(c.id);
      return isOwner || isMember || isAssigned;
    });

    console.log(`Companies visible under RLS simulator: ${rlsVisibleCompanies.length}`);
    rlsVisibleCompanies.forEach(c => {
      console.log(`  - Visible: ${c.name} (${c.id})`);
    });

    finalCompanyIds = rlsVisibleCompanies
      .filter(c => c.name !== 'SANDBOX')
      .map(c => c.id);

    console.log(`Final companyIds after SANDBOX filter: ${finalCompanyIds.length}`);
  }

  console.log("\n--- SIMULATING useAccountyClients ---");
  // Let's simulate useAccountyClients queryFn
  // 1. Fetch assignments
  let assignments = [];
  if (isAdmin && firmId) {
    const { data, error } = await supabase
      .from('accounty_assignments')
      .select('*')
      .eq('accounting_firm_id', firmId);
    if (error) {
      console.error("firm assignments select error:", error);
      return;
    }
    assignments = data || [];
  } else {
    // Non-admin
    const { data, error } = await supabase
      .from('accounty_assignments')
      .select('*')
      .in('company_id', finalCompanyIds);
    if (error) {
      console.error("non-admin assignments select error:", error);
      return;
    }
    assignments = data || [];
  }

  console.log(`Assignments fetched for clients list: ${assignments.length}`);

  // Group assignments by company
  const companyAssignments = {};
  assignments.forEach(a => {
    if (!companyAssignments[a.company_id]) companyAssignments[a.company_id] = [];
    companyAssignments[a.company_id].push(a);
  });
  const uniqueCompIdsForClients = Object.keys(companyAssignments);

  // Fetch companies again
  const { data: companiesForClients } = await supabase
    .from('companies')
    .select('id, name, tax_number')
    .in('id', uniqueCompIdsForClients);

  // Apply RLS filter to companiesForClients
  const { data: companyMembers } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId);

  const memberCompIds = new Set((companyMembers || []).map(m => m.company_id));
  const assignedCompIds = new Set(myAssignments.map(a => a.company_id));

  const visibleCompaniesForClients = (companiesForClients || []).filter(c => {
    return memberCompIds.has(c.id) || assignedCompIds.has(c.id);
  });

  console.log(`Visible companies for clients: ${visibleCompaniesForClients.length}`);

  const clientsList = visibleCompaniesForClients
    .filter(c => c.name !== 'SANDBOX')
    .map(company => {
      const assignsForComp = companyAssignments[company.id] || [];
      const mainAccountantAssign = assignsForComp.find(a => a.is_main_accountant) 
        || assignsForComp.find(a => a.is_primary) 
        || assignsForComp[0];
      
      const isMainAccountantForMe = assignsForComp.some(a => a.accountant_user_id === userId && a.is_main_accountant);
      const assignedToMe = isAdmin 
        ? assignsForComp.some(a => a.accountant_user_id === userId)
        : isMainAccountantForMe;

      return {
        id: company.id,
        name: company.name,
        isMainAccountant: isMainAccountantForMe,
        assignedToMe
      };
    });

  let finalClients = clientsList;
  if (!isAdmin) {
    finalClients = clientsList.filter(c => c.isMainAccountant);
  }

  console.log(`Clients list returned: ${finalClients.length}`);
  finalClients.forEach(c => {
    console.log(`  - Client: ${c.name} (${c.id}), isMainAccountant: ${c.isMainAccountant}, assignedToMe: ${c.assignedToMe}`);
  });
}

run();
