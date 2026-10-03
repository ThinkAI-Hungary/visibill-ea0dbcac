import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavIngestionService } from '../_shared/nav/index.ts';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Kettős védelmi vonal (Script-runner és bot védelem, service_role bypass támogatással)
  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || '';
    const isServiceRole = serviceRoleKey && authHeader.includes(serviceRoleKey);

    let callerUserId: string | null = null;

    if (!isServiceRole) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization header is missing' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const anonClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const { data: { user }, error: userError } = await anonClient.auth.getUser();
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: invalid or expired session' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      callerUserId = user.id;
    }

    const body = await req.json().catch(() => ({}));
    const { companyId, invoiceId, invoiceNumbers, limit = 20 } = body;
    let userId = body.userId || callerUserId;

    if (!companyId && !invoiceId) {
      return new Response(
        JSON.stringify({ error: 'companyId or invoiceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mindig service_role klienst használunk a DB módosításokhoz és a titkosított creds eléréséhez
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const ingestionService = new NavIngestionService(serviceClient);

    let effectiveCompanyId = companyId;
    if (!effectiveCompanyId && invoiceId) {
      const { data: invRow } = await serviceClient
        .from('nav_invoices')
        .select('company_id')
        .eq('id', invoiceId)
        .maybeSingle();
      effectiveCompanyId = invRow?.company_id;
    }

    if (!effectiveCompanyId) {
      return new Response(
        JSON.stringify({ error: 'Could not resolve companyId for the specified invoice' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Jogosultság ellenőrzése (ha a hívó nem a belső service_role munkás, kötelező ellenőrizni a tagságot)
    if (!isServiceRole && callerUserId) {
      const { data: memberRow, error: memberError } = await serviceClient
        .from('company_members')
        .select('id')
        .eq('company_id', effectiveCompanyId)
        .eq('user_id', callerUserId)
        .maybeSingle();

      if (memberError || !memberRow) {
        return new Response(
          JSON.stringify({ error: 'Forbidden: you do not have permission to access this company' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const batchResult = await ingestionService.fetchDetailsBatch(
      userId,
      effectiveCompanyId,
      {
        limit: Math.min(Math.max(limit, 1), 50),
        invoiceId,
        invoiceNumbers
      }
    );

    return new Response(
      JSON.stringify({
        success: true,
        companyId: effectiveCompanyId,
        processedCount: batchResult.processedCount,
        failedCount: batchResult.failedCount,
        remainingCount: batchResult.remainingCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[NAV-FETCH-DETAILS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
