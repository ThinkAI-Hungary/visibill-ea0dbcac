import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceWithItems {
  id: string;
  invoice_number: string;
  invoice_direction: string;
  supplier_name: string | null;
  customer_name: string | null;
  company_id: string;
  nav_invoice_items: {
    line_description: string | null;
    product_code: string | null;
    net_amount: number | null;
  }[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { companyId, syncType = 'manual', invoiceNumbers, forceRecategorizeIds = [] } = body;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing companyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TRIGGER-NAV-CATEGORIZATION] Starting for company ${companyId}, syncType: ${syncType}, forceRecategorizeIds: ${forceRecategorizeIds.length}`);

    // Get webhook URL
    const webhookUrl = Deno.env.get('NAV_INVOICES_KATEGORIZALAS_WEBHOOK_URL');
    console.log(`[TRIGGER-NAV-CATEGORIZATION] Webhook URL: ${webhookUrl ? `SET (ends: ...${webhookUrl.slice(-30)})` : 'NOT SET'}`);

    if (!webhookUrl || !webhookUrl.startsWith('http')) {
      console.log('[TRIGGER-NAV-CATEGORIZATION] No valid webhook URL configured, skipping');
      return new Response(
        JSON.stringify({ success: true, message: 'No webhook configured', webhookTriggered: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Common select fields for invoices with items
    const selectFields = `
      id,
      invoice_number,
      invoice_direction,
      supplier_name,
      customer_name,
      company_id,
      category_id,
      project_id,
      nav_invoice_items (
        line_description,
        product_code,
        net_amount
      )
    `;

    // 1. Fetch uncategorized invoices (missing category_id OR project_id)
    let uncategorizedQuery = serviceClient
      .from('nav_invoices')
      .select(selectFields)
      .eq('user_id', user.id)
      .eq('company_id', companyId)
      .or('category_id.is.null,project_id.is.null');

    // If specific invoice numbers provided, filter by them
    if (invoiceNumbers && invoiceNumbers.length > 0) {
      uncategorizedQuery = uncategorizedQuery.in('invoice_number', invoiceNumbers);
    }

    const { data: uncategorizedInvoices, error: uncatError } = await uncategorizedQuery;

    if (uncatError) {
      console.error('[TRIGGER-NAV-CATEGORIZATION] Failed to fetch uncategorized invoices:', uncatError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invoices', details: uncatError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fetch force recategorize invoices (if any IDs provided)
    let forceInvoices: InvoiceWithItems[] = [];
    if (forceRecategorizeIds && forceRecategorizeIds.length > 0) {
      const { data: forceData, error: forceError } = await serviceClient
        .from('nav_invoices')
        .select(selectFields)
        .eq('user_id', user.id)
        .eq('company_id', companyId)
        .in('id', forceRecategorizeIds);

      if (forceError) {
        console.error('[TRIGGER-NAV-CATEGORIZATION] Failed to fetch force recategorize invoices:', forceError);
      } else if (forceData) {
        forceInvoices = forceData as InvoiceWithItems[];
        console.log(`[TRIGGER-NAV-CATEGORIZATION] Found ${forceInvoices.length} force recategorize invoices`);
      }
    }

    // 3. Combine and deduplicate invoices by ID
    const allInvoiceIds = new Set<string>();
    const invoicesWithItems: InvoiceWithItems[] = [];

    [...(uncategorizedInvoices || []), ...forceInvoices].forEach((inv: InvoiceWithItems) => {
      if (!allInvoiceIds.has(inv.id)) {
        allInvoiceIds.add(inv.id);
        invoicesWithItems.push(inv);
      }
    });

    if (invoicesWithItems.length === 0) {
      console.log('[TRIGGER-NAV-CATEGORIZATION] No invoices to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No invoices to process', webhookTriggered: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Separate by direction
    const outboundInvoices = invoicesWithItems.filter((inv: InvoiceWithItems) => inv.invoice_direction === 'OUTBOUND');
    const inboundInvoices = invoicesWithItems.filter((inv: InvoiceWithItems) => inv.invoice_direction === 'INBOUND');

    // Build payload with both directions
    const payload = {
      syncType,
      userId: user.id,
      companyId,
      invoiceDirections: ['OUTBOUND', 'INBOUND'],
      outboundCount: outboundInvoices.length,
      inboundCount: inboundInvoices.length,
      totalCount: invoicesWithItems.length,
      invoices: invoicesWithItems
    };

    console.log(`[TRIGGER-NAV-CATEGORIZATION] Payload: ${outboundInvoices.length} OUTBOUND, ${inboundInvoices.length} INBOUND, ${invoicesWithItems.length} total (${forceRecategorizeIds.length} force recategorize)`);

    // Single webhook call
    try {
      console.log(`[TRIGGER-NAV-CATEGORIZATION] Calling webhook: ...${webhookUrl.slice(-40)}`);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responseText = await response.text();
      console.log(`[TRIGGER-NAV-CATEGORIZATION] Webhook response - Status: ${response.status}, Body: ${responseText.slice(0, 200)}`);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          webhookTriggered: true,
          outboundCount: outboundInvoices.length,
          inboundCount: inboundInvoices.length,
          totalCount: invoicesWithItems.length,
          forceRecategorizeCount: forceRecategorizeIds.length,
          filteredMessage: 'Uncategorized + force recategorize invoices sent',
          webhookStatus: response.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchErr) {
      console.error(`[TRIGGER-NAV-CATEGORIZATION] Webhook fetch error:`, fetchErr);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Webhook call failed',
          details: fetchErr.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[TRIGGER-NAV-CATEGORIZATION] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
