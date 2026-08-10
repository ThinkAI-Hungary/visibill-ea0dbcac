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

    // Query companies directly
    const res = await client.query(`
      SELECT id, name FROM public.companies;
    `);
    console.log("Companies visible to Balázs Lederer (length:", res.rows.length, "):");
    res.rows.forEach(r => console.log(`  - ID: ${r.id}, Name: ${r.name}`));

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Error during simulation:", err);
  } finally {
    await client.end();
  }
}

run();
