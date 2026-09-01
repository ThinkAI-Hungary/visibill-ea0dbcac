const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260901140000_add_szamlazz_agent_key_migration.sql');

// Search for DB connection string from env or standard poolers
const CONNECTION_STRINGS = [
  process.env.DATABASE_URL,
  "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:postgres@aws-1-eu-central-1.pooler.supabase.com:6543/postgres",
  "postgresql://postgres:postgres@db.vxxgvdlqvvchtlmqnrqf.supabase.co:5432/postgres",
].filter(Boolean);

async function tryRunMigration(connStr) {
  const masked = connStr.replace(/:[^:@]+@/, ":****@");
  console.log(`Connecting to Postgres DB: ${masked}`);

  const client = new Client({
    connectionString: connStr,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected successfully to Supabase DB!");

    const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');
    console.log("Applying migration SQL:\n", sql);

    await client.query(sql);
    console.log("\nMigration applied successfully!");

    // Verify columns on companies table
    const checkRes = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'companies' AND column_name = 'szamlazz_agent_key';
    `);
    console.log("Verification on companies table:", checkRes.rows);

    await client.end();
    return true;
  } catch (err) {
    console.error("Connection/Query error:", err.message);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

async function main() {
  for (const connStr of CONNECTION_STRINGS) {
    const ok = await tryRunMigration(connStr);
    if (ok) {
      console.log("ALL DONE!");
      process.exit(0);
    }
  }
  console.error("Could not connect with default connection strings.");
  process.exit(1);
}

main();
