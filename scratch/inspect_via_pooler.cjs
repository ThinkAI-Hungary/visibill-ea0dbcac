const { Client } = require('pg');

async function main() {
  const connectionString = "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
  console.log("Connecting to pooler:", connectionString.replace(/:[^:@]+@/, ":****@"));
  
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("Connected to database via pooler successfully!");

    // Query function source code
    const res = await client.query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'generate_ticket_number';
    `);

    if (res.rows.length > 0) {
      console.log("=== generate_ticket_number definition ===");
      console.log(res.rows[0].routine_definition);
    } else {
      console.log("generate_ticket_number function not found in information_schema.");
    }

    // Query triggers on public.feedback
    const triggerRes = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'feedback';
    `);
    console.log("\n=== triggers on public.feedback ===");
    console.log(triggerRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

main();
