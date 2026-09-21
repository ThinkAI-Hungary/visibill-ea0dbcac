import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
        error: 'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!origin && !referer && !userAgent.startsWith('deno')) {
    return new Response(
      JSON.stringify({
        code: 'AUTOMATION_BLOCKED',
        error: 'A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!',
        details: 'Direct script automation is restricted. Please use the official Visibill web application.',
      }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Block unauthorized external script automation
  const blocked = checkAutomationShield(req);
  if (blocked) {
    return blocked;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const isServiceRole = token === supabaseServiceKey;
    let userId: string | null = null;

    if (isServiceRole) {
      // Internal or cron invocation
    } else {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error: authError } = await userClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = user.id;
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const {
      companyId,
      syncType = 'manual',
      forceRecategorizeIds,
      forceInvoiceIds,
    } = body;
    const forcedIds = forceRecategorizeIds || forceInvoiceIds;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing companyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TRIGGER-NAV-CATEGORIZATION] Forwarding to auto-categorize-invoices for company ${companyId}, user: ${userId}, syncType: ${syncType}, forcedCount: ${forcedIds?.length || 0}`);

    const runAutoCategorize = async () => {
      try {
        const autoCatResponse = await fetch(`${supabaseUrl}/functions/v1/auto-categorize-invoices`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyId,
            userId: userId || undefined,
            limit: 200,
            forceInvoiceIds: forcedIds && forcedIds.length > 0 ? forcedIds : undefined,
          }),
        });

        if (!autoCatResponse.ok) {
          const errText = await autoCatResponse.text();
          console.warn(`[TRIGGER-NAV-CATEGORIZATION] Background auto-categorize-invoices error (${autoCatResponse.status}): ${errText}`);
        } else {
          const autoCatData = await autoCatResponse.json();
          console.log(`[TRIGGER-NAV-CATEGORIZATION] Background auto-categorize-invoices completed for company ${companyId}:`, autoCatData);
        }
      } catch (catErr: any) {
        console.error('[TRIGGER-NAV-CATEGORIZATION] Background auto-categorize-invoices exception:', catErr);
      }
    };

    // Asynchronous background dispatch via EdgeRuntime.waitUntil (Prevents client timeouts)
    const edgeRuntime = (globalThis as unknown as { EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void } }).EdgeRuntime;
    if (edgeRuntime && typeof edgeRuntime.waitUntil === 'function') {
      edgeRuntime.waitUntil(runAutoCategorize());
      console.log(`[TRIGGER-NAV-CATEGORIZATION] Dispatched auto-categorize-invoices in background via EdgeRuntime.waitUntil for company ${companyId}`);
      return new Response(
        JSON.stringify({
          success: true,
          webhookTriggered: false,
          categorizationTriggered: true,
          async: true,
          message: 'Az automatikus számlakategorizálás a háttérben elindult',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback if EdgeRuntime.waitUntil is unavailable
    console.log(`[TRIGGER-NAV-CATEGORIZATION] EdgeRuntime.waitUntil unavailable, running synchronously`);
    await runAutoCategorize();
    return new Response(
      JSON.stringify({
        success: true,
        webhookTriggered: false,
        categorizationTriggered: true,
        async: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TRIGGER-NAV-CATEGORIZATION] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
