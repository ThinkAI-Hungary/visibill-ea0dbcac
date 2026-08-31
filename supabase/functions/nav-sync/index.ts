import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavIngestionService } from '../_shared/nav/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const syncParams = await req.json();
    const { direction, dateFrom, dateTo, page, companyId } = syncParams;

    if (!direction || !['INBOUND', 'OUTBOUND'].includes(direction)) {
      throw new Error('direction is required (INBOUND or OUTBOUND)');
    }

    const ingestionService = new NavIngestionService(supabaseClient);

    const result = await ingestionService.executeSync({
      userId: user.id,
      companyId: companyId || null,
      direction,
      dateFrom,
      dateTo,
      page,
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
    console.error('[NAV-SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
