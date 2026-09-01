const https = require('https');

const SUPABASE_URL = "vxxgvdlqvvchtlmqnrqf.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";

function queryTable(table, select, extra = '') {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`;
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(data);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log("=== CHECKING COMPANIES ===");
  const companies = await queryTable('companies', 'id,name,tax_number', '&name=ilike.*Test%20Kft*');
  console.log("Companies:", companies);

  if (companies && companies.length > 0) {
    for (const comp of companies) {
      console.log(`Checking accounty_tax_profiles for company ${comp.id}...`);
      const taxProfiles = await queryTable('accounty_tax_profiles', '*', `&company_id=eq.${comp.id}`);
      console.log("Tax profile:", taxProfiles);
    }
  }
}

main().catch(console.error);
