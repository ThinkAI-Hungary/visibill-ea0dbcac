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
    const { companyId, syncType = 'manual', invoiceNumbers } = body;

    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'Missing companyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TRIGGER-NAV-CATEGORIZATION] Starting for company ${companyId}, syncType: ${syncType}`);

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

    // Fetch invoices with line items
    let query = serviceClient
      .from('nav_invoices')
      .select(`
        id,
        invoice_number,
        invoice_direction,
        supplier_name,
        customer_name,
        company_id,
        nav_invoice_items (
          line_description,
          product_code,
          net_amount
        )
      `)
      .eq('user_id', user.id)
      .eq('company_id', companyId);

    // If specific invoice numbers provided, filter by them
    if (invoiceNumbers && invoiceNumbers.length > 0) {
      query = query.in('invoice_number', invoiceNumbers);
    }

    const { data: invoicesWithItems, error: fetchError } = await query;

    if (fetchError) {
      console.error('[TRIGGER-NAV-CATEGORIZATION] Failed to fetch invoices:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch invoices', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!invoicesWithItems || invoicesWithItems.length === 0) {
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

    console.log(`[TRIGGER-NAV-CATEGORIZATION] Payload: ${outboundInvoices.length} OUTBOUND, ${inboundInvoices.length} INBOUND, ${invoicesWithItems.length} total`);

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
