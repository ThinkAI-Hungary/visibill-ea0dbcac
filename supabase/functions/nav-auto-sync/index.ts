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

/**
 * Computes a deterministic sync bucket (0..totalBuckets-1) for a company UUID.
 * Distributes companies evenly across dawn time slots using UUID hexadecimal modulo.
 */
function getCompanySyncBucket(companyId: string, totalBuckets = 4): number {
  if (!companyId || typeof companyId !== 'string' || totalBuckets <= 1) return 0;
  const cleanHex = companyId.replace(/[^0-9a-fA-F]/g, '').slice(0, 8);
  if (!cleanHex) {
    let hash = 0;
    for (let i = 0; i < companyId.length; i++) {
      hash = (hash * 31 + companyId.charCodeAt(i)) >>> 0;
    }
    return hash % totalBuckets;
  }
  const intVal = parseInt(cleanHex, 16);
  return isNaN(intVal) ? 0 : Math.abs(intVal) % totalBuckets;
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

    const eligibleCompanies = (companiesWithCreds || []).filter(c => 
      c.auto_sync_enabled !== false && 
      (!requestBody.companyId || c.company_id === requestBody.companyId)
    );

    const TOTAL_BUCKETS = 4;
    let targetBucket: number | null = null;
    let staggeringActive = false;

    if (requestBody.companyId) {
      // Explicit single company sync bypasses staggering
      staggeringActive = false;
    } else if (requestBody.staggering === false || requestBody.stagger === false) {
      // Staggering explicitly disabled
      staggeringActive = false;
    } else if (requestBody.bucket !== undefined && requestBody.bucket !== null) {
      // Explicit bucket requested (e.g. testing or dedicated worker partition)
      targetBucket = Math.abs(parseInt(String(requestBody.bucket), 10)) % TOTAL_BUCKETS;
      staggeringActive = true;
    } else if (requestBody.forceSync) {
      // Force sync without explicit bucket processes all companies
      staggeringActive = false;
    } else {
      // Default cron mode: check if running during scheduled dawn staggering window (01:00 - 04:59 UTC)
      const currentUtcHour = new Date().getUTCHours();
      if (currentUtcHour >= 1 && currentUtcHour <= 4) {
        // UTC 01:00 -> Bucket 0
        // UTC 02:00 -> Bucket 1
        // UTC 03:00 -> Bucket 2
        // UTC 04:00 -> Bucket 3
        targetBucket = currentUtcHour - 1;
        staggeringActive = true;
      } else {
        // Outside dawn window, run all unless bucket is specified
        staggeringActive = false;
      }
    }

    const activeCompanies = (staggeringActive && targetBucket !== null)
      ? eligibleCompanies.filter(c => getCompanySyncBucket(c.company_id, TOTAL_BUCKETS) === targetBucket)
      : eligibleCompanies;

    if (activeCompanies.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: staggeringActive
            ? `No companies assigned to slot ${targetBucket} (total eligible: ${eligibleCompanies.length})`
            : 'No companies to sync',
          slot: targetBucket,
          total_eligible: eligibleCompanies.length,
          companies_processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[NAV-AUTO-SYNC] Total eligible companies: ${eligibleCompanies.length}. ` +
      (staggeringActive
        ? `Staggering ACTIVE: Slot ${(targetBucket ?? 0) + 1}/${TOTAL_BUCKETS} (Bucket ${targetBucket}) -> ${activeCompanies.length} companies assigned to this window.`
        : `Staggering BYPASSED: Processing all ${activeCompanies.length} companies.`)
    );

    const startTime = Date.now();
    const results = {
      total_eligible: eligibleCompanies.length,
      staggering: staggeringActive,
      bucket: targetBucket,
      total_companies: activeCompanies.length,
      successful: 0,
      failed: 0,
      details: [] as any[]
    };

    const dateTo = new Date();
    const dateToStr = dateTo.toISOString().split('T')[0];
    const companiesToCategorize: { companyId: string; userId: string }[] = [];

    for (const company of activeCompanies) {
      console.log(`[NAV-AUTO-SYNC] [Bucket ${targetBucket !== null ? targetBucket : 'all'}] Processing company: ${company.company_id} (user: ${company.user_id})`);

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

        const inboundFetched = inboundResult?.totalFetched ?? 0;
        if (inboundFetched > 0) {
          companiesToCategorize.push({
            companyId: company.company_id,
            userId: company.user_id,
          });
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
            inbound_count: inboundFetched,
            outbound_error: outboundError ? (outboundError.message || String(outboundError)) : null,
            inbound_error: inboundError ? (inboundError.message || String(inboundError)) : null
          });
        } else {
          results.successful++;
          results.details.push({
            company_id: company.company_id,
            status: 'success',
            outbound_count: outboundResult?.totalFetched ?? 0,
            inbound_count: inboundFetched
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

    // Trigger automatic background categorization for companies with new inbound invoices
    if (companiesToCategorize.length > 0 && !detailsOnly) {
      console.log(`[NAV-AUTO-SYNC] Triggering auto-categorization for ${companiesToCategorize.length} companies...`);
      for (const item of companiesToCategorize) {
        try {
          const autoCatResponse = await fetch(`${supabaseUrl}/functions/v1/auto-categorize-invoices`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              companyId: item.companyId,
              userId: item.userId,
              limit: 200,
            }),
          });
          if (!autoCatResponse.ok) {
            const errText = await autoCatResponse.text();
            console.warn(`[NAV-AUTO-SYNC] Auto-categorization failed for company ${item.companyId}: ${autoCatResponse.status} ${errText}`);
          } else {
            const autoCatData = await autoCatResponse.json();
            console.log(`[NAV-AUTO-SYNC] Auto-categorization completed for company ${item.companyId}:`, autoCatData);
          }
        } catch (catErr: any) {
          console.warn(`[NAV-AUTO-SYNC] Auto-categorization invocation error for ${item.companyId}:`, catErr);
        }
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
