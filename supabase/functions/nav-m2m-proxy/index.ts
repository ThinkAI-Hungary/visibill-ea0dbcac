import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-shield',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// NAV M2M Endpoints
const DEV_BASE_URL = 'https://m2m-dev.nav.gov.hu';
const PROD_BASE_URL = 'https://m2m.nav.gov.hu';

// Helper to create SHA-256 Base64 Uppercase signature
async function createSignature(messageId: string, timestampUtc: string, operationData: string, signatureKey: string): Promise<string> {
  const toHash = `${messageId}${timestampUtc}${operationData}${signatureKey}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(toHash);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.toUpperCase();
}

// Format UTC Timestamp YYYYMMDDHHmmss
function getUtcTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    now.getUTCFullYear().toString() +
    pad(now.getUTCMonth() + 1) +
    pad(now.getUTCDate()) +
    pad(now.getUTCHours()) +
    pad(now.getUTCMinutes()) +
    pad(now.getUTCSeconds())
  );
}

// Helper to delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const adminClient = createClient(supabaseUrl, supabaseServiceKey);

  // Authenticate user or service role
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization fejléc szükséges', code: 'UNAUTHORIZED' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tokenStr = authHeader.replace('Bearer ', '');
  let callerUserId: string | null = null;
  let isServiceRole = false;

  if (tokenStr === supabaseServiceKey) {
    isServiceRole = true;
  } else {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(tokenStr);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Érvénytelen vagy lejárt munkamenet', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    callerUserId = user.id;
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { action, company_id, environment = 'production' } = body;

    // ═══════════════════════════════════════════════════════════════
    // ACTION: CRON SYNC ALL (Called by pg_cron with service role / secret)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'cron_sync_all') {
      const cronSecret = req.headers.get('x-cron-secret');
      const validCronSecret = Deno.env.get('CRON_SECRET');
      if (!isServiceRole && (!cronSecret || cronSecret !== validCronSecret)) {
        return new Response(JSON.stringify({ error: 'Nincs jogosultság a cron futtatására' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: creds, error: fetchErr } = await adminClient
        .from('accounty_upo_credentials')
        .select('*')
        .eq('status', 'active')
        .eq('auto_efo_sync_enabled', true);

      if (fetchErr) throw fetchErr;

      const results: any[] = [];
      const currentYear = new Date().getFullYear();

      for (const c of creds || []) {
        try {
          const isDev = c.environment === 'development';
          const baseUrl = isDev ? DEV_BASE_URL : PROD_BASE_URL;
          const clientId = isDev ? '8WRh8DdR8p' : (Deno.env.get('NAV_M2M_CLIENT_ID') || 'kD67QsLcF8');
          const clientSecret = isDev ? 'csrbeEW0SjTFgP2s6L1WZvxyzotsoTS6' : (Deno.env.get('NAV_M2M_CLIENT_SECRET') || '');

          const { data: comp } = await adminClient.from('companies').select('tax_number').eq('id', c.company_id).single();
          const targetTaxId = isDev ? '8452004729' : (comp?.tax_number?.replace(/[^0-9]/g, '').slice(0, 8) || '');
          if (!targetTaxId) continue;

          const tokenMsgId = crypto.randomUUID();
          const tokenResp = await fetch(`${baseUrl}/NavM2mCommon/tokenService/Token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'messageId': tokenMsgId },
            body: JSON.stringify({
              requestData: {
                clientId: c.client_id,
                clientSecret,
                username: c.username,
                password: c.password_encrypted || (isDev ? 'ostHdsoNKL' : ''),
              },
            }),
          });

          const tokenJson = await tokenResp.json();
          const phantomToken = tokenJson.accessToken;
          if (!phantomToken) continue;

          const efoMsgId = crypto.randomUUID();
          const tsUtc = getUtcTimestamp();
          const sig = await createSignature(efoMsgId, tsUtc, '', c.signature_key_encrypted);
          const queryUrl = `${baseUrl}/rest-api/1.0/NavM2mAdozo/adozoService/EgyszerusitettFoglalkoztatasFoglalkoztatottLista/${targetTaxId}?targyEv=${currentYear}&signature=${encodeURIComponent(sig)}`;

          const navResp = await fetch(queryUrl, {
            headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${phantomToken}`, 'messageId': efoMsgId },
          });
          const navJson = await navResp.json();

          const workers = navJson.foglalkoztatott || [];
          for (const w of workers) {
            await adminClient.from('accounty_efo_entries').upsert(
              {
                company_id: c.company_id,
                tax_id: w.adoazonositoJel,
                name: w.nev,
                taj_number: w.tajSzam || null,
                target_year: currentYear,
                days_alkalmi: w.felhasznaltNapok?.alkalmi || 0,
                days_mezogazdasag: w.felhasznaltNapok?.mezogazdasag || 0,
                days_turisztika: w.felhasznaltNapok?.turisztika || 0,
                days_filmipar: w.felhasznaltNapok?.filmipar || 0,
                days_total_used: w.felhasznaltNapok?.osszes || 0,
                days_total_available: w.felhasznalhatoNapok?.osszes ?? 120,
                days_agri_available: w.felhasznalhatoNapok?.mezogazdasag ?? 90,
                last_sync_at: new Date().toISOString(),
              },
              { onConflict: 'company_id,tax_id,target_year' }
            );
          }

          await adminClient.from('accounty_upo_credentials').update({ last_sync_at: new Date().toISOString() }).eq('id', c.id);

          await adminClient.from('nav_m2m_audit_logs').insert({
            company_id: c.company_id,
            environment: c.environment,
            action: 'cron_sync_efo',
            endpoint: '/EgyszerusitettFoglalkoztatasFoglalkoztatottLista',
            request_id: efoMsgId,
            target_tax_id: targetTaxId,
            status_code: navResp.status,
            result_code: navJson.resultCode,
            result_message: `Automatikus napi EFO szinkron: ${workers.length} fő frissítve`,
            duration_ms: Date.now() - startTime,
          });

          results.push({ company_id: c.company_id, status: 'success', count: workers.length });
        } catch (err: any) {
          results.push({ company_id: c.company_id, status: 'error', error: err.message });
        }
      }

      return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!company_id) {
      return new Response(JSON.stringify({ error: 'A company_id megadása kötelező' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Permission check for user
    if (!isServiceRole && callerUserId) {
      const { data: isMember } = await adminClient
        .from('company_members')
        .select('id')
        .eq('company_id', company_id)
        .eq('user_id', callerUserId)
        .maybeSingle();

      const { data: isOwner } = await adminClient
        .from('companies')
        .select('id')
        .eq('id', company_id)
        .eq('owner_id', callerUserId)
        .maybeSingle();

      if (!isMember && !isOwner) {
        return new Response(JSON.stringify({ error: 'Nincs jogosultságod ehhez a céghez' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Resolve NAV Client credentials based on environment
    const isDev = environment === 'development';
    const baseUrl = isDev ? DEV_BASE_URL : PROD_BASE_URL;

    // Use vault secrets or fallback to dev credentials in sandbox
    const clientId = isDev
      ? '8WRh8DdR8p'
      : (Deno.env.get('NAV_M2M_CLIENT_ID') || 'kD67QsLcF8');
    const clientSecret = isDev
      ? 'csrbeEW0SjTFgP2s6L1WZvxyzotsoTS6'
      : (Deno.env.get('NAV_M2M_CLIENT_SECRET') || '');

    if (!clientSecret) {
      return new Response(JSON.stringify({ error: 'A szerveroldali NAV_M2M_CLIENT_SECRET nincs beállítva!' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: GET STATUS
    // ═══════════════════════════════════════════════════════════════
    if (action === 'get_status') {
      const { data: statusData, error: statusErr } = await adminClient.rpc('get_upo_credentials_status', {
        p_company_id: company_id,
        p_env: environment,
      });

      if (statusErr) throw statusErr;

      return new Response(JSON.stringify(statusData), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: TOGGLE AUTO SYNC
    // ═══════════════════════════════════════════════════════════════
    if (action === 'toggle_auto_sync') {
      const { auto_efo, auto_employee } = body;
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (typeof auto_efo === 'boolean') updates.auto_efo_sync_enabled = auto_efo;
      if (typeof auto_employee === 'boolean') updates.auto_employee_sync_enabled = auto_employee;

      const { error: updErr } = await adminClient
        .from('accounty_upo_credentials')
        .update(updates)
        .eq('company_id', company_id)
        .eq('environment', environment);

      if (updErr) throw updErr;

      return new Response(JSON.stringify({ success: true, ...updates }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: ACTIVATE
    // ═══════════════════════════════════════════════════════════════
    if (action === 'activate') {
      let username = (body.username || '').trim();
      let password = (body.password || '').trim();
      let keyPart1 = (body.key_part_1 || '').trim();
      let nonce = (body.nonce || '').trim();

      const apiKeyRaw: string = (body.api_key || '').trim();
      if (apiKeyRaw && apiKeyRaw.length === 40) {
        username = apiKeyRaw.slice(0, 10);
        password = apiKeyRaw.slice(10, 20);
        keyPart1 = apiKeyRaw.slice(20, 30);
        nonce = apiKeyRaw.slice(30, 40);
      }

      if (!username || !password || !keyPart1 || !nonce) {
        return new Response(
          JSON.stringify({
            error: 'Hiányzó azonosítási adatok! Adj meg egy 40 karakteres egybefüggő API kulcsot, vagy a 4 mezőt külön.',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 1: Token igénylés
      const tokenMsgId = crypto.randomUUID();
      const tokenResp = await fetch(`${baseUrl}/NavM2mCommon/tokenService/Token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'messageId': tokenMsgId,
        },
        body: JSON.stringify({
          requestData: {
            clientId,
            clientSecret,
            username,
            password,
          },
        }),
      });

      const tokenJson = await tokenResp.json();
      if (tokenJson.resultCode !== 'TOKEN_CREATION_SUCCESSFUL' || !tokenJson.accessToken) {
        await adminClient.from('nav_m2m_audit_logs').insert({
          company_id,
          user_id: callerUserId,
          environment,
          action: 'token_create_failed',
          endpoint: '/NavM2mCommon/tokenService/Token',
          request_id: tokenMsgId,
          status_code: tokenResp.status,
          result_code: tokenJson.resultCode || 'FAILED',
          result_message: tokenJson.resultMessage || 'Nem sikerült az azonosítás a megadott adatokkal.',
          duration_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({
            error: 'A NAV elutasította a felhasználói hitelesítést. Ellenőrizd a megadott adatokat / API Key-t!',
            resultCode: tokenJson.resultCode,
            resultMessage: tokenJson.resultMessage,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const phantomToken = tokenJson.accessToken;

      // Step 2: Nonce beváltás
      const nonceMsgId = crypto.randomUUID();
      const nonceUrl = `${baseUrl}/rest-api/1.1/NavM2mCommon/userregistrationService/Nonce`;
      const nonceResp = await fetch(nonceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${phantomToken}`,
          'messageId': nonceMsgId,
        },
        body: JSON.stringify({
          requestData: { nonce },
        }),
      });

      const nonceJson = await nonceResp.json();
      if (nonceJson.resultCode !== 'REDEEM_NONCE_SUCCESSFUL' || !nonceJson.signatureKeySecondPart) {
        await adminClient.from('nav_m2m_audit_logs').insert({
          company_id,
          user_id: callerUserId,
          environment,
          action: 'nonce_redeem_failed',
          endpoint: '/userregistrationService/Nonce',
          request_id: nonceMsgId,
          status_code: nonceResp.status,
          result_code: nonceJson.resultCode || 'FAILED',
          result_message: nonceJson.resultMessage || 'Érvénytelen vagy már felhasznált nonce kód.',
          duration_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({
            error: 'Nem sikerült a nonce kód beváltása. Lehet, hogy már aktiválva lett, vagy lejárt a 72 óra.',
            resultCode: nonceJson.resultCode,
            resultMessage: nonceJson.resultMessage,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const keyPart2 = nonceJson.signatureKeySecondPart;
      const signatureKey = keyPart1 + keyPart2;

      // Step 3: Aktiválás hitelesített aláírással
      const actMsgId = crypto.randomUUID();
      const actTimestamp = getUtcTimestamp();
      const actSignature = await createSignature(actMsgId, actTimestamp, '', signatureKey);

      const actUrl = `${baseUrl}/rest-api/1.1/NavM2mCommon/userregistrationService/Activation`;
      const actResp = await fetch(actUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${phantomToken}`,
          'messageId': actMsgId,
        },
        body: JSON.stringify({
          requestData: { signature: actSignature },
        }),
      });

      const actJson = await actResp.json();
      if (
        actJson.resultCode !== 'ACTIVATE_USER_REGISTRATION_SUCCESSFUL' &&
        actJson.resultCode !== 'USER_REGISTRATION_ALREADY_ACTIVATED'
      ) {
        await adminClient.from('nav_m2m_audit_logs').insert({
          company_id,
          user_id: callerUserId,
          environment,
          action: 'activation_failed',
          endpoint: '/userregistrationService/Activation',
          request_id: actMsgId,
          status_code: actResp.status,
          result_code: actJson.resultCode,
          result_message: actJson.resultMessage,
          duration_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({
            error: 'Az aktiválás sikertelen volt az aláírás ellenőrzése során.',
            resultCode: actJson.resultCode,
            resultMessage: actJson.resultMessage,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Step 4: Mentés az adatbázisba (kulcs és felhasználói jelszó tárolása az automatikus szinkronokhoz)
      const { error: upsertErr } = await adminClient
        .from('accounty_upo_credentials')
        .upsert(
          {
            company_id,
            user_id: callerUserId,
            environment,
            client_id: clientId,
            username,
            password_encrypted: password,
            signature_key_encrypted: signatureKey,
            status: 'active',
            last_validated_at: new Date().toISOString(),
            error_message: null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,environment' }
        );

      if (upsertErr) {
        throw upsertErr;
      }

      // Audit napló rögzítése
      await adminClient.from('nav_m2m_audit_logs').insert({
        company_id,
        user_id: callerUserId,
        environment,
        action: 'user_activate',
        endpoint: '/userregistrationService/Activation',
        request_id: actMsgId,
        status_code: 200,
        result_code: actJson.resultCode,
        result_message: 'Sikeres NAV M2M felhasználói regisztráció és kapcsolat aktiválás.',
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'active',
          username_masked: username.slice(0, 3) + '••••' + username.slice(-2),
          message: 'A NAV M2M kapcsolat sikeresen aktiválva és hitelesítve lett!',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // Helper: Obtain Access Token for active credential
    // ═══════════════════════════════════════════════════════════════
    const { data: cred, error: credErr } = await adminClient
      .from('accounty_upo_credentials')
      .select('*')
      .eq('company_id', company_id)
      .eq('environment', environment)
      .single();

    if (credErr || !cred || cred.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Nincs aktív NAV M2M kapcsolat beállítva ehhez a céghez.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve company tax number (first 8 digits)
    const { data: comp } = await adminClient
      .from('companies')
      .select('tax_number, name')
      .eq('id', company_id)
      .single();

    const targetTaxId = isDev
      ? '8452004729'
      : (comp?.tax_number?.replace(/[^0-9]/g, '').slice(0, 8) || '');

    if (!targetTaxId) {
      return new Response(JSON.stringify({ error: 'A cég adószáma nem található!' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get fresh token
    const tokenMsgId = crypto.randomUUID();
    const tokenResp = await fetch(`${baseUrl}/NavM2mCommon/tokenService/Token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'messageId': tokenMsgId,
      },
      body: JSON.stringify({
        requestData: {
          clientId: cred.client_id,
          clientSecret,
          username: cred.username,
          password: cred.password_encrypted || (isDev ? 'ostHdsoNKL' : (body.password || '')),
        },
      }),
    });

    const tokenJson = await tokenResp.json();
    const phantomToken = tokenJson.accessToken;

    if (!phantomToken) {
      return new Response(
        JSON.stringify({ error: 'Nem sikerült új munkamenet tokent igényelni a NAV-tól', details: tokenJson }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const signatureKey = cred.signature_key_encrypted;

    // ═══════════════════════════════════════════════════════════════
    // ACTION: SYNC EMPLOYEES (BiztositottiJogviszonyFoglalkoztatoAdat)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'sync_employees') {
      const jogviszonyTipus = body.jogviszony_tipus || 'NYITOTT';
      const msgId = crypto.randomUUID();
      const tsUtc = getUtcTimestamp();
      const sig = await createSignature(msgId, tsUtc, '', signatureKey);

      const queryUrl = `${baseUrl}/rest-api/1.0/NavM2mAdozo/adozoService/BiztositottiJogviszonyFoglalkoztatoAdat/${targetTaxId}?jogviszonyTipus=${jogviszonyTipus}&signature=${encodeURIComponent(sig)}`;

      const navResp = await fetch(queryUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${phantomToken}`,
          'messageId': msgId,
        },
      });

      let navJson = await navResp.json();

      // Ha FOLYAMATBAN státusszal tért vissza és van requestId, végezzünk státuszlekérdezést (polling)
      if (navJson.resultCode === 'FOLYAMATBAN' && navJson.requestData?.requestId) {
        const pollRequestId = navJson.requestData.requestId;
        // Várakozás 3 másodpercet az első lekérdezés előtt
        await sleep(3000);

        const pollMsgId = crypto.randomUUID();
        const pollTsUtc = getUtcTimestamp();
        const pollSig = await createSignature(pollMsgId, pollTsUtc, '', signatureKey);
        const pollUrl = `${baseUrl}/rest-api/1.0/NavM2mAdozo/adozoService/BiztositottiJogviszonyFoglalkoztatoAdatStatusz/${pollRequestId}/0?signature=${encodeURIComponent(pollSig)}`;

        const pollResp = await fetch(pollUrl, {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${phantomToken}`,
            'messageId': pollMsgId,
          },
        });

        const polledJson = await pollResp.json();
        if (polledJson.resultCode === 'SIKERES' || (polledJson.foglalkoztatottak && polledJson.foglalkoztatottak.length > 0)) {
          navJson = polledJson;
        }
      }

      await adminClient.from('nav_m2m_audit_logs').insert({
        company_id,
        user_id: callerUserId,
        environment,
        action: 'query_employees',
        endpoint: '/BiztositottiJogviszonyFoglalkoztatoAdat',
        request_id: msgId,
        target_tax_id: targetTaxId,
        status_code: navResp.status,
        result_code: navJson.resultCode,
        result_message: navJson.resultMessage,
        duration_ms: Date.now() - startTime,
      });

      // Update last sync time
      await adminClient
        .from('accounty_upo_credentials')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', cred.id);

      const workers = navJson.foglalkoztatottak || [];

      // Automatikus szinkronizálás az accounty_employees és accounty_employments táblákba
      let syncedCount = 0;
      for (const item of workers) {
        const rawName = (item.munkavallaloNeve || '').trim();
        const taxId = (item.munkavallaloAdoazonositoJele || '').trim();
        const taj = item.bejelentes?.tajSzam || null;
        const mothersName = item.bejelentes?.anyjaNeve || null;
        const birthName = item.bejelentes?.szuletesiNev || null;
        const rawAddress = item.bejelentes?.cim || null;

        // Parse birth date and birth place
        let birthDate: string | null = null;
        let birthPlace: string | null = null;
        const rawBirth = item.bejelentes?.szuletesiDatumHely || '';
        if (rawBirth) {
          const matchDate = rawBirth.match(/(\d{4}[.-]\d{2}[.-]\d{2})/);
          if (matchDate) {
            birthDate = matchDate[1].replace(/\./g, '-');
            birthPlace = rawBirth.replace(matchDate[0], '').replace(/[,\s]+/g, ' ').trim() || null;
          } else {
            birthPlace = rawBirth.trim();
          }
        }

        if (!taxId) continue;

        const nameParts = rawName.split(/\s+/);
        const lastName = nameParts[0] || 'Munkavállaló';
        const firstName = nameParts.slice(1).join(' ') || lastName;

        // Keresés vagy létrehozás
        const { data: existingEmp } = await adminClient
          .from('accounty_employees')
          .select('id')
          .eq('company_id', company_id)
          .eq('tax_id', taxId)
          .maybeSingle();

        let employeeId = existingEmp?.id;
        if (!employeeId) {
          const { data: newEmp } = await adminClient
            .from('accounty_employees')
            .insert({
              company_id,
              first_name: firstName,
              last_name: lastName,
              birth_name: birthName,
              birth_date: birthDate,
              birth_place: birthPlace,
              address: rawAddress ? { full: rawAddress } : null,
              tax_id: taxId,
              taj_number: taj,
              mothers_name: mothersName,
              status: 'active',
            })
            .select('id')
            .single();
          employeeId = newEmp?.id;
        } else {
          await adminClient
            .from('accounty_employees')
            .update({
              first_name: firstName,
              last_name: lastName,
              birth_name: birthName || undefined,
              birth_date: birthDate || undefined,
              birth_place: birthPlace || undefined,
              address: rawAddress ? { full: rawAddress } : undefined,
              taj_number: taj || undefined,
              mothers_name: mothersName || undefined,
            })
            .eq('id', employeeId);
        }

        if (employeeId) {
          const feorCode = item.feor?.feorKod || null;
          const feorDesc = item.feor?.feorMegnevezes || null;
          const weeklyHours = parseFloat(item.hetiOra?.hetiMunkaorakSzama) || 40;
          const startDate = item.jogviszonyAlapadatok?.biztositasiJogviszonyKezdete || null;
          const endDate = item.jogviszonyAlapadatok?.biztositasiJogviszonyVege || null;
          const relCode = item.jogviszonyAlapadatok?.biztositasiJogviszonyKodNev || null;

          const { data: existingJob } = await adminClient
            .from('accounty_employments')
            .select('id')
            .eq('company_id', company_id)
            .eq('employee_id', employeeId)
            .maybeSingle();

          if (!existingJob) {
            await adminClient.from('accounty_employments').insert({
              company_id,
              employee_id: employeeId,
              feor_code: feorCode,
              job_title: feorDesc || 'Munkavállaló',
              weekly_hours: weeklyHours,
              start_date: startDate,
              end_date: endDate,
              insurance_relationship_code: relCode,
              status: 'active',
            });
          } else {
            await adminClient
              .from('accounty_employments')
              .update({
                feor_code: feorCode || undefined,
                job_title: feorDesc || undefined,
                weekly_hours: weeklyHours,
                start_date: startDate || undefined,
                end_date: endDate,
                insurance_relationship_code: relCode || undefined,
              })
              .eq('id', existingJob.id);
          }
          syncedCount++;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          resultCode: navJson.resultCode,
          requestData: navJson.requestData,
          foglalkoztatottak: workers,
          synced_count: syncedCount,
          is_pending: navJson.resultCode === 'FOLYAMATBAN',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: SYNC EFO (EgyszerusitettFoglalkoztatasFoglalkoztatottLista)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'sync_efo') {
      const targetYear = body.target_year || new Date().getFullYear();
      const msgId = crypto.randomUUID();
      const tsUtc = getUtcTimestamp();
      const sig = await createSignature(msgId, tsUtc, '', signatureKey);

      const queryUrl = `${baseUrl}/rest-api/1.0/NavM2mAdozo/adozoService/EgyszerusitettFoglalkoztatasFoglalkoztatottLista/${targetTaxId}?targyEv=${targetYear}&signature=${encodeURIComponent(sig)}`;

      const navResp = await fetch(queryUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${phantomToken}`,
          'messageId': msgId,
        },
      });

      const navJson = await navResp.json();

      // Upsert into accounty_efo_entries if employees found
      const workers = navJson.foglalkoztatott || [];
      for (const w of workers) {
        await adminClient.from('accounty_efo_entries').upsert(
          {
            company_id,
            tax_id: w.adoazonositoJel,
            name: w.nev,
            taj_number: w.tajSzam || null,
            target_year: targetYear,
            days_alkalmi: w.felhasznaltNapok?.alkalmi || 0,
            days_mezogazdasag: w.felhasznaltNapok?.mezogazdasag || 0,
            days_turisztika: w.felhasznaltNapok?.turisztika || 0,
            days_filmipar: w.felhasznaltNapok?.filmipar || 0,
            days_total_used: w.felhasznaltNapok?.osszes || 0,
            days_total_available: w.felhasznalhatoNapok?.osszes ?? 120,
            days_agri_available: w.felhasznalhatoNapok?.mezogazdasag ?? 90,
            last_sync_at: new Date().toISOString(),
          },
          { onConflict: 'company_id,tax_id,target_year' }
        );
      }

      await adminClient.from('nav_m2m_audit_logs').insert({
        company_id,
        user_id: callerUserId,
        environment,
        action: 'query_efo',
        endpoint: '/EgyszerusitettFoglalkoztatasFoglalkoztatottLista',
        request_id: msgId,
        target_tax_id: targetTaxId,
        status_code: navResp.status,
        result_code: navJson.resultCode,
        result_message: navJson.resultMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: true,
          resultCode: navJson.resultCode,
          count: workers.length,
          workers,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTION: TEST HEALTH / KOMA (KoztartozasMentesseg)
    // ═══════════════════════════════════════════════════════════════
    if (action === 'test_health') {
      const msgId = crypto.randomUUID();
      const tsUtc = getUtcTimestamp();
      const sig = await createSignature(msgId, tsUtc, '', signatureKey);

      const queryUrl = `${baseUrl}/rest-api/1.0/NavM2mAdozo/adozoService/KoztartozasMentesseg/${targetTaxId}?signature=${encodeURIComponent(sig)}`;

      const navResp = await fetch(queryUrl, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${phantomToken}`,
          'messageId': msgId,
        },
      });

      const navJson = await navResp.json();

      await adminClient.from('nav_m2m_audit_logs').insert({
        company_id,
        user_id: callerUserId,
        environment,
        action: 'health_check_koma',
        endpoint: '/KoztartozasMentesseg',
        request_id: msgId,
        target_tax_id: targetTaxId,
        status_code: navResp.status,
        result_code: navJson.resultCode,
        result_message: navJson.resultMessage,
        duration_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({
          success: navJson.resultCode === 'SIKERES',
          resultCode: navJson.resultCode,
          data: navJson,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ error: `Ismeretlen művelet: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || 'Belső szerverhiba', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
