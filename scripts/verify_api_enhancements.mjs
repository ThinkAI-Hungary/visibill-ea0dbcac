import crypto from 'crypto';

const SUPABASE_URL = 'https://vxxgvdlqvvchtlmqnrqf.supabase.co';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/customer-api`;

async function verifyAll() {
  console.log('====================================================================');
  console.log('  VISIBILL CUSTOMER REST API 2.1 — ÉLES VERIFIKÁCIÓS AUDIT');
  console.log('====================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      if (details) console.error(`     Részletek:`, details);
      failed++;
    }
  }

  // 1. OPENAPI SPEC TESZT (Hitelesítés nélkül elérhető GET /v1/openapi.json)
  console.log('\n--- 1. TESZT: OpenAPI 3.0.3 Specifikáció publikus elérése ---');
  try {
    const res = await fetch(`${EDGE_FUNCTION_URL}/v1/openapi.json`);
    const status = res.status;
    const data = await res.json();
    assert(status === 200, 'GET /v1/openapi.json HTTP 200-at ad', `Status: ${status}`);
    assert(data.openapi === '3.0.3', 'Specifikáció verziója OpenAPI 3.0.3', data.openapi);
    assert(Boolean(data.paths?.['/v1/transactions/{id}/unmatch']), 'Tartalmazza az unmatch végpontot');
    assert(Boolean(data.paths?.['/v1/invoices/{id}/image']), 'Tartalmazza az invoice image végpontot');
    assert(Boolean(data.paths?.['/v1/categories']), 'Tartalmazza a categories végpontot');
    assert(Boolean(data.paths?.['/v1/nav/status']), 'Tartalmazza a nav status végpontot');
    assert(Boolean(data.paths?.['/v1/nav/sync']), 'Tartalmazza a /v1/nav/sync végpontot');
    assert(Boolean(data.paths?.['/v1/auth/me']), 'Tartalmazza az auth me végpontot');
    assert(Boolean(data.paths?.['/v1/tickets']), 'Tartalmazza a /v1/tickets végpontot');
    assert(Boolean(data.paths?.['/v1/tickets/{id}']), 'Tartalmazza a /v1/tickets/{id} végpontot');
    assert(Boolean(data.paths?.['/v1/tickets/{id}/comments']), 'Tartalmazza a /v1/tickets/{id}/comments végpontot');
    assert(Boolean(data.paths?.['/v1/tickets/{id}/confirm-resolution']), 'Tartalmazza a confirm-resolution végpontot');
    assert(!Boolean(data.paths?.['/v1/tickets/{id}/reopen']), 'Reopen végpont NEM szerepel az OpenAPI specifikációban (letiltva)');
  } catch (err) {
    assert(false, 'Hiba történt az OpenAPI spec lekérésekor', err.message);
  }

const apiKey = 'vb_a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const keyId = '7232b8f4-3a30-475e-b9ea-566ec03cc564';
const targetCompanyId = 'c132676d-85c5-4e2a-bde1-d966766bb94f'; // Mauroni Events Kft.
console.log(`\nTeszt API kulcs használata: ${apiKey.slice(0, 15)}... (ID: ${keyId})`);

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  async function apiCall(method, path, body = null, extraHeaders = {}) {
    const url = `${EDGE_FUNCTION_URL}${path}`;
    const opts = {
      method,
      headers: { ...headers, ...extraHeaders },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data,
    };
  }

  try {
    // 3. P0: Hamis siker megszüntetése (Match nem létező azonosítóval -> 404)
    console.log('\n--- 2. TESZT: POST /v1/transactions/:id/match nem létező azonosítóval ---');
    const zeroId = '00000000-0000-0000-0000-000000000000';
    const fakeMatchRes = await apiCall('POST', `/v1/transactions/${zeroId}/match`, {
      invoice_id: zeroId,
    });
    assert(fakeMatchRes.status === 404, 'Hamis siker elhárítva: 404-et ad (nem 200-at)', `Kapott: ${fakeMatchRes.status}`);
    assert(fakeMatchRes.data?.error?.code === 'TRANSACTION_NOT_FOUND', 'Hiba kódja TRANSACTION_NOT_FOUND', fakeMatchRes.data?.error?.code);

    // 4. P0: Ismeretlen query paraméter elutasítása (400 INVALID_QUERY_PARAMETER)
    console.log('\n--- 3. TESZT: Szigorú URL query paraméter validáció ---');
    const invalidParamRes = await apiCall('GET', '/v1/transactions?unsupported_field=true');
    assert(invalidParamRes.status === 400, 'Ismeretlen query paraméter 400 Bad Request-et ad', `Kapott: ${invalidParamRes.status}`);
    assert(invalidParamRes.data?.error?.code === 'INVALID_QUERY_PARAMETER', 'Hiba kódja INVALID_QUERY_PARAMETER', invalidParamRes.data?.error?.code);

    // 5. P0: unmatched_only=true és is_matched=false ekvivalencia
    console.log('\n--- 4. TESZT: unmatched_only és is_matched paraméterek ---');
    const [resUnmatched, resIsMatchedFalse] = await Promise.all([
      apiCall('GET', '/v1/transactions?unmatched_only=true&page_size=10'),
      apiCall('GET', '/v1/transactions?is_matched=false&page_size=10'),
    ]);
    assert(resUnmatched.status === 200, 'unmatched_only=true HTTP 200-at ad', `Kapott: ${resUnmatched.status}`);
    assert(resIsMatchedFalse.status === 200, 'is_matched=false HTTP 200-at ad', `Kapott: ${resIsMatchedFalse.status}`);
    const countUnmatched = resUnmatched.data?.data?.pagination?.total_items;
    const countIsMatched = resIsMatchedFalse.data?.data?.pagination?.total_items;
    assert(countUnmatched === countIsMatched, `Elemek száma megegyezik (${countUnmatched} === ${countIsMatched})`);

    // Conflict check
    const conflictRes = await apiCall('GET', '/v1/transactions?unmatched_only=true&is_matched=true');
    assert(conflictRes.status === 400, 'unmatched_only=true és is_matched=true konfliktus 400-at ad', `Kapott: ${conflictRes.status}`);

    // 6. P1: Kategóriák lekérdezése (GET /v1/categories)
    console.log('\n--- 5. TESZT: Kategóriák és főkönyvi számlák lekérdezése ---');
    const catRes = await apiCall('GET', '/v1/categories');
    assert(catRes.status === 200, 'GET /v1/categories HTTP 200-at ad', `Kapott: ${catRes.status}`);
    const categories = catRes.data?.data?.categories || [];
    assert(Array.isArray(categories) && categories.length > 0, `Kategóriák listája nem üres (${categories.length} db)`);
    if (categories.length > 0) {
      assert(categories[0].hasOwnProperty('gl_accounts'), 'Kategória tartalmazza a gl_accounts mezőt');
    }

    // 7. P1: NAV szinkronizációs állapot lekérdezése (GET /v1/nav/status)
    console.log('\n--- 6. TESZT: NAV kapcsolat és szinkronizáció státusz ---');
    const navStatusRes = await apiCall('GET', '/v1/nav/status');
    assert(navStatusRes.status === 200, 'GET /v1/nav/status HTTP 200-at ad', `Kapott: ${navStatusRes.status}`);
    assert(navStatusRes.data?.data?.hasOwnProperty('is_configured'), 'Tartalmazza az is_configured flaget');
    assert(navStatusRes.data?.data?.hasOwnProperty('recent_syncs'), 'Tartalmazza a recent_syncs listát');

    // NAV Manuális Szinkronizáció (POST /v1/nav/sync)
    console.log('\n--- 6b. TESZT: Manuális NAV szinkronizáció (POST /v1/nav/sync) ---');
    // 1. Validation: missing date_from
    const navMissingDate = await apiCall('POST', '/v1/nav/sync', {});
    assert(navMissingDate.status === 400, 'Hiányzó date_from mező 400-at ad', `Kapott: ${navMissingDate.status}`);
    assert(navMissingDate.data?.error?.code === 'MISSING_FIELD', 'Hiba kódja MISSING_FIELD');

    // 2. Validation: invalid date format
    const navBadDate = await apiCall('POST', '/v1/nav/sync', { date_from: 'invalid-date' });
    assert(navBadDate.status === 400, 'Érvénytelen date_from formátum 400-at ad', `Kapott: ${navBadDate.status}`);

    // 3. Validation: date_to < date_from
    const navInvertedDates = await apiCall('POST', '/v1/nav/sync', { date_from: '2026-05-01', date_to: '2026-04-01' });
    assert(navInvertedDates.status === 400, 'date_to < date_from 400-at ad', `Kapott: ${navInvertedDates.status}`);

    // 4. Validation: invalid direction
    const navBadDir = await apiCall('POST', '/v1/nav/sync', { date_from: '2026-04-01', direction: 'unsupported' });
    assert(navBadDir.status === 400, 'Érvénytelen direction 400-at ad', `Kapott: ${navBadDir.status}`);

    // 5. Execution: valid sync for 1-day range (inbound)
    console.log('  📡 Éles NAV szinkronizáció hívása 1 napos teszttartományra (2026-09-01..2026-09-02)...');
    const navSyncExec = await apiCall('POST', '/v1/nav/sync', {
      date_from: '2026-09-01',
      date_to: '2026-09-02',
      direction: 'inbound',
      fetch_details: false,
    });
    assert(navSyncExec.status === 200, 'POST /v1/nav/sync HTTP 200-at ad', `Kapott: ${navSyncExec.status}`);
    assert(navSyncExec.data?.success === true, 'Válasz success: true');
    assert(navSyncExec.data?.data?.direction === 'inbound', 'Irány inbound');
    assert(Boolean(navSyncExec.data?.data?.inbound?.status === 'completed'), 'Inbound státusz completed');
    assert(typeof navSyncExec.data?.data?.total_invoices_fetched === 'number', `Számlák száma: ${navSyncExec.data?.data?.total_invoices_fetched}`);

    // 6c. NAV Sync 60s Cooldown teszt
    console.log('\n--- 6c. TESZT: Manuális NAV szinkronizáció 60s cooldown védelem ---');
    const navCooldownRes = await apiCall('POST', '/v1/nav/sync', {
      date_from: '2026-09-01',
      date_to: '2026-09-02',
      direction: 'inbound',
    });
    assert(navCooldownRes.status === 429, 'Gyors ismételt szinkron hívás 429 Too Many Requests-et ad', `Kapott: ${navCooldownRes.status}`);
    assert(navCooldownRes.data?.error?.code === 'NAV_SYNC_COOLDOWN', 'Hiba kódja NAV_SYNC_COOLDOWN', navCooldownRes.data?.error?.code);

    // 8. P2: Kulcs introspekció (GET /v1/auth/me)
    console.log('\n--- 7. TESZT: API Kulcs introspekció (GET /v1/auth/me) ---');
    const meRes = await apiCall('GET', '/v1/auth/me');
    assert(meRes.status === 200, 'GET /v1/auth/me HTTP 200-at ad', `Kapott: ${meRes.status}`);
    assert(meRes.data?.data?.key?.scope === 'read_write', 'Visszaadja a kulcs jogosultsági körét (read_write)');
    assert(meRes.data?.data?.company?.id === targetCompanyId, 'Visszaadja a hozzátartozó cég ID-t');
    assert(Array.isArray(meRes.data?.data?.accessible_companies), 'Visszaadja a hozzáférhető cégek listáját');

    // 9. P2: ÁFA riport period paraméterrel (GET /v1/reports/vat?period=2026-04)
    console.log('\n--- 8. TESZT: ÁFA kimutatás period paraméterrel ---');
    const vatPeriodRes = await apiCall('GET', '/v1/reports/vat?period=2026-04');
    assert(vatPeriodRes.status === 200, 'GET /v1/reports/vat?period=2026-04 HTTP 200-at ad', `Kapott: ${vatPeriodRes.status}`);
    assert(Boolean(vatPeriodRes.data?.data?.vat_reports), 'Tartalmazza a vat_reports adatokat');

    // 10. P1: Idempotencia védelem és replay fejléc
    console.log('\n--- 9. TESZT: Idempotencia védelem (Idempotency-Key) ---');
    const testIdempotencyKey = `idem-${crypto.randomUUID()}`;
    const req1 = await apiCall('POST', `/v1/transactions/${zeroId}/match`, { invoice_id: zeroId }, {
      'Idempotency-Key': testIdempotencyKey,
    });
    const req2 = await apiCall('POST', `/v1/transactions/${zeroId}/match`, { invoice_id: zeroId }, {
      'Idempotency-Key': testIdempotencyKey,
    });
    assert(req1.status === 404, 'Első hívás 404-et adott');
    assert(req2.status === 404, 'Második (ismételt) hívás 404-et adott');
    const replayedHeader = req2.headers.get('idempotency-replayed');
    assert(replayedHeader === 'true', 'Második válasz fejlécében Idempotency-Replayed: true szerepel', replayedHeader);

    // 11. P1: NAV számla törlési védelem (409 Conflict)
    console.log('\n--- 10. TESZT: NAV számla törlésvédelmi integritás (409 Conflict) ---');
    const invListRes = await apiCall('GET', '/v1/invoices?page_size=10');
    const realNavInv = (invListRes.data?.data?.invoices || []).find((i) => i.is_nav_synced);

    if (realNavInv) {
      const delNavRes = await apiCall('DELETE', `/v1/invoices/${realNavInv.id}`);
      assert(delNavRes.status === 409, 'NAV számla törlési kísérlet force nélkül 409 Conflict-ot ad', `Kapott: ${delNavRes.status}`);
      assert(delNavRes.data?.error?.code === 'NAV_INVOICE_CANNOT_BE_DELETED', 'Hiba kódja NAV_INVOICE_CANNOT_BE_DELETED');
    } else {
      console.log('  ℹ️ Nincs NAV szinkronizált számla a tesztcégben, teszteljük nem létező azonosítóval (404)');
      const delNotFoundRes = await apiCall('DELETE', `/v1/invoices/${zeroId}`);
      assert(delNotFoundRes.status === 404, 'Nem létező számla törlése 404-et ad');
    }

    // 12. P1: Tranzakció unmatch (szétválasztás)
    console.log('\n--- 11. TESZT: Tranzakció unmatch nem létező azonosítóval ---');
    const unmatchRes = await apiCall('POST', `/v1/transactions/${zeroId}/unmatch`);
    assert(unmatchRes.status === 404, 'POST /v1/transactions/:id/unmatch nem létező tranzakcióra 404-et ad', `Kapott: ${unmatchRes.status}`);

    const delMatchRes = await apiCall('DELETE', `/v1/transactions/${zeroId}/match`);
    assert(delMatchRes.status === 404, 'DELETE /v1/transactions/:id/match nem létező tranzakcióra 404-et ad', `Kapott: ${delMatchRes.status}`);

    // 13. P1: Tömeges tranzakció törlés (POST /v1/transactions/bulk-delete)
    console.log('\n--- 12. TESZT: Tömeges tranzakció törlés validáció ---');
    const bulkEmptyRes = await apiCall('POST', '/v1/transactions/bulk-delete', { ids: [] });
    assert(bulkEmptyRes.status === 400, 'Üres ids tömbre 400 Bad Request-et ad', `Kapott: ${bulkEmptyRes.status}`);

    // 14. P1: Hibajegyek modul (Tickets - feedback tábla integráció)
    console.log('\n--- 13. TESZT: Hibajegy létrehozása validáció & siker (POST /v1/tickets) ---');
    // Validation: missing message
    const ticketMissingMsg = await apiCall('POST', '/v1/tickets', { type: 'bug' });
    assert(ticketMissingMsg.status === 400, 'Hiányzó message mezőre 400 Bad Request-et ad', `Kapott: ${ticketMissingMsg.status}`);

    // Validation: invalid type
    const ticketBadType = await apiCall('POST', '/v1/tickets', { type: 'invalid_type', message: 'Teszt' });
    assert(ticketBadType.status === 400, 'Érvénytelen type mezőre 400 Bad Request-et ad', `Kapott: ${ticketBadType.status}`);

    // Success creation
    const createTicketRes = await apiCall('POST', '/v1/tickets', {
      type: 'bug',
      priority: 'high',
      service: 'api',
      message: '[VERIFY_AUTO_TEST] Teszt hibajegy a REST API teszteléshez',
    });
    assert(createTicketRes.status === 201, 'POST /v1/tickets sikeres létrehozás 201-et ad', `Kapott: ${createTicketRes.status}`);
    const createdTicket = createTicketRes.data?.data?.ticket;
    const testTicketId = createdTicket?.id;
    const testTicketNumber = createdTicket?.ticket_number;
    assert(Boolean(testTicketId), `Létrejött ticket ID: ${testTicketId}`);
    assert(Boolean(testTicketNumber && testTicketNumber.startsWith('EB-')), `Automatikus ticket_number formátum valid: ${testTicketNumber}`);
    assert(['created', 'new', 'open'].includes(createdTicket?.status), `Kezdő státusz érvényes (${createdTicket?.status})`);
    assert(createdTicket?.priority === 'high', 'Prioritás high');

    console.log('\n--- 14. TESZT: Hibajegyek listázása és szűrése (GET /v1/tickets) ---');
    const ticketsListRes = await apiCall('GET', '/v1/tickets?page=1&page_size=20');
    assert(ticketsListRes.status === 200, 'GET /v1/tickets HTTP 200-at ad', `Kapott: ${ticketsListRes.status}`);
    const ticketItems = ticketsListRes.data?.data?.tickets || [];
    assert(Array.isArray(ticketItems) && ticketItems.length > 0, `Hibajegyek listája nem üres (${ticketItems.length} db)`);
    const foundInList = ticketItems.find((t) => t.id === testTicketId);
    assert(Boolean(foundInList), 'A létrehozott hibajegy megtalálható a listában');

    // Filter by status
    const filterOpenRes = await apiCall('GET', '/v1/tickets?status=open');
    assert(filterOpenRes.status === 200, 'Szűrés status=open működik');

    console.log('\n--- 15. TESZT: Hibajegy lekérése duális azonosítással (UUID és EB-xxxx) ---');
    // Fetch by UUID
    const getByUuidRes = await apiCall('GET', `/v1/tickets/${testTicketId}`);
    assert(getByUuidRes.status === 200, 'Lekérés UUID alapján 200-at ad', `Kapott: ${getByUuidRes.status}`);
    assert(getByUuidRes.data?.data?.ticket?.id === testTicketId, 'UUID szerinti lekérés adatai megegyeznek');

    // Fetch by ticket_number
    const getByNumRes = await apiCall('GET', `/v1/tickets/${testTicketNumber}`);
    assert(getByNumRes.status === 200, `Lekérés ticket_number (${testTicketNumber}) alapján 200-at ad`, `Kapott: ${getByNumRes.status}`);
    assert(getByNumRes.data?.data?.ticket?.id === testTicketId, 'Ticket_number szerinti lekérés adatai megegyeznek');

    // Fetch non-existing ticket
    const notFoundTicketRes = await apiCall('GET', `/v1/tickets/${zeroId}`);
    assert(notFoundTicketRes.status === 404, 'Nem létező hibajegy lekérése 404-et ad', `Kapott: ${notFoundTicketRes.status}`);

    console.log('\n--- 16. TESZT: Ügyfél válasz / komment beküldése (POST /v1/tickets/:id/comments) ---');
    const commentRes = await apiCall('POST', `/v1/tickets/${testTicketNumber}/comments`, {
      message: '[VERIFY_AUTO_TEST] Ez egy teszt ügyfél megjegyzés.',
    });
    assert(commentRes.status === 201, 'Komment beküldése 201 Created-et ad', `Kapott: ${commentRes.status}`);
    assert(commentRes.data?.data?.comment?.feedback_id === testTicketId, 'Komment hozzárendelve a hibajegyhez');

    // Verify comment appears in ticket details
    const getTicketAfterComment = await apiCall('GET', `/v1/tickets/${testTicketId}`);
    const ticketComments = getTicketAfterComment.data?.data?.comments || [];
    assert(ticketComments.length >= 1, `Kommentek száma legalább 1 (${ticketComments.length} db)`);
    const internalLeaked = ticketComments.some((c) => c.message?.includes('CONFIDENTIAL_STAFF_NOTE'));
    assert(!internalLeaked, 'Belső ügyfélszolgálati megjegyzések (is_internal) nem szivárognak ki a REST API-ra');

    console.log('\n--- 17. TESZT: Megoldás megerősítése (POST /v1/tickets/:id/confirm-resolution) ---');
    const confirmRes = await apiCall('POST', `/v1/tickets/${testTicketId}/confirm-resolution`);
    assert(confirmRes.status === 200, 'confirm-resolution 200 OK-t ad', `Kapott: ${confirmRes.status}`);
    assert(confirmRes.data?.data?.status === 'resolved', 'Hibajegy státusza resolved');

    console.log('\n--- 17b. TESZT: Lezárt hibajegy kommentelési védelme (400 TICKET_CLOSED) ---');
    const closedCommentRes = await apiCall('POST', `/v1/tickets/${testTicketNumber}/comments`, {
      message: 'Ez egy kísérlet komment küldésére a lezárt hibajegyhez.',
    });
    assert(closedCommentRes.status === 400, 'Lezárt jegyhez való hozzászólás 400 Bad Request-et ad', `Kapott: ${closedCommentRes.status}`);
    assert(closedCommentRes.data?.error?.code === 'TICKET_CLOSED', 'Hiba kódja TICKET_CLOSED', closedCommentRes.data?.error?.code);

    console.log('\n--- 18. TESZT: Hibajegy újranyitás védelme (kliens általi újranyitás tiltott) ---');
    const reopenRes = await apiCall('POST', `/v1/tickets/${testTicketNumber}/reopen`, {
      reason: 'A probléma ismét jelentkezett a teszt során.',
    });
    assert(reopenRes.status === 405 || reopenRes.status === 404, 'POST /v1/tickets/:id/reopen tiltva van (405 Method Not Allowed)', `Kapott: ${reopenRes.status}`);
    assert(reopenRes.data?.error?.code === 'METHOD_NOT_ALLOWED' || reopenRes.data?.error?.code === 'UNKNOWN_RESOURCE', 'Megfelelő hibakód elutasításkor');

    // Mentés tisztításhoz
    globalThis.__TEST_TICKET_ID = testTicketId;
  } finally {
    console.log('\n--- TISZTÍTÁS ---');
    console.log(`Verifikációs teszt lefutott.`);
  }

  console.log('\n====================================================================');
  console.log(`  EREDMÉNY: Összesen: ${passed + failed} | Sikeres: ${passed} | Hibás: ${failed}`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

verifyAll();
