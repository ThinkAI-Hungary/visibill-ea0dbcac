import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();

    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Authentication failed');

    const { companyId, dateFrom, dateTo, invoiceDirection } = body;

    if (!companyId || !dateFrom || !dateTo) {
      throw new Error('Missing required fields: companyId, dateFrom, dateTo');
    }

    // ── Verify company membership ──
    const { data: membership } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('user_id', user.id)
      .single();

    if (!membership) throw new Error('User is not a member of this company');

    // ── Query invoices ──
    let invoiceQuery = supabase
      .from('invoices')
      .select('id, bizonylatsorszam, image_url, melleklet_url, kibocsatas_datuma', { count: 'exact' })
      .eq('company_id', companyId)
      .gte('kibocsatas_datuma', dateFrom)
      .lte('kibocsatas_datuma', dateTo)
      .order('kibocsatas_datuma', { ascending: true });

    if (invoiceDirection) {
      invoiceQuery = invoiceQuery.eq('invoice_direction', invoiceDirection);
    }

    const { data: invoices, error: queryError, count } = await invoiceQuery;
    if (queryError) throw new Error(`Invoice query failed: ${queryError.message}`);

    const totalInvoices = count || invoices?.length || 0;
    if (totalInvoices === 0) {
      return new Response(JSON.stringify({ error: 'Nincs számla a megadott időszakban' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const baseName = `${dateFrom}_${dateTo}_bekuldott_szamlak`;

    const invoiceList = (invoices || []).map((inv: any) => ({
      id: inv.id,
      name: inv.bizonylatsorszam || inv.id.slice(0, 8),
      url: inv.image_url || inv.melleklet_url,
    })).filter((inv: any) => inv.url);

    // ── Create job record ──
    const { data: job, error: jobError } = await supabase
      .from('pdf_export_jobs')
      .insert({
        company_id: companyId,
        user_id: user.id,
        status: 'queued',
        date_from: dateFrom,
        date_to: dateTo,
        invoice_direction: invoiceDirection || null,
        total_invoices: invoiceList.length,
        processed_invoices: 0,
        invoice_list: invoiceList,
        base_name: baseName,
      })
      .select('id')
      .single();

    if (jobError) throw new Error(`Job creation failed: ${jobError.message}`);

    const jobId = job.id;

    // ── Enqueue PGMQ message for worker ──
    const { error: queueError } = await supabase.rpc('pgmq_send_retry', {
      queue_name: 'pdf_export_jobs',
      msg: {
        job_id: jobId,
        company_id: companyId,
        user_id: user.id,
        invoice_list: invoiceList,
        base_name: baseName,
      },
    });

    if (queueError) {
      console.error('[PDF-EXPORT] PGMQ enqueue failed:', queueError);
      // Clean up the job record
      await supabase.from('pdf_export_jobs').delete().eq('id', jobId);
      throw new Error(`Queue enqueue failed: ${queueError.message}`);
    }

    console.log(`[PDF-EXPORT] Job ${jobId} created and enqueued (${invoiceList.length} invoices)`);

    return new Response(JSON.stringify({
      success: true,
      jobId,
      totalInvoices: invoiceList.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[PDF-EXPORT] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
