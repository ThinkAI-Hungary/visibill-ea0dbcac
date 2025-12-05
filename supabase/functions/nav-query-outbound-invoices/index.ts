import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { sha3_512 } from 'https://esm.sh/@noble/hashes@1.3.0/sha3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NavCredentials {
  nav_username: string;
  nav_password: string;
  nav_tax_number: string;
  nav_sign_key: string;
  nav_exchange_key: string;
  software_id: string;
  software_dev_name: string;
  software_dev_contact: string;
  is_test_environment: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[NAV-QUERY-OUTBOUND] Function started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get auth header for user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[NAV-QUERY-OUTBOUND] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client for user authentication (with user token)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Create service client for admin operations (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      console.error('[NAV-QUERY-OUTBOUND] Authentication failed:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] User authenticated:', user.id);

    // Parse request body
    const { dateFrom, dateTo, additionalFilters, invoiceDirection = 'OUTBOUND', companyId } = await req.json();
    
    if (!dateFrom || !dateTo) {
      return new Response(
        JSON.stringify({ error: 'dateFrom and dateTo are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // companyId is required for multi-tenancy
    if (!companyId) {
      return new Response(
        JSON.stringify({ error: 'companyId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate invoiceDirection
    if (!['INBOUND', 'OUTBOUND'].includes(invoiceDirection)) {
      return new Response(
        JSON.stringify({ error: 'invoiceDirection must be INBOUND or OUTBOUND' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate date range (max 35 days)
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff > 35) {
      return new Response(
        JSON.stringify({ error: 'Date range cannot exceed 35 days' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[NAV-QUERY-OUTBOUND] Date range:', { dateFrom, dateTo, daysDiff, companyId });

    const startTime = Date.now();

    // Create sync log entry using service client (bypasses RLS)
    const { data: logEntry, error: logError } = await serviceClient
      .from('nav_sync_logs')
      .insert({
        user_id: user.id,
        company_id: companyId,
        sync_type: 'manual',
        invoice_direction: invoiceDirection,
        date_from: dateFrom,
        date_to: dateTo,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to create sync log:', logError);
    }

    const syncLogId = logEntry?.id;
    console.log('[NAV-QUERY-OUTBOUND] Created sync log:', syncLogId);

    // Get credentials using service client - now by company_id
    const { data: credsData, error: credsError } = await serviceClient
      .from('user_nav_credentials')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (credsError || !credsData) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to get credentials:', credsError);
      
      // Update sync log with failure using service client
      if (syncLogId) {
        await serviceClient
          .from('nav_sync_logs')
          .update({
            status: 'failed',
            error_message: 'Failed to retrieve NAV credentials for company',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', syncLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to retrieve NAV credentials for company' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get decrypted credentials via RPC
    const { data: decryptedCreds, error: decryptError } = await serviceClient.rpc('get_nav_credentials', {
      p_user_id: user.id
    });

    if (decryptError || !decryptedCreds || decryptedCreds.error) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to decrypt credentials:', decryptError || decryptedCreds?.error);
      
      if (syncLogId) {
        await serviceClient
          .from('nav_sync_logs')
          .update({
            status: 'failed',
            error_message: 'Failed to decrypt NAV credentials',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime
          })
          .eq('id', syncLogId);
      }
      
      return new Response(
        JSON.stringify({ error: 'Failed to decrypt NAV credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credentials: NavCredentials = decryptedCreds;
    console.log('[NAV-QUERY-OUTBOUND] Credentials retrieved');

    // Use production endpoint only
    const endpoint = 'https://api.onlineszamla.nav.gov.hu/invoiceService/v3/queryInvoiceDigest';

    console.log('[NAV-QUERY-OUTBOUND] Using endpoint:', endpoint);

    // Fetch up to 3 pages
    const allInvoices: any[] = [];
    let currentPage = 1;
    let availablePage = 1;
    const maxPages = 3;

    while (currentPage <= maxPages && currentPage <= availablePage) {
      console.log(`[NAV-QUERY-OUTBOUND] Fetching page ${currentPage}/${availablePage}`);

      const requestId = generateRequestId();
      const timestamp = new Date().toISOString();
      const timestampFormatted = timestamp.replace(/[-:]/g, '').split('.')[0] + 'Z';

      // Build password hash (SHA-512) - NAV v3 requires hashing password only
      const passwordHash = await sha512Hash(credentials.nav_password);

      // Build request signature (SHA3-512) using compact UTC timestamp yyyyMMddHHmmss
      const d = new Date(timestamp);
      const compactTimestamp = d.getUTCFullYear().toString()
        + (d.getUTCMonth() + 1).toString().padStart(2, '0')
        + d.getUTCDate().toString().padStart(2, '0')
        + d.getUTCHours().toString().padStart(2, '0')
        + d.getUTCMinutes().toString().padStart(2, '0')
        + d.getUTCSeconds().toString().padStart(2, '0');
      const signatureInput = requestId + compactTimestamp + credentials.nav_sign_key;
      const encoder = new TextEncoder();
      const data = encoder.encode(signatureInput);
      const hash = sha3_512(data);
      const requestSignature = Array.from(hash)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

      // Build XML request
      const xmlBody = buildQueryXML({
        requestId,
        timestamp,
        credentials,
        passwordHash,
        requestSignature,
        page: currentPage,
        dateFrom,
        dateTo,
        additionalFilters,
        invoiceDirection
      });

      // Mask sensitive data in XML for logging
      const maskedXmlBody = xmlBody
        .replace(/<common:passwordHash[^>]*>.*?<\/common:passwordHash>/g, '<common:passwordHash>***MASKED***</common:passwordHash>')
        .replace(/<common:requestSignature[^>]*>.*?<\/common:requestSignature>/g, '<common:requestSignature>***MASKED***</common:requestSignature>');

      console.log('[NAV-QUERY-OUTBOUND] ========== QUERY REQUEST START ==========');
      console.log('[NAV-QUERY-OUTBOUND] Request ID:', requestId);
      console.log('[NAV-QUERY-OUTBOUND] Page:', currentPage);
      console.log('[NAV-QUERY-OUTBOUND] Date Range:', { dateFrom, dateTo });
      console.log('[NAV-QUERY-OUTBOUND] XML Request (sensitive data masked):');
      console.log(maskedXmlBody);
      console.log('[NAV-QUERY-OUTBOUND] ========== QUERY REQUEST END ==========');

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml; charset=UTF-8',
          'Accept': 'application/xml'
        },
        body: xmlBody
      });

      const responseText = await response.text();
      
      console.log('[NAV-QUERY-OUTBOUND] ========== QUERY RESPONSE START ==========');
      console.log('[NAV-QUERY-OUTBOUND] Request ID:', requestId);
      console.log('[NAV-QUERY-OUTBOUND] Page:', currentPage);
      console.log('[NAV-QUERY-OUTBOUND] HTTP Status:', response.status);
      console.log('[NAV-QUERY-OUTBOUND] XML Response:');
      console.log(responseText);
      console.log('[NAV-QUERY-OUTBOUND] ========== QUERY RESPONSE END ==========');

      if (!response.ok) {
        console.error('[NAV-QUERY-OUTBOUND] NAV API error:', responseText);
        const errorMsg = parseNAVError(responseText);
        
        // Update sync log with failure using service client
        if (syncLogId) {
          await serviceClient
            .from('nav_sync_logs')
            .update({
              status: 'failed',
              error_message: `NAV API request failed: ${errorMsg}`,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime
            })
            .eq('id', syncLogId);
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'NAV API request failed',
            details: errorMsg,
            page: currentPage
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse response
      const pageData = parseQueryResponse(responseText);
      
      if (pageData.funcCode !== 'OK') {
        console.error('[NAV-QUERY-OUTBOUND] NAV returned error:', pageData.errorMessage);
        
        // Update sync log with failure using service client
        if (syncLogId) {
          await serviceClient
            .from('nav_sync_logs')
            .update({
              status: 'failed',
              error_message: `NAV query failed: ${pageData.errorMessage}`,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime
            })
            .eq('id', syncLogId);
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'NAV query failed',
            details: pageData.errorMessage,
            page: currentPage
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update available pages
      availablePage = pageData.availablePage || 1;
      
      // Add invoices from this page
      if (pageData.invoices && pageData.invoices.length > 0) {
        allInvoices.push(...pageData.invoices);
        console.log(`[NAV-QUERY-OUTBOUND] Page ${currentPage}: ${pageData.invoices.length} invoices`);
      }

      currentPage++;
    }

    console.log(`[NAV-QUERY-OUTBOUND] Query complete. Total invoices: ${allInvoices.length}, Pages fetched: ${currentPage - 1}`);

    // Store invoices in database
    if (allInvoices.length > 0) {
      console.log('[NAV-QUERY-OUTBOUND] Storing invoices in database...');
      
      const invoicesToInsert = allInvoices.map(inv => ({
        user_id: user.id,
        company_id: companyId,
        invoice_number: inv.invoiceNumber,
        invoice_direction: invoiceDirection,
        supplier_tax_number: inv.supplierTaxNumber,
        customer_tax_number: inv.customerTaxNumber,
        invoice_issue_date: inv.invoiceIssueDate,
        invoice_delivery_date: null,
        invoice_net_amount: parseFloat(inv.invoiceNetAmount || '0'),
        invoice_vat_amount: parseFloat(inv.invoiceVatAmount || '0'),
        invoice_gross_amount: parseFloat(inv.invoiceNetAmount || '0') + parseFloat(inv.invoiceVatAmount || '0'),
        currency: inv.currency || 'HUF',
        payment_method: inv.paymentMethod,
        invoice_operation: inv.invoiceOperation,
        fetched_at: new Date().toISOString()
      }));

      const { error: insertError } = await serviceClient
        .from('nav_invoices')
        .upsert(invoicesToInsert, { 
          onConflict: 'invoice_number,user_id',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('[NAV-QUERY-OUTBOUND] Failed to store invoices:', insertError);
        
        // Update sync log with partial failure using service client
        if (syncLogId) {
          await serviceClient
            .from('nav_sync_logs')
            .update({
              status: 'failed',
              error_message: `Failed to store invoices: ${insertError.message}`,
              invoices_fetched: allInvoices.length,
              completed_at: new Date().toISOString(),
              duration_ms: Date.now() - startTime
            })
            .eq('id', syncLogId);
        }
        
        return new Response(
          JSON.stringify({ 
            error: 'Failed to store invoices',
            details: insertError.message
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[NAV-QUERY-OUTBOUND] Invoices stored successfully');
    }

    // Update sync log with success using service client
    if (syncLogId) {
      await serviceClient
        .from('nav_sync_logs')
        .update({
          status: 'completed',
          invoices_fetched: allInvoices.length,
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        })
        .eq('id', syncLogId);
    }

    console.log('[NAV-QUERY-OUTBOUND] Sync log updated');

    return new Response(
      JSON.stringify({
        success: true,
        invoices: allInvoices,
        totalInvoices: allInvoices.length,
        pagesFetched: currentPage - 1,
        totalPagesAvailable: availablePage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[NAV-QUERY-OUTBOUND] Unexpected error:', error);
    
    // Try to update sync log with error if we have a sync log ID
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const authHeader = req.headers.get('Authorization');
      
      if (authHeader) {
        const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: authHeader } }
        });
        const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
        
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await userClient.auth.getUser(token);
        
        if (user) {
          // Find the most recent running log for this user
          const { data: runningLogs } = await serviceClient
            .from('nav_sync_logs')
            .select('id')
            .eq('user_id', user.id)
            .eq('status', 'running')
            .order('started_at', { ascending: false })
            .limit(1);
          
          if (runningLogs && runningLogs.length > 0) {
            await serviceClient
              .from('nav_sync_logs')
              .update({
                status: 'failed',
                error_message: `Unexpected error: ${error.message}`,
                completed_at: new Date().toISOString()
              })
              .eq('id', runningLogs[0].id);
          }
        }
      }
    } catch (logError) {
      console.error('[NAV-QUERY-OUTBOUND] Failed to update error log:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateRequestId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'RID';
  for (let i = 0; i < 27; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function buildQueryXML(params: {
  requestId: string;
  timestamp: string;
  credentials: NavCredentials;
  passwordHash: string;
  requestSignature: string;
  page: number;
  dateFrom: string;
  dateTo: string;
  additionalFilters?: any;
  invoiceDirection: string;
}): string {
  const { requestId, timestamp, credentials, passwordHash, requestSignature, page, dateFrom, dateTo, additionalFilters, invoiceDirection } = params;

  let additionalParamsXML = '';
  if (additionalFilters) {
    additionalParamsXML = '<additionalQueryParams>';
    if (additionalFilters.currency) {
      additionalParamsXML += `<currency>${additionalFilters.currency}</currency>`;
    }
    if (additionalFilters.taxNumber) {
      additionalParamsXML += `<taxNumber>${additionalFilters.taxNumber}</taxNumber>`;
    }
    additionalParamsXML += '</additionalQueryParams>';
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<QueryInvoiceDigestRequest xmlns="http://schemas.nav.gov.hu/OSA/3.0/api" xmlns:common="http://schemas.nav.gov.hu/NTCA/1.0/common">
  <common:header>
    <common:requestId>${requestId}</common:requestId>
    <common:timestamp>${timestamp}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion>
    <common:headerVersion>1.0</common:headerVersion>
  </common:header>
  <common:user>
    <common:login>${credentials.nav_username}</common:login>
    <common:passwordHash cryptoType="SHA-512">${passwordHash}</common:passwordHash>
    <common:taxNumber>${credentials.nav_tax_number}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">${requestSignature}</common:requestSignature>
  </common:user>
  <software>
    <softwareId>${credentials.software_id}</softwareId>
    <softwareName>Visibill</softwareName>
    <softwareOperation>ONLINE_SERVICE</softwareOperation>
    <softwareMainVersion>1.0</softwareMainVersion>
    <softwareDevName>${credentials.software_dev_name || 'Visibill'}</softwareDevName>
    <softwareDevContact>${credentials.software_dev_contact || 'support@visibill.hu'}</softwareDevContact>
  </software>
  <page>${page}</page>
  <invoiceDirection>${invoiceDirection}</invoiceDirection>
  <invoiceQueryParams>
    <mandatoryQueryParams>
      <invoiceIssueDate>
        <dateFrom>${dateFrom}</dateFrom>
        <dateTo>${dateTo}</dateTo>
      </invoiceIssueDate>
    </mandatoryQueryParams>
    ${additionalParamsXML}
  </invoiceQueryParams>
</QueryInvoiceDigestRequest>`;
}

function parseQueryResponse(xml: string): any {
  const funcCodeMatch = xml.match(/<(?:\w+:)?funcCode>([^<]+)<\/(?:\w+:)?funcCode>/);
  const funcCode = funcCodeMatch ? funcCodeMatch[1] : null;

  if (funcCode !== 'OK') {
    const errorMessage = parseNAVError(xml);
    return { funcCode, errorMessage };
  }

  const currentPageMatch = xml.match(/<(?:\w+:)?currentPage>(\d+)<\/(?:\w+:)?currentPage>/);
  const availablePageMatch = xml.match(/<(?:\w+:)?availablePage>(\d+)<\/(?:\w+:)?availablePage>/);

  const currentPage = currentPageMatch ? parseInt(currentPageMatch[1]) : 1;
  const availablePage = availablePageMatch ? parseInt(availablePageMatch[1]) : 1;

  const invoices: any[] = [];
  const invoiceDigestRegex = /<(?:\w+:)?invoiceDigest>([\s\S]*?)<\/(?:\w+:)?invoiceDigest>/g;
  let match;

  while ((match = invoiceDigestRegex.exec(xml)) !== null) {
    const digestXML = match[1];
    
    const invoice: any = {};
    
    const extractField = (fieldName: string) => {
      const regex = new RegExp(`<(?:\\w+:)?${fieldName}>([^<]*)<\\/(?:\\w+:)?${fieldName}>`);
      const match = digestXML.match(regex);
      return match ? match[1] : null;
    };

    invoice.invoiceNumber = extractField('invoiceNumber');
    invoice.invoiceOperation = extractField('invoiceOperation');
    invoice.invoiceCategory = extractField('invoiceCategory');
    invoice.invoiceIssueDate = extractField('invoiceIssueDate');
    invoice.supplierTaxNumber = extractField('supplierTaxNumber');
    invoice.customerTaxNumber = extractField('customerTaxNumber');
    invoice.customerName = extractField('customerName');
    invoice.paymentMethod = extractField('paymentMethod');
    invoice.invoiceAppearance = extractField('invoiceAppearance');
    invoice.currency = extractField('currency');
    invoice.invoiceNetAmount = extractField('invoiceNetAmount');
    invoice.invoiceNetAmountHUF = extractField('invoiceNetAmountHUF');
    invoice.invoiceVatAmount = extractField('invoiceVatAmount');
    invoice.invoiceVatAmountHUF = extractField('invoiceVatAmountHUF');
    invoice.transactionId = extractField('transactionId');
    invoice.index = extractField('index');
    invoice.insDate = extractField('insDate');

    invoices.push(invoice);
  }

  return {
    funcCode,
    currentPage,
    availablePage,
    invoices
  };
}

function parseNAVError(xml: string): string {
  const errorCodeMatch = xml.match(/<errorCode>([^<]+)<\/errorCode>/);
  const messageMatch = xml.match(/<message>([^<]+)<\/message>/);
  
  if (errorCodeMatch || messageMatch) {
    const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'UNKNOWN';
    const message = messageMatch ? messageMatch[1] : 'No error message';
    return `${errorCode}: ${message}`;
  }
  
  return 'Unknown NAV API error';
}

// Helper function to compute SHA-512
async function sha512Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
