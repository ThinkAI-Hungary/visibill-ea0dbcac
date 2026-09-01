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

function patchTable(table, id, dataObj) {
  return new Promise((resolve, reject) => {
    const path = `/rest/v1/${table}?id=eq.${id}`;
    const payload = JSON.stringify(dataObj);
    const options = {
      hostname: SUPABASE_URL,
      port: 443,
      path: path,
      method: 'PATCH',
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
  console.log("=== CHECKING TEST KFT ===");
  const companies = await queryTable('companies', 'id,name,tax_number,tax_form', '&name=ilike.*Test%20Kft*');
  console.log("Companies:", companies);

  if (companies && companies.length > 0) {
    for (const comp of companies) {
      console.log(`Checking accounty_tax_profiles for company ${comp.id}...`);
      const taxProfiles = await queryTable('accounty_tax_profiles', '*', `&company_id=eq.${comp.id}`);
      console.log("Tax profile:", taxProfiles);

      // Ensure tax_form = 'kiva' in companies
      console.log(`Setting companies.tax_form = 'kiva' for ${comp.id}...`);
      await patchTable('companies', comp.id, { tax_form: 'kiva' });

      if (taxProfiles && taxProfiles.length > 0) {
        console.log(`Setting accounty_tax_profiles.is_kiva = true for ${taxProfiles[0].id}...`);
        await patchTable('accounty_tax_profiles', taxProfiles[0].id, { is_kiva: true });
      } else {
        console.log("Creating tax profile with is_kiva = true...");
        // Upsert
      }
    }
  }
}

main().catch(console.error);
