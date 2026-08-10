const { createClient } = require('@supabase/supabase-js');
const url = "https://vxxgvdlqvvchtlmqnrqf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";
const supabase = createClient(url, key);

const userId = 'e5b822ee-4240-4350-9ebe-a14357d5bd89';

async function run() {
  // 1. Get assignments of user to determine firm and role
  const { data: myAssignments, error: myAssignError } = await supabase
    .from('accounty_assignments')
    .select('accounting_firm_id, role, company_id, is_main_accountant')
    .eq('accountant_user_id', userId);

  if (myAssignError) {
    console.error("Error fetching my assignments:", myAssignError);
    return;
  }

  console.log(`User assignments count: ${myAssignments.length}`);
  const firmId = myAssignments[0]?.accounting_firm_id || null;
  const isAdmin = myAssignments.some(a => a.role === 'iroda_admin');
  console.log(`firmId: ${firmId}, isAdmin: ${isAdmin}`);

  // Get companyIds
  let companyIds = [];
  if (isAdmin && firmId) {
    const { data, error } = await supabase
      .from('accounty_assignments')
      .select('company_id')
      .eq('accounting_firm_id', firmId);
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
  console.log(`Unique company IDs count from assignments: ${companyIds.length}`);

  // Fetch companies (simulating RLS as well by using public.companies)
  // Note: service role key bypasses RLS, but we can see what's in the DB
  const { data: companies, error: compErr } = await supabase
    .from('companies')
    .select('id, name, tax_number')
    .in('id', companyIds);

  if (compErr) {
    console.error("Error fetching companies:", compErr);
    return;
  }
  console.log(`Companies fetched from DB (service_role): ${companies.length}`);
  const tesztCompany = companies.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' (61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2) in companies list?`, !!tesztCompany);
  if (tesztCompany) {
    console.log(`Teszt company detail:`, tesztCompany);
  }

  // 2. Run useAccountyClients queryFn logic
  let assignments = [];
  if (isAdmin && firmId) {
    const { data, error } = await supabase
      .from('accounty_assignments')
      .select('*')
      .eq('accounting_firm_id', firmId);
    if (error) {
      console.error("Error fetching all firm assignments:", error);
      return;
    }
    assignments = data || [];
  } else {
    const { data, error } = await supabase
      .from('accounty_assignments')
      .select('*')
      .eq('accountant_user_id', userId);
    if (error) {
      console.error("Error fetching assignments:", error);
      return;
    }
    assignments = data || [];
  }

  const uniqueCompanyIds = [...new Set(assignments.map(a => a.company_id))];
  console.log(`uniqueCompanyIds count from assignments query: ${uniqueCompanyIds.length}`);

  const { data: clientCompanies, error: clientCompErr } = await supabase
    .from('companies')
    .select('id, name, tax_number')
    .in('id', uniqueCompanyIds);

  if (clientCompErr) {
    console.error("Error fetching client companies:", clientCompErr);
    return;
  }
  console.log(`Client companies count: ${clientCompanies.length}`);

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

    const assignedToMe = isAdmin 
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

  console.log(`clientsList total count: ${clientsList.length}`);
  const clientsListTeszt = clientsList.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' in clientsList?`, !!clientsListTeszt);
  if (clientsListTeszt) {
    console.log(`Teszt in clientsList details:`, clientsListTeszt);
  }

  // Non-admin filter logic
  const filteredClients = isAdmin ? clientsList : clientsList.filter(c => c.isMainAccountant);
  console.log(`filteredClients total count (with isAdmin=${isAdmin}): ${filteredClients.length}`);
  const filteredTeszt = filteredClients.find(c => c.id === '61e7fbe5-aa53-401b-9b2b-e5e5a852fdd2');
  console.log(`Is 'teszt' in filteredClients?`, !!filteredTeszt);
}

run();
