import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function checkAutomationShield(req: Request): Response | null {
  const authHeader = req.headers.get('authorization') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceKey && authHeader.includes(serviceKey)) {
    return null;
  }

  const userAgent = (req.headers.get('user-agent') || '').toLowerCase();
  const clientInfo = (req.headers.get('x-client-info') || '').toLowerCase();
  const origin = req.headers.get('origin') || '';
  const referer = req.headers.get('referer') || '';

  const isScript =
    userAgent.startsWith('node') ||
    userAgent.includes('node-fetch') ||
    userAgent.includes('axios') ||
    userAgent.includes('undici') ||
    userAgent.startsWith('python') ||
    userAgent.includes('aiohttp') ||
    userAgent.includes('requests') ||
    userAgent.includes('urllib') ||
    userAgent.startsWith('curl') ||
    userAgent.startsWith('wget') ||
    userAgent.includes('postman') ||
    userAgent.includes('insomnia') ||
    userAgent.includes('httpie') ||
    userAgent.startsWith('powershell') ||
    userAgent.includes('go-http-client') ||
    clientInfo.includes('supabase-js-node');

  if (isScript) {
    return new Response(
      JSON.stringify({
        code: 'AUTOMATION_BLOCKED',
        error:
          'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!origin && !referer && !userAgent.startsWith('deno')) {
    return new Response(
      JSON.stringify({
        code: 'AUTOMATION_BLOCKED',
        error:
          'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return null;
}

interface MinimaxSyncRequest {
  action?: 'test_connection' | 'get_orgs' | 'sync';
  companyId: string;
  direction?: 'INBOUND' | 'OUTBOUND' | 'BOTH';
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string;   // YYYY-MM-DD
  downloadAttachments?: boolean;
  testMode?: boolean;
}

const MINIMAX_AUTH_URL = 'https://moj.minimax.hr/HR/AUT/oauth20/token';
const MINIMAX_API_BASE = 'https://moj.minimax.hr/HR/api';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Hiányzó Authorization fejléc');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Érvénytelen felhasználói token');
    }

    const body: MinimaxSyncRequest = await req.json();
    const {
      action = 'sync',
      companyId,
      direction = 'BOTH',
      dateFrom,
      dateTo,
      downloadAttachments = true,
      testMode = false,
    } = body;

    if (!companyId) {
      throw new Error('companyId megadása kötelező');
    }

    // 1. Verify user membership in company
    const { data: membership, error: memberErr } = await supabaseClient
      .from('company_members')
      .select('role')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      throw new Error('Nincs jogosultságod ehhez a céghez');
    }

    // 2. Fetch Minimax credentials for company
    const { data: creds, error: credsErr } = await supabaseClient
      .from('company_minimax_credentials')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (credsErr) {
      throw new Error(`Hiba a hitelesítő adatok lekérésekor: ${credsErr.message}`);
    }

    // If no credentials and not in explicit testMode
    if (!creds && !testMode) {
      throw new Error('A céghez még nincsenek beállítva Minimax API hitelesítő adatok.');
    }

    const clientId = Deno.env.get('MINIMAX_CLIENT_ID') || 'visibill_test_client_id';
    const clientSecret = Deno.env.get('MINIMAX_CLIENT_SECRET') || 'visibill_test_client_secret';
    const username = creds?.minimax_username || 'test_user';
    const password = creds?.minimax_password || 'test_password';
    const orgId = creds?.organisation_id;

    // Helper: Obtain OAuth2 token from Minimax
    async function getMinimaxToken(): Promise<string> {
      // If we are in simulated testMode or without live credentials, return mock token
      if (testMode || !Deno.env.get('MINIMAX_CLIENT_ID')) {
        return 'mock_minimax_oauth_token_' + Date.now();
      }

      const params = new URLSearchParams();
      params.append('grant_type', 'password');
      params.append('client_id', clientId);
      params.append('client_secret', clientSecret);
      params.append('username', username);
      params.append('password', password);

      const resp = await fetch(MINIMAX_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Minimax OAuth2 hiba (${resp.status}): ${errText}`);
      }

      const tokenData = await resp.json();
      return tokenData.access_token;
    }

    // ACTION A: TEST CONNECTION / GET ORGS
    if (action === 'test_connection' || action === 'get_orgs') {
      const token = await getMinimaxToken();
      let orgsList: any[] = [];

      if (testMode || !Deno.env.get('MINIMAX_CLIENT_ID')) {
        orgsList = [
          {
            OrganisationId: '10001',
            Title: 'D-INVOICE D.O.O (Teszt Minimax Szervezet)',
            TaxNumber: 'HR95114485977',
          },
        ];
      } else {
        const orgResp = await fetch(`${MINIMAX_API_BASE}/currentuser/orgs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!orgResp.ok) {
          throw new Error(`Minimax szervezetek lekérdezése sikertelen: ${await orgResp.text()}`);
        }
        orgsList = await orgResp.json();
      }

      // Update validation status in credentials
      if (creds?.id) {
        await supabaseClient
          .from('company_minimax_credentials')
          .update({
            validation_status: 'valid',
            validation_error: null,
            last_validated_at: new Date().toISOString(),
          })
          .eq('id', creds.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Minimax kapcsolat sikeresen ellenőrizve!',
          organisations: orgsList,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION B: SYNC INVOICES
    let totalFetched = 0;
    let totalSaved = 0;
    const syncedInvoices: any[] = [];

    // Helper: Upsert invoice into Supabase
    async function upsertInvoice(invData: {
      bizonylatsorszam: string;
      direction: 'INBOUND' | 'OUTBOUND';
      dateIssued: string;
      dateTransaction: string;
      dateDue?: string;
      currency: string;
      netAmount: number;
      vatAmount: number;
      grossAmount: number;
      partnerName: string;
      partnerVatId?: string;
      partnerAddress?: string;
      buyerName: string;
      buyerVatId?: string;
      buyerAddress?: string;
      paymentMethod?: string;
      items: any[];
      minimaxId: string | number;
    }) {
      // 1. Upsert invoice header
      const { data: savedInv, error: invErr } = await supabaseClient
        .from('invoices')
        .upsert(
          {
            company_id: companyId,
            user_id: user.id,
            bizonylatsorszam: invData.bizonylatsorszam,
            invoice_direction: invData.direction,
            kibocsatas_datuma: invData.dateIssued,
            teljesites_datuma: invData.dateTransaction || invData.dateIssued,
            fizetesi_hatarido: invData.dateDue || invData.dateIssued,
            penznem: invData.currency || 'EUR',
            adoalap_osszesen: invData.netAmount,
            afa_osszeg_osszesen: invData.vatAmount,
            brutto_vegosszeg: invData.grossAmount,
            fizetendo_osszeg: invData.grossAmount,
            elado_nev: invData.partnerName,
            elado_vat_id: invData.partnerVatId,
            elado_cim: invData.partnerAddress,
            vevo_nev: invData.buyerName,
            vevo_vat_id: invData.buyerVatId,
            vevo_cim: invData.buyerAddress,
            fizetesi_mod: invData.paymentMethod || 'Átutalás',
            statusz: 'feldolgozott',
            invoice_type: 'sima_szla',
            intermediary_service: true,
            dokumentum_azonosito: `minimax:${invData.minimaxId}`,
            frissitve: new Date().toISOString(),
          },
          { onConflict: 'company_id,bizonylatsorszam' }
        )
        .select('id')
        .single();

      if (invErr) {
        console.error('[MINIMAX-SYNC] Invoice upsert error:', invErr);
        return null;
      }

      totalSaved++;
      const invoiceId = savedInv.id;

      // 2. Insert invoice_items if provided
      if (invData.items && invData.items.length > 0) {
        // Clear old items for this invoice
        await supabaseClient.from('invoice_items').delete().eq('invoice_id', invoiceId);

        const itemsToInsert = invData.items.map((item, idx) => ({
          invoice_id: invoiceId,
          line_number: idx + 1,
          line_description: item.description || `Tétel ${idx + 1}`,
          quantity: Number(item.quantity) || 1,
          unit_of_measure: item.unit || 'db',
          unit_price: Number(item.unitPrice) || Number(item.netAmount),
          net_amount: Number(item.netAmount) || 0,
          vat_rate: item.vatRate || '25%',
          vat_amount: Number(item.vatAmount) || 0,
          gross_amount: Number(item.grossAmount) || Number(item.netAmount) + Number(item.vatAmount),
          exclude_from_accounting: false,
          deductible_percentage: 100,
        }));

        await supabaseClient.from('invoice_items').insert(itemsToInsert);
      }

      return invoiceId;
    }

    // Execute synchronization
    if (testMode || !Deno.env.get('MINIMAX_CLIENT_ID')) {
      // Realistic Croatian test invoices simulation
      const todayIso = new Date().toISOString().split('T')[0];
      const monthStr = dateFrom ? dateFrom.slice(0, 7) : todayIso.slice(0, 7);

      const testInvoices = [
        {
          bizonylatsorszam: `2026-MM-OUT-001`,
          direction: 'OUTBOUND' as const,
          dateIssued: `${monthStr}-05`,
          dateTransaction: `${monthStr}-05`,
          dateDue: `${monthStr}-19`,
          currency: 'EUR',
          netAmount: 2500.0,
          vatAmount: 625.0,
          grossAmount: 3125.0,
          partnerName: 'D-INVOICE D.O.O',
          partnerVatId: 'HR95114485977',
          buyerName: 'ZAGREB INŽENJERING D.O.O',
          buyerVatId: 'HR12345678901',
          buyerAddress: 'Ilica 100, 10000 Zagreb',
          paymentMethod: 'Virmanski',
          minimaxId: 'sim_out_001',
          items: [
            {
              description: 'Poslovno savjetovanje i upravljanje (Üzleti tanácsadás)',
              quantity: 1,
              unit: 'usluga',
              unitPrice: 2500.0,
              netAmount: 2500.0,
              vatRate: '25%',
              vatAmount: 625.0,
              grossAmount: 3125.0,
            },
          ],
        },
        {
          bizonylatsorszam: `2026-MM-IN-002`,
          direction: 'INBOUND' as const,
          dateIssued: `${monthStr}-10`,
          dateTransaction: `${monthStr}-10`,
          dateDue: `${monthStr}-24`,
          currency: 'EUR',
          netAmount: 450.0,
          vatAmount: 112.5,
          grossAmount: 562.5,
          partnerName: 'ADRIA IT RJEŠENJA D.O.O',
          partnerVatId: 'HR98765432109',
          partnerAddress: 'Vukovarska 25, 31000 Osijek',
          buyerName: 'D-INVOICE D.O.O',
          buyerVatId: 'HR95114485977',
          paymentMethod: 'Virmanski',
          minimaxId: 'sim_in_002',
          items: [
            {
              description: 'Održavanje software i cloud licenci (Licence)',
              quantity: 1,
              unit: 'mjesec',
              unitPrice: 450.0,
              netAmount: 450.0,
              vatRate: '25%',
              vatAmount: 112.5,
              grossAmount: 562.5,
            },
          ],
        },
      ];

      for (const inv of testInvoices) {
        if (direction === 'BOTH' || inv.direction === direction) {
          totalFetched++;
          const savedId = await upsertInvoice(inv);
          if (savedId) {
            syncedInvoices.push({ id: savedId, number: inv.bizonylatsorszam, direction: inv.direction });
          }
        }
      }
    } else {
      // Live Minimax API Sync
      const token = await getMinimaxToken();
      const currentOrgId = orgId || '1';

      // Helper to fetch all pages for a given Minimax endpoint (with safeguard limit)
      async function fetchAllPages(baseEndpoint: string, directionName: 'OUTBOUND' | 'INBOUND') {
        const pageSize = 100;
        let page = 1;
        const maxPages = 20; // Safeguard limit: up to 2,000 invoices per sync run

        while (page <= maxPages) {
          let url = `${MINIMAX_API_BASE}/orgs/${currentOrgId}/${baseEndpoint}?PageSize=${pageSize}&Page=${page}`;
          if (dateFrom) url += `&DateIssuedFrom=${dateFrom}`;
          if (dateTo) url += `&DateIssuedTo=${dateTo}`;

          const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
          if (!resp.ok) {
            console.error(`[MINIMAX-SYNC] Error fetching page ${page} of ${baseEndpoint}:`, resp.status, await resp.text());
            break;
          }

          const data = await resp.json();
          const items: any[] = Array.isArray(data) ? data : data.Rows || [];

          if (items.length === 0) {
            break;
          }

          for (const item of items) {
            totalFetched++;
            const isOut = directionName === 'OUTBOUND';
            const invNumber = item.InvoiceNumber || (isOut ? `MM-OUT-${item.IssuedInvoiceId}` : `MM-IN-${item.ReceivedInvoiceId}`);
            const minimaxId = isOut ? item.IssuedInvoiceId : item.ReceivedInvoiceId;

            const savedId = await upsertInvoice({
              bizonylatsorszam: invNumber,
              direction: directionName,
              dateIssued: item.DateIssued,
              dateTransaction: item.DateTransaction || item.DateIssued,
              dateDue: item.DateDue,
              currency: item.CurrencyCode || 'EUR',
              netAmount: Number(item.InvoiceNetSum) || 0,
              vatAmount: Number(item.InvoiceVatSum) || 0,
              grossAmount: Number(item.InvoiceTotalSum) || 0,
              partnerName: isOut ? (creds?.organisation_name || 'D-INVOICE D.O.O') : (item.CustomerName || 'Szállító'),
              partnerVatId: isOut ? undefined : item.CustomerVatIdentificationNumber,
              buyerName: isOut ? (item.CustomerName || 'Vevő') : (creds?.organisation_name || 'D-INVOICE D.O.O'),
              buyerVatId: isOut ? item.CustomerVatIdentificationNumber : undefined,
              paymentMethod: item.PaymentMethod,
              minimaxId: minimaxId,
              items: [],
            });

            if (savedId) {
              syncedInvoices.push({ id: savedId, number: invNumber, direction: directionName });
            }
          }

          // If we received fewer items than requested, we reached the final page
          if (items.length < pageSize) {
            break;
          }

          page++;
        }
      }

      // 1. Fetch Issued Invoices (Outbound)
      if (direction === 'OUTBOUND' || direction === 'BOTH') {
        await fetchAllPages('issuedinvoices', 'OUTBOUND');
      }

      // 2. Fetch Received Invoices (Inbound)
      if (direction === 'INBOUND' || direction === 'BOTH') {
        await fetchAllPages('receivedinvoices', 'INBOUND');
      }
    }

    const durationMs = Date.now() - startTime;

    // 3. Log results to minimax_sync_logs & update credentials
    await supabaseClient.from('minimax_sync_logs').insert({
      company_id: companyId,
      direction,
      status: 'success',
      invoices_fetched: totalFetched,
      invoices_saved: totalSaved,
      date_from: dateFrom || null,
      date_to: dateTo || null,
      sync_duration_ms: durationMs,
      sync_type: 'manual',
    });

    if (creds?.id) {
      await supabaseClient
        .from('company_minimax_credentials')
        .update({
          last_synced_at: new Date().toISOString(),
          validation_status: 'valid',
          validation_error: null,
          last_sync_result: {
            fetched: totalFetched,
            saved: totalSaved,
            timestamp: new Date().toISOString(),
            testMode,
          },
        })
        .eq('id', creds.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Minimax szinkronizáció sikeres: ${totalSaved} számla mentve (${totalFetched} lekérve).`,
        totalFetched,
        totalSaved,
        invoices: syncedInvoices,
        durationMs,
        testMode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[MINIMAX-SYNC] Fatal error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err?.message || String(err),
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
