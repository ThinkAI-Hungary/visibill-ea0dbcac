import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavIngestionService } from '../_shared/nav/index.ts';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { dateFrom, dateTo, additionalFilters, invoiceDirection = 'OUTBOUND', companyId } = await req.json();

    if (!dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: 'dateFrom and dateTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ingestionService = new NavIngestionService(serviceClient);

    const result = await ingestionService.executeSync({
      userId: user.id,
      companyId,
      direction: invoiceDirection as 'INBOUND' | 'OUTBOUND',
      dateFrom,
      dateTo,
      additionalFilters,
      fetchDetailedItems: true,
      syncType: 'manual'
    });

    return new Response(
      JSON.stringify({
        success: true,
        totalInvoices: result.totalFetched,
        count: result.totalFetched,
        invoices: result.invoices,
        detailsFetched: result.totalFetched,
        logId: result.syncLogId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[NAV-QUERY-OUTBOUND] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
