const https = require('https');

const SUPABASE_URL = "vxxgvdlqvvchtlmqnrqf.supabase.co";
const SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4eGd2ZGxxdnZjaHRsbXFucnFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Nzk3MDA1MCwiZXhwIjoyMDczNTQ2MDUwfQ.YO-8-3sg4m--ms7MCvtwBLOo7ygqxaTbdtvwVwCin_Q";

function postTable(table, dataObj) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/${table}`;
    const payload = JSON.stringify(dataObj);
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: path,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
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
    req.write(payload);
    req.end();
  });
}

async function main() {
  console.log("=== TESTING BENEFIT TYPES IN ACCOUNTY_CAFETERIA ===");
  const typesToTest = ['housing', 'szep_recreation', 'szep_active', 'other', 'home_office'];
  for (const t of typesToTest) {
    const res = await postTable('accounty_cafeteria', {
      employment_id: '297212db-f476-42e7-a0fd-99b2925e5681',
      benefit_type: t,
      sub_type: 'home_office',
      amount: 32280
    });
    console.log(`Type '${t}':`, res.code ? res.message : `SUCCESS ID ${res.id}`);
  }
}

main().catch(console.error);
