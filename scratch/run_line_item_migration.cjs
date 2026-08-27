const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const CONNECTION_STRINGS = [
  // 1. Transaction Pooler (aws-1)
  "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
  // 2. Session Pooler (aws-1)
  "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@aws-1-eu-central-1.pooler.supabase.com:5432/postgres",
  // 3. Direct Connection
  "postgresql://postgres:postgres@db.vxxgvdlqvvchtlmqnrqf.supabase.co:5432/postgres",
  // 4. Custom Pooler / alternate port
  "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@db.vxxgvdlqvvchtlmqnrqf.supabase.co:6543/postgres"
];

async function tryConnectAndRun(connectionString) {
  const masked = connectionString.replace(/:[^:@]+@/, ":****@");
  console.log(`\nTrying connection string: ${masked}`);
  
  const client = new Client({ 
    connectionString,
    connectionTimeoutMillis: 5000 // 5 seconds timeout
  });

  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20260827_add_line_item_projects_and_notes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    await client.connect();
    console.log("Connected successfully!");

    console.log("Running migration SQL...");
    await client.query(sql);
    console.log("Migration executed successfully!");
    await client.end();
    return true;
  } catch (err) {
    console.error("Connection/Execution failed:", err.message);
    try {
      await client.end();
    } catch (e) {}
    return false;
  }
}

async function main() {
  for (const connStr of CONNECTION_STRINGS) {
    const success = await tryConnectAndRun(connStr);
    if (success) {
      console.log("\nMigration completed successfully using one of the connection strings!");
      process.exit(0);
    }
  }
  console.error("\nAll connection attempts failed.");
  process.exit(1);
}

main();
