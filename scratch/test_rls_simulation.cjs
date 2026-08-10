const { Client } = require('pg');

const connectionString = "postgresql://postgres:postgres@db.vxxgvdlqvvchtlmqnrqf.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query('BEGIN');
    
    // Set the auth.uid() to Balázs Lederer's ID
    const userId = 'e5b822ee-4240-4350-9ebe-a14357d5bd89';
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: userId, role: 'authenticated' })]);

    // Test 1: Query myAssignments
    const res1 = await client.query(`
      SELECT accounting_firm_id, role, company_id, is_main_accountant 
      FROM public.accounty_assignments 
      WHERE accountant_user_id = $1
    `, [userId]);
    console.log("Simulated myAssignments (length:", res1.rows.length, "):");
    res1.rows.forEach(r => console.log(`  - Company: ${r.company_id}, Firm: ${r.accounting_firm_id}, Role: ${r.role}, is_main: ${r.is_main_accountant}`));

    const myAssignments = res1.rows;
    if (myAssignments.length > 0) {
      const firmId = myAssignments[0].accounting_firm_id;
      const isAdmin = myAssignments.some(a => a.role === 'iroda_admin');
      console.log(`isAdmin: ${isAdmin}, firmId: ${firmId}`);

      // Test 2: Query assignments for all firm companies if admin
      let assignments = [];
      if (isAdmin && firmId) {
        const res2 = await client.query(`
          SELECT * FROM public.accounty_assignments 
          WHERE accounting_firm_id = $1
        `, [firmId]);
        assignments = res2.rows;
        console.log("Simulated assignments for firm (length:", assignments.length, "):");
      } else {
        const companyIds = myAssignments.filter(a => a.is_main_accountant).map(a => a.company_id);
        if (companyIds.length > 0) {
          const res2 = await client.query(`
            SELECT * FROM public.accounty_assignments 
            WHERE company_id = ANY($1)
          `, [companyIds]);
          assignments = res2.rows;
          console.log("Simulated assignments for companyIds (length:", assignments.length, "):");
        }
      }

      // Test 3: Query companies
      const uniqueCompanyIds = [...new Set(assignments.map(a => a.company_id))];
      if (uniqueCompanyIds.length > 0) {
        const res3 = await client.query(`
          SELECT id, name, tax_number FROM public.companies 
          WHERE id = ANY($1)
        `, [uniqueCompanyIds]);
        console.log("Simulated companies (length:", res3.rows.length, "):");
        res3.rows.forEach(r => console.log(`  - ID: ${r.id}, Name: ${r.name}`));
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during simulation:", err);
  } finally {
    await client.end();
  }
}

run();
