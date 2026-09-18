import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { NavIngestionService } from '../_shared/nav/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function calculateDynamicDateFrom(
  supabase: any,
  companyId: string,
  direction: 'OUTBOUND' | 'INBOUND',
  requestedDateFrom?: string
): Promise<string> {
  if (requestedDateFrom) return requestedDateFrom;

  const now = new Date();
  const maxLookbackDate = new Date(now);
  maxLookbackDate.setDate(maxLookbackDate.getDate() - 365); // maximum 365 days lookback

  const defaultLookbackDate = new Date(now);
  defaultLookbackDate.setDate(defaultLookbackDate.getDate() - 90); // default 90 days

  try {
    const { data: lastSuccessLog, error } = await supabase
      .from('nav_sync_logs')
      .select('date_to, completed_at, created_at')
      .eq('company_id', companyId)
      .eq('invoice_direction', direction)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (!error && lastSuccessLog) {
      const rawDate = lastSuccessLog.date_to || lastSuccessLog.completed_at || lastSuccessLog.created_at;
      if (rawDate) {
        const lastDate = new Date(rawDate);
        if (!isNaN(lastDate.getTime())) {
          // Safety overlap of 2 days to capture any invoices arriving later on the sync date
          lastDate.setDate(lastDate.getDate() - 2);
          const effectiveDate = lastDate < maxLookbackDate ? maxLookbackDate : lastDate;
          return effectiveDate.toISOString().split('T')[0];
        }
      }
    }
  } catch (err) {
    console.warn(`[NAV-AUTO-SYNC] Could not calculate dynamic dateFrom for ${companyId} / ${direction}:`, err);
  }

  return defaultLookbackDate.toISOString().split('T')[0];
}

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
    const dateToStr = dateTo.toISOString().split('T')[0];

    for (const company of activeCompanies) {
      console.log(`[NAV-AUTO-SYNC] Processing company: ${company.company_id} (user: ${company.user_id})`);

      try {
        // Frequency check: only skip if BOTH OUTBOUND and INBOUND succeeded recently
        if (!detailsOnly && !requestBody.forceSync) {
          const frequency = company.sync_frequency || 'daily';
          const { data: recentCompletedLogs } = await supabase
            .from('nav_sync_logs')
            .select('invoice_direction, completed_at')
            .eq('company_id', company.company_id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(10);

          const lastOutbound = recentCompletedLogs?.find((l: any) => l.invoice_direction === 'OUTBOUND');
          const lastInbound = recentCompletedLogs?.find((l: any) => l.invoice_direction === 'INBOUND');

          const nowMs = Date.now();
          const outboundHours = lastOutbound?.completed_at ? (nowMs - new Date(lastOutbound.completed_at).getTime()) / (1000 * 60 * 60) : Infinity;
          const inboundHours = lastInbound?.completed_at ? (nowMs - new Date(lastInbound.completed_at).getTime()) / (1000 * 60 * 60) : Infinity;

          const limitHours = frequency === 'weekly' ? 24 * 6 : 20;

          if (outboundHours < limitHours && inboundHours < limitHours) {
            results.details.push({
              company_id: company.company_id,
              status: 'skipped',
              reason: `${frequency} limit (both directions synced less than ${limitHours}h ago)`
            });
            continue;
          }
        }

        // Calculate dynamic dateFrom independently per direction (up to 365 days lookback)
        const outboundDateFromStr = await calculateDynamicDateFrom(supabase, company.company_id, 'OUTBOUND', requestBody.dateFrom);
        const inboundDateFromStr = await calculateDynamicDateFrom(supabase, company.company_id, 'INBOUND', requestBody.dateFrom);

        console.log(`[NAV-AUTO-SYNC] Company ${company.company_id} date ranges - OUTBOUND: ${outboundDateFromStr} to ${dateToStr}, INBOUND: ${inboundDateFromStr} to ${dateToStr}`);

        // Execute OUTBOUND sync
        let outboundResult: any = null;
        let outboundError: any = null;
        try {
          outboundResult = await ingestionService.executeSync({
            userId: company.user_id,
            companyId: company.company_id,
            direction: 'OUTBOUND',
            dateFrom: outboundDateFromStr,
            dateTo: dateToStr,
            fetchDetailedItems: true,
            syncType: 'cron'
          });
        } catch (oErr: any) {
          outboundError = oErr;
          console.error(`[NAV-AUTO-SYNC] Outbound sync failed for company ${company.company_id}:`, oErr);
        }

        // Execute INBOUND sync
        let inboundResult: any = null;
        let inboundError: any = null;
        try {
          inboundResult = await ingestionService.executeSync({
            userId: company.user_id,
            companyId: company.company_id,
            direction: 'INBOUND',
            dateFrom: inboundDateFromStr,
            dateTo: dateToStr,
            fetchDetailedItems: true,
            syncType: 'cron'
          });
        } catch (iErr: any) {
          inboundError = iErr;
          console.error(`[NAV-AUTO-SYNC] Inbound sync failed for company ${company.company_id}:`, iErr);
        }

        if (outboundError && inboundError) {
          results.failed++;
          results.details.push({
            company_id: company.company_id,
            status: 'error',
            error: `Both directions failed. Outbound: ${outboundError?.message || outboundError}, Inbound: ${inboundError?.message || inboundError}`
          });
        } else if (outboundError || inboundError) {
          results.successful++; // partial success
          results.details.push({
            company_id: company.company_id,
            status: 'partial',
            outbound_count: outboundResult?.totalFetched ?? 0,
            inbound_count: inboundResult?.totalFetched ?? 0,
            outbound_error: outboundError ? (outboundError.message || String(outboundError)) : null,
            inbound_error: inboundError ? (inboundError.message || String(inboundError)) : null
          });
        } else {
          results.successful++;
          results.details.push({
            company_id: company.company_id,
            status: 'success',
            outbound_count: outboundResult?.totalFetched ?? 0,
            inbound_count: inboundResult?.totalFetched ?? 0
          });
        }

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
