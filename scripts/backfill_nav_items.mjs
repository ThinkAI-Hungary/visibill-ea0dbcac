// scripts/backfill_nav_items.mjs
// Sequentially trigger nav-auto-sync for affected companies to backfill missing line items.
// Usage: CRON_SECRET="..." node scripts/backfill_nav_items.mjs

const CRON_SECRET = process.env.CRON_SECRET;
if (!CRON_SECRET) {
  console.error('❌ Hiba: A CRON_SECRET környezeti változó megadása kötelező!');
  console.error('Használat: CRON_SECRET="..." node scripts/backfill_nav_items.mjs');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const SYNC_URL = `${SUPABASE_URL}/functions/v1/nav-auto-sync`;

// List of target companies ordered by missing items descending
const TARGET_COMPANIES = [
  { id: '5364d0be-e92a-4b94-9704-f457cf71f140', name: 'VBV Vision Kft.' },
  { id: 'dc1802d8-f41d-4fa2-8009-d68e2b35fba3', name: 'NB Forsz Kft.' },
  { id: '7820c484-2cc6-49cc-8411-e67866036154', name: 'RAHIMI Kft.' },
  { id: 'c791c4b1-fd24-467d-b5a4-4280858cb697', name: 'Vasalat Expressz Kft.' },
  { id: '35a5409c-d9a7-4c0b-819e-b1ae79a9dd98', name: 'TS Consult Kft.' },
  { id: 'eaad1b07-39a2-4267-9001-78b4f764449f', name: 'Ván Iroda Kft.' },
  { id: '377d28cb-edc9-48a7-b261-bcd9c91d81a1', name: 'Test Kft' },
  { id: '3f5b0688-c523-4e56-9a6c-c9803fb0c6ab', name: 'EURODIFFERENT Kft.' },
  { id: '7022da90-94a8-4313-8486-065b8cdd56ec', name: 'Fóliavilág Kft' },
  { id: '86ac88ac-4b2f-4d79-8eeb-251e3db7a02e', name: 'Victoria Music Kft.' },
  { id: 'acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2', name: 'Taxology Kft.' },
  { id: '507e90db-06b8-46e0-824e-290f9368b6e1', name: 'Sümegi és Társa Kft.' },
  { id: 'b16df0ae-27fb-42df-bb9c-0d03122d1d5c', name: 'Kolos Transport Kft.' },
  { id: 'd268417b-3354-4661-99d4-554804346322', name: 'JKP STATIC Kft.' },
  { id: 'e8b013ce-b2cf-4b62-a64e-9760a1f565c5', name: 'HORVÁTH GAZDA Kft.' },
  { id: 'c132676d-85c5-4e2a-bde1-d966766bb94f', name: 'Mauroni Events KFT.' },
  { id: 'ecadc119-ea53-4aee-8d92-ac046c87511e', name: 'Ügyvitel Technika Kft' },
  { id: '38be1064-032d-4766-93f0-736ae4a80cd7', name: 'Szbs BT' },
  { id: 'f37b1861-d843-4abf-8fac-9fe05ce84369', name: 'SOFT-CONTROLL KFT.' },
  { id: '8559e7d4-5f45-420d-aa1d-0bddbf11c2b0', name: 'Adóvalló Kft.' },
  { id: '9d7fe489-8b84-4c65-89ba-3276682ccc79', name: 'Cs és K Kft' },
  { id: 'da7b2c17-981c-4da7-ad61-107606bec5b4', name: 'Dream Factory Network Kft.' },
  { id: 'bf31de8b-e125-467d-b50f-b03fcbd77e26', name: 'Bosnyák Gergő EV' },
  { id: '3d7a0386-5654-4267-b36e-c352df7e6670', name: 'Günder János e.v.' },
  { id: 'b1c19e7d-df9f-4a23-a9d0-fa43dea1f5c7', name: 'SportsBase Hungary Kft.' },
  { id: '0922dcf6-c8a4-4f1b-8218-a5dcb0157854', name: 'B-Audit Kft.' },
  { id: '29513e2e-61ea-443e-9d4e-97559b007512', name: 'Kelist Kft.' },
  { id: 'ecf31039-b539-4e04-bbea-70ea48c701bb', name: 'Think Ai Kft' },
  { id: '283411b2-d389-4497-86ba-903de7a5e4f0', name: 'Kubát Károly e.v.' }
];

async function syncCompany(company) {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Starting backfill for: ${company.name} (${company.id})`);

  try {
    const res = await fetch(SYNC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET
      },
      body: JSON.stringify({
        companyId: company.id,
        forceSync: true
      })
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    if (!res.ok) {
      const errText = await res.text();
      console.error(`❌ [${company.name}] HTTP ${res.status}: ${errText} (${elapsed}s)`);
      return false;
    }

    const data = await res.json();
    console.log(`✅ [${company.name}] Finished in ${elapsed}s:`, JSON.stringify(data.summary || data));
    return true;
  } catch (err) {
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.error(`❌ [${company.name}] Error after ${elapsed}s:`, err.message);
    return false;
  }
}

async function run() {
  console.log(`=== NAV ITEM BACKFILL STARTED: ${TARGET_COMPANIES.length} companies ===`);
  let successCount = 0;

  for (let i = 0; i < TARGET_COMPANIES.length; i++) {
    const company = TARGET_COMPANIES[i];
    console.log(`\n--- [${i + 1}/${TARGET_COMPANIES.length}] ---`);
    const ok = await syncCompany(company);
    if (ok) successCount++;

    if (i < TARGET_COMPANIES.length - 1) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  console.log(`\n=== BACKFILL COMPLETED: ${successCount}/${TARGET_COMPANIES.length} successful ===`);
}

run();
