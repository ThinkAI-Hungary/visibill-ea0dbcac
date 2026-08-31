const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.vxxgvdlqvvchtlmqnrqf:Thinkerman11.%21@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("Connected successfully to vxxgvdlqvvchtlmqnrqf pooler!");
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await client.end();
  }
}

run();
