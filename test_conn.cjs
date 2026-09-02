const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://postgres:Thinkerman11.%21@db.vxxgvdlqvvchtlmqnrqf.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

// Force IPv4 in DNS lookup override or socket option
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

async function main() {
  console.log("Connecting with ipv4first...");
  try {
    await client.connect();
    console.log("🎉🎉🎉 SUCCESS CONNECTED TO SUPABASE POSTGRES DIRECTLY WITH IPV4!");
    const res = await client.query("SELECT version();");
    console.log("Version:", res.rows[0].version);
    await client.end();
  } catch (e) {
    console.error("Connection error:", e);
  }
}

main();
