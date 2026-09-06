import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavIngestionService } from '../_shared/nav/index.ts';
import { corsHeaders, checkAutomationShield } from '../_shared/client-guard.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const automationBlock = checkAutomationShield(req);
  if (automationBlock) {
    return automationBlock;
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { invoiceDirection, dateFrom, dateTo, page = 1, companyId } = await req.json();

    if (!invoiceDirection || !['INBOUND', 'OUTBOUND'].includes(invoiceDirection)) {
      return new Response(
        JSON.stringify({ error: 'invoiceDirection is required (OUTBOUND or INBOUND)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const ingestionService = new NavIngestionService(serviceClient);

    const result = await ingestionService.executeSync({
      userId: user.id,
      companyId: companyId || null,
      direction: invoiceDirection,
      dateFrom,
      dateTo,
      page,
      syncType: 'single_query'
    });

    return new Response(
      JSON.stringify({
        success: true,
        invoices: result.invoices,
        totalInvoices: result.invoices.length,
        count: result.invoices.length,
        page
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[QUERY-NAV-INVOICES] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});