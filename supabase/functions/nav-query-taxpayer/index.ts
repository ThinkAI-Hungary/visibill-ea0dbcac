import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavClient, NavCredentials } from '../_shared/nav/index.ts';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

// Think AI Kft. mint platform fallback cégazonosító új felhasználói regisztrációkhoz
const THINKAI_FALLBACK_COMPANY_ID = 'ecf31039-b539-4e04-bbea-70ea48c701bb';

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 2. Kettős védelmi vonal (Script-runner és Bot védelem - ADR A-101)
  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // 3. Felhasználói autentikáció ellenőrzése
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Érvénytelen munkamenet vagy jogosulatlan hozzáférés', code: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Bemeneti paraméterek beolvasása és adószám normalizálása
    const body = await req.json().catch(() => ({}));
    const rawTaxNumber: string = body.taxNumber || '';
    const requestedCompanyId: string | undefined = body.companyId;

    const cleanTax = rawTaxNumber.replace(/[^0-9]/g, '').slice(0, 8);
    if (!cleanTax || cleanTax.length !== 8) {
      return new Response(
        JSON.stringify({
          error: 'Érvénytelen magyar adószám (legalább a 8 számjegyű törzsszám megadása kötelező)',
          code: 'INVALID_TAX_NUMBER'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 5. NAV hitelesítő adatok feloldása
    // Elsődleges: ha van megadott companyId, megpróbáljuk annak a kulcsait használni
    let credsResult: any = null;
    if (requestedCompanyId) {
      const { data } = await serviceClient.rpc('get_nav_credentials', {
        p_user_id: user.id,
        p_company_id: requestedCompanyId
      });
      if (data && !data.error) {
        credsResult = data;
      }
    }

    // Másodlagos: a felhasználóhoz rendelt közvetlen vagy cégtagsági hitelesítő keresése
    if (!credsResult) {
      const { data } = await serviceClient.rpc('get_nav_credentials', {
        p_user_id: user.id,
        p_company_id: null
      });
      if (data && !data.error) {
        credsResult = data;
      }
    }

    // Harmadlagos (Jóváhagyott fallback új regisztrációhoz): Think AI Kft. hivatalos platform kulcsa
    if (!credsResult) {
      const { data: fallbackData, error: fallbackError } = await serviceClient.rpc('get_nav_credentials', {
        p_user_id: null,
        p_company_id: THINKAI_FALLBACK_COMPANY_ID
      });
      if (!fallbackError && fallbackData && !fallbackData.error) {
        credsResult = fallbackData;
      }
    }

    if (!credsResult || credsResult.error) {
      return new Response(
        JSON.stringify({
          error: 'Nem érhető el érvényes NAV technikai felhasználó a lekérdezéshez.',
          code: 'NO_NAV_CREDENTIALS'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. NAV Online Számla v3 queryTaxpayer kérés indítása
    const navClient = new NavClient(credsResult as NavCredentials);
    const taxpayerDetails = await navClient.queryTaxpayer(cleanTax);

    return new Response(
      JSON.stringify({
        success: true,
        data: taxpayerDetails
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[NAV-QUERY-TAXPAYER] Hiba történt:', err);
    return new Response(
      JSON.stringify({
        error: err.message || 'Hiba történt a NAV adóalanyi lekérdezés során',
        code: 'QUERY_TAXPAYER_FAILED'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
