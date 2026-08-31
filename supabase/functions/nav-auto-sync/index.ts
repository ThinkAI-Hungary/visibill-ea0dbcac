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

  // Auth guard: only allow pg_cron and authorized callers with CRON_SECRET
  const cronSecret = Deno.env.get('CRON_SECRET');
  const providedSecret = req.headers.get('x-cron-secret');
  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let requestBody: any = {};
    try { requestBody = await req.json(); } catch { /* empty body is allowed */ }

    const depth = requestBody.depth || 0;
    const detailsOnly = requestBody.detailsOnly || false;
    const MAX_DEPTH = 10;

    if (depth >= MAX_DEPTH) {
      console.log(`[NAV-AUTO-SYNC] Max reinvocation depth (${MAX_DEPTH}) reached. Stopping.`);
      return new Response(
        JSON.stringify({ success: true, message: `Max depth ${MAX_DEPTH} reached`, depth }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NAV-AUTO-SYNC] Starting automatic NAV sync (depth: ${depth}, detailsOnly: ${detailsOnly})`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
    const ingestionService = new NavIngestionService(supabase);

    const { data: companiesWithCreds, error: companiesError } = await supabase
      .from('user_nav_credentials')
      .select('user_id, company_id, nav_username, auto_sync_enabled, sync_frequency')
      .eq('validation_status', 'valid')
      .not('company_id', 'is', null);

    if (companiesError) {
      throw new Error(`Failed to fetch companies: ${companiesError.message}`);
    }

    const activeCompanies = (companiesWithCreds || []).filter(c => 
      c.auto_sync_enabled !== false && 
      (!requestBody.companyId || c.company_id === requestBody.companyId)
    );

    if (activeCompanies.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No companies to sync', companies_processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NAV-AUTO-SYNC] Found ${activeCompanies.length} active companies to sync`);

    const startTime = Date.now();
    const results = {
      total_companies: activeCompanies.length,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };

    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 90);
    const dateToStr = dateTo.toISOString().split('T')[0];
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    for (const company of activeCompanies) {
      console.log(`[NAV-AUTO-SYNC] Processing company: ${company.company_id} (user: ${company.user_id})`);

      try {
        // Frequency check (skip if already synced recently, unless forceSync is set)
        if (!detailsOnly && !requestBody.forceSync) {
          const frequency = company.sync_frequency || 'daily';
          const { data: lastSyncLogs } = await supabase
            .from('nav_sync_logs')
            .select('completed_at')
            .eq('company_id', company.company_id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1);

          if (lastSyncLogs && lastSyncLogs.length > 0 && lastSyncLogs[0].completed_at) {
            const lastSyncTime = new Date(lastSyncLogs[0].completed_at).getTime();
            const hoursSinceLastSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

            if (frequency === 'daily' && hoursSinceLastSync < 20) {
              results.details.push({
                company_id: company.company_id,
                status: 'skipped',
                reason: 'daily limit (synced less than 20h ago)'
              });
              continue;
            }

            if (frequency === 'weekly' && hoursSinceLastSync < 24 * 6) {
              results.details.push({
                company_id: company.company_id,
                status: 'skipped',
                reason: 'weekly limit (synced less than 6d ago)'
              });
              continue;
            }
          }
        }

        // Execute OUTBOUND & INBOUND sync
        const outboundResult = await ingestionService.executeSync({
          userId: company.user_id,
          companyId: company.company_id,
          direction: 'OUTBOUND',
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          fetchDetailedItems: true,
          syncType: 'cron'
        });

        const inboundResult = await ingestionService.executeSync({
          userId: company.user_id,
          companyId: company.company_id,
          direction: 'INBOUND',
          dateFrom: dateFromStr,
          dateTo: dateToStr,
          fetchDetailedItems: true,
          syncType: 'cron'
        });

        results.successful++;
        results.details.push({
          company_id: company.company_id,
          status: 'success',
          outbound_count: outboundResult.totalFetched,
          inbound_count: inboundResult.totalFetched
        });

      } catch (companyErr: any) {
        console.error(`[NAV-AUTO-SYNC] Error syncing company ${company.company_id}:`, companyErr);
        results.failed++;
        results.details.push({
          company_id: company.company_id,
          status: 'error',
          error: companyErr?.message || String(companyErr)
        });
      }
    }

    // Optional webhook trigger for invoice categorization
    const webhookUrl = Deno.env.get('NAV_INVOICES_KATEGORIZALAS_WEBHOOK_URL');
    if (webhookUrl && results.successful > 0 && !detailsOnly) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'nav_auto_sync_completed',
            timestamp: new Date().toISOString(),
            companies_synced: results.successful
          })
        });
      } catch (hookErr) {
        console.warn('[NAV-AUTO-SYNC] Categorization webhook warning:', hookErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summary: results,
        duration_ms: Date.now() - startTime
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[NAV-AUTO-SYNC] Global Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
