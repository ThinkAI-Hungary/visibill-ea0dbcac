import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const EDGE_URL = `${SUPABASE_URL}/functions/v1/customer-api`;

async function run() {
  console.log('=== TESTING BRIEF 3 CORE FEATURES LIVE ===\n');

  // 1. Generate temp API key for Mauroni Events
  const companyId = 'c132676d-85c5-4e2a-bde1-d966766bb94f';
  const ownerId = '5c160828-ae2a-4b47-a8fc-f31dfea68b85';

  const { data: keyData, error: keyErr } = await admin.rpc('generate_api_key', {
    p_name: 'Test Brief Key',
    p_scope: 'read_write',
    p_company_id: companyId,
    p_user_id: ownerId,
  });

  if (keyErr) throw keyErr;
  const apiKey = keyData.api_key;
  const keyId = keyData.id;
  console.log('Generated test key:', apiKey);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  try {
    // ─────────────────────────────────────────────────────────────
    // TEST b: HIÁNYLISTA (Bejövő számlák lekérdezése: van-e kép?)
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST B: HIÁNYLISTA (has_image=false) ---');
    const resB = await fetch(`${EDGE_URL}/v1/invoices?direction=inbound&has_image=false&limit=10`, { headers });
    const jsonB = await resB.json();
    console.log(`HTTP ${resB.status}, Total without image:`, jsonB?.data?.pagination?.total_items);
    if (!jsonB.success || !Array.isArray(jsonB?.data?.invoices)) {
      throw new Error(`Test B failed: ${JSON.stringify(jsonB)}`);
    }
    const missingInvoices = jsonB.data.invoices;
    console.log(`Received ${missingInvoices.length} missing image invoices.`);
    console.log('Sample item:', {
      invoice_number: missingInvoices[0]?.invoice_number,
      has_image: missingInvoices[0]?.has_image,
      nav_status: missingInvoices[0]?.nav_status,
      processing_status: missingInvoices[0]?.processing_status,
    });
    if (missingInvoices.some(i => i.has_image !== false)) {
      throw new Error('Test B failed: Expected all returned invoices to have has_image: false');
    }
    console.log('[PASS] Test B: Hiánylista endpoint verified!');

    // Pick one missing invoice to test A and C
    const targetInvoice = missingInvoices[0];
    const targetInvoiceNumber = targetInvoice.invoice_number;
    const targetId = targetInvoice.id;
    console.log(`Targeting missing invoice: ${targetInvoiceNumber} (${targetId})`);

    // ─────────────────────────────────────────────────────────────
    // TEST a: SZÁMLAKÉP FELTÖLTÉSE + AZONNALI NAV PÁROSÍTÁS
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST A: SZÁMLAKÉP FELTÖLTÉSE + NAV PÁROSÍTÁS ---');
    // Create a tiny dummy base64 PDF
    const dummyPdfBase64 = Buffer.from('%PDF-1.4 test dummy invoice image content').toString('base64');
    const resA = await fetch(`${EDGE_URL}/v1/invoices/upload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        file_base64: dummyPdfBase64,
        file_name: `nav_match_${Date.now()}.pdf`,
        nav_invoice_number: targetInvoiceNumber,
      }),
    });
    const jsonA = await resA.json();
    console.log(`HTTP ${resA.status}, Result:`, jsonA);
    if (!jsonA.success || jsonA?.data?.matched !== true) {
      throw new Error(`Test A failed: ${JSON.stringify(jsonA)}`);
    }
    console.log('[PASS] Test A: Upload matched directly to NAV invoice number!');

    // ─────────────────────────────────────────────────────────────
    // TEST c: BIZONYLATSZÁM JAVÍTÁSA (OCR HIBA) & KÉP ÖSSZEKÖTÉSE
    // ─────────────────────────────────────────────────────────────
    console.log('\n--- TEST C1: BIZONYLATSZÁM JAVÍTÁSA (PATCH) ---');
    const fixedNumber = `${targetInvoiceNumber}-CORRECTED`;
    const resC1 = await fetch(`${EDGE_URL}/v1/invoices/${targetId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        invoice_number: fixedNumber,
      }),
    });
    const jsonC1 = await resC1.json();
    console.log(`HTTP ${resC1.status}, Corrected invoice:`, jsonC1?.data?.invoice?.invoice_number);
    if (!jsonC1.success || jsonC1?.data?.invoice?.invoice_number !== fixedNumber) {
      throw new Error(`Test C1 failed: ${JSON.stringify(jsonC1)}`);
    }
    console.log('[PASS] Test C1: Invoice number successfully corrected via PATCH!');

    // Restore original invoice number
    await fetch(`${EDGE_URL}/v1/invoices/${targetId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        invoice_number: targetInvoiceNumber,
        attachment_url: null, // restore null so we leave data clean
      }),
    });

    console.log('\n--- TEST C2: POST /v1/invoices/link (LINKING ENDPOINT) ---');
    const resC2 = await fetch(`${EDGE_URL}/v1/invoices/link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invoice_id: targetId,
        attachment_url: 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/invoice-uploads/sample.pdf',
      }),
    });
    const jsonC2 = await resC2.json();
    console.log(`HTTP ${resC2.status}, Result:`, jsonC2);
    if (!jsonC2.success || !jsonC2?.data?.invoice?.attachment_url) {
      throw new Error(`Test C2 failed: ${JSON.stringify(jsonC2)}`);
    }
    console.log('[PASS] Test C2: Attachment linked directly via /v1/invoices/link!');

    // Clean up restored invoice
    await admin.from('invoices').update({ melleklet_url: null }).eq('id', targetId);

    console.log('\n========================================');
    console.log('ALL 3 CORE BRIEF REQUIREMENTS PASSED 100%');
    console.log('========================================\n');
  } finally {
    // Revoke key
    await admin.rpc('revoke_api_key', { p_key_id: keyId });
    console.log('Test key revoked.');
  }
}

run().catch((err) => {
  console.error('TEST ERROR:', err);
  process.exit(1);
});
