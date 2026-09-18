import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local
const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    env[match[1]] = value;
  }
}

const SUPABASE_URL = env.SUPABASE_URL || 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/customer-api`;

async function deepTestCustomerApi() {
  console.log('====================================================');
  console.log('  MÉLYSÉGI CUSTOMER REST API TESZTELÉS & ADATELLENŐRZÉS');
  console.log('====================================================\n');

  // 1. Setup: Mauroni Events Kft.
  const targetCompanyId = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
  const { data: comp } = await supabase.from('companies').select('id, name, owner_id').eq('id', targetCompanyId).single();
  const userId = comp?.owner_id;
  console.log(`Cég: ${comp?.name} (ID: ${targetCompanyId})`);
  console.log(`Tulajdonos: ${userId}`);

  console.log('\n--- 1. LÉPÉS: M2M API Kulcs Létrehozása ---');
  const { data: keyData, error: keyErr } = await supabase.rpc('generate_api_key', {
    p_name: 'Mély Ellenőrző Tesztelő',
    p_scope: 'read_write',
    p_company_id: targetCompanyId,
    p_user_id: userId,
  });

  if (keyErr || !keyData?.api_key) {
    console.error('Hiba az API kulcs generálásakor:', keyErr);
    process.exit(1);
  }

  const apiKey = keyData.api_key;
  const keyId = keyData.id;
  console.log(`✅ API Kulcs legenerálva: ${apiKey.slice(0, 12)}... (Kulcs ID: ${keyId})`);

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  async function apiCall(method, path, body = null) {
    const url = `${EDGE_FUNCTION_URL}${path}`;
    const opts = {
      method,
      headers,
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, data: json };
  }

  let createdPartnerId = null;

  try {
    // ── 2. TESZT: GET /v1/invoices ──
    console.log('\n--- 2. TESZT: Számlák lekérdezése (GET /v1/invoices?direction=inbound&limit=3) ---');
    const invRes = await apiCall('GET', '/v1/invoices?direction=inbound&limit=3');
    console.log(`HTTP Státusz: ${invRes.status} (OK: ${invRes.ok})`);
    if (invRes.ok) {
      const invoices = invRes.data?.data?.invoices || [];
      console.log(`Visszaadott számlák száma: ${invoices.length}`);
      console.log('Lapozási meta:', invRes.data?.data?.pagination);
      if (invoices.length > 0) {
        const first = invoices[0];
        console.log('Példa számla a válaszból:');
        console.log({
          id: first.id,
          sorszam: first.invoice_number,
          partner: first.partner_name,
          irany: first.direction,
          kelt: first.issue_date,
          fizetendo: first.gross_amount,
          penznem: first.currency,
          fizetve: first.is_paid,
        });

        // ── 3. TESZT: GET /v1/invoices/:id tételsorokkal ──
        console.log(`\n--- 3. TESZT: Egy konkrét számla és tételei (GET /v1/invoices/${first.id}) ---`);
        const singleInv = await apiCall('GET', `/v1/invoices/${first.id}`);
        console.log(`HTTP Státusz: ${singleInv.status}`);
        const invDetails = singleInv.data?.data?.invoice;
        console.log(`Számla száma: ${invDetails?.invoice_number}, Partner: ${invDetails?.partner_name}`);
        console.log(`Tételek száma: ${(invDetails?.items || []).length}`);
        if (invDetails?.items && invDetails.items.length > 0) {
          console.log('Első tételsor adatai:', invDetails.items[0]);
        }
      }
    } else {
      console.error('Hiba:', invRes.data);
    }

    // ── 4. TESZT: ÍRÁS & OLVASÁS: Új partner rögzítése (POST /v1/partners) ──
    console.log('\n--- 4. TESZT: Új partner rögzítése (POST /v1/partners) ---');
    const partnerPayload = {
      name: `API Test Partner Kft. ${Date.now()}`,
      tax_number: '98765432-2-41',
      partner_type: 'supplier',
      email: 'api-test@example.com',
      bank_account_number: '11773016-11112222-00000000',
    };
    const createPartnerRes = await apiCall('POST', '/v1/partners', partnerPayload);
    console.log(`HTTP Státusz: ${createPartnerRes.status} (OK: ${createPartnerRes.ok})`);
    if (createPartnerRes.ok) {
      createdPartnerId = createPartnerRes.data?.data?.partner?.id;
      console.log(`✅ Létrehozott partner ID: ${createdPartnerId}`);
      console.log('Válasz objektum:', createPartnerRes.data?.data?.partner);

      // ── 5. TESZT: Partner keresése és visszaolvasása ──
      console.log(`\n--- 5. TESZT: Partner visszaolvasása (GET /v1/partners?search=98765432) ---`);
      const searchRes = await apiCall('GET', '/v1/partners?search=98765432');
      console.log(`HTTP Státusz: ${searchRes.status}`);
      const found = searchRes.data?.data?.partners || [];
      console.log(`Találatok száma: ${found.length}`);
      if (found.length > 0) {
        console.log('Megtalált partner:', found[0].name, '| Adószám:', found[0].tax_number);
      }

      // ── 6. TESZT: Partner módosítása (PATCH /v1/partners/:id) ──
      console.log(`\n--- 6. TESZT: Partner módosítása (PATCH /v1/partners/${createdPartnerId}) ---`);
      const updateRes = await apiCall('PATCH', `/v1/partners/${createdPartnerId}`, {
        email: 'api-updated@example.com',
        notes: 'API által sikeresen módosítva',
      });
      console.log(`HTTP Státusz: ${updateRes.status}`);
      console.log('Módosítás eredménye:', updateRes.data?.data?.partner?.email);
    } else {
      console.error('Hiba partner létrehozásakor:', createPartnerRes.data);
    }

    // ── 7. TESZT: Banki tranzakciók lekérése (GET /v1/transactions) ──
    console.log('\n--- 7. TESZT: Banki tranzakciók (GET /v1/transactions?limit=3) ---');
    const txRes = await apiCall('GET', '/v1/transactions?limit=3');
    console.log(`HTTP Státusz: ${txRes.status}`);
    if (txRes.ok) {
      const txs = txRes.data?.data?.transactions || [];
      console.log(`Tranzakciók száma a válaszban: ${txs.length}`);
      if (txs.length > 0) {
        console.log('Példa banki tranzakció:', {
          id: txs[0].id,
          kelt: txs[0].booking_date,
          osszeg: txs[0].amount,
          penznem: txs[0].currency,
          kozlemeny: txs[0].comment?.slice(0, 40),
          szamlara_kotve: txs[0].is_matched,
        });
      }
    } else {
      console.error('Hiba:', txRes.data);
    }

    // ── 8. TESZT: Főkönyvi napló és könyvelési tételek (GET /v1/ledger) ──
    console.log('\n--- 8. TESZT: Főkönyvi napló & ERP tételek (GET /v1/ledger?limit=3) ---');
    const ledgerRes = await apiCall('GET', '/v1/ledger?limit=3');
    console.log(`HTTP Státusz: ${ledgerRes.status}`);
    if (ledgerRes.ok) {
      const entries = ledgerRes.data?.data?.ledger_entries || [];
      console.log(`Főkönyvi bizonylatok száma: ${entries.length}`);
      if (entries.length > 0) {
        const e = entries[0];
        console.log('Példa főkönyvi fej:', {
          id: e.id,
          naploszam: e.journal_number,
          bizonylat: e.document_id,
          konyvelve: e.posting_date,
          leiras: e.description,
          statu: e.status,
          tetelek_szama: (e.lines || []).length,
        });
        if (e.lines && e.lines.length > 0) {
          console.log('Első könyvelési tétel sor:', e.lines[0]);
        }
      }
    } else {
      console.error('Hiba:', ledgerRes.data);
    }

    // ── 9. TESZT: ÁFA-kimutatás (GET /v1/reports/vat?year=2026) ──
    console.log('\n--- 9. TESZT: ÁFA kimutatás (GET /v1/reports/vat?year=2026) ---');
    const vatRes = await apiCall('GET', '/v1/reports/vat?year=2026');
    console.log(`HTTP Státusz: ${vatRes.status}`);
    if (vatRes.ok) {
      const vatReports = vatRes.data?.data?.vat_reports || [];
      console.log(`ÁFA időszakok száma: ${vatReports.length}`);
      if (vatReports.length > 0) {
        console.log('Legutóbbi ÁFA időszak adatai:', vatReports[0]);
      }
    } else {
      console.error('Hiba:', vatRes.data);
    }

    // ── 10. TESZT: Eredménykimutatás (GET /v1/reports/pnl?year=2026) ──
    console.log('\n--- 10. TESZT: Eredménykimutatás P&L (GET /v1/reports/pnl?year=2026) ---');
    const pnlRes = await apiCall('GET', '/v1/reports/pnl?year=2026');
    console.log(`HTTP Státusz: ${pnlRes.status}`);
    if (pnlRes.ok) {
      console.log('P&L aggregáció:', pnlRes.data?.data?.pnl);
    } else {
      console.error('Hiba:', pnlRes.data);
    }

  } finally {
    // ── CLEANUP: Töröljük a teszt során létrehozott partnert & vonjuk vissza a tesztkulcsot ──
    console.log('\n--- TISZTÍTÁS (CLEANUP) ---');
    if (createdPartnerId) {
      console.log(`Teszt partner (${createdPartnerId}) törlése a DB-ből...`);
      const { error: delErr } = await supabase.from('partners').delete().eq('id', createdPartnerId);
      if (delErr) console.error('Nem sikerült törölni a teszt partnert:', delErr);
      else console.log('✅ Teszt partner sikeresen eltávolítva.');
    }

    console.log(`Teszt API kulcs (${keyId}) visszavonása...`);
    await supabase.from('api_keys').update({ is_active: false }).eq('id', keyId);
    console.log('✅ Teszt API kulcs visszavonva.');
  }

  console.log('\n====================================================');
  console.log('  MÉLYSÉGI TESZTELÉS SIKERESEN BEFEJEZŐDÖTT');
  console.log('====================================================\n');
}

deepTestCustomerApi();
